const fs = require('fs');
const path = require('path');
const { randomInt } = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { driverModel, driverDocumentModel, driverTripModel } = require('../../models/driver.model');
const groupModel = require('../../models/group.model');
const groupMemberModel = require('../../models/groupMember.model');
const userModel = require('../../models/user.model');
const vehicleModel = require('../../models/vehicle.model');
const { vehicleFeedbackModel } = require('../../models/vehicle.model');
const groupsService = require('../groups/groups.service');
const { DEMO_DRIVERS, DRIVER_BUSY_AFTER_PICKUP_MINUTES } = require('../../config/drivers');
const {
  DRIVER_EMAIL_PATTERN, DEMO_DRIVER_ACCOUNTS, DRIVER_DEMO_OTP, DOCUMENT_TYPES, MAX_UPLOAD_BYTES, UPLOAD_TYPES, DRIVER_PAYOUT_SHARE,
} = require('../../config/driverPortal');
const { verificationOf } = require('./verification');

const UPLOAD_DIR = path.join(__dirname, '../../../uploads/drivers');
const round = (n) => Math.round(n * 100) / 100;

// --- sign-in -----------------------------------------------------------------

// The roster driver an address belongs to: priya.24@spit.ac.in -> Priya More.
// PLACEHOLDER: a real driver-verification process (licence/badge check by the
// RoutePool office) replaces this name match.
function rosterFor(email) {
  const demoPlate = DEMO_DRIVER_ACCOUNTS[email.toLowerCase()];
  if (demoPlate) {
    const auto = DEMO_DRIVERS.find((x) => x.plateNumber === demoPlate);
    const name = email.split('@')[0].replace(/\d+$/, '').split(/[._]/).filter(Boolean)
      .map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');
    return { ...auto, name };
  }
  if (!DRIVER_EMAIL_PATTERN.test(email)) {
    throw ApiError.badRequest('Driver emails look like name.YY@spit.ac.in, for example priya.24@spit.ac.in');
  }
  const first = email.split('.')[0].toLowerCase();
  const d = DEMO_DRIVERS.find((x) => x.name.split(' ')[0].toLowerCase() === first);
  if (!d) throw ApiError.notFound("We couldn't find a RoutePool driver with that name. Driver accounts are set up by the RoutePool office.");
  return d;
}

function assertDemoSignInAllowed() {
  if (env.nodeEnv === 'production') {
    throw new ApiError(503, "Driver sign-in isn't open yet. Please contact the RoutePool office.");
  }
}

async function sendOtp(email) {
  assertDemoSignInAllowed();
  rosterFor(email);
  // Driver addresses aren't real mailboxes yet, so nothing is emailed: the
  // fixed demo code is returned and the screen shows it, marked "Demo data".
  return { message: 'Use the demo code to sign in', demo: true, demoCode: DRIVER_DEMO_OTP };
}

// RP-DRV- plus 6 letters/digits. Generated once, checked against every existing ID.
async function newDriverCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    const code = 'RP-DRV-' + Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join('');
    if (!(await driverModel.findByCode(code))) return code;
  }
}

async function verifyOtp(email, code) {
  assertDemoSignInAllowed();
  const roster = rosterFor(email);
  if (String(code) !== DRIVER_DEMO_OTP) throw ApiError.badRequest('Incorrect verification code');

  let driver = await driverModel.findByEmail(email);
  if (!driver) {
    const other = await driverModel.findByPlate(roster.plateNumber);
    if (other) throw ApiError.conflict(`The auto ${roster.plateNumber} is already linked to another driver account (${other.email}).`);
    driver = await driverModel.create({
      email,
      driver_code: await newDriverCode(),
      name: roster.name,
      gender: roster.gender,
      plate_number: roster.plateNumber,
      vehicle_model: roster.vehicle,
      vehicle_colour: 'Yellow & black',
      seats: 3,
    });
  }
  const token = jwt.sign({ sub: driver.id, email: driver.email, role: 'driver' }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  return { token, user: publicDriver(driver) };
}

// --- profile -----------------------------------------------------------------

const initialsOf = (name) => name.split(' ').slice(0, 2).map((p) => p[0].toUpperCase()).join('');

const publicDriver = (d) => ({
  id: d.id,
  email: d.email,
  name: d.name,
  initials: initialsOf(d.name),
  role: 'driver',
  driverCode: d.driver_code,
  femaleDriver: d.gender === 'female',
});

async function getDriver(driverId) {
  const d = await driverModel.findById(driverId);
  if (!d) throw ApiError.unauthorized('Session expired, please sign in again');
  return d;
}

// Verification, and the automatic switch-off when it lapses: a driver whose
// documents aren't cleared is never left online.
async function verificationFor(d) {
  const verification = verificationOf(await driverDocumentModel.listByDriver(d.id));
  if (!verification.verified && d.online) await driverModel.update(d.id, { online: false });
  return verification;
}

async function ratingFor(d) {
  const roster = DEMO_DRIVERS.find((x) => x.plateNumber === d.plate_number);
  const feedback = await vehicleFeedbackModel.listByPlate(d.plate_number);
  const avg = (key) => {
    const xs = feedback.map((f) => f[key]).filter((n) => typeof n === 'number');
    return xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  };
  const completed = (await driverTripModel.listByDriver(d.id)).filter((t) => t.status === 'completed').length;
  return {
    average: roster?.rating ?? null,
    rides: completed,
    ratingsCount: feedback.length,
    cleanliness: avg('cleanliness'),
    condition: avg('condition'),
  };
}

async function me(driverId) {
  const d = await getDriver(driverId);
  const verification = await verificationFor(d);
  const vehicle = await vehicleModel.findByPlate(d.plate_number);
  const fresh = await driverModel.findById(d.id);
  return {
    ...publicDriver(fresh),
    online: Boolean(fresh.online),
    vehicle: {
      model: fresh.vehicle_model,
      plateNumber: fresh.plate_number,
      registrationNumber: vehicle?.registration_number || fresh.plate_number.replace(/\s/g, ''),
      colour: fresh.vehicle_colour,
      seats: fresh.seats,
    },
    verification,
    rating: await ratingFor(fresh),
  };
}

async function updateVehicle(driverId, { model, colour, seats }) {
  const d = await getDriver(driverId);
  await driverModel.update(d.id, { vehicle_model: model, vehicle_colour: colour, seats });
  return me(driverId);
}

async function setOnline(driverId, online) {
  const d = await getDriver(driverId);
  if (online) {
    const v = await verificationFor(d);
    if (!v.verified) throw ApiError.conflict(v.message || 'Your documents need to be verified before you can go online.');
  }
  await driverModel.update(d.id, { online });
  return me(driverId);
}

// --- rides -------------------------------------------------------------------

// A ride as the driver sees it: route, time, riders, fare and their payout.
async function describeRide(g, trip) {
  const members = await groupMemberModel.listByGroup(g.id);
  if (!members.length) return null;
  const ride = await groupsService.describeGroup(g, members, null);
  const totalFare = ride.fare.totalFare;
  const feedback = (await vehicleFeedbackModel.listByPlate(g.driver?.plateNumber || trip?.plate_number || ''))
    .filter((f) => f.group_id === g.id);
  const scores = feedback.flatMap((f) => [f.cleanliness, f.condition]).filter((n) => typeof n === 'number');
  return {
    groupId: g.id,
    pickupName: ride.pickupName,
    dropName: ride.dropName,
    drops: [...new Set(members.map((m) => m.drop_name))],
    pickupTime: ride.pickupTime,
    womenOnly: ride.womenOnly,
    riders: members.map((m) => ({ name: m.name, initials: m.initials, dropName: m.drop_name, boarded: Boolean(m.boarded_at) })),
    distanceKm: ride.fare.distanceKm,
    totalFare,
    payout: round(totalFare * DRIVER_PAYOUT_SHARE),
    status: trip?.status || 'offered',
    acceptedAt: trip?.accepted_at || null,
    completedAt: trip?.completed_at || null,
    riderRating: scores.length ? round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  };
}

const rideStillAhead = (g) => g.status !== 'cancelled'
  && groupsService.pickupTimeOf(g).getTime() + DRIVER_BUSY_AFTER_PICKUP_MINUTES * 60000 > Date.now();

// Rides assigned to this driver that they haven't accepted yet.
async function listOffers(driverId) {
  const d = await getDriver(driverId);
  const verification = await verificationFor(d);
  const trips = await driverTripModel.listByDriver(d.id);
  const answered = new Set(trips.map((t) => t.group_id));
  const groups = (await groupModel.listWithDrivers())
    .filter((g) => g.driver.plateNumber === d.plate_number && !answered.has(g.id) && rideStillAhead(g));
  const rides = (await Promise.all(groups.map((g) => describeRide(g, null)))).filter(Boolean)
    .sort((a, b) => new Date(a.pickupTime) - new Date(b.pickupTime));
  return { rides, verification };
}

async function assignedGroup(d, groupId) {
  const g = await groupModel.findById(groupId);
  if (!g || g.driver?.plateNumber !== d.plate_number) throw ApiError.notFound('This ride is no longer assigned to you');
  if (g.status === 'cancelled') throw ApiError.conflict('This ride was cancelled');
  return g;
}

async function accept(driverId, groupId) {
  const d = await getDriver(driverId);
  const verification = await verificationFor(d);
  if (!verification.verified) throw ApiError.conflict(verification.message);
  const g = await assignedGroup(d, groupId);
  // Women-only groups are only ever offered to female drivers; this is the backstop.
  if (g.women_only && d.gender !== 'female') throw ApiError.forbidden('Women-only rides go to female drivers only');
  const existing = await driverTripModel.find(groupId, d.id);
  if (existing) throw ApiError.conflict('You already answered this ride');
  await driverTripModel.upsert(groupId, d.id, d.plate_number, 'accepted');
  return trip(d, groupId);
}

// Declining hands the ride straight to another free driver (same rules as a
// booking), so the riders are never left without one if anyone is free.
async function decline(driverId, groupId) {
  const d = await getDriver(driverId);
  await assignedGroup(d, groupId);
  if (await driverTripModel.find(groupId, d.id)) throw ApiError.conflict('You already answered this ride');
  await driverTripModel.upsert(groupId, d.id, d.plate_number, 'declined');
  await groupModel.clearDriver(groupId);
  const [first] = await groupMemberModel.listByGroup(groupId);
  if (first) {
    try { await groupsService.getDriver(groupId, first.user_id); } catch { /* nobody free: riders see it on their next look */ }
  }
  return { declined: true };
}

async function trip(d, groupId) {
  const t = await driverTripModel.find(groupId, d.id);
  const g = await groupModel.findById(groupId);
  if (!t || t.status === 'declined' || !g) throw ApiError.notFound('Trip not found');
  return describeRide(g, t);
}

async function listTrips(driverId) {
  const d = await getDriver(driverId);
  const trips = (await driverTripModel.listByDriver(d.id)).filter((t) => t.status !== 'declined');
  const rows = (await Promise.all(trips.map(async (t) => {
    const g = await groupModel.findById(t.group_id);
    return g ? describeRide(g, t) : null; // group cleared by a dev reset
  }))).filter(Boolean);
  const upcoming = rows.filter((r) => r.status !== 'completed').sort((a, b) => new Date(a.pickupTime) - new Date(b.pickupTime));
  const completed = rows.filter((r) => r.status === 'completed').sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  const rated = completed.filter((r) => r.riderRating != null);
  return {
    upcoming,
    completed,
    summary: {
      completedTrips: completed.length,
      earned: round(completed.reduce((s, r) => s + r.payout, 0)),
      avgRating: rated.length ? round(rated.reduce((s, r) => s + r.riderRating, 0) / rated.length) : null,
    },
  };
}

async function tripStep(driverId, groupId, from, to) {
  const d = await getDriver(driverId);
  const t = await driverTripModel.find(groupId, d.id);
  if (!t || !from.includes(t.status)) throw ApiError.conflict('That step is not available for this trip right now');
  await driverTripModel.upsert(groupId, d.id, d.plate_number, to);
  return trip(d, groupId);
}

const headToPickup = (driverId, groupId) => tripStep(driverId, groupId, ['accepted'], 'heading');
const complete = (driverId, groupId) => tripStep(driverId, groupId, ['started'], 'completed');

// The rider reads out the 6-digit code from their profile; a match boards them
// (exactly as if they had boarded themselves) and starts the trip.
async function boardRider(driverId, groupId, code) {
  const d = await getDriver(driverId);
  const t = await driverTripModel.find(groupId, d.id);
  if (!t || !['accepted', 'heading', 'started'].includes(t.status)) throw ApiError.conflict('Accept the ride before verifying riders');
  const members = await groupMemberModel.listByGroup(groupId);
  let match = null;
  for (const m of members) {
    if ((await userModel.ensureRiderCode(m.user_id)) === String(code).trim()) match = m;
  }
  if (!match) throw ApiError.badRequest("That code doesn't match any rider in this group");
  if (match.boarded_at) throw ApiError.conflict(`${match.name} is already verified`);
  await groupsService.markBoarded(groupId, match.user_id);
  if (t.status !== 'started') await driverTripModel.upsert(groupId, d.id, d.plate_number, 'started');
  return { rider: match.name, trip: await trip(d, groupId) };
}

// --- documents ---------------------------------------------------------------

// Files are checked by their first bytes, not just the declared type.
const MAGIC = {
  'application/pdf': (b) => b.subarray(0, 4).toString('latin1') === '%PDF',
  'image/png': (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
};

async function uploadDocument(driverId, type, { buffer, mimeType, fileName }) {
  const d = await getDriver(driverId);
  if (!DOCUMENT_TYPES[type]) throw ApiError.badRequest('Unknown document type');
  if (!UPLOAD_TYPES[mimeType]) throw ApiError.badRequest('Upload a PDF, JPG or PNG file');
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw ApiError.badRequest('The file is empty');
  if (buffer.length > MAX_UPLOAD_BYTES) throw ApiError.badRequest('Files can be up to 5 MB');
  if (!MAGIC[mimeType](buffer)) throw ApiError.badRequest("That file doesn't look like a real PDF, JPG or PNG");

  const dir = path.join(UPLOAD_DIR, d.id);
  fs.mkdirSync(dir, { recursive: true });
  const storedName = `${type}-${Date.now()}.${UPLOAD_TYPES[mimeType]}`;
  fs.writeFileSync(path.join(dir, storedName), buffer);

  await driverDocumentModel.create({
    driver_id: d.id,
    type,
    file_name: String(fileName || storedName).slice(0, 120),
    stored_name: storedName,
    mime_type: mimeType,
    size_bytes: buffer.length,
  });
  return me(driverId);
}

// `driverId` limits it to the driver's own files; admins pass null.
async function documentFile(docId, driverId) {
  const doc = await driverDocumentModel.findById(docId);
  if (!doc || (driverId && doc.driver_id !== driverId)) throw ApiError.notFound('Document not found');
  const file = path.join(UPLOAD_DIR, doc.driver_id, doc.stored_name);
  if (!fs.existsSync(file)) throw ApiError.notFound('The file is no longer on the server');
  return { file, mimeType: doc.mime_type, fileName: doc.file_name };
}

// Dev only: show the "expires in N days" and "expired" states without waiting months.
async function ageDocuments(driverId, days) {
  const d = await getDriver(driverId);
  await driverDocumentModel.ageByDays(d.id, days);
  return me(driverId);
}

// --- admin -------------------------------------------------------------------

async function adminList() {
  const drivers = await Promise.all((await driverModel.listAll()).map(async (d) => {
    const verification = await verificationFor(d);
    return {
      id: d.id,
      name: d.name,
      email: d.email,
      driverCode: d.driver_code,
      vehicle: d.vehicle_model,
      plateNumber: d.plate_number,
      online: Boolean((await driverModel.findById(d.id)).online),
      verification,
    };
  }));
  return {
    drivers,
    summary: {
      total: drivers.length,
      reverification: drivers.filter((d) => d.verification.reverificationRequired).map((d) => d.name),
      pendingReviews: drivers.reduce((n, d) => n + d.verification.documents.filter((x) => x.current?.reviewStatus === 'pending').length, 0),
      expiringSoon: drivers.filter((d) => d.verification.reminder).map((d) => d.name),
    },
  };
}

async function reviewDocument(docId, { approve, note }, reviewedBy) {
  const doc = await driverDocumentModel.findById(docId);
  if (!doc) throw ApiError.notFound('Document not found');
  if (doc.status !== 'pending') throw ApiError.conflict('This document was already reviewed');
  return driverDocumentModel.review(docId, { status: approve ? 'verified' : 'rejected', reviewedBy, note });
}

module.exports = {
  sendOtp, verifyOtp, me, updateVehicle, setOnline,
  listOffers, accept, decline, listTrips, headToPickup, boardRider, complete,
  uploadDocument, documentFile, ageDocuments,
  adminList, reviewDocument,
};
