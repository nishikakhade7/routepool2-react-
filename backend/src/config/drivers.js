/**
 * DEMO driver roster - no real dispatch system yet. When a group's booking is
 * confirmed, one of these is assigned to it ONCE and stored on the group, so
 * every member (any browser) sees the same driver. Edit freely.
 *
 * A driver is busy (not assignable) while assigned to another group whose ride
 * isn't over yet. `gender` is used only to honour riders' "female driver"
 * preference and women-only groups (see utils/genderRules.js).
 */
const DEMO_DRIVERS = [
  { name: 'Ramesh Patil',   gender: 'male',   rating: 4.8, vehicle: 'Bajaj RE Auto',       plateNumber: 'MH 02 EK 4417' },
  { name: 'Sunil Yadav',    gender: 'male',   rating: 4.6, vehicle: 'Piaggio Ape Auto',    plateNumber: 'MH 02 FR 1093' },
  { name: 'Anil Gaikwad',   gender: 'male',   rating: 4.9, vehicle: 'Bajaj RE Compact',    plateNumber: 'MH 47 AT 7720' },
  { name: 'Mahesh Shinde',  gender: 'male',   rating: 4.7, vehicle: 'TVS King Auto',       plateNumber: 'MH 03 CV 2586' },
  { name: 'Vijay Kadam',    gender: 'male',   rating: 4.5, vehicle: 'Bajaj RE CNG',        plateNumber: 'MH 02 DQ 9314' },
  { name: 'Sunita Jadhav',  gender: 'female', rating: 4.9, vehicle: 'Bajaj RE Auto',       plateNumber: 'MH 02 GK 5521' },
  { name: 'Priya More',     gender: 'female', rating: 4.8, vehicle: 'Piaggio Ape Auto',    plateNumber: 'MH 47 BX 3308' },
];

// Assigned driver's ETA to the pickup is picked in this range (minutes).
const DRIVER_ETA_MINUTES = { min: 3, max: 8 };

// A driver stays busy (not assignable to another group) until this long after
// their current group's pickup time.
const DRIVER_BUSY_AFTER_PICKUP_MINUTES = 30;

module.exports = { DEMO_DRIVERS, DRIVER_ETA_MINUTES, DRIVER_BUSY_AFTER_PICKUP_MINUTES };
