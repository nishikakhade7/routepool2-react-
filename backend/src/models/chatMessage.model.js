const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').chatMessageModel;
} else {
  const prisma = require('../config/prisma');

  async function create({ groupId, userId, message }) {
    return prisma.chatMessage.create({
      data: { group_id: groupId, user_id: userId, message },
    });
  }

  async function listByGroup(groupId, { limit = 100 } = {}) {
    const messages = await prisma.chatMessage.findMany({
      where:   { group_id: groupId },
      orderBy: { created_at: 'asc' },
      take:    limit,
      include: {
        user: { select: { id: true, name: true, initials: true } },
      },
    });

    return messages.map((m) => ({
      id:         m.id,
      message:    m.message,
      created_at: m.created_at,
      user_id:    m.user_id,
      name:       m.user.name,
      initials:   m.user.initials,
    }));
  }

  module.exports = { create, listByGroup };
}
