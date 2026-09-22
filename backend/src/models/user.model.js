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

  async function markVerified(id) {
    return prisma.user.update({
      where: { id },
      data: { is_verified: true },
    });
  }

  module.exports = { findByEmail, findById, createVerified, markVerified };
}
