const { Router } = require('express');
const auth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { requestRideSchema, matchesQuerySchema } = require('./rides.validation');
const controller = require('./rides.controller');

const router = Router();
router.use(auth);

router.get('/nodes', controller.getNodes);
router.post('/request', validate(requestRideSchema), controller.createRequest);
router.get('/matches', validate(matchesQuerySchema), controller.getMatches);

module.exports = router;
