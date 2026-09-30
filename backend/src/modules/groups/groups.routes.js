const { Router } = require('express');
const auth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { joinGroupSchema, groupIdParamSchema, postMessageSchema, setMeetingSchema, boardSchema } = require('./groups.validation');
const controller = require('./groups.controller');

const router = Router();
router.use(auth);

router.post('/join', validate(joinGroupSchema), controller.join);
router.patch('/:groupId/meeting', validate(setMeetingSchema), controller.setMeeting);
router.post('/:groupId/board', validate(boardSchema), controller.board);
router.get('/available', controller.listAvailable);
router.get('/mine', controller.listMine);
router.get('/:groupId', validate(groupIdParamSchema), controller.getGroup);
router.post('/:groupId/join', validate(groupIdParamSchema), controller.joinById);
router.post('/:groupId/leave', validate(groupIdParamSchema), controller.leave);
router.get('/:groupId/driver', validate(groupIdParamSchema), controller.getDriver);
router.get('/:groupId/chat', validate(groupIdParamSchema), controller.getChat);
router.post('/:groupId/chat', validate(postMessageSchema), controller.postChat);

module.exports = router;
