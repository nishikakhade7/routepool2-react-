const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  const store = require('../db/mockStore');
  module.exports = Object.assign({}, store.vehicleModel, {
    inspectionModel: store.inspectionModel,
    vehicleFeedbackModel: store.vehicleFeedbackModel,
  });
} else {
  const prisma = require('../config/prisma');

  const listAll = () => prisma.vehicle.findMany({ orderBy: { driver_name: 'asc' } });
  const findByPlate = (plate) => prisma.vehicle.findUnique({ where: { plate_number: plate } });
  const update = (plate, patch) => prisma.vehicle.update({ where: { plate_number: plate }, data: patch });
  const addKm = (plate, km) => prisma.vehicle.update({ where: { plate_number: plate }, data: { km_driven: { increment: Number(km) } } });

  const inspectionModel = {
    create: ({ plateNumber, photos, submittedBy }) =>
      prisma.vehicleInspection.create({ data: { plate_number: plateNumber, photos, submitted_by: submittedBy, status: 'pending' } }),
    findById: (id) => prisma.vehicleInspection.findUnique({ where: { id } }),
    review: (id, { status, reviewedBy, note }) =>
      prisma.vehicleInspection.update({ where: { id }, data: { status, reviewed_by: reviewedBy, note: note || null, reviewed_at: new Date() } }),
    listByPlate: (plate) => prisma.vehicleInspection.findMany({ where: { plate_number: plate }, orderBy: { submitted_at: 'desc' } }),
    listPending: () => prisma.vehicleInspection.findMany({ where: { status: 'pending' } }),
  };

  const vehicleFeedbackModel = {
    create: ({ plateNumber, groupId, userId, cleanliness, condition, tags }) =>
      prisma.vehicleFeedback.create({ data: { plate_number: plateNumber, group_id: groupId, user_id: userId, cleanliness, condition, tags } }),
    listByPlate: (plate) => prisma.vehicleFeedback.findMany({ where: { plate_number: plate } }),
    findByGroupAndUser: (groupId, userId) => prisma.vehicleFeedback.findFirst({ where: { group_id: groupId, user_id: userId } }),
  };

  module.exports = { listAll, findByPlate, update, addKm, inspectionModel, vehicleFeedbackModel };
}
