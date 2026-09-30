/**
 * Fetch real driving distances between consecutive stops and cache them in
 * src/config/stopEdges.json:
 *
 *   node scripts/buildStopEdges.js
 *
 * Uses free OpenStreetMap services - no API key, no billing:
 *   - Nominatim (nominatim.openstreetmap.org) to look up each stop's coordinates
 *   - OSRM     (router.project-osrm.org)      for road distances between them
 *
 * Run it again after editing STOPS in src/config/stopGraph.js. Nothing calls
 * these services at request time: the app reads the cached file, so the demo
 * works offline and costs nothing.
 *
 * Dijkstra is unchanged - this only replaces the placeholder edge weights it
 * runs on. Edges stay consecutive-stop-only (a corridor), because matching
 * pools riders whose routes overlap along the same road.
 *
 * ponytail: public demo servers, fine for this scale - swap in a paid provider
 * (Google Routes, Mapbox) here if it ever needs rate limits or an SLA.
 */
const fs = require('fs');
const path = require('path');
const { STOPS } = require('../src/config/stopGraph');

const CITY = process.env.STOP_CITY || 'Mumbai, Maharashtra, India';
const OUT = path.join(__dirname, '../src/config/stopEdges.json');
// Nominatim's usage policy requires a real identifying User-Agent and <=1 request/second.
const UA = 'RoutePool-student-project/1.0 (https://github.com/nishikakhade7/routepool2-react-)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${query}, ${CITY}`)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Nominatim ${res.status} for "${query}"`);
  const [hit] = await res.json();
  return hit ? { lat: +hit.lat, lng: +hit.lon, label: hit.display_name } : null;
}

// A stop's display name isn't always a place OSM knows ("SPIT Campus (Gate 2)"),
// so fall back to its geoQuery override, the name without brackets, then its aliases.
async function geocode(stop) {
  const tried = [];
  for (const query of [stop.geoQuery, stop.name, stop.name.replace(/\(.*?\)/g, '').trim(), ...(stop.aliases || [])]) {
    if (!query || tried.includes(query)) continue;
    tried.push(query);
    const hit = await lookup(query);
    if (hit) return hit;
    await sleep(1100);
  }
  throw new Error(`No coordinates found for "${stop.name}". Add a geoQuery to that stop in src/config/stopGraph.js (tried: ${tried.join(', ')}).`);
}

async function drivingDistanceMatrix(points) {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const res = await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?annotations=distance`);
  const body = await res.json();
  if (!res.ok || body.code !== 'Ok') throw new Error(`OSRM: ${body.message || res.status}`);
  return body.distances; // metres, [origin][destination]
}

(async () => {
  const coordinates = {};
  for (const stop of STOPS) {
    const hit = await geocode(stop);
    coordinates[stop.name] = { lat: hit.lat, lng: hit.lng };
    console.log(`  ${stop.name}: ${hit.lat}, ${hit.lng}  (${hit.label.slice(0, 50)})`);
    await sleep(1100); // stay inside Nominatim's 1 request/second policy
  }

  const matrix = await drivingDistanceMatrix(STOPS.map((s) => coordinates[s.name]));

  const distances = {};
  for (let i = 0; i < STOPS.length - 1; i++) {
    // Average both directions: one-ways make A->B and B->A differ, and the graph is undirected.
    const both = [matrix[i]?.[i + 1], matrix[i + 1]?.[i]].filter((v) => v != null);
    if (both.length === 0) throw new Error(`No route between "${STOPS[i].name}" and "${STOPS[i + 1].name}".`);
    distances[`${STOPS[i].name}|${STOPS[i + 1].name}`] = +(both.reduce((a, b) => a + b, 0) / both.length / 1000).toFixed(2);
  }

  fs.writeFileSync(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: 'osrm+nominatim', coordinates, distances }, null, 2)}\n`);
  console.log(`\nWrote ${OUT}`);
  for (const [pair, d] of Object.entries(distances)) console.log(`  ${pair.replace('|', ' → ')}: ${d} km`);
  console.log('\nRestart the backend. Existing ride requests keep their old distances: run scripts/resetRides.js to clear them.');
})().catch((e) => { console.error(e.message); process.exit(1); });
