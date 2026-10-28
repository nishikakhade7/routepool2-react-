const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/driverMockStore');
} else {
  const prisma = require('../config/prisma');

  const driverModel = {
    findById: (id) => prisma.driver.findUnique({ where: { id } }),
    findByEmail: (email) => prisma.driver.findUnique({ where: { email } }),
    findByPlate: (plate) => prisma.driver.findFirst({ where: { plate_number: plate } }),
    findByCode: (code) => prisma.driver.findUnique({ where: { driver_code: code } }),
    listAll: () => prisma.driver.findMany({ orderBy: { name: 'asc' } }),
    create: (row) => prisma.driver.create({ data: row }),
    update: (id, patch) => prisma.driver.update({ where: { id }, data: patch }),
  };

  const driverDocumentModel = {
    create: (row) => prisma.driverDocument.create({ data: { ...row, status: 'pending' } }),
    findById: (id) => prisma.driverDocument.findUnique({ where: { id } }),
    listByDriver: (driverId) => prisma.driverDocument.findMany({ where: { driver_id: driverId }, orderBy: { uploaded_at: 'desc' } }),
    review: (id, { status, reviewedBy, note }) =>
      prisma.driverDocument.update({ where: { id }, data: { status, reviewed_by: reviewedBy, reviewed_at: new Date(), note: note || null } }),
    async ageByDays(driverId, days) {
      const ms = days * 86400000;
      const docs = await prisma.driverDocument.findMany({ where: { driver_id: driverId } });
      await Promise.all(docs.map((d) => prisma.driverDocument.update({
        where: { id: d.id },
        data: {
          uploaded_at: new Date(d.uploaded_at.getTime() - ms),
          reviewed_at: d.reviewed_at ? new Date(d.reviewed_at.getTime() - ms) : null,
        },
      })));
    },
  };

  const driverTripModel = {
    find: (groupId, driverId) => prisma.driverTrip.findUnique({ where: { group_id_driver_id: { group_id: groupId, driver_id: driverId } } }),
    listByDriver: (driverId) => prisma.driverTrip.findMany({ where: { driver_id: driverId } }),
    listDeclinedPlates: async (groupId) =>
      (await prisma.driverTrip.findMany({ where: { group_id: groupId, status: 'declined' } })).map((t) => t.plate_number),
    upsert: (groupId, driverId, plate, status) => {
      const stamp = { status, [`${status}_at`]: new Date() };
      return prisma.driverTrip.upsert({
        where: { group_id_driver_id: { group_id: groupId, driver_id: driverId } },
        create: { group_id: groupId, driver_id: driverId, plate_number: plate, ...stamp },
        update: stamp,
      });
    },
  };

  module.exports = { driverModel, driverDocumentModel, driverTripModel };
}
