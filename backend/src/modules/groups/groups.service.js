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
const { MAX_GROUP_SIZE, MATCH_BUFFER_MINUTES, LEAVE_LOCK_MINUTES } = require('../../config/matchingConfig');
const nodeModel = require('../../models/node.model');
const ridesService = require('../rides/rides.service');
const { DEMO_DRIVERS, DRIVER_ETA_MINUTES } = require('../../config/drivers');

// Joins and leaves run one at a time: each reads the group, then writes it after
// several awaits, so two riders clicking "join" together could otherwise both
// take the last seat.
let groupWriteQueue = Promise.resolve();
function oneAtATime(fn) {
  return (...args) => {
    const run = groupWriteQueue.then(() => fn(...args));
    groupWriteQueue = run.catch(() => {});
    return run;
  };
}

// A rider can be in only one upcoming group at a time. Returns that group
// (other than `exceptGroupId`), or null. Groups whose pickup has passed don't count.
async function activeGroupOf(userId, exceptGroupId) {
  for (const id of new Set(await groupMemberModel.listGroupIdsByUser(userId))) {
    if (id === exceptGroupId) continue;
    const g = await groupModel.findById(id);
    if (g && g.status !== 'cancelled' && pickupTimeOf(g).getTime() >= Date.now() - MATCH_BUFFER_MINUTES * 60000) return g;
  }
  return null;
}

// The one "you're already in a group" message, used by every join path and by
// the Dashboard list (so a blocked Join shows the same text as a refused join).
function alreadyInGroupMessage(g) {
  const time = pickupTimeOf(g).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  // Covers both a pooled group and a solo ride (Book a ride books a group of one).
  return `You're already booked on a ride for ${time}. Leave or cancel it (Joined groups page) before booking another.`;
}

async function assertNoOtherActiveGroup(userId, exceptGroupId) {
  const other = await activeGroupOf(userId, exceptGroupId);
  if (other) throw ApiError.conflict(alreadyInGroupMessage(other));
}

// Joins (or creates) the group made up of exactly `memberRideRequestIds`.
// The caller must own `rideRequestId`, one of the ids in that set - this is
// how both the first rider (creating the group) and later riders (joining
// a group a groupmate already locked in) go through the same endpoint.
const join = oneAtATime(async (userId, { rideRequestId, memberRideRequestIds }) => {
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
      if (g?.status === 'confirmed') throw ApiError.conflict('This group just filled up - refresh the list and pick another, or start a new group');
      if (!g || g.status !== 'forming') throw ApiError.conflict('This group is no longer open');
      existingGroupId = g.id;
      const extraIds = (await groupMemberModel.listByGroup(g.id))
        .map((m) => m.ride_request_id)
        .filter((id) => !memberRideRequestIds.includes(id));
      requests.push(...await rideRequestModel.findByIds(extraIds));
    }
  }
  if (requests.length > MAX_GROUP_SIZE) throw ApiError.conflict('This group is full');
  const starts = requests.map((r) => new Date(r.window_start).getTime());
  if (Math.max(...starts) - Math.min(...starts) > MATCH_BUFFER_MINUTES * 60000) {
    throw ApiError.badRequest(`Pickup times in a group must be within ${MATCH_BUFFER_MINUTES} minutes of each other`);
  }
  for (const r of requests) {
    if (r.status === 'matched' && r.group_id === existingGroupId) continue; // already in this group
    if (r.user_id === userId) {
      await assertNoOtherActiveGroup(userId, existingGroupId);
    } else if (await activeGroupOf(r.user_id, existingGroupId)) {
      throw ApiError.conflict('One of the selected riders is already in another group');
    }
  }

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
});

// Group departure_time is the latest member's window_start (= pickup - buffer).
const pickupTimeOf = (g) => new Date(new Date(g.departure_time).getTime() + MATCH_BUFFER_MINUTES * 60000);
// The auto runs to the farthest member's drop.
const farthest = (members) => members.reduce((a, b) => (Number(b.estimated_distance_km) > Number(a.estimated_distance_km) ? b : a));

// Forming groups with a free seat and an upcoming pickup that the user isn't already in.
// Each carries joinBlockedReason when the one-active-group rule stops this user joining.
async function listAvailable(userId) {
  const out = [];
  // A row that can't be priced is logged and skipped, not allowed to 500 the whole list.
  const tryPush = async (label, build) => {
    try { out.push(await build()); } catch (e) { console.error(`[groups/available] skipped ${label}:`, e); }
  };
  // Only forming groups: joining goes through the Book page's search -> confirm
  // flow, which joins groups (a lone open request is a search, not a group).
  const mine = await activeGroupOf(userId);
  const joinBlockedReason = mine ? alreadyInGroupMessage(mine) : null;

  // Every live group the student could care about: the ones they can join, plus
  // the ones they are already in (flagged isMine). Hiding their own made the
  // shared list look per-user - "I see groups, my friend sees none".
  const groups = await groupModel.listForming();
  if (mine && !groups.some((g) => g.id === mine.id)) groups.push(mine);

  for (const g of groups) {
    const members = await groupMemberModel.listByGroup(g.id);
    if (members.length === 0 || pickupTimeOf(g) < new Date()) continue;
    const isMine = members.some((m) => m.user_id === userId);
    if (!isMine && (members.length >= MAX_GROUP_SIZE || g.status !== 'forming')) continue;
    await tryPush(`group ${g.id}`, async () => ({
      ...await describeGroup(g, members, userId, !isMine),
      isMine,
      joinBlockedReason: isMine ? null : joinBlockedReason,
    }));
  }
  return out.sort((a, b) => new Date(a.pickupTime) - new Date(b.pickupTime));
}

// Full price breakup for riders sharing one auto from `pickupNodeId`.
// riders: [{ userId, name, dropNodeId, dropName }]. Same segment split the join uses.
async function fareBreakup(pickupNodeId, riders, youUserId) {
  const t = env.autoTariff;
  const edges = await routeEdgeModel.listAll();
  const { pathTo } = dijkstra(edges, pickupNodeId);
  const withKm = riders.map((r) => {
    const path = pathTo(r.dropNodeId);
    if (!path) throw ApiError.badRequest(`No route from stop ${pickupNodeId} to stop ${r.dropNodeId} in the stop graph`);
    return { ...r, km: path.distanceKm };
  });
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
// Legacy direct join (the Dashboard now sends users through the Book flow);
// kept for API compatibility, with the same one-active-group rule up front.
async function joinById(userId, id) {
  await assertNoOtherActiveGroup(userId);
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

// Full view of a group for one of its members: riders, per-rider fare, price breakup.
// Same shape as a /rides/matches entry, so the booking screens render either.
async function getGroup(groupId, userId) {
  await assertMembership(groupId, userId);
  const g = await groupModel.findById(groupId);
  const members = await groupMemberModel.listByGroup(groupId);
  const pickup = await nodeModel.findById(g.pickup_node_id);
  const fare = await fareBreakup(g.pickup_node_id, ridersOf(members), userId);
  return {
    id: g.id,
    groupKey: g.id,
    status: g.status,
    departureTime: pickupTimeOf(g).toISOString(),
    totalFare: fare.totalFare,
    distanceKm: fare.distanceKm,
    seatsLeft: MAX_GROUP_SIZE - members.length,
    leaveLockedReason: leaveLockedReason(g),
    pickupNode: pickup ? { id: pickup.id, name: pickup.name, shortName: pickup.shortName } : null,
    memberRideRequestIds: members.map((m) => m.ride_request_id),
    fare,
    members: members.map((m, i) => ({
      userId: m.user_id,
      rideRequestId: m.ride_request_id,
      name: m.name,
      initials: m.initials,
      branch: m.branch,
      isYou: m.user_id === userId,
      dropNode: { id: m.drop_node_id, name: m.drop_name, shortName: m.drop_short },
      dropDistanceKm: fare.members[i].distanceKm,
      fareShare: fare.members[i].fareShare,
      soloFare: fare.members[i].soloFare,
    })),
  };
}

// "Can't make it": drop the rider (and their request), re-split the fare for
// whoever is left, and reopen the group if it had been full.
// Minutes until pickup, and whether the rider is still allowed to back out.
const minutesToPickup = (g) => (pickupTimeOf(g).getTime() - Date.now()) / 60000;
const leaveLockedReason = (g) => (minutesToPickup(g) <= LEAVE_LOCK_MINUTES
  ? `Pickup is in under ${LEAVE_LOCK_MINUTES} minutes — you're locked in. Message the group if something changed.`
  : null);

const leave = oneAtATime(async (groupId, userId) => {
  await assertMembership(groupId, userId);
  const g = await groupModel.findById(groupId);
  const locked = leaveLockedReason(g);
  if (locked) throw ApiError.conflict(locked);
  const mine = (await groupMemberModel.listByGroup(groupId)).find((m) => m.user_id === userId);
  await groupMemberModel.remove(groupId, userId);
  await rideRequestModel.cancel(mine.ride_request_id);

  const rest = await groupMemberModel.listByGroup(groupId);
  if (rest.length === 0) {
    await groupModel.setStatus(groupId, 'cancelled');
    return { left: true, groupId };
  }
  const fare = await fareBreakup(g.pickup_node_id, ridersOf(rest), null);
  for (const [i, m] of rest.entries()) {
    await groupMemberModel.add({ groupId, userId: m.user_id, rideRequestId: m.ride_request_id, dropNodeId: m.drop_node_id, fareShare: fare.members[i].fareShare });
  }
  await groupModel.updateTotalFare(groupId, fare.totalFare);
  if (g.status === 'confirmed') await groupModel.setStatus(groupId, 'forming');
  return { left: true, groupId };
});

// The group's driver: picked once (first member to confirm), stored on the group,
// and returned as-is to every member - so all browsers show the same driver/ETA.
async function getDriver(groupId, userId) {
  await assertMembership(groupId, userId);
  const g = await groupModel.findById(groupId);
  let driver = g.driver;
  if (!driver) {
    const pick = DEMO_DRIVERS[Math.floor(Math.random() * DEMO_DRIVERS.length)];
    const { min, max } = DRIVER_ETA_MINUTES;
    const etaMinutes = min + Math.floor(Math.random() * (max - min + 1));
    driver = await groupModel.setDriverIfAbsent(groupId, {
      ...pick,
      assignedAt: new Date().toISOString(),
      arrivesAt: new Date(Date.now() + etaMinutes * 60000).toISOString(),
    });
  }
  const msLeft = new Date(driver.arrivesAt).getTime() - Date.now();
  return {
    name: driver.name,
    rating: driver.rating,
    vehicle: driver.vehicle,
    plateNumber: driver.plateNumber,
    arrivesAt: new Date(driver.arrivesAt).toISOString(),
    etaMinutes: Math.max(0, Math.ceil(msLeft / 60000)),
  };
}

// "Book a ride" is a solo ride: one rider, their own auto, full fare. It is stored
// as a group of one closed straight away ('confirmed', never 'forming'), so matching
// and the available-groups list - which only ever look at open requests and forming
// groups - can never pool another student into it.
async function bookSolo(userId, body) {
  const request = await ridesService.createRequest(userId, body);
  const group = await join(userId, { rideRequestId: request.id, memberRideRequestIds: [request.id] });
  await groupModel.setStatus(group.id, 'confirmed');
  return { ...group, status: 'confirmed', solo: true };
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

module.exports = { join, bookSolo, listAvailable, listMine, joinById, getGroup, leave, getDriver, listChat, postChat, fareBreakup };
