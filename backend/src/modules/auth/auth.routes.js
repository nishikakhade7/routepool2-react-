const { Router } = require('express');
const validate = require('../../middleware/validate');
const { sendOtpSchema, verifyOtpSchema, preferencesSchema, adminLoginSchema } = require('./auth.validation');
const controller = require('./auth.controller');

const router = Router();

router.post('/send-otp', validate(sendOtpSchema), controller.sendOtp);
router.post('/verify-otp', validate(verifyOtpSchema), controller.verifyOtp);
// Staff sign in with a password instead of an emailed code.
router.post('/admin-login', validate(adminLoginSchema), controller.adminLogin);
router.get('/me', require('../../middleware/auth'), controller.me);
router.put('/me/preferences', require('../../middleware/auth'), validate(preferencesSchema), controller.updatePreferences);

module.exports = router;
