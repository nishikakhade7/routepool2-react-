const { Router } = require('express');
const auth = require('../../middleware/auth');
const requireAdmin = require('../../middleware/requireAdmin');
const validate = require('../../middleware/validate');
const { feedbackSchema, inspectionSchema, reviewSchema, serviceSchema, documentsSchema, statusSchema } = require('./vehicles.validation');
const controller = require('./vehicles.controller');

const router = Router();
router.use(auth);

// Riders rate the auto they just rode in.
router.post('/groups/:groupId/feedback', validate(feedbackSchema), controller.addFeedback);

// Everything below is the admin panel.
router.use(requireAdmin);
router.get('/', controller.list);
router.get('/:plate', controller.get);
router.patch('/:plate/documents', validate(documentsSchema), controller.updateDocuments);
router.patch('/:plate/status', validate(statusSchema), controller.setStatus);
router.post('/:plate/service', validate(serviceSchema), controller.logService);
router.post('/:plate/inspections', validate(inspectionSchema), controller.submitInspection);
router.patch('/inspections/:id', validate(reviewSchema), controller.reviewInspection);

module.exports = router;
