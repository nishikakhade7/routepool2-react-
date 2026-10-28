const express = require('express');
const auth = require('../../middleware/auth');
const requireAdmin = require('../../middleware/requireAdmin');
const validate = require('../../middleware/validate');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const driverAuth = require('./driverAuth');
const v = require('./drivers.validation');
const c = require('./drivers.controller');
const { MAX_UPLOAD_BYTES, UPLOAD_TYPES } = require('../../config/driverPortal');

const router = express.Router();

// Raw file body, at most 5 MB; an oversized file gets a clear 400, not a 500.
const rawFile = (req, res, next) => express.raw({ type: Object.keys(UPLOAD_TYPES), limit: MAX_UPLOAD_BYTES })(req, res, (err) => {
  if (err?.type === 'entity.too.large') return next(ApiError.badRequest('Files can be up to 5 MB'));
  next(err);
});

// Sign-in (no token yet).
router.post('/auth/send-otp', validate(v.sendOtpSchema), c.sendOtp);
router.post('/auth/verify-otp', validate(v.verifyOtpSchema), c.verifyOtp);

// Admin panel: staff (student-app) tokens.
router.get('/admin/list', auth, requireAdmin, c.adminList);
router.get('/admin/documents/:id/file', auth, requireAdmin, c.adminFile);
router.patch('/admin/documents/:id', auth, requireAdmin, validate(v.reviewSchema), c.review);

// The signed-in driver.
const me = express.Router();
me.use(driverAuth);
me.get('/', c.me);
me.patch('/vehicle', validate(v.vehicleSchema), c.updateVehicle);
me.patch('/availability', validate(v.availabilitySchema), c.setAvailability);
me.get('/rides', c.offers);
me.post('/rides/:groupId/accept', validate(v.groupSchema), c.accept);
me.post('/rides/:groupId/decline', validate(v.groupSchema), c.decline);
me.get('/trips', c.trips);
me.post('/trips/:groupId/heading', validate(v.groupSchema), c.heading);
me.post('/trips/:groupId/board', validate(v.boardSchema), c.board);
me.post('/trips/:groupId/complete', validate(v.groupSchema), c.complete);
me.put('/documents/:type', rawFile, c.upload);
me.get('/documents/:id/file', c.myFile);
// Dev only: fast-forward document dates to show the expiry states.
if (env.nodeEnv !== 'production') me.post('/dev/age-documents', validate(v.ageSchema), c.ageDocuments);
router.use('/me', me);

module.exports = router;
