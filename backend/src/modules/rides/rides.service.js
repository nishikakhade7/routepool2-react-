const nodeModel = require('../../models/node.model');
const routeEdgeModel = require('../../models/routeEdge.model');
const rideRequestModel = require('../../models/rideRequest.model');
const groupModel = require('../../models/group.model');
const groupMemberModel = require('../../models/groupMember.model');
const { dijkstra } = require('../../utils/dijkstra');
const { autoFareForDistance } = require('../../utils/fare');
const { matchStop } = require('../../utils/stopMatcher');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');
const { MATCH_BUFFER_MINUTES } = require('../../config/matchingConfig');

// The "already in a group for this ride" refusal, describing what the student is
// actually in: joined but unpaid, paid, or a public-transport group. Message only -
// the 10-minute same-ride rule itself is unchanged. details let the page link to it.
async function alreadyInGroupError(duplicate, userId) {
  const g = duplicate.group_id && await groupModel.findById(duplicate.group_id);
  if (!g) return ApiError.conflict('You already have a ride for this route and time');
  const me = (await groupMemberModel.listByGroup(g.id)).find((m) => m.user_id === userId);
  const [pickup, drop] = await Promise.all([nodeModel.findById(duplicate.pickup_node_id), nodeModel.findById(duplicate.drop_node_id)]);
  const time = new Date(new Date(g.departure_time).getTime() + MATCH_BUFFER_MINUTES * 60000)
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  const ride = `${time} ${pickup?.name} → ${drop?.name}`;
  const window = `(Pickup times within ${MATCH_BUFFER_MINUTES} minutes of it on the same route count as the same ride.)`;
  const paid = Boolean(me?.paid_at);
  const kind = g.kind || 'auto';
  let message;
  if (kind === 'transit') {
    message = `You're already in the ${ride} public-transport group — open it instead of starting a new search. ${window}`;
  } else if (paid) {
    const driver = g.driver ? ` with ${g.driver.name} (${g.driver.plateNumber})` : '';
    message = `You already paid for the ${ride} group${driver} — open it to see details. ${window}`;
  } else {
    message = `You're already in the ${ride} group — finish booking it instead of starting a new search. ${window}`;
  }
  return new ApiError(409, message, { code: 'ALREADY_IN_GROUP', groupId: g.id, paid, kind });
}

async function listNodes() {
  return nodeModel.listAll();
}

// Free text -> nearest stop id (400 listing the known stops if nothing is close).
async function resolveStopId(text, label) {
  const nodes = await nodeModel.listAll();
  const stop = matchStop(nodes, text);
  if (!stop) throw ApiError.badRequest(`Unknown ${label} "${text}". Try one of: ${nodes.map((n) => n.name).join(', ')}`);
  return stop.id;
}

// Shortest road distance between two stops (Dijkstra over the stop graph).
async function distanceBetween(pickupNodeId, dropNodeId) {
  const edges = await routeEdgeModel.listAll();
  const { pathTo } = dijkstra(edges, pickupNodeId);
  const result = pathTo(dropNodeId);
  if (!result) throw ApiError.badRequest('No known route between the selected nodes');
  return result;
}

/**
 * Create a new ride request.
 * Accepts a single `pickupTime` (ISO datetime) from the user.
 * Internally derives window_start / window_end (±MATCH_BUFFER_MINUTES) and
 * stores flexMinutes = 0 — matching is now handled entirely by the buffer
 * constant in matchingConfig.js.
 */
async function createRequest(userId, { pickupNodeId, dropNodeId, pickupText, dropText, pickupTime }) {
  pickupNodeId = pickupNodeId || await resolveStopId(pickupText, 'pickup');
  dropNodeId = dropNodeId || await resolveStopId(dropText, 'drop');
  if (pickupNodeId === dropNodeId) throw ApiError.badRequest('Pickup and drop resolve to the same stop - pick two different places');

  const pickupMs = new Date(pickupTime).getTime();
  if (isNaN(pickupMs)) throw ApiError.badRequest('Invalid pickupTime');
  // 1 min grace so "now" from the client isn't rejected by clock skew.
  if (pickupMs < Date.now() - 60000) throw ApiError.badRequest('Pickup time must be in the future');

  const bufferMs = MATCH_BUFFER_MINUTES * 60000;

  // Same pickup + drop within the matching buffer is the same ride, not a new request.
  // window_start = pickupTime - buffer, so compare on that.
  const duplicate = (await rideRequestModel.findActiveByUser(userId)).find((r) =>
    r.pickup_node_id === pickupNodeId && r.drop_node_id === dropNodeId &&
    Math.abs(new Date(r.window_start).getTime() + bufferMs - pickupMs) <= bufferMs);
  if (duplicate?.status === 'matched') throw await alreadyInGroupError(duplicate, userId);

  const windowStart = new Date(pickupMs - bufferMs).toISOString();
  const windowEnd   = new Date(pickupMs + bufferMs).toISOString();
  const flexMinutes = 0;

  const [pickup, drop] = await Promise.all([nodeModel.findById(pickupNodeId), nodeModel.findById(dropNodeId)]);
  if (!pickup || !drop) throw ApiError.notFound('Pickup or drop node not found');

  const { distanceKm } = await distanceBetween(pickupNodeId, dropNodeId);
  const soloFare = +autoFareForDistance(distanceKm, env.autoTariff).toFixed(2);

  const request = duplicate || await rideRequestModel.create({
    userId, pickupNodeId, dropNodeId, windowStart, windowEnd, flexMinutes,
    estimatedDistanceKm: distanceKm, soloFare,
  });

  return {
    id: request.id,
    pickup,
    drop,
    pickupTime: new Date(new Date(request.window_start).getTime() + bufferMs).toISOString(),
    windowStart: request.window_start,
    windowEnd: request.window_end,
    status: request.status,
    estimatedDistanceKm: Number(request.estimated_distance_km),
    soloFare: Number(request.solo_fare),
    pooledEstimate: {
      of2: +(soloFare / 2).toFixed(2),
      of3: +(soloFare / 3).toFixed(2),
      of4: +(soloFare / 4).toFixed(2),
    },
  };
}

module.exports = { listNodes, resolveStopId, distanceBetween, createRequest };

