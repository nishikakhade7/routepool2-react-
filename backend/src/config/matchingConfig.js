/**
 * Matching algorithm configuration.
 * All tuneable matching constants live here so they can be adjusted in one place.
 */

/**
 * Two riders are time-compatible if the absolute difference between their
 * requested pickup times is at most this many minutes.
 * Also used by rides.service.js to synthesise the window_start / window_end
 * values written to the database (pickupTime ± MATCH_BUFFER_MINUTES).
 *
 * To change the buffer, edit only this value — no other file needs updating.
 */
const MATCH_BUFFER_MINUTES = 5;

module.exports = { MATCH_BUFFER_MINUTES };
