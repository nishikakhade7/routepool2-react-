const vehicleModel = require('../../models/vehicle.model');
const { inspectionModel, vehicleFeedbackModel } = require('../../models/vehicle.model');
const ApiError = require('../../utils/ApiError');
const {
  EXPIRY_REMINDER_DAYS, INSPECTION_VALID_DAYS, SERVICE_DUE_DAYS, SERVICE_DUE_KM,
  COMPLAINT_WINDOW_DAYS, COMPLAINT_FLAG_COUNT, COMPLAINT_SUSPEND_COUNT,
  COMPLAINT_TAGS, DOCUMENTS, INSPECTION_PHOTOS,
} = require('../../config/vehicleRules');

const DAY_MS = 86400000;
const daysUntil = (date) => Math.floor((new Date(date).getTime() - Date.now()) / DAY_MS);
const daysSince = (date) => Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS);

// Every document with how long it has left. Expired = the eligibility gate closes;
// "expiring soon" = what the driver is reminded about before it does.
function documentStatus(v) {
  return DOCUMENTS.map((doc) => {
    const expiresOn = v[`${doc}_expiry`];
    const daysLeft = daysUntil(expiresOn);
    return {
      document: doc,
      expiresOn: new Date(expiresOn).toISOString(),
      daysLeft,
      expired: daysLeft < 0,
      expiringSoon: daysLeft >= 0 && daysLeft <= EXPIRY_REMINDER_DAYS,
    };
  });
}

// The last inspection an admin approved, and whether it is still current.
function inspectionStatus(inspections) {
  const approved = inspections.filter((i) => i.status === 'approved')
    .sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at))[0];
  const inspectedOn = approved ? new Date(approved.reviewed_at) : null;
  const ageDays = inspectedOn ? daysSince(inspectedOn) : null;
  const waiting = inspections.find((i) => i.status === 'pending');
  return {
    inspectedOn: inspectedOn ? inspectedOn.toISOString() : null,
    current: Boolean(inspectedOn) && ageDays <= INSPECTION_VALID_DAYS,
    overdue: !inspectedOn || ageDays > INSPECTION_VALID_DAYS,
    pending: Boolean(waiting),
    pendingId: waiting?.id || null,
  };
}

// Overdue by date OR by kilometres driven since the last service, whichever first.
function serviceStatus(v) {
  const sinceServiceKm = +(Number(v.km_driven || 0) - Number(v.last_service_km || 0)).toFixed(2);
  const daysSinceService = daysSince(v.last_service_date);
  return {
    lastServicedOn: new Date(v.last_service_date).toISOString(),
    daysSinceService,
    kmSinceService: sinceServiceKm,
    overdueByDate: daysSinceService > SERVICE_DUE_DAYS,
    overdueByKm: sinceServiceKm > SERVICE_DUE_KM,
    overdue: daysSinceService > SERVICE_DUE_DAYS || sinceServiceKm > SERVICE_DUE_KM,
  };
}

function complaintStatus(feedback) {
  const since = Date.now() - COMPLAINT_WINDOW_DAYS * DAY_MS;
  const recent = feedback.filter((f) => new Date(f.created_at).getTime() >= since);
  const complaints = recent.reduce((n, f) => n + (f.tags || []).filter((t) => COMPLAINT_TAGS.includes(t)).length, 0);
  const ratings = recent.flatMap((f) => [f.cleanliness, f.condition]).filter((n) => typeof n === 'number');
  return {
    complaints,
    ratingCount: recent.length,
    avgRating: ratings.length ? +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null,
    shouldFlag: complaints >= COMPLAINT_FLAG_COUNT,
    shouldSuspend: complaints >= COMPLAINT_SUSPEND_COUNT,
  };
}

// One vehicle with every check resolved. `eligible` is the gate the driver
// assignment uses: valid paperwork on an unsuspended auto, nothing else.
async function describe(v) {
  const [inspections, feedback] = await Promise.all([
    inspectionModel.listByPlate(v.plate_number),
    vehicleFeedbackModel.listByPlate(v.plate_number),
  ]);
  const documents = documentStatus(v);
  const expired = documents.filter((d) => d.expired).map((d) => d.document);
  const suspended = v.status === 'suspended';
  const docsApproved = v.documents_status === 'approved';

  const blockedReason = suspended ? 'Vehicle suspended'
    : expired.length ? `Expired ${expired.join(' and ')}`
    : !docsApproved ? 'Documents awaiting admin approval'
    : null;

  return {
    plateNumber: v.plate_number,
    registrationNumber: v.registration_number,
    driverName: v.driver_name,
    gender: v.gender,
    rating: v.rating,
    vehicle: v.vehicle,
    status: v.status,
    documentsStatus: v.documents_status,
    flaggedReason: v.flagged_reason,
    documents,
    expiringSoon: documents.filter((d) => d.expiringSoon).map((d) => d.document),
    inspection: inspectionStatus(inspections),
    service: serviceStatus(v),
    feedback: complaintStatus(feedback),
    kmDriven: Number(v.km_driven || 0),
    eligible: !blockedReason,
    blockedReason,
  };
}

async function list() {
  return Promise.all((await vehicleModel.listAll()).map(describe));
}

async function getByPlate(plate) {
  const v = await vehicleModel.findByPlate(plate);
  if (!v) throw ApiError.notFound('Vehicle not found');
  return describe(v);
}

// Plates the driver assignment may use. Everything else is off the road.
async function eligiblePlates() {
  const all = await list();
  return new Set(all.filter((v) => v.eligible).map((v) => v.plateNumber));
}

// What a rider sees on the driver card: "Verified vehicle · inspected 12 Oct".
async function riderBadge(plate) {
  const v = await vehicleModel.findByPlate(plate);
  if (!v) return null;
  const { inspection, registrationNumber, service } = await describe(v);
  return {
    verified: inspection.current,
    inspectedOn: inspection.inspectedOn,
    registrationNumber,
    serviceOverdue: service.overdue,
  };
}

// Kilometres a finished ride puts on the auto - this is what makes servicing fall due.
async function recordRideKm(plate, km) {
  if (!plate || !km) return null;
  return vehicleModel.addKm(plate, km);
}

// --- driver/admin actions -----------------------------------------------

async function submitInspection(plate, photos, submittedBy) {
  await getByPlate(plate); // 404s on an unknown plate
  const missing = INSPECTION_PHOTOS.filter((p) => !photos?.[p]);
  if (missing.length) throw ApiError.badRequest(`Photos required: ${missing.join(', ')}`);
  return inspectionModel.create({ plateNumber: plate, photos, submittedBy });
}

async function reviewInspection(id, { approve, note, reviewedBy }) {
  const row = await inspectionModel.findById(id);
  if (!row) throw ApiError.notFound('Inspection not found');
  if (row.status !== 'pending') throw ApiError.conflict('This inspection was already reviewed');
  const reviewed = await inspectionModel.review(id, { status: approve ? 'approved' : 'rejected', reviewedBy, note });
  // A fresh approved inspection clears a "sent for inspection" flag.
  if (approve) await vehicleModel.update(row.plate_number, { flagged_reason: null });
  return reviewed;
}

async function logService(plate, { servicedOn }) {
  const v = await vehicleModel.findByPlate(plate);
  if (!v) throw ApiError.notFound('Vehicle not found');
  const date = servicedOn ? new Date(servicedOn) : new Date();
  if (isNaN(date.getTime())) throw ApiError.badRequest('Invalid service date');
  if (date.getTime() > Date.now()) throw ApiError.badRequest('Service date cannot be in the future');
  // Counting kilometres from this service resets the km side of the due check.
  await vehicleModel.update(plate, { last_service_date: date, last_service_km: Number(v.km_driven || 0) });
  return getByPlate(plate);
}

async function updateDocuments(plate, patch) {
  const v = await vehicleModel.findByPlate(plate);
  if (!v) throw ApiError.notFound('Vehicle not found');
  const update = {};
  for (const doc of DOCUMENTS) {
    if (patch[doc]) {
      const date = new Date(patch[doc]);
      if (isNaN(date.getTime())) throw ApiError.badRequest(`Invalid ${doc} expiry date`);
      update[`${doc}_expiry`] = date;
    }
  }
  if (patch.registrationNumber) update.registration_number = patch.registrationNumber;
  if (patch.documentsStatus) update.documents_status = patch.documentsStatus;
  await vehicleModel.update(plate, update);
  return getByPlate(plate);
}

async function setStatus(plate, status, reason) {
  if (!['active', 'suspended'].includes(status)) throw ApiError.badRequest('Status must be active or suspended');
  await getByPlate(plate);
  await vehicleModel.update(plate, { status, flagged_reason: status === 'suspended' ? (reason || 'Suspended by admin') : null });
  return getByPlate(plate);
}

// --- rider feedback -----------------------------------------------------

// Repeated complaints flag the vehicle for inspection, and enough of them take
// it off the road until an admin clears it.
async function addFeedback({ plate, groupId, userId, cleanliness, condition, tags = [] }) {
  const v = await vehicleModel.findByPlate(plate);
  if (!v) throw ApiError.notFound('Vehicle not found');
  if (await vehicleFeedbackModel.findByGroupAndUser(groupId, userId)) {
    throw ApiError.conflict('You already rated this ride');
  }
  const unknown = tags.filter((t) => !COMPLAINT_TAGS.includes(t));
  if (unknown.length) throw ApiError.badRequest(`Unknown tags: ${unknown.join(', ')}`);

  await vehicleFeedbackModel.create({ plateNumber: plate, groupId, userId, cleanliness, condition, tags });

  const after = await getByPlate(plate);
  if (after.feedback.shouldSuspend && after.status !== 'suspended') {
    await vehicleModel.update(plate, { status: 'suspended', flagged_reason: `Suspended: ${after.feedback.complaints} rider complaints in ${COMPLAINT_WINDOW_DAYS} days` });
  } else if (after.feedback.shouldFlag && !v.flagged_reason) {
    await vehicleModel.update(plate, { flagged_reason: `Sent for inspection: ${after.feedback.complaints} rider complaints in ${COMPLAINT_WINDOW_DAYS} days` });
  }
  return getByPlate(plate);
}

module.exports = {
  list, getByPlate, eligiblePlates, riderBadge, recordRideKm,
  submitInspection, reviewInspection, logService, updateDocuments, setStatus, addFeedback,
};
