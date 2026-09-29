// "You pay ₹X" plus the full price breakup (backend fareBreakup in groups.service.js).
const rs = (n) => `₹${n.toFixed(2)}`;
const row = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0' };

export default function FareBreakup({ fare, open = false }) {
  if (!fare) return null;
  const { you } = fare;
  return (
    <details open={open} style={{ fontSize: 13, marginTop: 8 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
        {you ? <>You pay {rs(you.fareShare)} <span style={{ color: '#0F8A5F' }}>(save {rs(you.saved)} vs {rs(you.soloFare)} solo)</span></> : `Total ${rs(fare.totalFare)}`}
        <span style={{ fontWeight: 600, color: 'rgba(33,28,38,.5)' }}> · price breakup</span>
      </summary>

      <FareBreakupDetails fare={fare} />
    </details>
  );
}

// Meter maths + per-rider split, without the collapsible "You pay" summary.
export function FareBreakupDetails({ fare }) {
  if (!fare) return null;
  return (
    <div style={{ marginTop: 10, padding: '12px 14px', background: '#F4EEE3', borderRadius: 12, fontWeight: 600 }}>
      <div style={{ font: '700 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.5)', marginBottom: 6 }}>
        Auto meter · {fare.distanceKm} km
      </div>
      <div style={row}><span>Base fare (first {fare.baseKm} km)</span><span>{rs(fare.baseFare)}</span></div>
      <div style={row}><span>Distance ({fare.extraKm} km × {rs(fare.perKmRate)})</span><span>{rs(fare.distanceCharge)}</span></div>
      <div style={row}><span>Surge (×{fare.surgeMultiplier})</span><span>{rs(fare.surgeCharge)}</span></div>
      <div style={{ ...row, borderTop: '1px solid rgba(33,28,38,.15)', marginTop: 4, paddingTop: 6, fontWeight: 800 }}>
        <span>Total auto fare</span><span>{rs(fare.totalFare)}</span>
      </div>

      <div style={{ font: '700 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.5)', margin: '12px 0 6px' }}>
        Split by distance ridden
      </div>
      {fare.members.map((m, i) => (
        <div key={i} style={{ ...row, fontWeight: m.isYou ? 800 : 600 }}>
          <span>{m.isYou ? 'You' : m.name} → {m.dropName} ({m.distanceKm} km)</span>
          <span>{rs(m.fareShare)}</span>
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: 'rgba(33,28,38,.5)', marginTop: 8 }}>
        Each stretch of road is split equally among the riders still in the auto.
      </div>
    </div>
  );
}
