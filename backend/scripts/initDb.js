require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'init.sql'), 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Database initialized successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
