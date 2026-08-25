const { Router } = require('express');
const validate = require('../../middleware/validate');
const { sendOtpSchema, verifyOtpSchema } = require('./auth.validation');
const controller = require('./auth.controller');

const router = Router();

router.post('/send-otp', validate(sendOtpSchema), controller.sendOtp);
router.post('/verify-otp', validate(verifyOtpSchema), controller.verifyOtp);

module.exports = router;
