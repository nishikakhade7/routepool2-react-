const { Router } = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const ridesRoutes = require('../modules/rides/rides.routes');
const groupsRoutes = require('../modules/groups/groups.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/rides', ridesRoutes);
router.use('/groups', groupsRoutes);

module.exports = router;
