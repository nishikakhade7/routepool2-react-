// Same real/placeholder pattern as formatRating/formatEta in formatDriver.js:
// once a real backend computes a fare, the field is a number and this
// formats it as currency; until then (USE_MOCK_MATCHING's mock branch) the
// field is a field-name placeholder string ("Trip Total", ...) and is passed
// through untouched. No caller needs to change when the real value arrives.
export function formatFare(value) {
  return typeof value === 'number' ? `₹${value.toFixed(0)}` : value;
}
