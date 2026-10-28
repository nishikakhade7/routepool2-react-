const asyncHandler = require('../../utils/asyncHandler');
const service = require('./drivers.service');
const adminService = require('../admin/admin.service');

const sendOtp = asyncHandler(async (req, res) => res.json(await service.sendOtp(req.body.email)));
const verifyOtp = asyncHandler(async (req, res) => res.json(await service.verifyOtp(req.body.email, req.body.code)));

const me = asyncHandler(async (req, res) => res.json(await service.me(req.driver.id)));
const updateVehicle = asyncHandler(async (req, res) => res.json(await service.updateVehicle(req.driver.id, req.body)));
const setAvailability = asyncHandler(async (req, res) => res.json(await service.setOnline(req.driver.id, req.body.online)));

const offers = asyncHandler(async (req, res) => res.json(await service.listOffers(req.driver.id)));
const accept = asyncHandler(async (req, res) => res.json(await service.accept(req.driver.id, req.params.groupId)));
const decline = asyncHandler(async (req, res) => res.json(await service.decline(req.driver.id, req.params.groupId)));
const trips = asyncHandler(async (req, res) => res.json(await service.listTrips(req.driver.id)));
const heading = asyncHandler(async (req, res) => res.json(await service.headToPickup(req.driver.id, req.params.groupId)));
const board = asyncHandler(async (req, res) => res.json(await service.boardRider(req.driver.id, req.params.groupId, req.body.code)));
const complete = asyncHandler(async (req, res) => res.json(await service.complete(req.driver.id, req.params.groupId)));

// Body is the raw file (express.raw); the name comes in a header.
const upload = asyncHandler(async (req, res) => {
  let fileName = req.get('X-File-Name') || '';
  try { fileName = decodeURIComponent(fileName); } catch { /* keep as sent */ }
  res.status(201).json(await service.uploadDocument(req.driver.id, req.params.type, {
    buffer: req.body,
    mimeType: (req.get('Content-Type') || '').split(';')[0].trim(),
    fileName,
  }));
});

const sendFile = (res, { file, mimeType, fileName }) => {
  res.type(mimeType);
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
  res.sendFile(file);
};
const myFile = asyncHandler(async (req, res) => sendFile(res, await service.documentFile(req.params.id, req.driver.id)));
const ageDocuments = asyncHandler(async (req, res) => res.json(await service.ageDocuments(req.driver.id, req.body.days)));

// --- admin -------------------------------------------------------------------
const adminList = asyncHandler(async (req, res) => res.json(await service.adminList()));
const adminFile = asyncHandler(async (req, res) => sendFile(res, await service.documentFile(req.params.id, null)));
const review = asyncHandler(async (req, res) => {
  const doc = await service.reviewDocument(req.params.id, req.body, req.user.email);
  await adminService.record(req.user.email, `driver-document.${req.body.approve ? 'approve' : 'reject'}`, doc.type, req.body.note || null);
  res.json({ id: doc.id, status: doc.status });
});

module.exports = {
  sendOtp, verifyOtp, me, updateVehicle, setAvailability,
  offers, accept, decline, trips, heading, board, complete,
  upload, myFile, ageDocuments, adminList, adminFile, review,
};
