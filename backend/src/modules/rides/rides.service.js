const nodeModel = require('../../models/node.model');
const routeEdgeModel = require('../../models/routeEdge.model');
const rideRequestModel = require('../../models/rideRequest.model');
const { dijkstra } = require('../../utils/dijkstra');
const { autoFareForDistance } = require('../../utils/fare');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');
const { MATCH_BUFFER_MINUTES } = require('../../config/matchingConfig');

async function listNodes() {
  return nodeModel.listAll();
}

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
async function createRequest(userId, { pickupNodeId, dropNodeId, pickupTime }) {
  if (pickupNodeId === dropNodeId) throw ApiError.badRequest('Pickup and drop node must differ');

  const pickupMs = new Date(pickupTime).getTime();
  if (isNaN(pickupMs)) throw ApiError.badRequest('Invalid pickupTime');

  const bufferMs = MATCH_BUFFER_MINUTES * 60000;
  const windowStart = new Date(pickupMs - bufferMs).toISOString();
  const windowEnd   = new Date(pickupMs + bufferMs).toISOString();
  const flexMinutes = 0;

  const [pickup, drop] = await Promise.all([nodeModel.findById(pickupNodeId), nodeModel.findById(dropNodeId)]);
  if (!pickup || !drop) throw ApiError.notFound('Pickup or drop node not found');

  const { distanceKm } = await distanceBetween(pickupNodeId, dropNodeId);
  const soloFare = +autoFareForDistance(distanceKm, env.autoTariff).toFixed(2);

  const request = await rideRequestModel.create({
    userId, pickupNodeId, dropNodeId, windowStart, windowEnd, flexMinutes,
    estimatedDistanceKm: distanceKm, soloFare,
  });

  return {
    id: request.id,
    pickup,
    drop,
    pickupTime: new Date(pickupMs).toISOString(),
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

module.exports = { listNodes, distanceBetween, createRequest };

