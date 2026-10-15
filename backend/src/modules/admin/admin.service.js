const store = require('../../db/mockStore');
const groupModel = require('../../models/group.model');
const groupMemberModel = require('../../models/groupMember.model');
const rideRequestModel = require('../../models/rideRequest.model');
const userModel = require('../../models/user.model');
const nodeModel = require('../../models/node.model');
const ApiError = require('../../utils/ApiError');
const { MATCH_BUFFER_MINUTES } = require('../../config/matchingConfig');

// These tables only exist in the mock store today (the Postgres path would need
// its own models). ponytail: thin wrappers, swap for real models with Prisma.
const { safetyReportModel, noticeModel, adminActionModel } = store;

const pickupTimeOf = (g) => new Date(new Date(g.departure_time).getTime() + MATCH_BUFFER_MINUTES * 60000);

// --- audit trail ---------------------------------------------------------
// Every admin action goes through here, so the panel can show who did what.
async function record(adminEmail, action, target, details) {
  return adminActionModel.create({ adminEmail, action, target, details });
}

async function auditLog(limit) {
  return (await adminActionModel.list(limit)).map((a) => ({
    id: a.id, admin: a.admin_email, action: a.action, target: a.target, details: a.details, at: new Date(a.created_at).toISOString(),
  }));
}

// --- live rides board ----------------------------------------------------
// Every group that hasn't departed yet (plus today's past ones), with who is
// riding, whether they boarded, and whether they paid.
async function rides({ includePast = false } = {}) {
  const groups = store._db.groups.filter((g) => g.status !== 'cancelled');
  const out = [];
  for (const g of groups) {
    const pickupAt = pickupTimeOf(g);
    const isPast = pickupAt.getTime() < Date.now();
    if (isPast && !includePast) continue;

    const members = await groupMemberModel.listByGroup(g.id);
    if (members.length === 0) continue;
    const pickup = await nodeModel.findById(g.pickup_node_id);
    const farthest = members.reduce((a, b) => (Number(b.estimated_distance_km) > Number(a.estimated_distance_km) ? b : a));

    out.push({
      id: g.id,
      kind: g.kind || 'auto',
      status: g.status,
      womenOnly: Boolean(g.women_only),
      pickupName: pickup?.name,
      dropName: farthest.drop_name,
      pickupTime: pickupAt.toISOString(),
      isPast,
      totalFare: Number(g.total_fare || 0),
      driver: g.driver ? { name: g.driver.name, plateNumber: g.driver.plateNumber } : null,
      members: members.map((m) => ({
        userId: m.user_id,
        name: m.name,
        dropName: m.drop_name,
        fareShare: Number(m.fare_share || 0),
        boarded: Boolean(m.boarded_at),
        paid: Boolean(m.paid_at),
      })),
    });
  }
  return out.sort((a, b) => new Date(a.pickupTime) - new Date(b.pickupTime));
}

// Call off a ride: the group is cancelled and every rider's request reopened as
// cancelled, so nobody is left thinking they have a seat.
async function cancelRide(groupId, adminEmail, reason) {
  const g = await groupModel.findById(groupId);
  if (!g) throw ApiError.notFound('Group not found');
  if (g.status === 'cancelled') throw ApiError.conflict('This ride is already cancelled');
  const members = await groupMemberModel.listByGroup(groupId);
  if (members.some((m) => m.boarded_at)) throw ApiError.conflict('Someone has already boarded this ride');

  for (const m of members) await rideRequestModel.cancel(m.ride_request_id);
  await groupModel.setStatus(groupId, 'cancelled');
  await record(adminEmail, 'ride.cancel', groupId, reason || null);
  return { cancelled: true, groupId, riders: members.length };
}

// Drop the assigned auto so the next driver request picks a different one
// (used when a vehicle is pulled off the road mid-booking).
async function unassignDriver(groupId, adminEmail, reason) {
  const g = await groupModel.findById(groupId);
  if (!g) throw ApiError.notFound('Group not found');
  if (!g.driver) throw ApiError.badRequest('No driver is assigned to this ride');
  const members = await groupMemberModel.listByGroup(groupId);
  if (members.some((m) => m.boarded_at)) throw ApiError.conflict('Someone has already boarded this ride');

  const previous = g.driver.plateNumber;
  await groupModel.clearDriver(groupId);
  await record(adminEmail, 'ride.unassign_driver', groupId, `${previous}${reason ? ` · ${reason}` : ''}`);
  return { groupId, previousPlate: previous };
}

// --- students ------------------------------------------------------------
async function students() {
  const users = await userModel.listAll();
  const memberships = store._db.groupMembers;
  const reports = await safetyReportModel.listAll();
  return users.map((u) => {
    const mine = memberships.filter((m) => m.user_id === u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      branch: u.branch,
      joinedOn: new Date(u.created_at).toISOString(),
      rides: mine.length,
      ridesBoarded: mine.filter((m) => m.boarded_at).length,
      unpaid: mine.filter((m) => m.boarded_at && !m.paid_at).length,
      reportsAgainst: reports.filter((r) => r.about_user_id === u.id).length,
      suspended: Boolean(u.suspended_at),
      suspendedReason: u.suspended_reason || null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

async function setStudentStatus(userId, { suspended, reason }, adminEmail) {
  const user = await userModel.findById(userId);
  if (!user) throw ApiError.notFound('Student not found');
  await userModel.setStatus(userId, { suspended, reason });
  await record(adminEmail, suspended ? 'student.suspend' : 'student.reinstate', user.email, reason || null);
  return (await students()).find((s) => s.id === userId);
}

// --- safety reports ------------------------------------------------------
async function fileReport({ reporterId, groupId, aboutUserId, aboutPlate, category, message }) {
  const reporter = await userModel.findById(reporterId);
  const about = aboutUserId ? await userModel.findById(aboutUserId) : null;
  if (aboutUserId && !about) throw ApiError.badRequest('That student was not found');
  return safetyReportModel.create({
    reporter_id: reporterId,
    reporter_name: reporter?.name,
    group_id: groupId,
    about_user_id: aboutUserId || null,
    about_user_name: about?.name || null,
    about_plate: aboutPlate || null,
    category,
    message,
  });
}

async function reports() {
  return (await safetyReportModel.listAll()).map((r) => ({
    id: r.id,
    status: r.status,
    category: r.category,
    message: r.message,
    reportedBy: r.reporter_name,
    aboutStudent: r.about_user_name,
    aboutStudentId: r.about_user_id,
    aboutPlate: r.about_plate,
    groupId: r.group_id,
    at: new Date(r.created_at).toISOString(),
    resolution: r.resolution,
    resolvedBy: r.resolved_by,
  }));
}

async function resolveReport(id, { status, resolution }, adminEmail) {
  const r = await safetyReportModel.findById(id);
  if (!r) throw ApiError.notFound('Report not found');
  if (r.status !== 'open') throw ApiError.conflict('This report was already closed');
  await safetyReportModel.resolve(id, { status, resolvedBy: adminEmail, resolution });
  await record(adminEmail, `report.${status}`, id, resolution || null);
  return (await reports()).find((x) => x.id === id);
}

// --- notices -------------------------------------------------------------
async function postNotice({ message, level, expiresAt }, adminEmail) {
  const notice = await noticeModel.create({ message, level: level || 'info', createdBy: adminEmail, expiresAt: expiresAt ? new Date(expiresAt) : null });
  await record(adminEmail, 'notice.post', notice.id, message);
  return notice;
}

async function removeNotice(id, adminEmail) {
  const gone = await noticeModel.remove(id);
  if (!gone) throw ApiError.notFound('Notice not found');
  await record(adminEmail, 'notice.remove', id, gone.message);
  return { removed: true, id };
}

// What students see: notices that haven't expired.
async function activeNotices() {
  const now = Date.now();
  return (await noticeModel.listAll())
    .filter((n) => !n.expires_at || new Date(n.expires_at).getTime() > now)
    .map((n) => ({ id: n.id, message: n.message, level: n.level, at: new Date(n.created_at).toISOString() }));
}

async function allNotices() {
  return (await noticeModel.listAll()).map((n) => ({
    id: n.id, message: n.message, level: n.level, by: n.created_by,
    at: new Date(n.created_at).toISOString(),
    expiresAt: n.expires_at ? new Date(n.expires_at).toISOString() : null,
  }));
}

module.exports = {
  record, auditLog,
  rides, cancelRide, unassignDriver,
  students, setStudentStatus,
  fileReport, reports, resolveReport,
  postNotice, removeNotice, activeNotices, allNotices,
};
