// Driver fields are numeric once a real driver-dispatch backend is wired up
// (see getAssignedDriver in api/client.js), but the mock branch returns
// field-name placeholder strings ("Rating", "ETA") instead — these helpers
// format the real, numeric case and pass the placeholder through untouched.
export function formatRating(rating) {
  return typeof rating === 'number' ? rating.toFixed(1) : rating;
}

export function formatEta(etaMinutes) {
  return typeof etaMinutes === 'number' ? `${etaMinutes} min` : etaMinutes;
}
