/**
 * RoutePool — Prisma Seed Script
 * ===============================
 * Seeds the database with the same fixture data as db/init.sql.
 * Uses fixed UUIDs so the seed is idempotent (safe to re-run).
 *
 * Run: node prisma/seed.js   OR   npm run prisma:seed
 *
 * Requires: PostgreSQL running with PostGIS extension enabled.
 * Requires: DATABASE_URL set in .env
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ── Fixed UUIDs (match db/init.sql so seed is idempotent) ────────────────────

const NODE_SPIT     = '00000000-0000-0000-0000-000000000001';
const NODE_ANDHERI  = '00000000-0000-0000-0000-000000000002';
const NODE_JOG_W    = '00000000-0000-0000-0000-000000000003';
const NODE_JOG_E    = '00000000-0000-0000-0000-000000000004';
const NODE_MAROL    = '00000000-0000-0000-0000-000000000005';
const NODE_VILE     = '00000000-0000-0000-0000-000000000006';

const USER_NISHIKA  = '00000000-0000-0000-0000-000000000101';
const USER_RHEA     = '00000000-0000-0000-0000-000000000102';
const USER_KABIR    = '00000000-0000-0000-0000-000000000103';
const USER_ANANYA   = '00000000-0000-0000-0000-000000000104';

const GROUP_1       = '00000000-0000-0000-0000-000000000201';

const RR_1          = '00000000-0000-0000-0000-000000000301';
const RR_2          = '00000000-0000-0000-0000-000000000302';
const RR_3          = '00000000-0000-0000-0000-000000000303';
const RR_4          = '00000000-0000-0000-0000-000000000304';

async function main() {
  console.log('🌱 Starting RoutePool seed...');

  // ── 1. PostGIS extension ────────────────────────────────────────────────────
  // Ensure extensions exist before inserting nodes with geography columns.
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS postgis`);
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  // ── 2. Nodes (PostGIS geography — must use $executeRaw) ────────────────────
  console.log('  → Seeding nodes...');
  const nodeInserts = [
    { id: NODE_SPIT,    name: 'S.P.I.T Campus (Gate 2)', short: 'SPIT',        area: 'campus', lng: 72.8468, lat: 19.1197 },
    { id: NODE_ANDHERI, name: 'Andheri East',             short: 'ANDHERI E',   area: 'city',   lng: 72.8590, lat: 19.1150 },
    { id: NODE_JOG_W,   name: 'Jogeshwari West',          short: 'JOG WEST',    area: 'city',   lng: 72.8380, lat: 19.1360 },
    { id: NODE_JOG_E,   name: 'Jogeshwari East',          short: 'JOG EAST',    area: 'city',   lng: 72.8530, lat: 19.1360 },
    { id: NODE_MAROL,   name: 'Marol Naka',               short: 'MAROL',       area: 'city',   lng: 72.8790, lat: 19.1190 },
    { id: NODE_VILE,    name: 'Vile Parle',               short: 'VILE PARLE',  area: 'city',   lng: 72.8420, lat: 19.1000 },
  ];

  for (const n of nodeInserts) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO nodes (id, name, short_name, area, geom)
       VALUES ($1, $2, $3, $4::node_area, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)
       ON CONFLICT (id) DO NOTHING`,
      n.id, n.name, n.short, n.area, n.lng, n.lat
    );
  }

  // ── 3. Route edges ──────────────────────────────────────────────────────────
  console.log('  → Seeding route edges...');
  const edgeData = [
    { a: NODE_SPIT,    b: NODE_ANDHERI, km: 2.6 },
    { a: NODE_ANDHERI, b: NODE_MAROL,   km: 1.3 },
    { a: NODE_ANDHERI, b: NODE_JOG_W,   km: 3.2 },
    { a: NODE_JOG_W,   b: NODE_JOG_E,   km: 1.6 },
    { a: NODE_SPIT,    b: NODE_VILE,    km: 4.5 },
  ];

  for (const e of edgeData) {
    // Use upsert-by-content (no fixed UUID for edges)
    const exists = await prisma.routeEdge.findFirst({
      where: { node_a_id: e.a, node_b_id: e.b },
    });
    if (!exists) {
      await prisma.routeEdge.create({
        data: { node_a_id: e.a, node_b_id: e.b, distance_km: e.km },
      });
    }
  }

  // ── 4. Users ────────────────────────────────────────────────────────────────
  console.log('  → Seeding users...');
  const users = [
    { id: USER_NISHIKA, email: 'nishika.khade@spit.ac.in',    name: 'Nishika Khade',    initials: 'NK', branch: 'TE Computer Engineering', is_verified: true, total_rides: 3, total_savings: 2340.00 },
    { id: USER_RHEA,    email: 'rhea.menon@spit.ac.in',       name: 'Rhea Menon',       initials: 'RM', branch: 'TE Computer Engineering', is_verified: true, total_rides: 2, total_savings: 860.00  },
    { id: USER_KABIR,   email: 'kabir.shetty@spit.ac.in',     name: 'Kabir Shetty',     initials: 'KS', branch: 'BE IT',                   is_verified: true, total_rides: 4, total_savings: 1510.00 },
    { id: USER_ANANYA,  email: 'ananya.deshpande@spit.ac.in', name: 'Ananya Deshpande', initials: 'AD', branch: 'SE EXTC',                 is_verified: true, total_rides: 1, total_savings: 210.00  },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: u,
    });
  }

  // ── 5. Group ────────────────────────────────────────────────────────────────
  console.log('  → Seeding confirmed group...');
  const departureTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2h from now
  await prisma.group.upsert({
    where: { id: GROUP_1 },
    update: {},
    create: {
      id: GROUP_1,
      pickup_node_id: NODE_SPIT,
      departure_time: departureTime,
      total_fare: 159.84,
      status: 'confirmed',
    },
  });

  // ── 6. Ride requests ────────────────────────────────────────────────────────
  console.log('  → Seeding ride requests...');
  const wStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const wEnd   = new Date(Date.now() + 2.5 * 60 * 60 * 1000);

  const rideRequests = [
    { id: RR_1, user_id: USER_NISHIKA, pickup_node_id: NODE_SPIT, drop_node_id: NODE_JOG_E,   window_start: wStart, window_end: wEnd, flex_minutes: 10, status: 'matched', estimated_distance_km: 7.4,  solo_fare: 159.84, group_id: GROUP_1 },
    { id: RR_2, user_id: USER_RHEA,    pickup_node_id: NODE_SPIT, drop_node_id: NODE_ANDHERI, window_start: wStart, window_end: wEnd, flex_minutes: 10, status: 'matched', estimated_distance_km: 2.6,  solo_fare: 56.16,  group_id: GROUP_1 },
    { id: RR_3, user_id: USER_KABIR,   pickup_node_id: NODE_SPIT, drop_node_id: NODE_JOG_W,   window_start: wStart, window_end: wEnd, flex_minutes: 10, status: 'matched', estimated_distance_km: 5.8,  solo_fare: 125.28, group_id: GROUP_1 },
    { id: RR_4, user_id: USER_ANANYA,  pickup_node_id: NODE_SPIT, drop_node_id: NODE_MAROL,   window_start: wStart, window_end: wEnd, flex_minutes: 10, status: 'open',    estimated_distance_km: 3.9,  solo_fare: 84.24,  group_id: null    },
  ];

  for (const rr of rideRequests) {
    await prisma.rideRequest.upsert({
      where: { id: rr.id },
      update: {},
      create: rr,
    });
  }

  // ── 7. Group members ────────────────────────────────────────────────────────
  console.log('  → Seeding group members...');
  const members = [
    { group_id: GROUP_1, user_id: USER_NISHIKA, ride_request_id: RR_1, drop_node_id: NODE_JOG_E,   fare_share: 87.84, status: 'confirmed' },
    { group_id: GROUP_1, user_id: USER_RHEA,    ride_request_id: RR_2, drop_node_id: NODE_ANDHERI, fare_share: 18.72, status: 'confirmed' },
    { group_id: GROUP_1, user_id: USER_KABIR,   ride_request_id: RR_3, drop_node_id: NODE_JOG_W,   fare_share: 53.28, status: 'confirmed' },
  ];

  for (const m of members) {
    await prisma.groupMember.upsert({
      where: { group_id_user_id: { group_id: m.group_id, user_id: m.user_id } },
      update: {},
      create: m,
    });
  }

  // ── 8. Chat messages ────────────────────────────────────────────────────────
  console.log('  → Seeding chat messages...');
  const messages = [
    { group_id: GROUP_1, user_id: USER_NISHIKA, message: "Heyy, matched with you two for tonight's pool 🎉", created_at: new Date(Date.now() - 20 * 60000) },
    { group_id: GROUP_1, user_id: USER_RHEA,    message: 'Perfect, see you at Gate 2!',                       created_at: new Date(Date.now() - 18 * 60000) },
    { group_id: GROUP_1, user_id: USER_KABIR,   message: "I'll be 2 min late, hold the auto 🙏",              created_at: new Date(Date.now() - 12 * 60000) },
  ];

  // Chat messages don't have fixed IDs in init.sql, use createMany with skipDuplicates
  // We check by group+user+message to avoid duplication
  for (const msg of messages) {
    const exists = await prisma.chatMessage.findFirst({
      where: { group_id: msg.group_id, user_id: msg.user_id, message: msg.message },
    });
    if (!exists) {
      await prisma.chatMessage.create({ data: msg });
    }
  }

  console.log('✅ Seed complete! Database is ready for development.');
  console.log('');
  console.log('   Seeded users:');
  console.log('   • nishika.khade@spit.ac.in');
  console.log('   • rhea.menon@spit.ac.in');
  console.log('   • kabir.shetty@spit.ac.in');
  console.log('   • ananya.deshpande@spit.ac.in');
  console.log('');
  console.log('   Login tip: run the backend (npm run dev) and POST to');
  console.log('   /api/auth/send-otp with one of the emails above.');
  console.log('   The OTP will be printed in the backend terminal (DEV mode).');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e.message);
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
