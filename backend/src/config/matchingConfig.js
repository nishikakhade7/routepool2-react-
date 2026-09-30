/**
 * Matching algorithm configuration.
 * All tuneable matching constants live here so they can be adjusted in one place.
 * (Stops and their distances live in stopGraph.js.)
 */

/**
 * Time window: two riders can share an auto only if their requested pickup
 * times are at most this many minutes apart.
 * Also used by rides.service.js to synthesise the window_start / window_end
 * values written to the database (pickupTime ± MATCH_BUFFER_MINUTES).
 *
 * To change the window, edit only this value — no other file needs updating.
 * (Run `npm run reset-rides` after changing it: stored requests use the old offset.)
 */
const MATCH_BUFFER_MINUTES = 10;

// One auto seats this many riders; a group stays 'forming' (joinable) until full.
const MAX_GROUP_SIZE = 3;

/**
 * Route overlap (eligibility): a rider is only offered a group if the shared
 * stretch of road is at least this fraction of the SHORTER of the two routes
 * (rider's route vs the group's route). A trip lying entirely inside the other
 * counts as 1 (100%) however much longer the other trip is, e.g. Andheri ->
 * Marol Naka inside Andheri -> Ghatkopar. Opposite directions share 0 and never match.
 */
const MIN_ROUTE_OVERLAP = 0.5;

// How the "best match" ranking weighs route similarity (shared km / LONGER
// route, so only identical routes score 1) vs pickup-time closeness.
const SCORE_WEIGHTS = { similarity: 0.7, time: 0.3 };

// Leaving is locked this many minutes before pickup: the others have planned
// their auto and fare around you, so a last-minute exit strands them.
const LEAVE_LOCK_MINUTES = 10;

module.exports = { MATCH_BUFFER_MINUTES, MAX_GROUP_SIZE, MIN_ROUTE_OVERLAP, SCORE_WEIGHTS, LEAVE_LOCK_MINUTES };
