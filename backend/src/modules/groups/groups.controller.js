const asyncHandler = require('../../utils/asyncHandler');
const groupsService = require('./groups.service');

const join = asyncHandler(async (req, res) => {
  const group = await groupsService.join(req.user.id, req.body);
  res.status(201).json(group);
});

const listAvailable = asyncHandler(async (req, res) => {
  res.json({ groups: await groupsService.listAvailable(req.user.id) });
});

const bookSolo = asyncHandler(async (req, res) => {
  res.status(201).json(await groupsService.bookSolo(req.user.id, req.body));
});

const listMine = asyncHandler(async (req, res) => {
  res.json({ groups: await groupsService.listMine(req.user.id) });
});

const joinById = asyncHandler(async (req, res) => {
  res.status(201).json(await groupsService.joinById(req.user.id, req.params.groupId));
});

const getGroup = asyncHandler(async (req, res) => {
  res.json(await groupsService.getGroup(req.params.groupId, req.user.id));
});

const leave = asyncHandler(async (req, res) => {
  res.json(await groupsService.leave(req.params.groupId, req.user.id));
});

const getDriver = asyncHandler(async (req, res) => {
  res.json(await groupsService.getDriver(req.params.groupId, req.user.id));
});

const getChat = asyncHandler(async (req, res) => {
  const messages = await groupsService.listChat(req.params.groupId, req.user.id);
  res.json({ messages });
});

const postChat = asyncHandler(async (req, res) => {
  const message = await groupsService.postChat(req.params.groupId, req.user.id, req.body.message);
  res.status(201).json(message);
});

module.exports = { join, bookSolo, listAvailable, listMine, joinById, getGroup, leave, getDriver, getChat, postChat };
