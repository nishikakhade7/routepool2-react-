/**
 * Database configuration.
 * =======================
 * Exports `withTransaction` backed by Prisma's interactive transactions
 * when USE_MOCK_DB is false.
 *
 * Prisma is loaded lazily (only when USE_MOCK_DB=false) so that the mock
 * server can start without a generated Prisma client.
 */

const USE_MOCK = process.env.USE_MOCK_DB === 'true';

/**
 * Runs `fn(tx)` inside a Prisma interactive transaction.
 * The `tx` argument is a scoped Prisma client, so model functions that
 * accept an optional client parameter work transparently.
 *
 * In mock mode this is a simple passthrough (mock store is synchronous).
 *
 * @param {(tx: any) => Promise<any>} fn
 */
async function withTransaction(fn) {
  if (USE_MOCK) {
    // Mock store has no real transactions; just call fn with a dummy client.
    return fn(null);
  }
  // Lazy-load so that mock mode never imports @prisma/client
  const prisma = require('./prisma');
  return prisma.$transaction((tx) => fn(tx));
}

/**
 * Returns the Prisma singleton (only available when USE_MOCK_DB=false).
 */
function getPrisma() {
  if (USE_MOCK) throw new Error('Prisma is not available in mock mode');
  return require('./prisma');
}

module.exports = { withTransaction, getPrisma };
