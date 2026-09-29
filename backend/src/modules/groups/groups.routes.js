const { Router } = require('express');
const auth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { joinGroupSchema, groupIdParamSchema, postMessageSchema } = require('./groups.validation');
const controller = require('./groups.controller');

const router = Router();
router.use(auth);

router.post('/join', validate(joinGroupSchema), controller.join);
router.get('/available', controller.listAvailable);
router.get('/mine', controller.listMine);
router.post('/:groupId/join', validate(groupIdParamSchema), controller.joinById);
router.get('/:groupId/chat', validate(groupIdParamSchema), controller.getChat);
router.post('/:groupId/chat', validate(postMessageSchema), controller.postChat);

module.exports = router;
