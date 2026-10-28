import { useState } from 'react';
import { setDriverOnline } from '../../api/driver';
import { useDriver } from '../../contexts/DriverContext';

// Online / Offline, drawn like the toggles on the customer Profile page.
// Locked to Offline while the driver's documents aren't cleared.
export default function AvailabilityToggle() {
  const { me, setMe } = useDriver();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!me) return null;

  const online = me.online;
  const locked = !me.verification.verified;

  async function toggle() {
    if (locked || busy) return;
    setBusy(true);
    setError(null);
    try {
      setMe(await setDriverOnline(!online));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <button
        type="button"
        role="switch"
        aria-checked={online}
        aria-label="Available for rides"
        onClick={toggle}
        disabled={locked || busy}
        title={locked ? 'Get your documents verified to go online' : online ? 'Go offline' : 'Go online'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 12, border: '1px solid rgba(33,28,38,.1)',
          background: '#fff', borderRadius: 999, padding: '8px 10px 8px 16px', cursor: locked ? 'not-allowed' : 'pointer',
          opacity: locked ? 0.6 : 1, font: '700 13.5px Karla,sans-serif', color: '#211C26',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? '#157F63' : 'rgba(33,28,38,.3)' }} />
          {online ? 'Online' : 'Offline'}
        </span>
        <span style={{ width: 44, height: 24, borderRadius: 12, background: online ? '#157F63' : 'rgba(33,28,38,.1)', position: 'relative', transition: 'background .2s' }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: online ? 22 : 2, boxShadow: '0 1px 3px rgba(0,0,0,.1)', transition: 'left .2s' }} />
        </span>
      </button>
      {error && <span role="alert" style={{ fontSize: 12, fontWeight: 600, color: '#C24444', maxWidth: 280, textAlign: 'right' }}>{error}</span>}
    </div>
  );
}
