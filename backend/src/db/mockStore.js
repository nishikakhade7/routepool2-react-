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

// Stops and road edges come from config/stopGraph.js (edit them there).
const { STOP_NODES, STOP_EDGES } = require('../config/stopGraph');

const USERS = [
  { id: '00000000-0000-0000-0000-000000000101', email: 'nishika.khade@spit.ac.in',    name: 'Nishika Khade',    initials: 'NK', branch: 'TE Computer Engineering', is_verified: true, total_rides: 3, total_savings: 2340.00, created_at: new Date() },
  { id: '00000000-0000-0000-0000-000000000102', email: 'rhea.menon@spit.ac.in',       name: 'Rhea Menon',       initials: 'RM', branch: 'TE Computer Engineering', is_verified: true, total_rides: 2, total_savings: 860.00,  created_at: new Date() },
  { id: '00000000-0000-0000-0000-000000000103', email: 'kabir.shetty@spit.ac.in',     name: 'Kabir Shetty',     initials: 'KS', branch: 'BE IT',                   is_verified: true, total_rides: 4, total_savings: 1510.00, created_at: new Date() },
  { id: '00000000-0000-0000-0000-000000000104', email: 'ananya.deshpande@spit.ac.in', name: 'Ananya Deshpande', initials: 'AD', branch: 'SE EXTC',                 is_verified: true, total_rides: 1, total_savings: 210.00,  created_at: new Date() },
];

// No seeded rides: every group/request is created by real students through the app.
const GROUPS = [];
const RIDE_REQUESTS = [];
const GROUP_MEMBERS = [];

// No seeded chat messages: a group's chat starts empty and only holds what members send.
const CHAT_MESSAGES = [];

// Mutable in-memory tables (arrays are mutated in place)
const db = {
  users: [...USERS],
  otpCodes: [],
  nodes: [],
  edges: [],
  groups: [...GROUPS],
  rideRequests: [...RIDE_REQUESTS],
  groupMembers: [...GROUP_MEMBERS],
  chatMessages: [...CHAT_MESSAGES],
};

// Persist to disk so a backend restart (nodemon on every file save) doesn't wipe
// users, requests and groups - which also logged everyone out. Delete the file to reseed.
// ponytail: snapshot every 2s, so the last <2s of writes can be lost on a hard kill.
const fs = require('fs');
const DB_FILE = process.env.MOCK_DB_FILE || require('path').join(__dirname, '../../.mockdb.json');
try {
  const isoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'), (k, v) => (typeof v === 'string' && isoDate.test(v) ? new Date(v) : v)));
} catch { /* no snapshot yet: start from seed data */ }
// Stops/edges always come from config, never from an old snapshot.
db.nodes = STOP_NODES.map((n) => ({ ...n }));
db.edges = STOP_EDGES.map((e) => ({ ...e }));

// Rows saved before the stop list changed can point at stops that no longer
// exist; with no route to price them they'd crash every screen that lists them.
// Retire them once at load (logged, so it's visible), instead of failing later.
{
  const known = new Set(db.nodes.map((n) => n.id));
  const staleGroups = new Set(db.groups.filter((g) => g.status !== 'cancelled' && !known.has(g.pickup_node_id)).map((g) => g.id));
  const staleReqs = db.rideRequests.filter((r) => r.status !== 'cancelled' && (!known.has(r.pickup_node_id) || !known.has(r.drop_node_id) || staleGroups.has(r.group_id)));
  for (const r of staleReqs) { if (r.group_id) staleGroups.add(r.group_id); r.status = 'cancelled'; }
  for (const g of db.groups) if (staleGroups.has(g.id)) g.status = 'cancelled';
  const before = db.groupMembers.length;
  db.groupMembers = db.groupMembers.filter((m) => !staleGroups.has(m.group_id));
  if (staleGroups.size || staleReqs.length) {
    console.warn(`[mockStore] retired ${staleGroups.size} group(s), ${staleReqs.length} request(s), ${before - db.groupMembers.length} membership(s) that referenced stops no longer in config/stopGraph.js`);
  }
}
setInterval(() => fs.writeFile(DB_FILE, JSON.stringify(db), () => {}), 2000).unref();
// Immediate save, for changes that must survive an instant restart (dev reset, shutdown).
const saveNow = () => fs.writeFileSync(DB_FILE, JSON.stringify(db));
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, () => { try { saveNow(); } finally { process.exit(0); } });
}

// ── Helper ───────────────────────────────────────────────────────────────────

function nodeById(id) {
  return db.nodes.find(n => n.id === id) || null;
}

const publicNode = (n) => ({ id: n.id, name: n.name, shortName: n.short_name, area: n.area, kmFromCampus: n.kmFromCampus, aliases: n.aliases, lat: n.lat, lng: n.lng });

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
    return db.nodes.map(publicNode);
  },
  async findById(id) {
    const n = db.nodes.find(n => n.id === id);
    return n ? publicNode(n) : null;
  },
  // Simplification: treat all nodes within 600m as nearby; for mock data
  // only the same-node pickup will ever be used, so just return nodes whose
  // real geographic distance from the given node is ≤ radiusMeters.
  async findNearbyIds(nodeId, radiusMeters = 600) {
    const origin = db.nodes.find(n => n.id === nodeId);
    if (!origin || origin.lat == null) return [nodeId]; // stop graph has no coordinates yet
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

// A request is "active" while it's open or in a forming/confirmed group and its
// pickup hasn't passed (window_end = pickup + buffer). Same rule as a user's
// active ride on the Dashboard.
const isActiveRequest = (r) => {
  if (new Date(r.window_end) < new Date()) return false;
  if (r.status === 'open') return true;
  const g = r.status === 'matched' && db.groups.find(g => g.id === r.group_id);
  return !!g && (g.status === 'forming' || g.status === 'confirmed');
};

// Open requests, plus members of groups still forming (not yet full) - i.e. joinable.
const isJoinable = (r) => r.status === 'open' || (r.status === 'matched' && db.groups.find(g => g.id === r.group_id)?.status === 'forming');

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
      isJoinable(r) &&
      r.user_id !== excludeUserId &&
      r.id !== excludeRequestId
    );
  },
  async listOpenUngrouped() {
    return db.rideRequests.filter(r => r.status === 'open' && !r.group_id);
  },
  async findActiveByUser(userId) {
    return db.rideRequests.filter(r => r.user_id === userId && (r.status === 'open' || r.status === 'matched'));
  },
  async cancelOpenForUser(userId, _client) {
    db.rideRequests.filter(r => r.user_id === userId && r.status === 'open').forEach(r => { r.status = 'cancelled'; });
  },
  async cancel(id) {
    const rr = db.rideRequests.find(r => r.id === id);
    if (rr) { rr.status = 'cancelled'; rr.group_id = null; }
    return rr;
  },
  async markMatched(id, groupId, _client) {
    const rr = db.rideRequests.find(r => r.id === id);
    if (rr) { rr.status = 'matched'; rr.group_id = groupId; }
    return rr;
  },
  async busyRoutes(limit = 5) {
    const openReqs = db.rideRequests.filter(isActiveRequest);
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
        return { pickupName: pn?.name || '', pickupShort: pn?.short_name || '', dropName: dn?.name || '', dropShort: dn?.short_name || '', count };
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
  async listForming() {
    return db.groups.filter(g => g.status === 'forming');
  },
  async setStatus(id, status, _client) {
    const g = db.groups.find(g => g.id === id);
    if (g) g.status = status;
    return g;
  },
  // First caller wins: a group's driver is decided once and never replaced.
  async setDriverIfAbsent(id, driver) {
    const g = db.groups.find(g => g.id === id);
    if (!g) return null;
    if (!g.driver) g.driver = driver;
    return g.driver;
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
  async listGroupIdsByUser(userId) {
    return db.groupMembers.filter(m => m.user_id === userId).map(m => m.group_id);
  },
  async remove(groupId, userId) {
    const i = db.groupMembers.findIndex(m => m.group_id === groupId && m.user_id === userId);
    return i >= 0 ? db.groupMembers.splice(i, 1)[0] : null;
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

// Dev reset: wipe all ride state (requests, groups + their drivers, members, chat)
// but keep users and OTPs, so everyone stays logged in. Arrays are emptied in
// place; the 2s snapshot then persists the empty state.
function resetRides() {
  const counts = {
    rideRequests: db.rideRequests.length,
    groups: db.groups.length,
    groupMembers: db.groupMembers.length,
    chatMessages: db.chatMessages.length,
  };
  for (const table of Object.keys(counts)) db[table].length = 0;
  saveNow(); // on disk right away, so stopping the server straight after can't bring rides back
  return counts;
}

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
  resetRides,
};

