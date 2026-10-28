// What the driver portal changes about driver assignment (groups.service getDriver).
// Roster drivers who never signed in to the portal are unaffected.
const { driverModel, driverDocumentModel, driverTripModel } = require('../../models/driver.model');
const { verificationOf } = require('./verification');

// Portal drivers who can't take a new ride right now: documents not cleared
// (including "re-verification required") or switched offline. Plus anyone who
// already declined this group.
async function unavailablePlates(groupId) {
  const out = new Set(await driverTripModel.listDeclinedPlates(groupId));
  for (const d of await driverModel.listAll()) {
    if (!d.online || !verificationOf(await driverDocumentModel.listByDriver(d.id)).verified) out.add(d.plate_number);
  }
  return out;
}

// Drivers online in the portal get the ride before roster drivers who aren't using it.
async function onlinePlates() {
  return new Set((await driverModel.listAll()).filter((d) => d.online).map((d) => d.plate_number));
}

// The portal account driving this auto, if any: riders see its name and the
// model the driver set on their profile.
async function portalDriverFor(plate) {
  const d = await driverModel.findByPlate(plate);
  return d ? { name: d.name, vehicle: d.vehicle_model } : null;
}

// For the rider's "Verified vehicle · inspected …" badge: when the driver's
// inspection certificate was approved, if it is still valid.
async function inspectionCertificateApprovedOn(plate) {
  const d = await driverModel.findByPlate(plate);
  if (!d) return null;
  const cert = verificationOf(await driverDocumentModel.listByDriver(d.id)).documents.find((x) => x.type === 'inspection_certificate');
  if (!cert.cleared) return null;
  const docs = await driverDocumentModel.listByDriver(d.id);
  const approved = docs.filter((x) => x.type === 'inspection_certificate' && x.status === 'verified' && x.reviewed_at)
    .sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at))[0];
  return approved ? new Date(approved.reviewed_at) : null;
}

module.exports = { unavailablePlates, onlinePlates, portalDriverFor, inspectionCertificateApprovedOn };
