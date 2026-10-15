/**
 * Vehicle maintenance rules. All tuneable thresholds live here.
 */

// A document (permit, insurance, PUC, fitness) expiring within this many days
// is "expiring soon": the driver gets reminders, the admin panel lists it.
const EXPIRY_REMINDER_DAYS = 14;

// A self-inspection (photos of tyres, lights, seats, meter) counts as current
// for this long after an admin approves it.
const INSPECTION_VALID_DAYS = 30;

// Servicing is overdue past either of these, whichever comes first.
const SERVICE_DUE_DAYS = 180;
const SERVICE_DUE_KM = 3000;

// Rider complaints (the negative tags below) counted over this window:
// FLAG = send the vehicle for inspection, SUSPEND = stop assigning it.
const COMPLAINT_WINDOW_DAYS = 30;
const COMPLAINT_FLAG_COUNT = 3;
const COMPLAINT_SUSPEND_COUNT = 5;

// Quick tags a rider can attach to a rating. Everything here counts as a complaint.
const COMPLAINT_TAGS = ['dirty seats', 'meter not working', 'unsafe driving', 'poor condition', 'rash lane changes'];

const DOCUMENTS = ['permit', 'insurance', 'puc', 'fitness'];
const INSPECTION_PHOTOS = ['tyres', 'lights', 'seats', 'meter'];

module.exports = {
  EXPIRY_REMINDER_DAYS,
  INSPECTION_VALID_DAYS,
  SERVICE_DUE_DAYS,
  SERVICE_DUE_KM,
  COMPLAINT_WINDOW_DAYS,
  COMPLAINT_FLAG_COUNT,
  COMPLAINT_SUSPEND_COUNT,
  COMPLAINT_TAGS,
  DOCUMENTS,
  INSPECTION_PHOTOS,
};
