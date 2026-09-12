const userModel = require('../../models/user.model');
const rideRequestModel = require('../../models/rideRequest.model');
const ApiError = require('../../utils/ApiError');

const USE_MOCK = process.env.USE_MOCK_DB === 'true';

async function getStats(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  let recentActivity = [];

  if (USE_MOCK) {
    // Build recent activity entirely in-memory from the mock store's raw tables
    const { _db } = require('../../db/mockStore');
    const myMembers = _db.groupMembers
      .filter(m => m.user_id === userId)
      .slice(0, 5);

    recentActivity = myMembers.map(m => {
      const g  = _db.groups.find(g => g.id === m.group_id) || {};
      const dn = _db.nodes.find(n => n.id === m.drop_node_id) || {};
      const rr = _db.rideRequests.find(r => r.id === m.ride_request_id) || {};
      const pn = _db.nodes.find(n => n.id === rr.pickup_node_id) || {};
      const fareShare = Number(m.fare_share);
      const soloFare  = Number(rr.solo_fare || 0);
      return {
        groupId:       g.id,
        pickupName:    pn.name || '—',
        dropName:      dn.name,
        dropShort:     dn.short_name,
        departureTime: g.departure_time,
        status:        g.status,
        fareShare,
        soloFare,
        saved: +(soloFare - fareShare).toFixed(2),
      };
    }).filter(a => a.groupId);
  } else {
    const { pool } = require('../../config/db');
    const { rows: activity } = await pool.query(
      `SELECT g.id AS group_id, g.departure_time, g.status, gm.fare_share,
              pn.name AS pickup_name,
              dn.name AS drop_name, dn.short_name AS drop_short, rr.solo_fare
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       JOIN ride_requests rr ON rr.id = gm.ride_request_id
       JOIN nodes pn ON pn.id = rr.pickup_node_id
       JOIN nodes dn ON dn.id = gm.drop_node_id
       WHERE gm.user_id = $1
       ORDER BY g.departure_time DESC
       LIMIT 5`,
      [userId]
    );
    recentActivity = activity.map((a) => ({
      groupId:       a.group_id,
      pickupName:    a.pickup_name,
      dropName:      a.drop_name,
      dropShort:     a.drop_short,
      departureTime: a.departure_time,
      status:        a.status,
      fareShare:     Number(a.fare_share),
      soloFare:      Number(a.solo_fare),
      saved: +(Number(a.solo_fare) - Number(a.fare_share)).toFixed(2),
    }));
  }

  return {
    totalRides:     user.total_rides,
    totalSavings:   Number(user.total_savings),
    recentActivity,
  };
}

async function getBusyRoutes() {
  const rows = await rideRequestModel.busyRoutes(5);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return rows.map((r) => ({
    name:     `${r.pickupName} → ${r.dropName}`,
    dropShort: r.dropShort,
    count:    r.count,
    widthPct: Math.round((r.count / max) * 100),
  }));
}

async function getHistory(userId) {
  if (USE_MOCK) {
    const { _db } = require('../../db/mockStore');
    const myMembers = _db.groupMembers.filter(m => m.user_id === userId);

    return myMembers.map(m => {
      const g  = _db.groups.find(g => g.id === m.group_id) || {};
      const dn = _db.nodes.find(n => n.id === m.drop_node_id) || {};
      const rr = _db.rideRequests.find(r => r.id === m.ride_request_id) || {};
      const pn = _db.nodes.find(n => n.id === rr.pickup_node_id) || {};
      const fareShare = Number(m.fare_share);
      const soloFare  = Number(rr.solo_fare || 0);

      const coRiders = _db.groupMembers
        .filter(gm => gm.group_id === m.group_id && gm.user_id !== userId)
        .map(gm => {
          const u = _db.users.find(u => u.id === gm.user_id);
          return u ? u.initials : '??';
        });

      return {
        groupId: g.id,
        pickupName: pn.name || '—',
        dropName: dn.name,
        departureTime: g.departure_time,
        status: g.status,
        fareShare,
        soloFare,
        saved: +(soloFare - fareShare).toFixed(2),
        coRiders,
      };
    })
    .filter(a => a.groupId)
    .sort((a, b) => new Date(b.departureTime) - new Date(a.departureTime));
  }

  const { pool } = require('../../config/db');
  const { rows } = await pool.query(
    `SELECT g.id AS group_id, g.departure_time, g.status, gm.fare_share,
            pn.name AS pickup_name,
            dn.name AS drop_name, rr.solo_fare,
            array_agg(u.initials ORDER BY u.name) FILTER (WHERE u.id != $1) AS co_riders
     FROM group_members gm
     JOIN groups g ON g.id = gm.group_id
     JOIN ride_requests rr ON rr.id = gm.ride_request_id
     JOIN nodes pn ON pn.id = rr.pickup_node_id
     JOIN nodes dn ON dn.id = gm.drop_node_id
     JOIN group_members gm2 ON gm2.group_id = g.id
     JOIN users u ON u.id = gm2.user_id
     WHERE gm.user_id = $1
     GROUP BY g.id, g.departure_time, g.status, gm.fare_share, pn.name, dn.name, rr.solo_fare
     ORDER BY g.departure_time DESC`,
    [userId]
  );
  return rows.map(r => ({
    groupId:       r.group_id,
    pickupName:    r.pickup_name,
    dropName:      r.drop_name,
    departureTime: r.departure_time,
    status:        r.status,
    fareShare:     Number(r.fare_share),
    soloFare:      Number(r.solo_fare),
    saved: +(Number(r.solo_fare) - Number(r.fare_share)).toFixed(2),
    coRiders:      r.co_riders || [],
  }));
}

async function getCampusStats() {
  if (USE_MOCK) {
    const { _db } = require('../../db/mockStore');
    const totalPools   = _db.groups.length;
    const totalUsers   = _db.users.length;
    const totalSavings = _db.users.reduce((s, u) => s + Number(u.total_savings || 0), 0);
    const avgFare = totalPools > 0
      ? _db.groups.reduce((s, g) => s + Number(g.total_fare || 0), 0) / totalPools
      : 0;
    return { totalUsers, totalPools, avgFare: +avgFare.toFixed(0), totalSavings: +totalSavings.toFixed(0) };
  }

  const { pool } = require('../../config/db');
  const [{ rows: [gs] }, { rows: [us] }] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total_pools, AVG(total_fare) AS avg_fare FROM groups`),
    pool.query(`SELECT COUNT(*) AS total_users, SUM(total_savings) AS total_savings FROM users`),
  ]);
  return {
    totalUsers:   Number(us.total_users),
    totalPools:   Number(gs.total_pools),
    avgFare:      +Number(gs.avg_fare || 0).toFixed(0),
    totalSavings: Number(us.total_savings || 0),
  };
}

module.exports = { getStats, getBusyRoutes, getHistory, getCampusStats };
