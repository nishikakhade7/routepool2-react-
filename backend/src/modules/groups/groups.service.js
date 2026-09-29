// withTransaction is backed by Prisma.$transaction when USE_MOCK_DB=false,
// or by the mock store's no-op transaction when in mock mode.
const { withTransaction } = process.env.USE_MOCK_DB === 'true'
  ? require('../../db/mockStore')
  : require('../../config/db');
const groupModel = require('../../models/group.model');
const groupMemberModel = require('../../models/groupMember.model');
const rideRequestModel = require('../../models/rideRequest.model');
const userModel = require('../../models/user.model');
const chatMessageModel = require('../../models/chatMessage.model');
const routeEdgeModel = require('../../models/routeEdge.model');
const { dijkstra } = require('../../utils/dijkstra');
const { buildCumulativePath, splitFareBySegments, autoFareForDistance } = require('../../utils/fare');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');
const { MAX_GROUP_SIZE, MATCH_BUFFER_MINUTES } = require('../../config/matchingConfig');
const nodeModel = require('../../models/node.model');
const ridesService = require('../rides/rides.service');

// Joins (or creates) the group made up of exactly `memberRideRequestIds`.
// The caller must own `rideRequestId`, one of the ids in that set - this is
// how both the first rider (creating the group) and later riders (joining
// a group a groupmate already locked in) go through the same endpoint.
async function join(userId, { rideRequestId, memberRideRequestIds }) {
  if (!memberRideRequestIds.includes(rideRequestId)) {
    throw ApiError.badRequest('rideRequestId must be included in memberRideRequestIds');
  }

  const requests = await rideRequestModel.findByIds(memberRideRequestIds);
  if (requests.length !== memberRideRequestIds.length) {
    throw ApiError.badRequest('One or more ride requests not found');
  }

  const own = requests.find((r) => r.id === rideRequestId);
  if (!own || own.user_id !== userId) throw ApiError.forbidden('You do not own this ride request');
  if (own.status === 'matched') throw ApiError.conflict('This ride request has already been matched');

  const samePickup = requests.every((r) => r.pickup_node_id === own.pickup_node_id);
  if (!samePickup) throw ApiError.badRequest('All members must share the same pickup node');

  let existingGroupId = await groupModel.findByExactRideRequestSet(memberRideRequestIds);
  if (!existingGroupId) {
    // Members already in a group must all be in the same one, and it must still be
    // forming - then we join it (pulling in its other members) instead of creating one.
    const groupIds = [...new Set(requests.filter((r) => r.id !== rideRequestId && r.status === 'matched').map((r) => r.group_id))];
    if (groupIds.length > 1) throw ApiError.conflict('Selected riders are in different groups');
    if (groupIds.length === 1) {
      const g = await groupModel.findById(groupIds[0]);
      if (!g || g.status !== 'forming') throw ApiError.conflict('One of the selected riders has already joined a different group');
      existingGroupId = g.id;
      const extraIds = (await groupMemberModel.listByGroup(g.id))
        .map((m) => m.ride_request_id)
        .filter((id) => !memberRideRequestIds.includes(id));
      requests.push(...await rideRequestModel.findByIds(extraIds));
    }
  }
  if (requests.length > MAX_GROUP_SIZE) throw ApiError.conflict('This group is full');

  const edges = await routeEdgeModel.listAll();
  const { pathTo } = dijkstra(edges, own.pickup_node_id);

  const memberPaths = requests.map((r) => {
    const path = pathTo(r.drop_node_id);
    if (!path) throw ApiError.badRequest(`No known route for ride request ${r.id}`);
    path.stops = buildCumulativePath(edges, path.nodeIds);
    return { request: r, path };
  });

  const backbone = memberPaths.reduce((a, b) => (b.path.distanceKm > a.path.distanceKm ? b : a));

  // One shared auto can only serve a single linear route - reject a
  // composition where a member's drop isn't actually on the backbone route.
  for (const m of memberPaths) {
    const onBackbone = m.path.nodeIds.every((id, i) => id === backbone.path.nodeIds[i]);
    if (!onBackbone) {
      throw ApiError.badRequest(`Ride request ${m.request.id} is not on the same route as the rest of the group`);
    }
  }

  const fareMembers = memberPaths.map((m) => ({
    userId: m.request.user_id,
    dropCumulativeKm: m.path.distanceKm,
  }));
  const { totalFare, shares } = splitFareBySegments(backbone.path.stops, fareMembers, env.autoTariff);

  const groupId = await withTransaction(async (client) => {
    let gid = existingGroupId;
    if (!gid) {
      const departureTime = new Date(Math.max(...requests.map((r) => new Date(r.window_start).getTime())));
      const created = await groupModel.create({ pickupNodeId: own.pickup_node_id, departureTime, totalFare }, client);
      gid = created.id;
    } else {
      await groupModel.updateTotalFare(gid, totalFare, client);
    }

    for (const m of memberPaths) {
      await groupMemberModel.add({
        groupId: gid,
        userId: m.request.user_id,
        rideRequestId: m.request.id,
        dropNodeId: m.request.drop_node_id,
        fareShare: shares.get(m.request.user_id),
      }, client);
      await rideRequestModel.markMatched(m.request.id, gid, client);
      // Confirmed on a ride -> drop this rider's other pending requests.
      await rideRequestModel.cancelOpenForUser(m.request.user_id, client);
    }
    if (requests.length >= MAX_GROUP_SIZE) await groupModel.setStatus(gid, 'confirmed', client);

    return gid;
  });

  const group = await groupModel.findById(groupId);
  const members = await groupMemberModel.listByGroup(groupId);

  return {
    id: group.id,
    status: group.status,
    departureTime: group.departure_time,
    totalFare: Number(group.total_fare),
    members: members.map((m) => ({
      userId: m.user_id,
      name: m.name,
      initials: m.initials,
      branch: m.branch,
      dropName: m.drop_name,
      dropShort: m.drop_short,
      dropDistanceKm: Number(m.estimated_distance_km),
      fareShare: Number(m.fare_share),
      soloFare: Number(m.solo_fare),
      isYou: m.user_id === userId,
    })),
  };
}

// Group departure_time is the latest member's window_start (= pickup - buffer).
const pickupTimeOf = (g) => new Date(new Date(g.departure_time).getTime() + MATCH_BUFFER_MINUTES * 60000);
// The auto runs to the farthest member's drop.
const farthest = (members) => members.reduce((a, b) => (Number(b.estimated_distance_km) > Number(a.estimated_distance_km) ? b : a));

// Forming groups with a free seat and an upcoming pickup that the user isn't already in,
// plus other students' open requests nobody has grouped yet (joining one starts a group of 2).
async function listAvailable(userId) {
  const out = [];
  const bufferMs = MATCH_BUFFER_MINUTES * 60000;
  const nodeName = async (id) => (await nodeModel.findById(id))?.name;
  for (const r of await rideRequestModel.listOpenUngrouped()) {
    const pickupTime = new Date(new Date(r.window_start).getTime() + bufferMs);
    if (r.user_id === userId || pickupTime < new Date()) continue;
    const u = await userModel.findById(r.user_id);
    out.push({
      id: r.id,
      pickupName: await nodeName(r.pickup_node_id),
      dropName: await nodeName(r.drop_node_id),
      pickupTime: pickupTime.toISOString(),
      seatsLeft: MAX_GROUP_SIZE - 1,
      members: [{ name: u?.name, initials: u?.initials, dropName: await nodeName(r.drop_node_id) }],
      fare: await fareBreakup(r.pickup_node_id, [
        { userId: r.user_id, name: u?.name, dropNodeId: r.drop_node_id, dropName: await nodeName(r.drop_node_id) },
        { userId, name: 'You', dropNodeId: r.drop_node_id, dropName: await nodeName(r.drop_node_id) },
      ], userId),
    });
  }
  for (const g of await groupModel.listForming()) {
    const members = await groupMemberModel.listByGroup(g.id);
    if (members.length === 0 || members.length >= MAX_GROUP_SIZE) continue;
    if (members.some((m) => m.user_id === userId) || pickupTimeOf(g) < new Date()) continue;
    out.push(await describeGroup(g, members, userId, true));
  }
  return out.sort((a, b) => new Date(a.pickupTime) - new Date(b.pickupTime));
}

// Full price breakup for riders sharing one auto from `pickupNodeId`.
// riders: [{ userId, name, dropNodeId, dropName }]. Same segment split the join uses.
async function fareBreakup(pickupNodeId, riders, youUserId) {
  const t = env.autoTariff;
  const edges = await routeEdgeModel.listAll();
  const { pathTo } = dijkstra(edges, pickupNodeId);
  const withKm = riders.map((r) => ({ ...r, km: pathTo(r.dropNodeId)?.distanceKm ?? 0 }));
  const backbone = pathTo(withKm.reduce((a, b) => (b.km > a.km ? b : a)).dropNodeId);
  const stops = buildCumulativePath(edges, backbone.nodeIds);
  const { totalFare, shares } = splitFareBySegments(stops, withKm.map((r) => ({ userId: r.userId, dropCumulativeKm: r.km })), t);

  const km = backbone.distanceKm;
  const extraKm = Math.max(0, km - t.baseKm);
  const meter = t.baseFare + extraKm * t.perKmRate;
  const round = (n) => +n.toFixed(2);
  const members = withKm.map((r) => {
    const soloFare = round(autoFareForDistance(r.km, t));
    return { name: r.name, dropName: r.dropName, distanceKm: r.km, fareShare: shares.get(r.userId), soloFare, saved: round(soloFare - shares.get(r.userId)), isYou: r.userId === youUserId };
  });
  return {
    distanceKm: km,
    baseFare: t.baseFare,
    baseKm: t.baseKm,
    extraKm: round(extraKm),
    perKmRate: t.perKmRate,
    distanceCharge: round(extraKm * t.perKmRate),
    meterFare: round(meter),
    surgeMultiplier: t.surgeMultiplier,
    surgeCharge: round(meter * (t.surgeMultiplier - 1)),
    totalFare,
    members,
    you: members.find((m) => m.isYou) || null,
  };
}

const ridersOf = (members) => members.map((m) => ({ userId: m.user_id, name: m.name, dropNodeId: m.drop_node_id, dropName: m.drop_name }));

// `joinAs` = preview with the viewer added (riding to the group's farthest drop).
async function describeGroup(g, members, userId, joinAs = false) {
  const pickup = await nodeModel.findById(g.pickup_node_id);
  const far = farthest(members);
  const riders = ridersOf(members);
  if (joinAs) riders.push({ userId, name: 'You', dropNodeId: far.drop_node_id, dropName: far.drop_name });
  return {
    id: g.id,
    status: g.status,
    pickupName: pickup?.name,
    dropName: far.drop_name,
    pickupTime: pickupTimeOf(g).toISOString(),
    seatsLeft: MAX_GROUP_SIZE - members.length,
    members: members.map((m) => ({ name: m.name, initials: m.initials, dropName: m.drop_name })),
    fare: await fareBreakup(g.pickup_node_id, riders, userId),
  };
}

// Groups the user has joined, soonest first.
async function listMine(userId) {
  const out = [];
  for (const id of new Set(await groupMemberModel.listGroupIdsByUser(userId))) {
    const g = await groupModel.findById(id);
    if (g) out.push(await describeGroup(g, await groupMemberModel.listByGroup(id), userId));
  }
  return out.sort((a, b) => new Date(a.pickupTime) - new Date(b.pickupTime));
}

// Join a listed group (or a listed open request) directly: creates the user's request
// on its route and time, then joins through the normal path.
// ponytail: rider goes to the group's farthest drop; add a drop picker if riders need to get off earlier.
async function joinById(userId, id) {
  const g = await groupModel.findById(id);
  if (!g) {
    const other = await rideRequestModel.findById(id);
    if (!other || other.status !== 'open' || other.user_id === userId) throw ApiError.conflict('This request is no longer open');
    const req = await ridesService.createRequest(userId, {
      pickupNodeId: other.pickup_node_id,
      dropNodeId: other.drop_node_id,
      pickupTime: new Date(new Date(other.window_start).getTime() + MATCH_BUFFER_MINUTES * 60000).toISOString(),
    });
    return join(userId, { rideRequestId: req.id, memberRideRequestIds: [req.id, other.id] });
  }
  if (g.status !== 'forming') throw ApiError.conflict('This group is no longer open');
  const members = await groupMemberModel.listByGroup(g.id);
  const req = await ridesService.createRequest(userId, {
    pickupNodeId: g.pickup_node_id,
    dropNodeId: farthest(members).drop_node_id,
    pickupTime: pickupTimeOf(g).toISOString(),
  });
  return join(userId, { rideRequestId: req.id, memberRideRequestIds: [req.id, ...members.map((m) => m.ride_request_id)] });
}

async function assertMembership(groupId, userId) {
  const isMember = await groupMemberModel.isMember(groupId, userId);
  if (!isMember) throw ApiError.forbidden('You are not a member of this group');
}

async function listChat(groupId, userId) {
  await assertMembership(groupId, userId);
  const messages = await chatMessageModel.listByGroup(groupId);
  return messages.map((m) => ({
    id: m.id,
    message: m.message,
    createdAt: m.created_at,
    userId: m.user_id,
    name: m.name,
    initials: m.initials,
    isYou: m.user_id === userId,
  }));
}

async function postChat(groupId, userId, message) {
  await assertMembership(groupId, userId);
  const saved = await chatMessageModel.create({ groupId, userId, message });
  const user = await userModel.findById(userId);
  return {
    id: saved.id,
    message: saved.message,
    createdAt: saved.created_at,
    userId,
    name: user.name,
    initials: user.initials,
    isYou: true,
  };
}

module.exports = { join, listAvailable, listMine, joinById, listChat, postChat };
