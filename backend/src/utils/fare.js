// Given an ordered node path with per-edge distances, returns each stop's
// cumulative km from the pickup node (stop 0).
function buildCumulativePath(edges, pathNodeIds) {
  const weightByPair = new Map();
  for (const e of edges) {
    weightByPair.set(`${e.nodeAId}:${e.nodeBId}`, Number(e.distanceKm));
    weightByPair.set(`${e.nodeBId}:${e.nodeAId}`, Number(e.distanceKm));
  }
  let cumulative = 0;
  const stops = [{ nodeId: pathNodeIds[0], cumulativeKm: 0 }];
  for (let i = 1; i < pathNodeIds.length; i++) {
    const seg = weightByPair.get(`${pathNodeIds[i - 1]}:${pathNodeIds[i]}`) || 0;
    cumulative += seg;
    stops.push({ nodeId: pathNodeIds[i], cumulativeKm: +cumulative.toFixed(2) });
  }
  return stops;
}

// Real auto-rickshaw meter tariff: a flat minimum for the first `baseKm`,
// then a per-km rate beyond it, with a flat surge multiplier for the driver
// on top. Distance 0 costs nothing (the minimum only kicks in once someone
// actually starts riding), which is what lets splitFareBySegments below
// telescope cleanly to the correct full-trip total.
function autoFareForDistance(distanceKm, tariff) {
  if (distanceKm <= 0) return 0;
  const raw = distanceKm <= tariff.baseKm
    ? tariff.baseFare
    : tariff.baseFare + (distanceKm - tariff.baseKm) * tariff.perKmRate;
  return raw * tariff.surgeMultiplier;
}

// Splits the fare of each road segment only among riders still onboard for
// that segment (i.e. whose drop point is at or beyond it), then sums each
// rider's share across the whole route. A segment's cost is the difference
// in cumulative tariff fare between its two stops, so the nonlinear
// (flat-then-per-km) tariff still adds up exactly to the full-route fare.
function splitFareBySegments(routeStops, members, tariff) {
  const shares = new Map(members.map((m) => [m.userId, 0]));
  let totalFare = 0;
  for (let i = 1; i < routeStops.length; i++) {
    const segCost = autoFareForDistance(routeStops[i].cumulativeKm, tariff)
      - autoFareForDistance(routeStops[i - 1].cumulativeKm, tariff);
    totalFare += segCost;
    const aboard = members.filter((m) => m.dropCumulativeKm >= routeStops[i].cumulativeKm - 1e-6);
    if (aboard.length === 0) continue;
    const each = segCost / aboard.length;
    for (const m of aboard) shares.set(m.userId, shares.get(m.userId) + each);
  }
  for (const [userId, amount] of shares) shares.set(userId, +amount.toFixed(2));
  return { totalFare: +totalFare.toFixed(2), shares };
}

module.exports = { buildCumulativePath, autoFareForDistance, splitFareBySegments };
