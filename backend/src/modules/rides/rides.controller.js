const asyncHandler = require('../../utils/asyncHandler');
const ridesService = require('./rides.service');
const matchingService = require('./matching.service');

const getNodes = asyncHandler(async (req, res) => {
  const nodes = await ridesService.listNodes();
  res.json({ nodes });
});

const createRequest = asyncHandler(async (req, res) => {
  const request = await ridesService.createRequest(req.user.id, req.body);
  res.status(201).json(request);
});

const getMatches = asyncHandler(async (req, res) => {
  const { groups, hiddenByPreference } = await matchingService.findMatches(
    req.query.rideRequestId, req.user.id, req.query.kind || 'auto',
    { relaxPreference: req.query.relaxPreference === 'true' },
  );
  res.json({ groups, hiddenByPreference });
});

module.exports = { getNodes, createRequest, getMatches };
