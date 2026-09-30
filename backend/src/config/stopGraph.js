/**
 * Stop-distance graph — temporary stand-in for real GPS routing.
 * ==============================================================
 * EDIT THE STOPS BELOW. `kmFromCampus` values are placeholders.
 *
 * Stops are listed in road order. Each consecutive pair becomes one weighted
 * edge (weight = difference in kmFromCampus), so right now the graph is a
 * straight line. Routing still goes through the general Dijkstra in
 * utils/dijkstra.js, so real GPS/Google Maps edges can replace STOP_EDGES later
 * (any { nodeAId, nodeBId, distanceKm } list works) without touching matching or fares.
 *
 * `aliases` are extra words a student might type for that stop (matched
 * case-insensitively, partial matches allowed — see utils/stopMatcher.js).
 *
 * After editing, delete backend/.mockdb.json and restart the backend so old
 * requests/groups pointing at the previous stops are cleared.
 */
const { createHash } = require('crypto');

const STOPS = [
  // geoQuery: what OpenStreetMap calls this place (used by scripts/buildStopEdges.js
  // when the display name above isn't a place on the map).
  { name: 'SPIT Campus (Gate 2)', shortName: 'SPIT',       kmFromCampus: 0,   aliases: ['spit', 'campus', 'college', 'gate 2', 'sp it'], geoQuery: 'Sardar Patel Institute of Technology' },
  { name: 'Azad Nagar',           shortName: 'AZAD NAGAR', kmFromCampus: 1.2, aliases: ['azad'] },
  { name: 'Andheri',              shortName: 'ANDHERI',    kmFromCampus: 2.5, aliases: ['andheri east', 'andheri west', 'andheri station'] },
  { name: 'Marol Naka',           shortName: 'MAROL',      kmFromCampus: 4.0, aliases: ['marol'] },
  { name: 'Saki Naka',            shortName: 'SAKI NAKA',  kmFromCampus: 6.0, aliases: ['saki', 'sakinaka'] },
  { name: 'Ghatkopar',            shortName: 'GHATKOPAR',  kmFromCampus: 9.5, aliases: ['ghatkopar station'] },
];

// Stable UUID per stop name (ride requests store node ids, and the API validates UUIDs),
// so reordering stops doesn't change ids.
function stopId(name) {
  const h = createHash('md5').update(`routepool-stop:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// Real coordinates + driving distances written by scripts/buildStopEdges.js
// (OpenStreetMap). Missing file (nobody has run it yet) -> fall back to the
// kmFromCampus placeholders and no coordinates.
let realDistances = {};
let realCoordinates = {};
try {
  const cached = require('./stopEdges.json');
  realDistances = cached.distances || {};
  realCoordinates = cached.coordinates || {};
} catch { /* not generated yet */ }

const STOP_NODES = STOPS.map((s) => ({
  id: stopId(s.name),
  name: s.name,
  short_name: s.shortName,
  area: s.kmFromCampus === 0 ? 'campus' : 'city',
  kmFromCampus: s.kmFromCampus,
  aliases: s.aliases || [],
  lat: realCoordinates[s.name]?.lat ?? null,
  lng: realCoordinates[s.name]?.lng ?? null,
}));


const STOP_EDGES = STOP_NODES.slice(1).map((n, i) => ({
  id: `edge-${i}`,
  nodeAId: STOP_NODES[i].id,
  nodeBId: n.id,
  distanceKm: realDistances[`${STOP_NODES[i].name}|${n.name}`]
    ?? +Math.abs(n.kmFromCampus - STOP_NODES[i].kmFromCampus).toFixed(2),
}));

module.exports = { STOPS, STOP_NODES, STOP_EDGES, usingRealDistances: Object.keys(realDistances).length > 0 };
