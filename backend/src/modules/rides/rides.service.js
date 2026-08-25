const nodeModel = require('../../models/node.model');
const routeEdgeModel = require('../../models/routeEdge.model');
const rideRequestModel = require('../../models/rideRequest.model');
const { dijkstra } = require('../../utils/dijkstra');
const { autoFareForDistance } = require('../../utils/fare');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');

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

async function createRequest(userId, { pickupNodeId, dropNodeId, windowStart, windowEnd, flexMinutes }) {
  if (pickupNodeId === dropNodeId) throw ApiError.badRequest('Pickup and drop node must differ');
  if (new Date(windowEnd) <= new Date(windowStart)) throw ApiError.badRequest('windowEnd must be after windowStart');

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
    windowStart: request.window_start,
    windowEnd: request.window_end,
    flexMinutes: request.flex_minutes,
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
