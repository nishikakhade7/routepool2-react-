const rideRequestModel = require('../../models/rideRequest.model');
const routeEdgeModel = require('../../models/routeEdge.model');
const nodeModel = require('../../models/node.model');
const userModel = require('../../models/user.model');
const { dijkstra } = require('../../utils/dijkstra');
const { buildCumulativePath, splitFareBySegments } = require('../../utils/fare');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');

// Scoring weights: how much of the match score comes from shared route
// overlap (graph distance shared with the target's path), pickup-time
// closeness, and how similarly "far" the two riders are going (compactness
// avoids pairing a 1km rider with a 10km rider even if the first km overlaps).
const WEIGHTS = { overlap: 0.5, time: 0.3, compactness: 0.2 };
const MIN_SCORE = 0.4;
const MAX_GROUP_SIZE = 4;
const PICKUP_PROXIMITY_METERS = 600;

function windowsOverlap(a, b) {
  const aStart = new Date(a.window_start).getTime() - a.flex_minutes * 60000;
  const aEnd = new Date(a.window_end).getTime() + a.flex_minutes * 60000;
  const bStart = new Date(b.window_start).getTime() - b.flex_minutes * 60000;
  const bEnd = new Date(b.window_end).getTime() + b.flex_minutes * 60000;
  return aStart <= bEnd && bStart <= aEnd;
}

function timeScore(a, b) {
  const aMid = (new Date(a.window_start).getTime() + new Date(a.window_end).getTime()) / 2;
  const bMid = (new Date(b.window_start).getTime() + new Date(b.window_end).getTime()) / 2;
  const diffMinutes = Math.abs(aMid - bMid) / 60000;
  const maxFlex = Math.max(a.flex_minutes, b.flex_minutes, 1);
  return Math.max(0, 1 - diffMinutes / (maxFlex * 3));
}

// Both paths start at the same pickup node, so the shared route overlap is
// just their common leading sequence of nodes.
function sharedPrefixKm(pathA, pathB) {
  let i = 0;
  while (i < pathA.nodeIds.length && i < pathB.nodeIds.length && pathA.nodeIds[i] === pathB.nodeIds[i]) i++;
  if (i === 0) return 0;
  const lastShared = pathA.nodeIds[i - 1];
  const stop = pathA.stops.find((s) => s.nodeId === lastShared);
  return stop ? stop.cumulativeKm : 0;
}

// True if `shorterPath`'s node sequence is a leading prefix of `longerPath`'s
// - i.e. they run along the exact same road until `shorterPath` ends.
function pathContains(longerPath, shorterPath) {
  if (shorterPath.nodeIds.length > longerPath.nodeIds.length) return false;
  return shorterPath.nodeIds.every((id, i) => id === longerPath.nodeIds[i]);
}

async function findMatches(rideRequestId, userId) {
  const target = await rideRequestModel.findById(rideRequestId);
  if (!target || target.user_id !== userId) throw ApiError.notFound('Ride request not found');
  if (target.status !== 'open') throw ApiError.badRequest('This request is no longer open');

  const edges = await routeEdgeModel.listAll();
  const { pathTo } = dijkstra(edges, target.pickup_node_id);
  const targetPath = pathTo(target.drop_node_id);
  if (!targetPath) throw ApiError.badRequest('No known route from pickup to drop');
  targetPath.stops = buildCumulativePath(edges, targetPath.nodeIds);

  // PostGIS: widen the candidate pool to requests starting near (not just
  // exactly at) the target's pickup node.
  const nearbyPickupIds = await nodeModel.findNearbyIds(target.pickup_node_id, PICKUP_PROXIMITY_METERS);
  const candidates = await rideRequestModel.findOpenCandidates({
    pickupNodeIds: nearbyPickupIds,
    excludeUserId: userId,
    excludeRequestId: target.id,
  });

  const scored = [];
  for (const c of candidates) {
    if (!windowsOverlap(target, c)) continue;

    const cPath = pathTo(c.drop_node_id);
    if (!cPath) continue;
    cPath.stops = buildCumulativePath(edges, cPath.nodeIds);

    // A single shared auto can only serve one linear route, so a candidate
    // is only compatible if their route is entirely contained within the
    // target's route, or the target's route is entirely contained within
    // theirs - never if the two diverge onto different final branches.
    const compatible = pathContains(cPath, targetPath) || pathContains(targetPath, cPath);
    if (!compatible) continue;

    const overlapKm = sharedPrefixKm(targetPath, cPath);
    const longer = Math.max(targetPath.distanceKm, cPath.distanceKm) || 1;
    const overlapRatio = overlapKm / longer;

    const tScore = timeScore(target, c);
    const compactness = 1 - Math.abs(targetPath.distanceKm - cPath.distanceKm) / longer;
    const score = WEIGHTS.overlap * overlapRatio + WEIGHTS.time * tScore + WEIGHTS.compactness * compactness;
    if (score < MIN_SCORE) continue;

    scored.push({ request: c, path: cPath, score });
  }

  // Candidates riding a *shorter or equal* route than the target are, by the
  // containment check above, necessarily a prefix of the target's route -
  // they're compatible with every backbone below. Candidates riding further
  // than the target ("extensions") may still diverge from *each other* past
  // the target's drop point, so each maximal (non-dominated) extension gets
  // its own group, and shorter extensions already covered by a longer one
  // are folded in as ordinary partners rather than duplicated.
  const subPrefix = scored.filter((s) => s.path.distanceKm <= targetPath.distanceKm);
  const extensions = scored.filter((s) => s.path.distanceKm > targetPath.distanceKm);
  const maximalExtensions = extensions.filter((s) => (
    !extensions.some((other) => other !== s && other.path.distanceKm > s.path.distanceKm && pathContains(other.path, s.path))
  ));

  const memberSets = [];
  if (subPrefix.length > 0) {
    memberSets.push({ backbonePath: targetPath, partners: subPrefix });
  }
  for (const leaf of maximalExtensions) {
    const dominated = extensions.filter((e) => e !== leaf && pathContains(leaf.path, e.path));
    memberSets.push({ backbonePath: leaf.path, partners: [...subPrefix, ...dominated, leaf] });
  }

  const userIds = [...new Set([target.user_id, ...scored.map((s) => s.request.user_id)])];
  const usersById = new Map((await Promise.all(userIds.map((id) => userModel.findById(id)))).map((u) => [u.id, u]));
  const nodeCache = new Map();
  const nodeById = async (id) => {
    if (!nodeCache.has(id)) nodeCache.set(id, await nodeModel.findById(id));
    return nodeCache.get(id);
  };

  const groups = [];
  for (const { backbonePath, partners: allPartners } of memberSets) {
    const partners = [...allPartners].sort((a, b) => b.score - a.score).slice(0, MAX_GROUP_SIZE - 1);
    if (partners.length === 0) continue;

    const allMembers = [{ request: target, path: targetPath, score: 1 }, ...partners];

    const fareMembers = await Promise.all(allMembers.map(async (m) => ({
      userId: m.request.user_id,
      rideRequestId: m.request.id,
      dropCumulativeKm: m.path.distanceKm,
      dropNode: await nodeById(m.request.drop_node_id),
      user: usersById.get(m.request.user_id),
    })));

    const { totalFare, shares } = splitFareBySegments(backbonePath.stops, fareMembers, env.autoTariff);
    const departureTime = new Date(Math.max(...allMembers.map((m) => new Date(m.request.window_start).getTime())));

    groups.push({
      groupKey: allMembers.map((m) => m.request.id).sort().join(':'),
      score: +(partners.reduce((s, m) => s + m.score, 0) / partners.length).toFixed(3),
      departureTime: departureTime.toISOString(),
      totalFare,
      distanceKm: backbonePath.distanceKm,
      memberRideRequestIds: allMembers.map((m) => m.request.id),
      members: fareMembers.map((m) => ({
        userId: m.userId,
        rideRequestId: m.rideRequestId,
        name: m.user.name,
        initials: m.user.initials,
        branch: m.user.branch,
        isYou: m.userId === userId,
        dropNode: { id: m.dropNode.id, name: m.dropNode.name, shortName: m.dropNode.shortName },
        dropDistanceKm: m.dropCumulativeKm,
        fareShare: shares.get(m.userId),
        soloFare: Number(allMembers.find((am) => am.request.user_id === m.userId).request.solo_fare),
      })),
    });
  }

  groups.sort((a, b) => b.score - a.score);
  return groups;
}

module.exports = { findMatches };
