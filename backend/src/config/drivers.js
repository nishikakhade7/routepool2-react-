/**
 * DEMO driver roster - no real dispatch system yet. When a group's booking is
 * confirmed, one of these is assigned to it ONCE and stored on the group, so
 * every member (any browser) sees the same driver. Edit freely.
 */
const DEMO_DRIVERS = [
  { name: 'Ramesh Patil',   rating: 4.8, vehicle: 'Bajaj RE Auto',       plateNumber: 'MH 02 EK 4417' },
  { name: 'Sunil Yadav',    rating: 4.6, vehicle: 'Piaggio Ape Auto',    plateNumber: 'MH 02 FR 1093' },
  { name: 'Anil Gaikwad',   rating: 4.9, vehicle: 'Bajaj RE Compact',    plateNumber: 'MH 47 AT 7720' },
  { name: 'Mahesh Shinde',  rating: 4.7, vehicle: 'TVS King Auto',       plateNumber: 'MH 03 CV 2586' },
  { name: 'Vijay Kadam',    rating: 4.5, vehicle: 'Bajaj RE CNG',        plateNumber: 'MH 02 DQ 9314' },
];

// Assigned driver's ETA to the pickup is picked in this range (minutes).
const DRIVER_ETA_MINUTES = { min: 3, max: 8 };

module.exports = { DEMO_DRIVERS, DRIVER_ETA_MINUTES };
