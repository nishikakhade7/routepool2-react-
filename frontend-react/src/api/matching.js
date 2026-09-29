/**
 * Shared ride-matching flow, used by both FormGroup (shows every match) and
 * Book (auto-picks the top-scored one) so the mock/real branching lives in
 * exactly one place instead of being duplicated per page.
 */
import { requestRide, getMatches, getNodes, USE_MOCK_MATCHING } from './client';

const words = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);

// ponytail: word-overlap match of free text to a node; swap for a real node picker when one lands.
function resolveNodeId(nodes, text) {
  const input = words(text);
  let best = null, bestScore = 0;
  for (const n of nodes) {
    const nodeWords = words(`${n.name} ${n.shortName ?? ''}`);
    const score = input.filter((w) => nodeWords.includes(w)).length;
    if (score > bestScore) { best = n; bestScore = score; }
  }
  if (!best) throw new Error(`Unknown place "${text}". Try one of: ${nodes.map((n) => n.name).join(', ')}`);
  return best.id;
}

const STAGE_DELAY_MS = 1500;

// Deterministic string hash so the same pickup/drop text always produces the
// same mock route distances (stable across re-renders/retries), while
// different text produces different distances.
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Deliberately field-name placeholders ("Trip Total", ...) rather than
// realistic-looking fake fare numbers — same reasoning as PLACEHOLDER_DRIVER
// in mockData/drivers.js: no real fare-splitting backend call happens on
// this path (see USE_MOCK_MATCHING below), so a plausible-looking number
// here would risk being mistaken for a real computed fare. Rendering code
// (formatFare in utils/formatFare.js) passes these through as plain text;
// once USE_MOCK_MATCHING is flipped off, the real backend's numeric
// fareShare/totalFare/soloFare flow through the same fields and render as
// currency automatically — no component changes needed.
const PLACEHOLDER_FARE = {
  yourShare: 'Your Share',
  riderShare: 'Rider Share',
  tripTotal: 'Trip Total',
  soloFare: 'Solo Fare',
};

// Builds a plausible two-stop shared route from the free-text pickup/drop
// (Book.jsx has no real node graph to measure yet) so distance-based fields
// (distanceKm, dropDistanceKm) still vary sensibly by route; the fare
// figures themselves stay placeholder text since there's no real fare-split
// computation behind this mock path.
function buildMockMatch(pickupText, dropText) {
  const seed = hashSeed(`${pickupText}|${dropText}`);
  // Student 2 drops off first (shorter leg), You continue further — mirrors
  // a real pooled route where the shared path telescopes outward.
  const studentDropKm = +(2 + (seed % 400) / 100).toFixed(1); // 2.0 - 5.9 km
  const yourDropKm = +(studentDropKm + 1.5 + ((seed >>> 8) % 500) / 100).toFixed(1); // +1.5 - 6.49 km more

  return {
    groupKey: 'mock1',
    isMock: true,
    score: 0.98,
    pickupNode: { name: pickupText, shortName: pickupText },
    distanceKm: yourDropKm,
    totalFare: PLACEHOLDER_FARE.tripTotal,
    departureTime: new Date().toISOString(),
    members: [
      { isYou: true, name: 'You', initials: 'YOU', dropNode: { name: dropText, shortName: dropText }, fareShare: PLACEHOLDER_FARE.yourShare, soloFare: PLACEHOLDER_FARE.soloFare, dropDistanceKm: yourDropKm },
      { name: 'Student 2', initials: 'S2', dropNode: { name: dropText, shortName: dropText }, fareShare: PLACEHOLDER_FARE.riderShare, dropDistanceKm: studentDropKm },
    ],
  };
}

/**
 * @param {object} params
 * @param {string} params.pickupText
 * @param {string} params.dropText
 * @param {string} [params.pickupTime]  ISO datetime; defaults to now if the
 *   caller doesn't collect one (Book.jsx has no time picker yet, unlike
 *   FormGroup.jsx's real flow).
 * @param {(stage: 'searching'|'grouping') => void} [params.onStageChange]
 *   Called as the flow progresses, so the caller can drive its own loading UI
 *   without duplicating the timing/branching here.
 * @returns {Promise<{ requestId: string|null, matches: object[] }>}
 */
export async function runMatchingFlow({ pickupText, dropText, pickupTime, onStageChange }) {
  onStageChange?.('searching');

  if (USE_MOCK_MATCHING) {
    await new Promise((r) => setTimeout(r, STAGE_DELAY_MS));
    onStageChange?.('grouping');
    await new Promise((r) => setTimeout(r, STAGE_DELAY_MS));
    return { requestId: null, matches: [buildMockMatch(pickupText, dropText)] };
  }

  const nodes = await getNodes();
  const req = await requestRide({
    pickupNodeId: resolveNodeId(nodes, pickupText),
    dropNodeId: resolveNodeId(nodes, dropText),
    pickupTime: pickupTime || new Date().toISOString(),
  });

  onStageChange?.('grouping');
  await new Promise((r) => setTimeout(r, STAGE_DELAY_MS));

  const matches = await getMatches(req.id);
  return { requestId: req.id, matches };
}
