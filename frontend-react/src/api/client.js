/**
 * RoutePool API Client
 * Thin fetch wrapper that handles JWT headers, JSON parsing,
 * and structured error throwing for all backend calls.
 */

const BASE = '/api';

export const USE_MOCK_MATCHING = true;

// Sentinel group id used by the mock-matching demo flow (FormGroup, Book,
// MatchCard, GroupChat) to bypass the real chat API with fake in-memory
// messages. Must stay in sync across all four call sites.
export const DEMO_GROUP_ID = '00000000-0000-0000-0000-000000000999';

function getToken() {
  return localStorage.getItem('rp_token');
}

async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
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

  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

// ---- Auth -----------------------------------------------
export function sendOtp(email) {
  return request('POST', '/auth/send-otp', { email });
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

export function getHistory() {
  return request('GET', '/dashboard/history').then((res) => res.history ?? res);
}

export function getCampusStats() {
  return request('GET', '/dashboard/campus-stats');
}

// ---- Rides ----------------------------------------------
export function getNodes() {
  return request('GET', '/rides/nodes').then((res) => res.nodes ?? res);
}

/**
 * @param {object} params
 * @param {string} params.pickupNodeId
 * @param {string} params.dropNodeId
 * @param {string} params.pickupTime  ISO datetime string (exact desired pickup time).
 *   The server applies a ±5-minute buffer (MATCH_BUFFER_MINUTES in matchingConfig.js)
 *   when comparing riders — no need to pass a window or flex value.
 */
export function requestRide({ pickupNodeId, dropNodeId, pickupTime }) {
  return request('POST', '/rides/request', { pickupNodeId, dropNodeId, pickupTime });
}

export function getMatches(rideRequestId) {
  return request('GET', `/rides/matches?rideRequestId=${rideRequestId}`).then((res) => res.groups ?? res);
}

// ---- Groups ---------------------------------------------
/**
 * @param {string} rideRequestId           The caller's own ride request ID
 * @param {string[]} memberRideRequestIds  All member request IDs (must include rideRequestId)
 */
export function joinGroup(rideRequestId, memberRideRequestIds) {
  return request('POST', '/groups/join', { rideRequestId, memberRideRequestIds });
}

export function getChat(groupId) {
  return request('GET', `/groups/${groupId}/chat`).then((res) => res.messages ?? res);
}

export function postChat(groupId, message) {
  return request('POST', `/groups/${groupId}/chat`, { message });
}
