const asyncHandler = require('../../utils/asyncHandler');
const groupsService = require('./groups.service');

const join = asyncHandler(async (req, res) => {
  const group = await groupsService.join(req.user.id, req.body);
  res.status(201).json(group);
});

const getChat = asyncHandler(async (req, res) => {
  const messages = await groupsService.listChat(req.params.groupId, req.user.id);
  res.json({ messages });
});

const postChat = asyncHandler(async (req, res) => {
  const message = await groupsService.postChat(req.params.groupId, req.user.id, req.body.message);
  res.status(201).json(message);
});

module.exports = { join, getChat, postChat };
