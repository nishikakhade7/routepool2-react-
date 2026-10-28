/**
 * RoutePool API Client
 * Thin fetch wrapper that handles JWT headers, JSON parsing,
 * and structured error throwing for all backend calls.
 */

import { PLACEHOLDER_DRIVER } from '../mockData/drivers';

const BASE = '/api';

// Set to false to use real backend matching (requires backend + PostgreSQL running)
// Set to true for purely frontend demos without a backend
export const USE_MOCK_MATCHING = false;


// Sentinel group id used by the mock-matching demo flow (FormGroup, Book,
// MatchCard, GroupChat) to bypass the real chat API with fake in-memory
// messages. Must stay in sync across all four call sites.
export const DEMO_GROUP_ID = '00000000-0000-0000-0000-000000000999';

function getToken() {
  return localStorage.getItem('rp_token');
}

// The dev backend restarts on every file save (nodemon), and calls in that
// half-second come back as a proxy 502/504 or a dropped connection. One retry
// rides over the restart instead of showing "Request failed" all over the page.
// Any call that gets no answer within this long fails with a clear message,
// so no screen can spin forever on a backend that never responds.
const REQUEST_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url, options) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: ctl.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw Object.assign(new Error('Something went wrong — the server took too long to respond. Please try again.'), { timedOut: true });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url, options) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options);
      if (res.status !== 502 && res.status !== 504) return res;
      if (attempt === 1) return res;
    } catch (err) {
      // A timeout already waited long enough; a second try would double it.
      if (err.timedOut || attempt === 1) throw err; // still unreachable: let the caller show it
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
}

// Exported for the driver portal's API module (api/driver.js).
export async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetchWithRetry(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  // Session no longer valid -> clear it and go sign in again.
  if (res.status === 401 && token) {
    const wasDriver = localStorage.getItem('rp_role') === 'driver';
    localStorage.removeItem('rp_token');
    localStorage.removeItem('rp_user');
    localStorage.removeItem('rp_role');
    window.location.assign(wasDriver ? '/driver/login' : '/login');
  }

  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `Request failed (${res.status})`;
    // Keep the status and structured details (e.g. details.code = 'NO_MATCHING_DRIVER')
    // so pages can react to specific cases, not just show the text.
    throw Object.assign(new Error(msg), { status: res.status, details: data?.error?.details });
  }

  return data;
}

// ---- Auth -----------------------------------------------
export function sendOtp(email) {
  return request('POST', '/auth/send-otp', { email });
}

// Staff sign in with a password instead of an emailed code.
export function adminLogin(email, password) {
  return request('POST', '/auth/admin-login', { email, password });
}

export function verifyOtp(email, otp) {
  return request('POST', '/auth/verify-otp', { email, code: otp });
}

// ---- Dashboard ------------------------------------------
export function getDashboardStats() {
  return request('GET', '/dashboard/stats');
}

export function getBusyRoutes() {
  return request('GET', '/dashboard/busy-routes').then((res) => res.routes ?? res);
}

// { history: rows, summary: { totalRides, totalSavings, avgFare } } — summary is
// computed server-side from exactly these rows.
export function getHistory() {
  return request('GET', '/dashboard/history');
}

export function getCampusStats() {
  return request('GET', '/dashboard/campus-stats');
}

// ---- Rides ----------------------------------------------
export function getNodes() {
  return request('GET', '/rides/nodes').then((res) => res.nodes ?? res);
}

/**
 * Pass either stop ids (pickupNodeId/dropNodeId) or the text the student typed
 * (pickupText/dropText) — the backend resolves text to the nearest named stop.
 * @param {string} params.pickupTime  ISO datetime string (exact desired pickup time).
 *   The server's matching window (MATCH_BUFFER_MINUTES in matchingConfig.js)
 *   decides who can share — no need to pass a window or flex value.
 */
export function requestRide({ pickupNodeId, dropNodeId, pickupText, dropText, pickupTime }) {
  return request('POST', '/rides/request', { pickupNodeId, dropNodeId, pickupText, dropText, pickupTime });
}

export function getMatches(rideRequestId, kind = 'auto', opts = {}) {
  return getMatchesDetailed(rideRequestId, kind, opts).then((res) => res.groups);
}

// { groups, hiddenByPreference }: hiddenByPreference = groups hidden only by MY
// women-only preference; relaxPreference shows them for this ride.
export function getMatchesDetailed(rideRequestId, kind = 'auto', { relaxPreference = false } = {}) {
  const relax = relaxPreference ? '&relaxPreference=true' : '';
  return request('GET', `/rides/matches?rideRequestId=${rideRequestId}&kind=${kind}${relax}`)
    .then((res) => ({ groups: res.groups ?? [], hiddenByPreference: res.hiddenByPreference ?? 0 }));
}

// ---- Groups ---------------------------------------------
/**
 * @param {string} rideRequestId           The caller's own ride request ID
 * @param {string[]} memberRideRequestIds  All member request IDs (must include rideRequestId)
 */
export function joinGroup(rideRequestId, memberRideRequestIds, kind = 'auto', { relaxPreference = false } = {}) {
  return request('POST', '/groups/join', { rideRequestId, memberRideRequestIds, kind, relaxPreference });
}

// Optional gender + pooling preferences: { gender, womenOnlyGroups, driverPreference }.
export function updatePreferences(prefs) {
  return request('PUT', '/auth/me/preferences', prefs);
}

// Payment step completed for this ride (recorded so an unpaid booking can be resumed).
export function payForGroup(groupId, method) {
  return request('POST', `/groups/${groupId}/pay`, { method });
}

// "Allow any driver" for this ride (waives only my own female-driver preference).
export function setDriverPreference(groupId, { allowAnyDriver }) {
  return request('POST', `/groups/${groupId}/driver-preference`, { allowAnyDriver });
}

// Public-transport groups only: where and how the group meets.
export function setGroupMeeting(groupId, { meetingPoint, transitMode }) {
  return request('PATCH', `/groups/${groupId}/meeting`, { meetingPoint, transitMode });
}

export function getAvailableGroups() {
  return request('GET', '/groups/available').then((res) => res.groups ?? res);
}

export function getMyGroups() {
  return request('GET', '/groups/mine').then((res) => res.groups ?? res);
}

export function joinGroupById(groupId) {
  return request('POST', `/groups/${groupId}/join`);
}

// Members, per-rider fares and price breakup (same shape as a getMatches entry).
export function getGroup(groupId) {
  return request('GET', `/groups/${groupId}`);
}

export function leaveGroup(groupId) {
  return request('POST', `/groups/${groupId}/leave`);
}

// The rider reads their permanent code out to the driver; this records that the
// ride has started for them (after which they can't join or leave groups).
export function boardRide(groupId, code) {
  return request('POST', `/groups/${groupId}/board`, { code });
}

// Current student, including their permanent rider code.
export function getMe() {
  return request('GET', '/auth/me');
}

// --- admin panel (staff only; the backend refuses everyone else) ---------
export function getAdminRides(includePast = false) {
  return request('GET', `/admin/rides?includePast=${includePast}`).then((r) => r.rides ?? r);
}
export const cancelRide = (groupId, reason) => request('POST', `/admin/rides/${groupId}/cancel`, { reason });
export const unassignDriver = (groupId, reason) => request('POST', `/admin/rides/${groupId}/unassign-driver`, { reason });
export const getStudents = () => request('GET', '/admin/students').then((r) => r.students ?? r);
export const setStudentStatus = (userId, suspended, reason) => request('PATCH', `/admin/students/${userId}/status`, { suspended, reason });
export const getSafetyReports = () => request('GET', '/admin/reports').then((r) => r.reports ?? r);
export const resolveReport = (id, status, resolution) => request('PATCH', `/admin/reports/${id}`, { status, resolution });
export const getNotices = () => request('GET', '/admin/notices').then((r) => r.notices ?? r);
export const postNotice = (message, level, expiresAt) => request('POST', '/admin/notices', { message, level, expiresAt });
export const deleteNotice = (id) => request('DELETE', `/admin/notices/${id}`);
export const getAuditLog = () => request('GET', '/admin/audit').then((r) => r.actions ?? r);

// --- students -----------------------------------------------------------
export const getActiveNotices = () => request('GET', '/admin/notices/active').then((r) => r.notices ?? r);
export const REPORT_CATEGORIES = ['unsafe driving', 'harassment', 'no show', 'payment issue', 'other'];
export const fileSafetyReport = (groupId, { aboutUserId, aboutPlate, category, message }) =>
  request('POST', `/admin/reports/groups/${groupId}`, { aboutUserId, aboutPlate, category, message });

// --- vehicle maintenance ------------------------------------------------
// Quick tags a rider can attach to a rating (must match backend vehicleRules.js).
export const COMPLAINT_TAGS = ['dirty seats', 'meter not working', 'unsafe driving', 'poor condition', 'rash lane changes'];

export function rateVehicle(groupId, { cleanliness, condition, tags }) {
  return request('POST', `/vehicles/groups/${groupId}/feedback`, { cleanliness, condition, tags });
}

// Admin panel (staff only - the backend refuses everyone else).
export function getVehicles() {
  return request('GET', '/vehicles').then((res) => res.vehicles ?? res);
}

export function updateVehicleDocuments(plate, patch) {
  return request('PATCH', `/vehicles/${encodeURIComponent(plate)}/documents`, patch);
}

export function setVehicleStatus(plate, status, reason) {
  return request('PATCH', `/vehicles/${encodeURIComponent(plate)}/status`, { status, reason });
}

export function logVehicleService(plate, servicedOn) {
  return request('POST', `/vehicles/${encodeURIComponent(plate)}/service`, { servicedOn });
}

export function submitInspection(plate, photos) {
  return request('POST', `/vehicles/${encodeURIComponent(plate)}/inspections`, { photos });
}

export function reviewInspection(id, approve, note) {
  return request('PATCH', `/vehicles/inspections/${id}`, { approve, note });
}

export function getChat(groupId) {
  return request('GET', `/groups/${groupId}/chat`).then((res) => res.messages ?? res);
}

export function postChat(groupId, message) {
  return request('POST', `/groups/${groupId}/chat`, { message });
}

// ---- Driver assignment -----------------------------------
// GET /api/groups/:groupId/driver ->
// { name, rating, vehicle, plateNumber, etaMinutes, arrivesAt }
/**
 * The backend decides a group's driver once and stores it on the group, so
 * every member (any browser) gets the same driver and the same arrivesAt.
 *
 * The mock branch returns PLACEHOLDER_DRIVER as-is (field-name strings like
 * "Rating"/"ETA", not realistic fake values) — callers that format these for
 * display (e.g. `rating.toFixed(1)`) must check `typeof` first, since only
 * the real branch's response is actually numeric.
 *
 * @param {string} groupId
 * @returns {Promise<{ name: string, rating: number|string, vehicle: string, plate: string, etaMinutes: number|string }>}
 */
export async function getAssignedDriver(groupId) {
  if (USE_MOCK_MATCHING) {
    return PLACEHOLDER_DRIVER;
  }
  const data = await request('GET', `/groups/${groupId}/driver`);
  // Normalize the wire field name (plateNumber) to `plate`, which is what
  // Book.jsx/BookingConfirmation.jsx already read — callers don't change.
  return { name: data.name, rating: data.rating, vehicle: data.vehicle, plate: data.plateNumber, etaMinutes: data.etaMinutes, arrivesAt: data.arrivesAt, femaleDriverAsRequested: data.femaleDriverAsRequested, vehicleCheck: data.vehicleCheck };
}
