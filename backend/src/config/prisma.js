/**
 * Prisma Client Singleton
 * =======================
 * Exports a single PrismaClient instance reused across all model files.
 * Never create `new PrismaClient()` in individual request handlers.
 *
 * In development, attaches the instance to `globalThis` so hot-reloads
 * (nodemon) don't exhaust the connection pool.
 */

const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown: release connections when process exits
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
