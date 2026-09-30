const rideRequestModel = require('../../models/rideRequest.model');
const routeEdgeModel = require('../../models/routeEdge.model');
const nodeModel = require('../../models/node.model');
const userModel = require('../../models/user.model');
const groupModel = require('../../models/group.model');
const groupMemberModel = require('../../models/groupMember.model');
const { dijkstra } = require('../../utils/dijkstra');
const ApiError = require('../../utils/ApiError');
const {
  MATCH_BUFFER_MINUTES, MAX_GROUP_SIZE, MIN_ROUTE_OVERLAP, SCORE_WEIGHTS,
} = require('../../config/matchingConfig');

// Two riders are time-compatible if their requested pickup times are within
// MATCH_BUFFER_MINUTES of each other. Every request's window_start carries the
// same offset from its pickup time, so comparing window_starts is exact.
const minutesApart = (a, b) => Math.abs(new Date(a.window_start) - new Date(b.window_start)) / 60000;

// True if `shorter`'s stops are a leading prefix of `longer`'s - i.e. both ride
// the same road in the same direction until `shorter` gets off.
function pathContains(longer, shorter) {
  if (shorter.nodeIds.length > longer.nodeIds.length) return false;
  return shorter.nodeIds.every((id, i) => id === longer.nodeIds[i]);
}

// Km two routes from the same pickup share before they split (common leading stops).
function sharedKm(a, b, pathTo) {
  let i = 0;
  while (i < a.nodeIds.length && i < b.nodeIds.length && a.nodeIds[i] === b.nodeIds[i]) i++;
  return i > 1 ? pathTo(a.nodeIds[i - 1]).distanceKm : 0;
}

// ELIGIBILITY: shared km / the SHORTER route. A trip lying entirely inside the
// other one is 100% (Andheri -> Marol inside Andheri -> Ghatkopar), whichever of
// the two riders started the group.
function routeOverlap(a, b, pathTo) {
  const shorter = Math.min(a.distanceKm, b.distanceKm);
  return shorter > 0 ? sharedKm(a, b, pathTo) / shorter : 1;
}

// RANKING: shared km / the LONGER route. 1 only for identical routes, so among
// eligible groups the one going exactly where you're going ranks first.
function routeSimilarity(a, b, pathTo) {
  const longer = Math.max(a.distanceKm, b.distanceKm);
  return longer > 0 ? sharedKm(a, b, pathTo) / longer : 1;
}

/**
 * Every forming group this ride request could join, best first.
 *
 * A group is offered only if:
 *   - it starts at the same pickup stop and has a free seat (MAX_GROUP_SIZE),
 *   - every member's pickup time is within MATCH_BUFFER_MINUTES of this one,
 *   - this rider's route runs the same way as the group's, sharing at least
 *     MIN_ROUTE_OVERLAP of the shorter of the two routes (a trip fully inside
 *     the group's route = 100%).
 * Ranking uses route SIMILARITY (shared / longer route, averaged over the
 * members) ahead of time closeness (SCORE_WEIGHTS): an Azad Nagar -> Andheri
 * rider may join an Azad Nagar -> Ghatkopar group, but a group of Andheri-bound
 * riders is listed first, so same-route riders end up together.
 *
 * Each result includes the fare split as it would be with this rider added.
 */
// kind: only pool with groups of the same kind - an auto pool (Book a ride) and a
// public-transport group (Form a group) are different trips.
async function findMatches(rideRequestId, userId, kind = 'auto') {
  const target = await rideRequestModel.findById(rideRequestId);
  if (!target || target.user_id !== userId) throw ApiError.notFound('Ride request not found');
  if (target.status !== 'open') throw ApiError.badRequest('This request is no longer open');

  const edges = await routeEdgeModel.listAll();
  const { pathTo } = dijkstra(edges, target.pickup_node_id);
  const targetPath = pathTo(target.drop_node_id);
  if (!targetPath) throw ApiError.badRequest('No known route from pickup to drop');

  // Late require: groups.service requires rides.service, which this module sits beside.
  const { fareBreakup } = require('../groups/groups.service');

  const results = [];
  for (const g of await groupModel.listForming()) {
    if ((g.kind || 'auto') !== kind) continue;
    if (g.pickup_node_id !== target.pickup_node_id) continue;
    const members = await groupMemberModel.listByGroup(g.id);
    if (members.length === 0 || members.length >= MAX_GROUP_SIZE) continue;
    if (members.some((m) => m.user_id === userId)) continue;

    const requests = await rideRequestModel.findByIds(members.map((m) => m.ride_request_id));
    const maxGapMinutes = Math.max(...requests.map((r) => minutesApart(r, target)));
    if (maxGapMinutes > MATCH_BUFFER_MINUTES) continue;

    const memberPaths = requests.map((r) => pathTo(r.drop_node_id)).filter(Boolean);
    if (memberPaths.length !== requests.length) continue;
    const backbone = memberPaths.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));
    // Everyone must be able to ride one auto along a single line.
    if (!memberPaths.every((p) => pathContains(backbone, p))) continue;
    const overlap = routeOverlap(targetPath, backbone, pathTo);
    if (overlap < MIN_ROUTE_OVERLAP) continue;
    // join() still needs one auto on one line: the rider's trip must sit inside the
    // group's route or extend it (a route that branches off can't be served).
    if (!pathContains(backbone, targetPath) && !pathContains(targetPath, backbone)) continue;

    const similarity = memberPaths.reduce((t, p) => t + routeSimilarity(targetPath, p, pathTo), 0) / memberPaths.length;
    const timeScore = 1 - maxGapMinutes / MATCH_BUFFER_MINUTES;
    const score = SCORE_WEIGHTS.similarity * similarity + SCORE_WEIGHTS.time * timeScore;

    const me = await userModel.findById(userId);
    const myDrop = await nodeModel.findById(target.drop_node_id);
    const riders = [
      ...members.map((m) => ({ userId: m.user_id, name: m.name, dropNodeId: m.drop_node_id, dropName: m.drop_name })),
      { userId, name: me?.name, dropNodeId: target.drop_node_id, dropName: myDrop?.name },
    ];
    const fare = await fareBreakup(g.pickup_node_id, riders, userId);
    const pickupNode = await nodeModel.findById(g.pickup_node_id);
    const latestStart = Math.max(...[...requests, target].map((r) => new Date(r.window_start).getTime()));

    const memberRows = [
      ...members.map((m) => ({ userId: m.user_id, rideRequestId: m.ride_request_id, name: m.name, initials: m.initials, branch: m.branch, dropNodeId: m.drop_node_id, dropName: m.drop_name, dropShort: m.drop_short })),
      { userId, rideRequestId: target.id, name: me?.name, initials: me?.initials, branch: me?.branch, dropNodeId: target.drop_node_id, dropName: myDrop?.name, dropShort: myDrop?.shortName },
    ];

    results.push({
      id: g.id,
      groupKey: g.id,
      score: +score.toFixed(3),
      routeOverlap: +overlap.toFixed(2),
      routeSimilarity: +similarity.toFixed(2),
      departureTime: new Date(latestStart + MATCH_BUFFER_MINUTES * 60000).toISOString(),
      totalFare: fare.totalFare,
      distanceKm: fare.distanceKm,
      seatsLeft: MAX_GROUP_SIZE - memberRows.length,
      pickupNode: pickupNode ? { id: pickupNode.id, name: pickupNode.name, shortName: pickupNode.shortName } : null,
      memberRideRequestIds: memberRows.map((m) => m.rideRequestId),
      fare,
      members: memberRows.map((m, i) => ({
        userId: m.userId,
        rideRequestId: m.rideRequestId,
        name: m.name,
        initials: m.initials,
        branch: m.branch,
        isYou: m.userId === userId,
        dropNode: { id: m.dropNodeId, name: m.dropName, shortName: m.dropShort },
        dropDistanceKm: fare.members[i].distanceKm,
        fareShare: fare.members[i].fareShare,
        soloFare: fare.members[i].soloFare,
      })),
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

module.exports = { findMatches, routeOverlap, routeSimilarity, pathContains };
