/**
 * Driver portal API. Same fetch wrapper as the customer app (api/client.js);
 * file upload and download go through fetch directly because they aren't JSON.
 */
import { request } from './client';

// ---- Sign-in ----------------------------------------------
// Returns { demo, demoCode }: driver addresses aren't real mailboxes yet, so the
// backend hands back a fixed demo code instead of emailing one.
export const sendDriverOtp = (email) => request('POST', '/drivers/auth/send-otp', { email });
export const verifyDriverOtp = (email, code) => request('POST', '/drivers/auth/verify-otp', { email, code });

// ---- Profile ----------------------------------------------
export const getDriverMe = () => request('GET', '/drivers/me');
export const updateDriverVehicle = ({ model, colour, seats }) => request('PATCH', '/drivers/me/vehicle', { model, colour, seats });
export const setDriverOnline = (online) => request('PATCH', '/drivers/me/availability', { online });

// ---- Rides and trips --------------------------------------
export const getRideOffers = () => request('GET', '/drivers/me/rides');
export const acceptRide = (groupId) => request('POST', `/drivers/me/rides/${groupId}/accept`);
export const declineRide = (groupId) => request('POST', `/drivers/me/rides/${groupId}/decline`);
export const getDriverTrips = () => request('GET', '/drivers/me/trips');
export const headToPickup = (groupId) => request('POST', `/drivers/me/trips/${groupId}/heading`);
export const verifyRiderCode = (groupId, code) => request('POST', `/drivers/me/trips/${groupId}/board`, { code });
export const completeTrip = (groupId) => request('POST', `/drivers/me/trips/${groupId}/complete`);

// ---- Documents --------------------------------------------
export const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png';
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

async function errorFrom(res) {
  const data = await res.json().catch(() => null);
  return Object.assign(new Error(data?.error?.message || `Request failed (${res.status})`), { status: res.status });
}

export async function uploadDocument(type, file) {
  const res = await fetch(`/api/drivers/me/documents/${type}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('rp_token')}`,
      'Content-Type': file.type,
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

// An object URL for previewing an uploaded file (needs the auth header, so no plain <img src>).
// `admin` reads through the staff route. Revoke the URL when done with it.
export async function documentObjectUrl(docId, { admin = false } = {}) {
  const path = admin ? `/api/drivers/admin/documents/${docId}/file` : `/api/drivers/me/documents/${docId}/file`;
  const res = await fetch(path, { headers: { Authorization: `Bearer ${localStorage.getItem('rp_token')}` } });
  if (!res.ok) throw await errorFrom(res);
  return URL.createObjectURL(await res.blob());
}

// Dev only: pretend `days` have passed, to show the expiry states.
export const ageDocuments = (days) => request('POST', '/drivers/me/dev/age-documents', { days });

// ---- Admin ------------------------------------------------
export const getAdminDrivers = () => request('GET', '/drivers/admin/list');
export const reviewDriverDocument = (docId, approve, note) => request('PATCH', `/drivers/admin/documents/${docId}`, { approve, note });
