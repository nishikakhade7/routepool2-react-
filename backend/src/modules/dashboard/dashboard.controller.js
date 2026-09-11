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

const getHistory = asyncHandler(async (req, res) => {
  const history = await dashboardService.getHistory(req.user.id);
  res.json({ history });
});

const getCampusStats = asyncHandler(async (req, res) => {
  const stats = await dashboardService.getCampusStats();
  res.json(stats);
});

module.exports = { getStats, getBusyRoutes, getHistory, getCampusStats };
