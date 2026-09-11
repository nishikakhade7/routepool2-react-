const { Router } = require('express');
const auth = require('../../middleware/auth');
const controller = require('./dashboard.controller');

const router = Router();
router.use(auth);

router.get('/stats', controller.getStats);
router.get('/busy-routes', controller.getBusyRoutes);
router.get('/history', controller.getHistory);
router.get('/campus-stats', controller.getCampusStats);

module.exports = router;
