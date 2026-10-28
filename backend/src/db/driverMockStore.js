// Driver portal tables for the in-memory mock store. They live on the same `db`
// object, so the 2-second snapshot to .mockdb.json persists them with everything else.
const { randomUUID: uuidv4 } = require('crypto');
const { _db: db } = require('./mockStore');

db.drivers = db.drivers || [];
db.driverDocuments = db.driverDocuments || [];
db.driverTrips = db.driverTrips || [];

const driverModel = {
  async findById(id) {
    return db.drivers.find((d) => d.id === id) || null;
  },
  async findByEmail(email) {
    return db.drivers.find((d) => d.email === email) || null;
  },
  async findByPlate(plate) {
    return db.drivers.find((d) => d.plate_number === plate) || null;
  },
  async findByCode(code) {
    return db.drivers.find((d) => d.driver_code === code) || null;
  },
  async listAll() {
    return [...db.drivers].sort((a, b) => a.name.localeCompare(b.name));
  },
  async create(row) {
    const d = { id: uuidv4(), online: false, created_at: new Date(), ...row };
    db.drivers.push(d);
    return d;
  },
  async update(id, patch) {
    const d = db.drivers.find((x) => x.id === id);
    if (d) Object.assign(d, patch);
    return d || null;
  },
};

const driverDocumentModel = {
  async create(row) {
    const doc = { id: uuidv4(), status: 'pending', uploaded_at: new Date(), reviewed_by: null, reviewed_at: null, note: null, ...row };
    db.driverDocuments.push(doc);
    return doc;
  },
  async findById(id) {
    return db.driverDocuments.find((d) => d.id === id) || null;
  },
  // Newest first.
  async listByDriver(driverId) {
    return db.driverDocuments
      .filter((d) => d.driver_id === driverId)
      .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
  },
  async review(id, { status, reviewedBy, note }) {
    const doc = db.driverDocuments.find((d) => d.id === id);
    if (doc) Object.assign(doc, { status, reviewed_by: reviewedBy, reviewed_at: new Date(), note: note || null });
    return doc || null;
  },
  // Dev only: pretend `days` more days have passed for this driver's documents.
  async ageByDays(driverId, days) {
    const ms = days * 86400000;
    for (const d of db.driverDocuments.filter((x) => x.driver_id === driverId)) {
      d.uploaded_at = new Date(new Date(d.uploaded_at).getTime() - ms);
      if (d.reviewed_at) d.reviewed_at = new Date(new Date(d.reviewed_at).getTime() - ms);
    }
  },
};

const driverTripModel = {
  async find(groupId, driverId) {
    return db.driverTrips.find((t) => t.group_id === groupId && t.driver_id === driverId) || null;
  },
  async listByDriver(driverId) {
    return db.driverTrips.filter((t) => t.driver_id === driverId);
  },
  async listDeclinedPlates(groupId) {
    return db.driverTrips.filter((t) => t.group_id === groupId && t.status === 'declined').map((t) => t.plate_number);
  },
  // One row per (group, driver); each step stamps its own time.
  async upsert(groupId, driverId, plate, status) {
    let t = db.driverTrips.find((x) => x.group_id === groupId && x.driver_id === driverId);
    if (!t) {
      t = { id: uuidv4(), group_id: groupId, driver_id: driverId, plate_number: plate, created_at: new Date() };
      db.driverTrips.push(t);
    }
    t.status = status;
    t[`${status}_at`] = new Date();
    return t;
  },
};

module.exports = { driverModel, driverDocumentModel, driverTripModel };
