const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').otpModel;
} else {
  const prisma = require('../config/prisma');

  async function create({ email, codeHash, expiresAt }) {
    return prisma.otpCode.create({
      data: { email, code_hash: codeHash, expires_at: new Date(expiresAt) },
    });
  }

  async function findLatestActive(email) {
    return prisma.otpCode.findFirst({
      where: {
        email,
        consumed: false,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async function consume(id) {
    await prisma.otpCode.update({
      where: { id },
      data: { consumed: true },
    });
  }

  async function invalidateAllForEmail(email) {
    await prisma.otpCode.updateMany({
      where: { email, consumed: false },
      data: { consumed: true },
    });
  }

  module.exports = { create, findLatestActive, consume, invalidateAllForEmail };
}
