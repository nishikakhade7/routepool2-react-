const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').userModel;
} else {
  const prisma = require('../config/prisma');

  async function findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  }

  async function findById(id) {
    return prisma.user.findUnique({ where: { id } });
  }

  async function createVerified({ email, name, initials, branch }) {
    return prisma.user.create({
      data: { email, name, initials, branch, is_verified: true },
    });
  }

  async function ensureRiderCode(id) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.rider_code) return user.rider_code;
    const rider_code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    await prisma.user.update({ where: { id }, data: { rider_code } });
    return rider_code;
  }

  async function markVerified(id) {
    return prisma.user.update({
      where: { id },
      data: { is_verified: true },
    });
  }

  module.exports = { findByEmail, findById, createVerified, ensureRiderCode, markVerified };
}
