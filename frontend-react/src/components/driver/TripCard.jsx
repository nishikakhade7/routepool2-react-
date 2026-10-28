import { useState } from 'react';
import WomenOnlyBadge from '../WomenOnlyBadge';
import { pickupTime, rupees } from './format';
import { headToPickup, verifyRiderCode, completeTrip } from '../../api/driver';

const STEPS = [
  { key: 'accepted', label: 'Accepted' },
  { key: 'heading', label: 'Heading to pickup' },
  { key: 'started', label: 'Rider code verified' },
  { key: 'completed', label: 'Completed' },
];

function Steps({ status }) {
  const at = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="dp-steps" aria-label="Trip progress">
      {STEPS.map((s, i) => (
        <li key={s.key} className={`dp-step${i < at ? ' done' : i === at ? ' current' : ''}`} aria-current={i === at ? 'step' : undefined}>
          {i < at ? '✓' : i + 1} {s.label}
        </li>
      ))}
    </ol>
  );
}

// An accepted trip: progress steps, the riders, and the next action. The driver
// starts the trip by entering a rider's 6-digit code (from their RoutePool profile).
export default function TripCard({ trip, onChange }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function run(fn) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError('Rider codes are 6 digits'); return; }
    const res = await run(() => verifyRiderCode(trip.groupId, code));
    if (res) {
      setCode('');
      setNotice(`${res.rider} is verified — enjoy the ride.`);
      onChange(res.trip);
    }
  }

  const waiting = trip.riders.filter((r) => !r.boarded);
  const codeId = `code-${trip.groupId}`;

  return (
    <article className="card" aria-label={`Trip from ${trip.pickupName} to ${trip.dropName}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '700 19px Familjen Grotesk,sans-serif', letterSpacing: '-.02em', marginBottom: 4 }}>
            {trip.pickupName} → {trip.dropName} <WomenOnlyBadge show={trip.womenOnly} style={{ marginLeft: 6 }} />
          </div>
          <div style={{ fontSize: 13.5, color: 'rgba(33,28,38,.6)', fontWeight: 600 }}>Pickup {pickupTime(trip.pickupTime)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: '700 22px Familjen Grotesk,sans-serif', color: '#0F6B52' }}>{rupees(trip.payout)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(33,28,38,.5)' }}>your payout</div>
        </div>
      </div>

      <Steps status={trip.status} />

      <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {trip.riders.map((r, i) => (
          <li key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: r.boarded ? '#E4F2EC' : '#F4EEE3', borderRadius: 999, padding: '6px 12px 6px 6px', fontSize: 13, fontWeight: 600 }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: '700 11px Familjen Grotesk,sans-serif' }}>{r.initials}</span>
            {r.name} · to {r.dropName}{r.boarded ? ' · ✓ on board' : ''}
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {trip.status === 'accepted' && (
          <button className="btn-primary" style={{ width: 'auto', padding: '12px 20px', fontSize: 15 }} disabled={busy}
            onClick={async () => { const t = await run(() => headToPickup(trip.groupId)); if (t) onChange(t); }}>
            Heading to pickup
          </button>
        )}

        {waiting.length > 0 && (
          <form onSubmit={submitCode} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <label htmlFor={codeId} className="visually-hidden">Rider code</label>
            <input
              id={codeId}
              className="dp-input"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
              placeholder="Rider's 6-digit code"
              inputMode="numeric"
              autoComplete="off"
              style={{ width: 190, letterSpacing: code ? '.2em' : undefined }}
            />
            <button type="submit" className="btn-accent" style={{ width: 'auto', padding: '11px 18px', fontSize: 15 }} disabled={busy || code.length !== 6}>
              Verify rider
            </button>
          </form>
        )}

        {trip.status === 'started' && (
          <button className="btn-primary" style={{ width: 'auto', padding: '12px 20px', fontSize: 15 }} disabled={busy}
            onClick={async () => { const t = await run(() => completeTrip(trip.groupId)); if (t) onChange(t); }}>
            Complete trip
          </button>
        )}
      </div>

      {notice && <p role="status" style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 700, color: '#0F6B52' }}>{notice}</p>}
      {error && <p role="alert" className="dp-field-error">{error}</p>}
    </article>
  );
}
