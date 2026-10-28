/**
 * Driver portal rules. All tuneable values live here.
 */

// PLACEHOLDER for a real driver-verification process (licence/badge check by the
// RoutePool office). For now a driver signs in with name.YY@spit.ac.in, where
// `name` is their first name on the roster (config/drivers.js) and YY the year
// they joined, e.g. priya.24@spit.ac.in.
const DRIVER_EMAIL_PATTERN = /^[a-z]+\.\d{2}@spit\.ac\.in$/i;

// Demo accounts for the project team: these addresses may sign in as drivers
// even though they don't follow the pattern, each driving the roster auto with
// this plate (config/drivers.js). The driver shows under their own name.
const DEMO_DRIVER_ACCOUNTS = {
  'nishika.khade24@spit.ac.in': 'MH 47 BX 3308',
};

// Driver addresses are not real mailboxes yet, so driver sign-in uses this fixed
// code, outside production only. Production refuses driver sign-in until a real
// verification process exists.
const DRIVER_DEMO_OTP = process.env.DRIVER_DEMO_OTP || '2468';

// Both documents are needed to drive, and each is good for this long after it is uploaded.
const DOCUMENT_TYPES = {
  inspection_certificate: 'Vehicle inspection certificate',
  licence: "Driver's licence",
};
const DOCUMENT_VALID_MONTHS = 6;
// Reminders start this many days before a document runs out.
const DOCUMENT_REMINDER_DAYS = 30;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const UPLOAD_TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

// Share of the ride's total fare that goes to the driver (demo assumption: a
// 10% platform fee). Set to 1 for no fee.
const DRIVER_PAYOUT_SHARE = 0.9;

module.exports = {
  DRIVER_EMAIL_PATTERN,
  DEMO_DRIVER_ACCOUNTS,
  DRIVER_DEMO_OTP,
  DOCUMENT_TYPES,
  DOCUMENT_VALID_MONTHS,
  DOCUMENT_REMINDER_DAYS,
  MAX_UPLOAD_BYTES,
  UPLOAD_TYPES,
  DRIVER_PAYOUT_SHARE,
};
