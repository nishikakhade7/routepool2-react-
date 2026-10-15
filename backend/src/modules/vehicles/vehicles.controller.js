const asyncHandler = require('../../utils/asyncHandler');
const service = require('./vehicles.service');
const groupsService = require('../groups/groups.service');
const adminService = require('../admin/admin.service');

// Every staff action on a vehicle is recorded, so the audit tab shows who did what.

// --- admin panel ---------------------------------------------------------
const list = asyncHandler(async (req, res) => res.json({ vehicles: await service.list() }));
const get = asyncHandler(async (req, res) => res.json(await service.getByPlate(req.params.plate)));
const updateDocuments = asyncHandler(async (req, res) => {
  const vehicle = await service.updateDocuments(req.params.plate, req.body);
  await adminService.record(req.user.email, 'vehicle.documents', req.params.plate, Object.keys(req.body).join(', '));
  res.json(vehicle);
});

const setStatus = asyncHandler(async (req, res) => {
  const vehicle = await service.setStatus(req.params.plate, req.body.status, req.body.reason);
  await adminService.record(req.user.email, `vehicle.${req.body.status}`, req.params.plate, req.body.reason || null);
  res.json(vehicle);
});

const logService = asyncHandler(async (req, res) => {
  const vehicle = await service.logService(req.params.plate, req.body);
  await adminService.record(req.user.email, 'vehicle.service', req.params.plate, null);
  res.json(vehicle);
});

const reviewInspection = asyncHandler(async (req, res) => {
  const reviewed = await service.reviewInspection(req.params.id, { ...req.body, reviewedBy: req.user.email });
  await adminService.record(req.user.email, `inspection.${req.body.approve ? 'approve' : 'reject'}`, reviewed.plate_number, req.body.note || null);
  res.json(reviewed);
});

// Driver self-inspection. No driver logins yet, so staff file it from the panel.
const submitInspection = asyncHandler(async (req, res) =>
  res.status(201).json(await service.submitInspection(req.params.plate, req.body.photos, req.user.email)));

// --- riders --------------------------------------------------------------
// Rate the vehicle after the ride. Membership and the assigned auto come from
// the group, so a rider can only rate an auto they actually rode in.
const addFeedback = asyncHandler(async (req, res) => {
  const plate = await groupsService.assignedPlate(req.params.groupId, req.user.id);
  res.status(201).json({
    vehicle: await service.addFeedback({
      plate,
      groupId: req.params.groupId,
      userId: req.user.id,
      cleanliness: req.body.cleanliness,
      condition: req.body.condition,
      tags: req.body.tags || [],
    }),
  });
});

module.exports = { list, get, updateDocuments, setStatus, logService, reviewInspection, submitInspection, addFeedback };
