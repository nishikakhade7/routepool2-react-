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

// ── Vehicle records (one per driver/auto) ────────────────────────────────────
// Seeded from config/drivers.js. Document expiries are spread around today so
// the eligibility gate is visible in a demo: two autos are off the road.
const { DEMO_DRIVERS } = require('../config/drivers');

const dayMs = 86400000;
const inDays = (n) => new Date(Date.now() + n * dayMs);
// Deterministic per-plate offsets: same seed every reset, no random demo data.
const DOC_OFFSETS = [
  { permit: 300, insurance: 210, puc: 120, fitness: 400, service: -40, km: 1200 },
  { permit: 180, insurance: 10, puc: 95, fitness: 260, service: -90, km: 2400 },   // insurance expiring soon
  { permit: 240, insurance: 150, puc: -5, fitness: 310, service: -20, km: 800 },   // PUC EXPIRED -> no new rides
  { permit: 90, insurance: 120, puc: 40, fitness: 150, service: -200, km: 3400 },  // service overdue by date + km
  { permit: -12, insurance: 200, puc: 160, fitness: 220, service: -60, km: 1500 }, // permit EXPIRED -> no new rides
  { permit: 365, insurance: 280, puc: 190, fitness: 420, service: -15, km: 450 },
  { permit: 200, insurance: 95, puc: 75, fitness: 330, service: -70, km: 1900 },
];

const VEHICLES = DEMO_DRIVERS.map((d, i) => {
  const o = DOC_OFFSETS[i % DOC_OFFSETS.length];
  return {
    plate_number: d.plateNumber,
    registration_number: d.plateNumber.replace(/\s/g, ''),
    driver_name: d.name,
    gender: d.gender,
    rating: d.rating,
    vehicle: d.vehicle,
    permit_expiry: inDays(o.permit),
    insurance_expiry: inDays(o.insurance),
    puc_expiry: inDays(o.puc),
    fitness_expiry: inDays(o.fitness),
    documents_status: 'approved',            // admin-approved paperwork
    status: 'active',                        // or 'suspended'
    flagged_reason: null,                    // set when complaints pile up
    last_service_date: inDays(o.service),
    last_service_km: 0,
    km_driven: o.km,                         // accrues from rides that start
    created_at: new Date(),
  };
});

const db = {
  users: [...USERS],
  otpCodes: [],
  nodes: [],
  edges: [],
  groups: [...GROUPS],
  rideRequests: [...RIDE_REQUESTS],
  groupMembers: [...GROUP_MEMBERS],
  chatMessages: [...CHAT_MESSAGES],
  vehicles: [...VEHICLES],
  safetyReports: [],
  notices: [],
  adminActions: [],
  inspections: [],
  vehicleFeedback: [],
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
// A snapshot written before vehicles existed: seed them rather than crash later.
if (!db.vehicles?.length) db.vehicles = [...VEHICLES];
db.inspections = db.inspections || [];
db.safetyReports = db.safetyReports || [];
db.notices = db.notices || [];
db.adminActions = db.adminActions || [];
db.vehicleFeedback = db.vehicleFeedback || [];

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
// SIGUSR2 is how nodemon restarts the app on every file save - without it, work
// from the last couple of seconds (a student who just signed up) is lost.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGUSR2']) {
  process.once(sig, () => { try { saveNow(); } finally { process.exit(0); } });
}
process.on('exit', () => { try { saveNow(); } catch { /* best effort */ } });

// Each rider keeps one permanent code, shown only to them and handed to the
// driver at pickup. Not an OTP that rotates - it identifies the rider for life.
const newRiderCode = () => String(Math.floor(Math.random() * 1000000)).padStart(6, '0');

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
    const user = { id: uuidv4(), email, name, initials, branch, is_verified: true, total_rides: 0, total_savings: 0, rider_code: newRiderCode(), created_at: new Date() };
    db.users.push(user);
    return user;
  },
  // Older rows (and the seed) predate rider_code: fill it in once, then keep it forever.
  async ensureRiderCode(id) {
    const user = db.users.find(u => u.id === id);
    if (user && !user.rider_code) user.rider_code = newRiderCode();
    return user?.rider_code || null;
  },
  async setStatus(id, { suspended, reason }) {
    const user = db.users.find(u => u.id === id);
    if (user) Object.assign(user, { suspended_at: suspended ? new Date() : null, suspended_reason: suspended ? (reason || 'Suspended by admin') : null });
    return user || null;
  },
  async listAll() {
    return db.users;
  },
  async markVerified(id) {
    const user = db.users.find(u => u.id === id);
    if (user) user.is_verified = true;
    return user;
  },
  // Optional gender + pooling preferences (see utils/genderRules.js).
  async updatePreferences(id, { gender, womenOnlyGroups, driverPreference }) {
    const user = db.users.find(u => u.id === id);
    if (user) Object.assign(user, { gender, women_only_groups: womenOnlyGroups, driver_preference: driverPreference });
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
  async create({ pickupNodeId, departureTime, totalFare, kind = 'auto', womenOnly = false }, _client) {
    const g = { id: uuidv4(), pickup_node_id: pickupNodeId, departure_time: new Date(departureTime), total_fare: totalFare, status: 'forming', created_at: new Date() , kind, meeting_point: null, transit_mode: null, women_only: womenOnly };
    db.groups.push(g);
    return g;
  },
  async findById(id) {
    return db.groups.find(g => g.id === id) || null;
  },
  async setMeeting(id, { meetingPoint, transitMode }) {
    const g = db.groups.find(g => g.id === id);
    if (g) { g.meeting_point = meetingPoint; g.transit_mode = transitMode; }
    return g;
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
  // Admin pulled the auto off this ride: the next driver request picks another.
  async clearDriver(id) {
    const g = db.groups.find(g => g.id === id);
    if (g) g.driver = null;
    return g || null;
  },
  async setDriverIfAbsent(id, driver) {
    const g = db.groups.find(g => g.id === id);
    if (!g) return null;
    if (!g.driver) g.driver = driver;
    return g.driver;
  },
  // Groups that have a driver assigned (to tell which drivers are busy).
  async listWithDrivers() {
    return db.groups.filter(g => g.driver);
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
  async markBoarded(groupId, userId) {
    const m = db.groupMembers.find(m => m.group_id === groupId && m.user_id === userId);
    if (m) m.boarded_at = new Date();
    return m;
  },
  // Rider paid their share (no real gateway - this records that the payment step was completed).
  async markPaid(groupId, userId, method) {
    const m = db.groupMembers.find(m => m.group_id === groupId && m.user_id === userId);
    if (m) { m.paid_at = new Date(); m.payment_method = method; }
    return m;
  },
  async boardedMembershipsOf(userId) {
    return db.groupMembers.filter(m => m.user_id === userId && m.boarded_at);
  },
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
  // This member waived their "female driver" preference for this group.
  async setAllowAnyDriver(groupId, userId, allow) {
    const m = db.groupMembers.find(m => m.group_id === groupId && m.user_id === userId);
    if (m) m.allow_any_driver = allow;
    return m;
  },
};

// ── Admin models mock (safety reports, notices, audit trail) ─────────────────

const safetyReportModel = {
  async create(row) {
    const r = { id: uuidv4(), status: 'open', created_at: new Date(), resolved_at: null, resolved_by: null, resolution: null, ...row };
    db.safetyReports.push(r);
    return r;
  },
  async findById(id) {
    return db.safetyReports.find(r => r.id === id) || null;
  },
  async listAll() {
    return [...db.safetyReports].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  async resolve(id, { status, resolvedBy, resolution }) {
    const r = db.safetyReports.find(r => r.id === id);
    if (r) Object.assign(r, { status, resolved_by: resolvedBy, resolution: resolution || null, resolved_at: new Date() });
    return r || null;
  },
};

const noticeModel = {
  async create({ message, level, createdBy, expiresAt }) {
    const n = { id: uuidv4(), message, level, created_by: createdBy, expires_at: expiresAt || null, created_at: new Date() };
    db.notices.push(n);
    return n;
  },
  async listAll() {
    return [...db.notices].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  async remove(id) {
    const i = db.notices.findIndex(n => n.id === id);
    return i === -1 ? null : db.notices.splice(i, 1)[0];
  },
};

const adminActionModel = {
  async create({ adminEmail, action, target, details }) {
    const a = { id: uuidv4(), admin_email: adminEmail, action, target: target || null, details: details || null, created_at: new Date() };
    db.adminActions.push(a);
    return a;
  },
  async list(limit = 200) {
    return [...db.adminActions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
  },
};

// ── Vehicle models mock ──────────────────────────────────────────────────────

const vehicleModel = {
  async listAll() {
    return db.vehicles;
  },
  async findByPlate(plate) {
    return db.vehicles.find(v => v.plate_number === plate) || null;
  },
  async update(plate, patch) {
    const v = db.vehicles.find(v => v.plate_number === plate);
    if (v) Object.assign(v, patch);
    return v || null;
  },
  async addKm(plate, km) {
    const v = db.vehicles.find(v => v.plate_number === plate);
    if (v) v.km_driven = +(Number(v.km_driven || 0) + Number(km || 0)).toFixed(2);
    return v || null;
  },
};

const inspectionModel = {
  async create({ plateNumber, photos, submittedBy }) {
    const row = { id: uuidv4(), plate_number: plateNumber, photos, submitted_by: submittedBy, submitted_at: new Date(), status: 'pending', reviewed_at: null, reviewed_by: null, note: null };
    db.inspections.push(row);
    return row;
  },
  async findById(id) {
    return db.inspections.find(i => i.id === id) || null;
  },
  async review(id, { status, reviewedBy, note }) {
    const row = db.inspections.find(i => i.id === id);
    if (row) Object.assign(row, { status, reviewed_by: reviewedBy, note: note || null, reviewed_at: new Date() });
    return row || null;
  },
  async listByPlate(plate) {
    return db.inspections.filter(i => i.plate_number === plate).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  },
  async listPending() {
    return db.inspections.filter(i => i.status === 'pending');
  },
};

const vehicleFeedbackModel = {
  async create({ plateNumber, groupId, userId, cleanliness, condition, tags }) {
    const row = { id: uuidv4(), plate_number: plateNumber, group_id: groupId, user_id: userId, cleanliness, condition, tags, created_at: new Date() };
    db.vehicleFeedback.push(row);
    return row;
  },
  async listByPlate(plate) {
    return db.vehicleFeedback.filter(f => f.plate_number === plate);
  },
  async findByGroupAndUser(groupId, userId) {
    return db.vehicleFeedback.find(f => f.group_id === groupId && f.user_id === userId) || null;
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
  vehicleModel,
  inspectionModel,
  vehicleFeedbackModel,
  safetyReportModel,
  noticeModel,
  adminActionModel,
  withTransaction,
  // Expose raw in-memory tables so dashboard service can do JS-level joins
  _db: db,
  resetRides,
};

