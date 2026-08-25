const asyncHandler = require('../../utils/asyncHandler');
const dashboardService = require('./dashboard.service');

const getStats = asyncHandler(async (req, res) => {
  const stats = await dashboardService.getStats(req.user.id);
  res.json(stats);
});

const getBusyRoutes = asyncHandler(async (req, res) => {
  const routes = await dashboardService.getBusyRoutes();
  res.json({ routes });
});

module.exports = { getStats, getBusyRoutes };
