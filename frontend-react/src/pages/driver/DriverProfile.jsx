import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DriverLayout from '../../components/driver/DriverLayout';
import DocumentSlot from '../../components/driver/DocumentSlot';
import { useDriver } from '../../contexts/DriverContext';
import { useAuth } from '../../contexts/AuthContext';
import { updateDriverVehicle, ageDocuments } from '../../api/driver';
import { DEMO_RATING_BREAKDOWN } from '../../api/driverMock';

// Indian registration plate, e.g. MH47BX3308 (spaces ignored).
const PLATE = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/;
const sectionLabel = { font: '600 12px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 6px', color: 'rgba(33,28,38,.45)' };

function RoutePoolIdCard({ code }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: the ID is on screen to read */ }
  }
  return (
    <div className="card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <div className="input-label" style={{ marginBottom: 4 }}>Your RoutePool ID</div>
        <div style={{ fontSize: 13, color: 'rgba(33,28,38,.55)', fontWeight: 600, maxWidth: 420 }}>
          Your permanent driver ID. Quote it when you contact the RoutePool office.
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ font: '700 30px Familjen Grotesk,sans-serif', letterSpacing: '.08em' }}>{code}</div>
        <button className="btn-ghost" onClick={copy} aria-live="polite">{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>
    </div>
  );
}

function SegmentRow({ label, value, demo }) {
  const filled = value == null ? 0 : Math.round(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ font: '600 13.5px Karla,sans-serif', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {label}
        {demo && <span className="badge badge-amber" style={{ padding: '3px 7px', fontSize: 9 }}>Demo data</span>}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', gap: 3 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} style={{ width: 18, height: 6, borderRadius: 3, background: n <= filled ? '#F2A230' : 'rgba(33,28,38,.12)' }} />
          ))}
        </span>
        <span style={{ font: '700 13px Karla,sans-serif', minWidth: 42, textAlign: 'right' }}>{value == null ? 'No ratings' : value.toFixed(1)}</span>
      </span>
    </div>
  );
}

function VehicleCard({ vehicle, onSaved }) {
  const [form, setForm] = useState({ model: vehicle.model, colour: vehicle.colour || '', seats: vehicle.seats });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const plate = vehicle.registrationNumber;
  const changed = form.model !== vehicle.model || form.colour !== (vehicle.colour || '') || Number(form.seats) !== vehicle.seats;

  async function save(e) {
    e.preventDefault();
    const errs = {};
    if (form.model.trim().length < 2) errs.model = 'Enter the vehicle model, e.g. Piaggio Ape Auto';
    if (form.colour.trim().length < 2) errs.colour = 'Enter the colour';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setMsg(null);
    try {
      onSaved(await updateDriverVehicle({ model: form.model.trim(), colour: form.colour.trim(), seats: Number(form.seats) }));
      setMsg({ ok: true, text: 'Vehicle details saved.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const field = (key, label, input) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="input-label" style={{ marginBottom: 0 }}>{label}</span>
      {input}
      {errors[key] && <span className="dp-field-error" role="alert" style={{ margin: 0 }}>{errors[key]}</span>}
    </label>
  );

  return (
    <form className="card" onSubmit={save} noValidate style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={sectionLabel}>Vehicle</h2>
      <div className="dp-grid-2" style={{ marginBottom: 0, gap: 16 }}>
        {field('model', 'Model', <input className="dp-input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} aria-invalid={Boolean(errors.model)} />)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="input-label" style={{ marginBottom: 0 }}>Number plate</span>
          <div className="dp-input" style={{ background: '#F4EEE3', letterSpacing: '.08em', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            {plate}
            {PLATE.test(plate) && <span style={{ color: '#0F6B52', letterSpacing: 0 }}>✓ Registered</span>}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(33,28,38,.5)' }}>Linked to your registration. To change it, contact the RoutePool office.</span>
        </div>
        {field('colour', 'Colour', <input className="dp-input" value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })} aria-invalid={Boolean(errors.colour)} />)}
        {field('seats', 'Passenger seats', (
          <select className="dp-input" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '12px 22px', fontSize: 15 }} disabled={saving || !changed}>
          {saving ? 'Saving…' : 'Save vehicle'}
        </button>
        {msg && <span role="status" style={{ fontSize: 13, fontWeight: 700, color: msg.ok ? '#0F6B52' : '#B3261E' }}>{msg.text}</span>}
      </div>
    </form>
  );
}

// Dev builds only: move document dates forward to show the expiry states.
function DevFastForward({ onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function go(days) {
    setBusy(true);
    setError(null);
    try { onDone(await ageDocuments(days)); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px dashed rgba(33,28,38,.15)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span className="badge badge-purple">Dev only</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(33,28,38,.55)' }}>Fast-forward document dates:</span>
      {[[30, '+30 days'], [155, '+5 months'], [185, '+6 months']].map(([d, label]) => (
        <button key={d} type="button" className="chip-btn" style={{ padding: '7px 11px', fontSize: 12.5 }} disabled={busy} onClick={() => go(d)}>{label}</button>
      ))}
      {error && <span className="dp-field-error" style={{ margin: 0 }}>{error}</span>}
    </div>
  );
}

export default function DriverProfile() {
  const { me, setMe } = useDriver();
  const { logout } = useAuth();
  const location = useLocation();

  // /driver/profile#documents (from the banners) scrolls to the documents card.
  useEffect(() => {
    if (me && location.hash === '#documents') document.getElementById('documents')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [me, location.hash]);

  const r = me?.rating;

  return (
    <DriverLayout title="Profile & Settings">
      {me && (
        <>
          <RoutePoolIdCard code={me.driverCode} />

          <div className="dp-grid-2">
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(150deg, #F7D9A8, #E8C9DE)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 24px Karla,sans-serif', color: '#5C3350', flexShrink: 0 }}>
                  {me.initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: '700 22px Familjen Grotesk,sans-serif', letterSpacing: '-.02em', marginBottom: 4 }}>{me.name}</div>
                  <div style={{ fontSize: 14, color: 'rgba(33,28,38,.55)', fontWeight: 500, wordBreak: 'break-all' }}>{me.email}</div>
                </div>
              </div>
              <div style={{ background: '#E4F2EC', border: '1px solid rgba(15,107,82,.16)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
                  <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" fill="#0F6B52" />
                  <path d="M8.8 12.2l2.3 2.3 4.2-4.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
                <div>
                  <div style={{ font: '700 14px Karla,sans-serif', color: '#0F6B52', marginBottom: 2 }}>Verified S.P.I.T driver</div>
                  <div style={{ fontSize: 12, color: 'rgba(15,107,82,.8)' }}>
                    {me.femaleDriver ? 'Female driver · offered women-only rides' : 'Driver email verified via OTP'}
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 style={sectionLabel}>Rating</h2>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ font: '700 40px Familjen Grotesk,sans-serif', letterSpacing: '-.03em' }}>{r.average?.toFixed(1) ?? '—'}</span>
                <span style={{ color: '#F2A230', fontSize: 20 }} aria-hidden="true">★</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(33,28,38,.55)' }}>
                  {r.rides} RoutePool trip{r.rides === 1 ? '' : 's'} · {r.ratingsCount} rider rating{r.ratingsCount === 1 ? '' : 's'}
                </span>
              </div>
              <SegmentRow label="Cleanliness" value={r.cleanliness} />
              <SegmentRow label="Vehicle condition" value={r.condition} />
              <SegmentRow label="Punctuality" value={DEMO_RATING_BREAKDOWN.punctuality} demo />
              <SegmentRow label="Driving" value={DEMO_RATING_BREAKDOWN.driving} demo />
            </div>
          </div>

          <VehicleCard key={JSON.stringify(me.vehicle)} vehicle={me.vehicle} onSaved={setMe} />

          <section id="documents" className="card" style={{ marginBottom: 24, scrollMarginTop: 90 }} aria-labelledby="documents-title">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
              <div>
                <h2 id="documents-title" style={sectionLabel}>Documents &amp; verification</h2>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(33,28,38,.55)', maxWidth: 520 }}>
                  Each document is valid for 6 months from upload and is checked by the RoutePool office. We'll remind you 30 days before it runs out.
                </div>
              </div>
              <span className={`badge ${me.verification.verified ? 'badge-green' : 'badge-amber'}`}>
                {me.verification.verified ? 'Verified to drive' : me.verification.reverificationRequired ? 'Re-verification required' : 'Not verified yet'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {me.verification.documents.map((slot) => <DocumentSlot key={slot.type} slot={slot} onUploaded={setMe} />)}
            </div>
            {import.meta.env.DEV && <DevFastForward onDone={setMe} />}
          </section>

          <button className="btn-ghost" onClick={logout} style={{ color: '#C24444', borderColor: 'rgba(194,68,68,.3)' }}>
            Log out
          </button>
        </>
      )}
    </DriverLayout>
  );
}
