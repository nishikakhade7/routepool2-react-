const { Router } = require('express');
const auth = require('../../middleware/auth');
const requireAdmin = require('../../middleware/requireAdmin');
const validate = require('../../middleware/validate');
const { cancelRideSchema, studentStatusSchema, fileReportSchema, resolveReportSchema, noticeSchema } = require('./admin.validation');
const controller = require('./admin.controller');

const router = Router();
router.use(auth);

// Students: notices they should see, and reporting something from a ride.
router.get('/notices/active', controller.activeNotices);
router.post('/reports/groups/:groupId', validate(fileReportSchema), controller.fileReport);

// Everything below is the admin panel.
router.use(requireAdmin);
router.get('/rides', controller.rides);
router.post('/rides/:groupId/cancel', validate(cancelRideSchema), controller.cancelRide);
router.post('/rides/:groupId/unassign-driver', validate(cancelRideSchema), controller.unassignDriver);
router.get('/students', controller.students);
router.patch('/students/:userId/status', validate(studentStatusSchema), controller.setStudentStatus);
router.get('/reports', controller.reports);
router.patch('/reports/:id', validate(resolveReportSchema), controller.resolveReport);
router.get('/notices', controller.notices);
router.post('/notices', validate(noticeSchema), controller.postNotice);
router.delete('/notices/:id', controller.removeNotice);
router.get('/audit', controller.auditLog);

module.exports = router;
