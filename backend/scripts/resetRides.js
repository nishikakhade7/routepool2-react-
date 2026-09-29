// Dev-only: wipe all ride state (requests, groups + their drivers, members, chat)
// but keep user accounts, so everyone stays logged in.
//   npm run reset-rides
// Works whether the backend is running or not:
//   - running  -> POST /api/dev/reset-rides (clears memory and saves to disk at once)
//   - stopped  -> clears the saved snapshot (.mockdb.json) directly
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');

if (process.env.USE_MOCK_DB !== 'true') {
  console.error('reset-rides only works with USE_MOCK_DB=true (it never touches a real database).');
  process.exit(1);
}

const port = process.env.PORT || 4000;
const DB_FILE = process.env.MOCK_DB_FILE || path.join(__dirname, '../.mockdb.json');
const TABLES = ['rideRequests', 'groups', 'groupMembers', 'chatMessages'];

(async () => {
  try {
    const res = await fetch(`http://localhost:${port}/api/dev/reset-rides`, { method: 'POST' });
    if (!res.ok) throw new Error(`server answered ${res.status} (is it running with USE_MOCK_DB=true?)`);
    console.log('Reset via running backend:', (await res.json()).cleared);
  } catch (e) {
    if (e.cause?.code !== 'ECONNREFUSED') { console.error('Reset failed:', e.message); process.exit(1); }
    if (!fs.existsSync(DB_FILE)) { console.log('Backend not running and no saved data - already clean.'); return; }
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const cleared = Object.fromEntries(TABLES.map((t) => [t, (db[t] || []).length]));
    for (const t of TABLES) db[t] = [];
    fs.writeFileSync(DB_FILE, JSON.stringify(db));
    console.log('Backend not running - cleared saved data file directly:', cleared);
  }
})();
