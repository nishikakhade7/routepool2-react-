const userModel = require('../../models/user.model');
const rideRequestModel = require('../../models/rideRequest.model');
const ApiError = require('../../utils/ApiError');
const { MATCH_BUFFER_MINUTES } = require('../../config/matchingConfig');

const USE_MOCK = process.env.USE_MOCK_DB === 'true';
const BUFFER_MS = MATCH_BUFFER_MINUTES * 60000;

// groups.departure_time stores pickup - buffer (see rides.service), so the
// real pickup time is departure + buffer.
const pickupTimeOf = (departureTime) => new Date(new Date(departureTime).getTime() + BUFFER_MS);

// Still happening: in a forming/confirmed group whose pickup hasn't passed the window.
const isActive = (row) => (row.status === 'forming' || row.status === 'confirmed')
  && new Date(row.departureTime).getTime() >= Date.now() - BUFFER_MS;

function toRow({ groupId, pickupName, dropName, dropShort, departureTime, status, fareShare, soloFare, coRiders, coRiderNames }) {
  const row = {
    groupId,
    pickupName: pickupName || '—',
    dropName,
    dropShort,
    departureTime: pickupTimeOf(departureTime).toISOString(),
    status,
    fareShare: Number(fareShare),
    soloFare: Number(soloFare || 0),
    saved: +(Number(soloFare || 0) - Number(fareShare)).toFixed(2),
    coRiders,
    coRiderNames,
  };
  row.active = isActive(row);
  return row;
}

/**
 * Every ride (group membership) of this user, newest first. This is the single
 * source for the History table, History's summary tiles, and the Dashboard's
 * "Tonight's pool", recent activity and savings - so they can't disagree.
 */
async function getHistory(userId) {
  if (USE_MOCK) {
    const { _db } = require('../../db/mockStore');
    return _db.groupMembers
      .filter((m) => m.user_id === userId)
      .map((m) => {
        const g = _db.groups.find((x) => x.id === m.group_id);
        if (!g) return null;
        const dn = _db.nodes.find((n) => n.id === m.drop_node_id) || {};
        const rr = _db.rideRequests.find((r) => r.id === m.ride_request_id) || {};
        const pn = _db.nodes.find((n) => n.id === (rr.pickup_node_id || g.pickup_node_id)) || {};
        const others = _db.groupMembers
          .filter((gm) => gm.group_id === m.group_id && gm.user_id !== userId)
          .map((gm) => _db.users.find((u) => u.id === gm.user_id) || {});
        return toRow({
          groupId: g.id,
          pickupName: pn.name,
          dropName: dn.name,
          dropShort: dn.short_name,
          departureTime: g.departure_time,
          status: g.status,
          fareShare: m.fare_share,
          soloFare: rr.solo_fare,
          coRiders: others.map((u) => u.initials || '??'),
          coRiderNames: others.map((u) => u.name || 'Unknown'),
        });
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.departureTime) - new Date(a.departureTime));
  }

  const prisma = require('../../config/prisma');
  const rows = await prisma.$queryRaw`
    SELECT g.id           AS group_id,
           g.departure_time,
           g.status::text,
           gm.fare_share,
           pn.name        AS pickup_name,
           dn.name        AS drop_name,
           dn.short_name  AS drop_short,
           rr.solo_fare,
           array_agg(u.initials ORDER BY u.name)
             FILTER (WHERE u.id != ${userId}::uuid) AS co_riders,
           array_agg(u.name ORDER BY u.name)
             FILTER (WHERE u.id != ${userId}::uuid) AS co_rider_names
    FROM group_members gm
    JOIN groups g         ON g.id   = gm.group_id
    JOIN ride_requests rr ON rr.id  = gm.ride_request_id
    JOIN nodes pn         ON pn.id  = rr.pickup_node_id
    JOIN nodes dn         ON dn.id  = gm.drop_node_id
    JOIN group_members gm2 ON gm2.group_id = g.id
    JOIN users u           ON u.id  = gm2.user_id
    WHERE gm.user_id = ${userId}::uuid
    GROUP BY g.id, g.departure_time, g.status, gm.fare_share,
             pn.name, dn.name, dn.short_name, rr.solo_fare
    ORDER BY g.departure_time DESC
  `;
  return rows.map((r) => toRow({
    groupId: r.group_id,
    pickupName: r.pickup_name,
    dropName: r.drop_name,
    dropShort: r.drop_short,
    departureTime: r.departure_time,
    status: r.status,
    fareShare: r.fare_share,
    soloFare: r.solo_fare,
    coRiders: r.co_riders || [],
    coRiderNames: r.co_rider_names || [],
  }));
}

// Totals over exactly the rows getHistory returns (cancelled rides excluded).
function summarize(rows) {
  const counted = rows.filter((r) => r.status !== 'cancelled');
  return {
    totalRides: counted.length,
    totalSavings: +counted.reduce((s, r) => s + Math.max(0, r.saved), 0).toFixed(2),
    avgFare: counted.length ? +(counted.reduce((s, r) => s + r.fareShare, 0) / counted.length).toFixed(2) : 0,
  };
}

async function getStats(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const rows = await getHistory(userId);
  // Soonest upcoming active ride = "Tonight's pool".
  const activeRide = rows.filter((r) => r.active)
    .sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime))[0] || null;

  return {
    ...summarize(rows),
    activeRide,
    recentActivity: rows.slice(0, 5),
  };
}

async function getBusyRoutes() {
  const rows = await rideRequestModel.busyRoutes(5);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return rows.map((r) => ({
    name:      `${r.pickupName} → ${r.dropName}`,
    pickupShort: r.pickupShort,
    dropShort:  r.dropShort,
    count:      r.count,
    widthPct:   Math.round((r.count / max) * 100),
  }));
}

// Campus insights: every number derived from real ride data, never from the
// seeded users.total_savings column (which no real ride ever updates).
// A "pool" = a non-cancelled group of 2+ riders; a solo ride isn't one.
// Savings = what each pooled rider would have paid alone minus their share.
async function getCampusStats() {
  const HOUR_BUCKETS = [8, 10, 12, 14, 16, 18, 20];
  const bucketOf = (date) => {
    const h = new Date(date).getHours();
    for (let i = HOUR_BUCKETS.length - 1; i >= 0; i--) if (h >= HOUR_BUCKETS[i]) return i;
    return null; // before the first bucket: not shown on the chart
  };

  if (USE_MOCK) {
    const { _db } = require('../../db/mockStore');
    const liveRequests = _db.rideRequests.filter((r) => r.status !== 'cancelled');
    const reqById = Object.fromEntries(_db.rideRequests.map((r) => [r.id, r]));

    const pools = _db.groups
      .filter((g) => g.status !== 'cancelled')
      .map((g) => ({ g, members: _db.groupMembers.filter((m) => m.group_id === g.id) }))
      .filter(({ members }) => members.length >= 2);

    const totalSavings = pools.reduce((sum, { members }) => sum + members.reduce((s, m) => {
      const solo = Number(reqById[m.ride_request_id]?.solo_fare || 0);
      return s + Math.max(0, solo - Number(m.fare_share || 0));
    }, 0), 0);

    const avgFare = pools.length
      ? pools.reduce((s, { g }) => s + Number(g.total_fare || 0), 0) / pools.length
      : 0;

    const byHour = HOUR_BUCKETS.map(() => 0);
    for (const r of liveRequests) {
      const i = bucketOf(r.window_start);
      if (i !== null) byHour[i] += 1;
    }

    return {
      totalUsers: new Set(liveRequests.map((r) => r.user_id)).size, // students who actually requested a ride
      totalPools: pools.length,
      avgFare: +avgFare.toFixed(0),
      totalSavings: +totalSavings.toFixed(0),
      hourLabels: HOUR_BUCKETS.map((h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`),
      byHour,
    };
  }

  const prisma = require('../../config/prisma');
  const [[totals], [savings], hours] = await Promise.all([
    prisma.$queryRaw`
      WITH pools AS (
        SELECT g.id, g.total_fare
        FROM groups g
        JOIN group_members gm ON gm.group_id = g.id
        WHERE g.status <> 'cancelled'
        GROUP BY g.id, g.total_fare
        HAVING COUNT(*) >= 2
      )
      SELECT (SELECT COUNT(DISTINCT user_id)::int FROM ride_requests WHERE status <> 'cancelled') AS total_users,
             (SELECT COUNT(*)::int FROM pools)                                                    AS total_pools,
             (SELECT COALESCE(AVG(total_fare), 0) FROM pools)                                     AS avg_fare`,
    prisma.$queryRaw`
      WITH pools AS (
        SELECT g.id FROM groups g
        JOIN group_members gm ON gm.group_id = g.id
        WHERE g.status <> 'cancelled'
        GROUP BY g.id HAVING COUNT(*) >= 2
      )
      SELECT COALESCE(SUM(GREATEST(r.solo_fare - gm.fare_share, 0)), 0) AS total_savings
      FROM group_members gm
      JOIN pools p ON p.id = gm.group_id
      JOIN ride_requests r ON r.id = gm.ride_request_id`,
    prisma.$queryRaw`
      SELECT EXTRACT(HOUR FROM window_start)::int AS hour, COUNT(*)::int AS count
      FROM ride_requests WHERE status <> 'cancelled' GROUP BY hour`,
  ]);

  const byHour = HOUR_BUCKETS.map(() => 0);
  for (const row of hours) {
    const i = bucketOf(new Date().setHours(row.hour, 0, 0, 0));
    if (i !== null) byHour[i] += Number(row.count);
  }

  return {
    totalUsers: Number(totals.total_users),
    totalPools: Number(totals.total_pools),
    avgFare: +Number(totals.avg_fare || 0).toFixed(0),
    totalSavings: +Number(savings.total_savings || 0).toFixed(0),
    hourLabels: HOUR_BUCKETS.map((h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`),
    byHour,
  };
}

module.exports = { getStats, getBusyRoutes, getHistory, getCampusStats, summarize };
