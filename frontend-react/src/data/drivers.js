// Phase 2 vision only — there is no real driver-matching system yet, so this
// is a small placeholder pool rather than one fixed driver every time.
const DRIVER_POOL = [
  { name: 'Ramesh Yadav', rating: 4.8, vehicle: 'Bajaj RE Auto', plate: 'MH 02 AB 4471', etaMinutes: 4 },
  { name: 'Suresh Patil', rating: 4.6, vehicle: 'TVS King', plate: 'MH 03 CJ 8825', etaMinutes: 6 },
  { name: 'Imran Shaikh', rating: 4.9, vehicle: 'Bajaj RE Auto', plate: 'MH 04 EK 1190', etaMinutes: 3 },
  { name: 'Vikas More', rating: 4.7, vehicle: 'Piaggio Ape', plate: 'MH 01 GT 6602', etaMinutes: 5 },
];

export function pickRandomDriver() {
  return DRIVER_POOL[Math.floor(Math.random() * DRIVER_POOL.length)];
}
