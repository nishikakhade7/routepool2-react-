const asyncHandler = require('../../utils/asyncHandler');
const service = require('./admin.service');
const groupsService = require('../groups/groups.service');

// --- admin panel ---------------------------------------------------------
const rides = asyncHandler(async (req, res) => res.json({ rides: await service.rides({ includePast: req.query.includePast === 'true' }) }));
const cancelRide = asyncHandler(async (req, res) => res.json(await service.cancelRide(req.params.groupId, req.user.email, req.body.reason)));
const unassignDriver = asyncHandler(async (req, res) => res.json(await service.unassignDriver(req.params.groupId, req.user.email, req.body.reason)));
const students = asyncHandler(async (req, res) => res.json({ students: await service.students() }));
const setStudentStatus = asyncHandler(async (req, res) => res.json(await service.setStudentStatus(req.params.userId, req.body, req.user.email)));
const reports = asyncHandler(async (req, res) => res.json({ reports: await service.reports() }));
const resolveReport = asyncHandler(async (req, res) => res.json(await service.resolveReport(req.params.id, req.body, req.user.email)));
const notices = asyncHandler(async (req, res) => res.json({ notices: await service.allNotices() }));
const postNotice = asyncHandler(async (req, res) => res.status(201).json(await service.postNotice(req.body, req.user.email)));
const removeNotice = asyncHandler(async (req, res) => res.json(await service.removeNotice(req.params.id, req.user.email)));
const auditLog = asyncHandler(async (req, res) => res.json({ actions: await service.auditLog(Number(req.query.limit) || 200) }));

// --- students ------------------------------------------------------------
// Report something that happened on a ride. Membership is checked first, so a
// student can only report a ride they were actually on.
const fileReport = asyncHandler(async (req, res) => {
  await groupsService.getGroup(req.params.groupId, req.user.id);
  res.status(201).json(await service.fileReport({
    reporterId: req.user.id,
    groupId: req.params.groupId,
    aboutUserId: req.body.aboutUserId,
    aboutPlate: req.body.aboutPlate,
    category: req.body.category,
    message: req.body.message,
  }));
});

const activeNotices = asyncHandler(async (req, res) => res.json({ notices: await service.activeNotices() }));

module.exports = {
  rides, cancelRide, unassignDriver, students, setStudentStatus,
  reports, resolveReport, notices, postNotice, removeNotice, auditLog,
  fileReport, activeNotices,
};
