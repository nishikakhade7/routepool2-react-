const asyncHandler = require('../../utils/asyncHandler');
const authService = require('./auth.service');

const sendOtp = asyncHandler(async (req, res) => {
  const result = await authService.sendOtp(req.body.email.toLowerCase());
  res.status(200).json(result);
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyOtp(req.body.email.toLowerCase(), req.body.code);
  res.status(200).json(result);
});

module.exports = { sendOtp, verifyOtp };
