const userModel = require('../../models/user.model');
const rideRequestModel = require('../../models/rideRequest.model');
const { pool } = require('../../config/db');
const ApiError = require('../../utils/ApiError');

async function getStats(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const { rows: activity } = await pool.query(
    `SELECT g.id AS group_id, g.departure_time, g.status, gm.fare_share,
            dn.name AS drop_name, dn.short_name AS drop_short, rr.solo_fare
     FROM group_members gm
     JOIN groups g ON g.id = gm.group_id
     JOIN ride_requests rr ON rr.id = gm.ride_request_id
     JOIN nodes dn ON dn.id = gm.drop_node_id
     WHERE gm.user_id = $1
     ORDER BY g.departure_time DESC
     LIMIT 5`,
    [userId]
  );

  return {
    totalRides: user.total_rides,
    totalSavings: Number(user.total_savings),
    recentActivity: activity.map((a) => ({
      groupId: a.group_id,
      dropName: a.drop_name,
      dropShort: a.drop_short,
      departureTime: a.departure_time,
      status: a.status,
      fareShare: Number(a.fare_share),
      soloFare: Number(a.solo_fare),
      saved: +(Number(a.solo_fare) - Number(a.fare_share)).toFixed(2),
    })),
  };
}

async function getBusyRoutes() {
  const rows = await rideRequestModel.busyRoutes(5);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return rows.map((r) => ({
    name: `${r.pickupName} → ${r.dropName}`,
    dropShort: r.dropShort,
    count: r.count,
    widthPct: Math.round((r.count / max) * 100),
  }));
}

module.exports = { getStats, getBusyRoutes };
