import { useState } from 'react';
import { rateVehicle, COMPLAINT_TAGS } from '../api/client';

function Stars({ value, onPick, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
      <span style={{ font: '600 13.5px Karla,sans-serif' }}>{label}</span>
      <span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onPick(n)}
            aria-label={`${label}: ${n} of 5`}
            style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: n <= value ? '#F2A230' : 'rgba(33,28,38,.2)' }}
          >
            ★
          </button>
        ))}
      </span>
    </div>
  );
}

// After the ride: cleanliness and condition, plus quick tags. Enough complaints
// and the backend flags the auto for inspection or takes it off the road.
export default function RateVehicle({ groupId }) {
  const [cleanliness, setCleanliness] = useState(0);
  const [condition, setCondition] = useState(0);
  const [tags, setTags] = useState([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const toggle = (t) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await rateVehicle(groupId, { cleanliness, condition, tags });
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="card" style={{ marginTop: 20, textAlign: 'center', fontWeight: 600 }}>
        Thanks — your rating helps keep these autos roadworthy.
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 20, textAlign: 'left' }}>
      <div className="input-label" style={{ marginBottom: 12 }}>Rate this auto</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Stars value={cleanliness} onPick={setCleanliness} label="Cleanliness" />
        <Stars value={condition} onPick={setCondition} label="Condition" />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 4px' }}>
        {COMPLAINT_TAGS.map((t) => (
          <button
            key={t}
            onClick={() => toggle(t)}
            style={{
              border: `1.5px solid ${tags.includes(t) ? '#B3261E' : 'rgba(33,28,38,.14)'}`,
              background: tags.includes(t) ? '#FDECEA' : '#fff',
              color: tags.includes(t) ? '#B3261E' : '#211C26',
              borderRadius: 999, padding: '7px 12px', font: '600 12.5px Karla,sans-serif', cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <div className="error-msg-red" style={{ marginTop: 12 }}>{error}</div>}

      <button
        className="btn-ghost"
        style={{ width: 'auto', marginTop: 14, padding: '10px 18px', opacity: cleanliness && condition ? 1 : 0.5 }}
        disabled={saving || !cleanliness || !condition}
        onClick={submit}
      >
        {saving ? 'Sending…' : 'Submit rating'}
      </button>
    </div>
  );
}
