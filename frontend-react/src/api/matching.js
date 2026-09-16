/**
 * Shared ride-matching flow, used by both FormGroup (shows every match) and
 * Book (auto-picks the top-scored one) so the mock/real branching lives in
 * exactly one place instead of being duplicated per page.
 */
import { requestRide, getMatches, USE_MOCK_MATCHING } from './client';

const STAGE_DELAY_MS = 1500;

function buildMockMatch(pickupText, dropText) {
  return {
    groupKey: 'mock1',
    isMock: true,
    score: 0.98,
    pickupNode: { name: pickupText, shortName: pickupText },
    distanceKm: 8.5,
    totalFare: 150,
    departureTime: new Date().toISOString(),
    members: [
      { isYou: true, name: 'You', initials: 'YOU', dropNode: { name: dropText, shortName: dropText }, fareShare: 85, soloFare: 150, dropDistanceKm: 5.2 },
      { name: 'Student 2', initials: 'S2', dropNode: { name: dropText, shortName: dropText }, fareShare: 65, dropDistanceKm: 3.1 },
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

  const req = await requestRide({
    pickupNodeId: pickupText, // Mock mapping until real node selection lands
    dropNodeId: dropText,
    pickupTime: pickupTime || new Date().toISOString(),
  });

  onStageChange?.('grouping');
  await new Promise((r) => setTimeout(r, STAGE_DELAY_MS));

  const matches = await getMatches(req.id);
  return { requestId: req.id, matches };
}
