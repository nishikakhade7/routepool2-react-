/**
 * RoutePool In-Memory Mock Store
 * ==============================
 * A full, functional in-memory replacement for all PostgreSQL-backed models.
 * Pre-seeded with the same data as db/init.sql so the app works without
 * a running database (no Docker, no local Postgres required).
 *
 * Activate by setting USE_MOCK_DB=true in .env
 */

const { randomUUID: uuidv4 } = require('crypto');

// ── Seed data (mirrors db/init.sql) ──────────────────────────────────────────

const NODES = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'S.P.I.T Campus (Gate 2)', short_name: 'SPIT',       area: 'campus', lat: 19.1197, lng: 72.8468, shortName: 'SPIT' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Andheri East',            short_name: 'ANDHERI E',  area: 'city',   lat: 19.1150, lng: 72.8590, shortName: 'ANDHERI E' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Jogeshwari West',         short_name: 'JOG WEST',   area: 'city',   lat: 19.1360, lng: 72.8380, shortName: 'JOG WEST' },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Jogeshwari East',         short_name: 'JOG EAST',   area: 'city',   lat: 19.1360, lng: 72.8530, shortName: 'JOG EAST' },
  { id: '00000000-0000-0000-0000-000000000005', name: 'Marol Naka',              short_name: 'MAROL',      area: 'city',   lat: 19.1190, lng: 72.8790, shortName: 'MAROL' },
  { id: '00000000-0000-0000-0000-000000000006', name: 'Vile Parle',              short_name: 'VILE PARLE', area: 'city',   lat: 19.1000, lng: 72.8420, shortName: 'VILE PARLE' },
];

const EDGES = [
  { id: uuidv4(), nodeAId: '00000000-0000-0000-0000-000000000001', nodeBId: '00000000-0000-0000-0000-000000000002', distanceKm: 2.6 },
  { id: uuidv4(), nodeAId: '00000000-0000-0000-0000-000000000002', nodeBId: '00000000-0000-0000-0000-000000000005', distanceKm: 1.3 },
  { id: uuidv4(), nodeAId: '00000000-0000-0000-0000-000000000002', nodeBId: '00000000-0000-0000-0000-000000000003', distanceKm: 3.2 },
  { id: uuidv4(), nodeAId: '00000000-0000-0000-0000-000000000003', nodeBId: '00000000-0000-0000-0000-000000000004', distanceKm: 1.6 },
  { id: uuidv4(), nodeAId: '00000000-0000-0000-0000-000000000001', nodeBId: '00000000-0000-0000-0000-000000000006', distanceKm: 4.5 },
];

const USERS = [
  { id: '00000000-0000-0000-0000-000000000101', email: 'nishika.khade@spit.ac.in',    name: 'Nishika Khade',    initials: 'NK', branch: 'TE Computer Engineering', is_verified: true, total_rides: 3, total_savings: 2340.00, created_at: new Date() },
  { id: '00000000-0000-0000-0000-000000000102', email: 'rhea.menon@spit.ac.in',       name: 'Rhea Menon',       initials: 'RM', branch: 'TE Computer Engineering', is_verified: true, total_rides: 2, total_savings: 860.00,  created_at: new Date() },
  { id: '00000000-0000-0000-0000-000000000103', email: 'kabir.shetty@spit.ac.in',     name: 'Kabir Shetty',     initials: 'KS', branch: 'BE IT',                   is_verified: true, total_rides: 4, total_savings: 1510.00, created_at: new Date() },
  { id: '00000000-0000-0000-0000-000000000104', email: 'ananya.deshpande@spit.ac.in', name: 'Ananya Deshpande', initials: 'AD', branch: 'SE EXTC',                 is_verified: true, total_rides: 1, total_savings: 210.00,  created_at: new Date() },
];

const deptureTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2h
const wStart      = new Date(Date.now() + 2 * 60 * 60 * 1000);
const wEnd        = new Date(Date.now() + 2.5 * 60 * 60 * 1000);

const GROUPS = [
  { id: '00000000-0000-0000-0000-000000000201', pickup_node_id: '00000000-0000-0000-0000-000000000001', departure_time: deptureTime, total_fare: 159.84, status: 'confirmed', created_at: new Date() },
  { id: '00000000-0000-0000-0000-000000000999', pickup_node_id: '00000000-0000-0000-0000-000000000001', departure_time: new Date(), total_fare: 50, status: 'confirmed', created_at: new Date() },
];

const RIDE_REQUESTS = [
  { id: '00000000-0000-0000-0000-000000000301', user_id: '00000000-0000-0000-0000-000000000101', pickup_node_id: '00000000-0000-0000-0000-000000000001', drop_node_id: '00000000-0000-0000-0000-000000000004', window_start: wStart, window_end: wEnd, flex_minutes: 10, status: 'matched', estimated_distance_km: 7.4,  solo_fare: 159.84, group_id: '00000000-0000-0000-0000-000000000201', created_at: new Date() },
  { id: '00000000-0000-0000-0000-000000000302', user_id: '00000000-0000-0000-0000-000000000102', pickup_node_id: '00000000-0000-0000-0000-000000000001', drop_node_id: '00000000-0000-0000-0000-000000000002', window_start: wStart, window_end: wEnd, flex_minutes: 10, status: 'matched', estimated_distance_km: 2.6,  solo_fare: 56.16,  group_id: '00000000-0000-0000-0000-000000000201', created_at: new Date() },
  { id: '00000000-0000-0000-0000-000000000303', user_id: '00000000-0000-0000-0000-000000000103', pickup_node_id: '00000000-0000-0000-0000-000000000001', drop_node_id: '00000000-0000-0000-0000-000000000003', window_start: wStart, window_end: wEnd, flex_minutes: 10, status: 'matched', estimated_distance_km: 5.8,  solo_fare: 125.28, group_id: '00000000-0000-0000-0000-000000000201', created_at: new Date() },
  { id: '00000000-0000-0000-0000-000000000304', user_id: '00000000-0000-0000-0000-000000000104', pickup_node_id: '00000000-0000-0000-0000-000000000001', drop_node_id: '00000000-0000-0000-0000-000000000005', window_start: wStart, window_end: wEnd, flex_minutes: 10, status: 'open',    estimated_distance_km: 3.9,  solo_fare: 84.24,  group_id: null,                                       created_at: new Date() },
];

const GROUP_MEMBERS = [
  { id: uuidv4(), group_id: '00000000-0000-0000-0000-000000000201', user_id: '00000000-0000-0000-0000-000000000101', ride_request_id: '00000000-0000-0000-0000-000000000301', drop_node_id: '00000000-0000-0000-0000-000000000004', fare_share: 87.84, status: 'confirmed', joined_at: new Date() },
  { id: uuidv4(), group_id: '00000000-0000-0000-0000-000000000201', user_id: '00000000-0000-0000-0000-000000000102', ride_request_id: '00000000-0000-0000-0000-000000000302', drop_node_id: '00000000-0000-0000-0000-000000000002', fare_share: 18.72, status: 'confirmed', joined_at: new Date() },
  { id: uuidv4(), group_id: '00000000-0000-0000-0000-000000000201', user_id: '00000000-0000-0000-0000-000000000103', ride_request_id: '00000000-0000-0000-0000-000000000303', drop_node_id: '00000000-0000-0000-0000-000000000003', fare_share: 53.28, status: 'confirmed', joined_at: new Date() },
];

const CHAT_MESSAGES = [
  { id: uuidv4(), group_id: '00000000-0000-0000-0000-000000000201', user_id: '00000000-0000-0000-0000-000000000101', message: "Heyy, matched with you two for tonight's pool 🎉", created_at: new Date(Date.now() - 20 * 60000) },
  { id: uuidv4(), group_id: '00000000-0000-0000-0000-000000000201', user_id: '00000000-0000-0000-0000-000000000102', message: 'Perfect, see you at Gate 2!',                   created_at: new Date(Date.now() - 18 * 60000) },
  { id: uuidv4(), group_id: '00000000-0000-0000-0000-000000000201', user_id: '00000000-0000-0000-0000-000000000103', message: "I'll be 2 min late, hold the auto 🙏",            created_at: new Date(Date.now() - 12 * 60000) },
];

// Mutable in-memory tables (arrays are mutated in place)
const db = {
  users: [...USERS],
  otpCodes: [],
  nodes: [...NODES],
  edges: [...EDGES],
  groups: [...GROUPS],
  rideRequests: [...RIDE_REQUESTS],
  groupMembers: [...GROUP_MEMBERS],
  chatMessages: [...CHAT_MESSAGES],
};

// ── Helper ───────────────────────────────────────────────────────────────────

function nodeById(id) {
  return db.nodes.find(n => n.id === id) || null;
}

// ── OTP model mock ────────────────────────────────────────────────────────────

const otpModel = {
  async create({ email, codeHash, expiresAt }) {
    const rec = { id: uuidv4(), email, code_hash: codeHash, expires_at: expiresAt, consumed: false, created_at: new Date() };
    db.otpCodes.push(rec);
    return rec;
  },
  async findLatestActive(email) {
    const now = new Date();
    return db.otpCodes
      .filter(o => o.email === email && !o.consumed && new Date(o.expires_at) > now)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
  },
  async consume(id) {
    const rec = db.otpCodes.find(o => o.id === id);
    if (rec) rec.consumed = true;
  },
  async invalidateAllForEmail(email) {
    db.otpCodes.filter(o => o.email === email && !o.consumed).forEach(o => { o.consumed = true; });
  },
};

// ── User model mock ───────────────────────────────────────────────────────────

const userModel = {
  async findByEmail(email) {
    return db.users.find(u => u.email === email) || null;
  },
  async findById(id) {
    return db.users.find(u => u.id === id) || null;
  },
  async createVerified({ email, name, initials, branch }) {
    const user = { id: uuidv4(), email, name, initials, branch, is_verified: true, total_rides: 0, total_savings: 0, created_at: new Date() };
    db.users.push(user);
    return user;
  },
  async markVerified(id) {
    const user = db.users.find(u => u.id === id);
    if (user) user.is_verified = true;
    return user;
  },
};

// ── Node model mock ───────────────────────────────────────────────────────────

const nodeModel = {
  async listAll() {
    return db.nodes.map(n => ({ id: n.id, name: n.name, shortName: n.short_name, area: n.area, lat: n.lat, lng: n.lng }));
  },
  async findById(id) {
    const n = db.nodes.find(n => n.id === id);
    if (!n) return null;
    return { id: n.id, name: n.name, shortName: n.short_name, area: n.area, lat: n.lat, lng: n.lng };
  },
  // Simplification: treat all nodes within 600m as nearby; for mock data
  // only the same-node pickup will ever be used, so just return nodes whose
  // real geographic distance from the given node is ≤ radiusMeters.
  async findNearbyIds(nodeId, radiusMeters = 600) {
    const origin = db.nodes.find(n => n.id === nodeId);
    if (!origin) return [nodeId];
    const R = 6371000; // earth radius m
    const nearby = db.nodes
      .filter(n => {
        const dLat = (n.lat - origin.lat) * Math.PI / 180;
        const dLng = (n.lng - origin.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(origin.lat * Math.PI / 180) * Math.cos(n.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        const dist = 2 * R * Math.asin(Math.sqrt(a));
        return dist <= radiusMeters;
      })
      .map(n => n.id);
    return nearby.length > 0 ? nearby : [nodeId];
  },
};

// ── RouteEdge model mock ──────────────────────────────────────────────────────

const routeEdgeModel = {
  async listAll() {
    return db.edges.map(e => ({ nodeAId: e.nodeAId, nodeBId: e.nodeBId, distanceKm: e.distanceKm }));
  },
};

// ── RideRequest model mock ────────────────────────────────────────────────────

const rideRequestModel = {
  async create({ userId, pickupNodeId, dropNodeId, windowStart, windowEnd, flexMinutes, estimatedDistanceKm, soloFare }) {
    const rr = {
      id: uuidv4(),
      user_id: userId,
      pickup_node_id: pickupNodeId,
      drop_node_id: dropNodeId,
      window_start: new Date(windowStart),
      window_end: new Date(windowEnd),
      flex_minutes: flexMinutes,
      status: 'open',
      estimated_distance_km: estimatedDistanceKm,
      solo_fare: soloFare,
      group_id: null,
      created_at: new Date(),
    };
    db.rideRequests.push(rr);
    return rr;
  },
  async findById(id) {
    return db.rideRequests.find(r => r.id === id) || null;
  },
  async findByIds(ids) {
    return db.rideRequests.filter(r => ids.includes(r.id));
  },
  async findOpenCandidates({ pickupNodeIds, excludeUserId, excludeRequestId }) {
    return db.rideRequests.filter(r =>
      pickupNodeIds.includes(r.pickup_node_id) &&
      r.status === 'open' &&
      r.user_id !== excludeUserId &&
      r.id !== excludeRequestId
    );
  },
  async markMatched(id, groupId, _client) {
    const rr = db.rideRequests.find(r => r.id === id);
    if (rr) { rr.status = 'matched'; rr.group_id = groupId; }
    return rr;
  },
  async busyRoutes(limit = 5) {
    const openReqs = db.rideRequests.filter(r => r.status === 'open');
    const counts = {};
    for (const r of openReqs) {
      const key = `${r.pickup_node_id}|${r.drop_node_id}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => {
        const [pickupId, dropId] = key.split('|');
        const pn = nodeById(pickupId);
        const dn = nodeById(dropId);
        return { pickupName: pn?.name || '', dropName: dn?.name || '', dropShort: dn?.short_name || '', count };
      });
  },
};

// ── Group model mock ──────────────────────────────────────────────────────────

const groupModel = {
  async create({ pickupNodeId, departureTime, totalFare }, _client) {
    const g = { id: uuidv4(), pickup_node_id: pickupNodeId, departure_time: new Date(departureTime), total_fare: totalFare, status: 'forming', created_at: new Date() };
    db.groups.push(g);
    return g;
  },
  async findById(id) {
    return db.groups.find(g => g.id === id) || null;
  },
  async updateTotalFare(id, totalFare, _client) {
    const g = db.groups.find(g => g.id === id);
    if (g) g.total_fare = totalFare;
    return g;
  },
  async findByExactRideRequestSet(rideRequestIds) {
    const sorted = [...rideRequestIds].sort();
    // Find any group whose members' ride_request_ids exactly match sorted
    for (const g of db.groups) {
      const memberRrIds = db.groupMembers
        .filter(m => m.group_id === g.id)
        .map(m => m.ride_request_id)
        .sort();
      if (memberRrIds.length === sorted.length && memberRrIds.every((id, i) => id === sorted[i])) {
        return g.id;
      }
    }
    return null;
  },
};

// ── GroupMember model mock ────────────────────────────────────────────────────

const groupMemberModel = {
  async add({ groupId, userId, rideRequestId, dropNodeId, fareShare }, _client) {
    // upsert on (group_id, user_id)
    let m = db.groupMembers.find(m => m.group_id === groupId && m.user_id === userId);
    if (m) {
      m.fare_share = fareShare;
    } else {
      m = { id: uuidv4(), group_id: groupId, user_id: userId, ride_request_id: rideRequestId, drop_node_id: dropNodeId, fare_share: fareShare, status: 'confirmed', joined_at: new Date() };
      db.groupMembers.push(m);
    }
    return m;
  },
  async listByGroup(groupId) {
    return db.groupMembers
      .filter(m => m.group_id === groupId)
      .sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at))
      .map(m => {
        const u  = db.users.find(u => u.id === m.user_id) || {};
        const dn = nodeById(m.drop_node_id) || {};
        const rr = db.rideRequests.find(r => r.id === m.ride_request_id) || {};
        return {
          ...m,
          name: u.name,
          initials: u.initials,
          branch: u.branch,
          email: u.email,
          drop_name: dn.name,
          drop_short: dn.short_name,
          solo_fare: rr.solo_fare,
          estimated_distance_km: rr.estimated_distance_km,
        };
      });
  },
  async isMember(groupId, userId) {
    return db.groupMembers.some(m => m.group_id === groupId && m.user_id === userId);
  },
};

// ── ChatMessage model mock ────────────────────────────────────────────────────

const chatMessageModel = {
  async create({ groupId, userId, message }) {
    const msg = { id: uuidv4(), group_id: groupId, user_id: userId, message, created_at: new Date() };
    db.chatMessages.push(msg);
    return msg;
  },
  async listByGroup(groupId, { limit = 100 } = {}) {
    return db.chatMessages
      .filter(m => m.group_id === groupId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(0, limit)
      .map(m => {
        const u = db.users.find(u => u.id === m.user_id) || {};
        return { id: m.id, message: m.message, created_at: m.created_at, user_id: m.user_id, name: u.name, initials: u.initials };
      });
  },
};

// ── withTransaction mock (just runs the fn directly) ─────────────────────────

async function withTransaction(fn) {
  // Mock client: expose same query API as pool (unused in mock models but keeps signature)
  const mockClient = { query: async () => ({ rows: [] }) };
  return fn(mockClient);
}

module.exports = {
  otpModel,
  userModel,
  nodeModel,
  routeEdgeModel,
  rideRequestModel,
  groupModel,
  groupMemberModel,
  chatMessageModel,
  withTransaction,
  // Expose raw in-memory tables so dashboard service can do JS-level joins
  _db: db,
};

