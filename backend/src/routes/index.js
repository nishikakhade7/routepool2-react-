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

// Dev-only: POST /api/dev/reset-rides (npm run reset-rides). Only mounted when the
// in-memory mock store is in use - with real Postgres this route doesn't exist.
if (process.env.USE_MOCK_DB === 'true') {
  const { resetRides } = require('../db/mockStore');
  router.post('/dev/reset-rides', (req, res) => {
    const cleared = resetRides();
    console.log('[dev] ride state reset:', cleared);
    res.json({ ok: true, cleared });
  });
}

module.exports = router;
