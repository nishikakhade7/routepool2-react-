import { useState, useEffect } from 'react';
import Spinner from '../../components/Spinner';
import StatusChip from '../../components/driver/StatusChip';
import { getAdminDrivers, reviewDriverDocument, documentObjectUrl } from '../../api/driver';
import '../../components/driver/driver.css';

function Stat({ label, value, tone }) {
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 6 }}>{label}</div>
      <div style={{ font: '700 28px Familjen Grotesk,sans-serif', color: tone }}>{value}</div>
    </div>
  );
}

// The upload as the reviewer sees it: status chip, a link to the file, and
// Approve / Reject while it waits for review.
function DocumentCell({ slot, busy, onReview }) {
  const doc = slot.current;
  const [error, setError] = useState(null);

  async function open() {
    setError(null);
    try {
      window.open(await documentObjectUrl(doc.id, { admin: true }), '_blank', 'noopener');
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <StatusChip state={doc?.state || 'not_uploaded'} daysLeft={doc?.daysLeft} />
      {doc && (
        <button type="button" onClick={open} style={{ border: 0, background: 'transparent', padding: 0, font: '700 12.5px Karla,sans-serif', color: '#8A2B6B', textDecoration: 'underline', cursor: 'pointer' }}>
          View file
        </button>
      )}
      {doc?.state === 'pending' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-accent" style={{ width: 'auto', padding: '7px 12px', fontSize: 13, borderRadius: 10 }} disabled={busy}
            onClick={() => onReview(doc.id, true)} aria-label={`Approve ${slot.label}`}>
            Approve
          </button>
          <button className="btn-ghost" style={{ padding: '7px 12px', fontSize: 13, color: '#B3261E' }} disabled={busy}
            onClick={() => onReview(doc.id, false)} aria-label={`Reject ${slot.label}`}>
            Reject
          </button>
        </div>
      )}
      {error && <span className="dp-field-error" style={{ margin: 0 }}>{error}</span>}
    </div>
  );
}

// Admin > Drivers: every portal driver with their documents, and who needs re-verification.
export default function DriversPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => getAdminDrivers().then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function review(docId, approve) {
    setBusy(true);
    setError(null);
    try {
      await reviewDriverDocument(docId, approve, approve ? undefined : 'Please upload a clearer copy');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) return <div className="loading-center" style={{ padding: 60 }}><Spinner /></div>;
  const s = data?.summary;

  return (
    <div className="driver-app">
      {error && <div className="error-msg-red" style={{ marginBottom: 16 }}>{error}</div>}
      {s && (
        <>
          <div className="dp-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <Stat label="Drivers on the portal" value={s.total} />
            <Stat label="Waiting for review" value={s.pendingReviews} tone={s.pendingReviews ? '#A96A0C' : undefined} />
            <Stat label="Re-verification required" value={s.reverification.length} tone={s.reverification.length ? '#B3261E' : undefined} />
          </div>
          {(s.reverification.length > 0 || s.expiringSoon.length > 0) && (
            <div className="card" style={{ marginBottom: 20, padding: '16px 22px', fontSize: 13.5, fontWeight: 600, color: 'rgba(33,28,38,.7)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {s.reverification.length > 0 && <span><strong style={{ color: '#B3261E' }}>Off the road until re-verified:</strong> {s.reverification.join(', ')}</span>}
              {s.expiringSoon.length > 0 && <span><strong style={{ color: '#A96A0C' }}>Expiring within 30 days:</strong> {s.expiringSoon.join(', ')}</span>}
            </div>
          )}
        </>
      )}

      {data?.drivers.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'rgba(33,28,38,.45)', fontWeight: 600 }}>
          No drivers have signed in to the driver portal yet.
        </div>
      ) : data && (
        <div className="card" style={{ padding: 0, overflowX: 'auto', opacity: busy ? 0.6 : 1 }}>
          <table className="dp-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th scope="col">Driver</th>
                <th scope="col">Vehicle</th>
                {data.drivers[0].verification.documents.map((d) => <th key={d.type} scope="col">{d.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.drivers.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div style={{ font: '700 15px Familjen Grotesk,sans-serif', marginBottom: 3 }}>
                      {d.name}
                      <span style={{ marginLeft: 8, font: '700 10.5px Karla,sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', color: d.online ? '#0F6B52' : 'rgba(33,28,38,.45)' }}>
                        {d.online ? '● online' : 'offline'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(33,28,38,.55)' }}>{d.driverCode}</div>
                    <div style={{ fontSize: 12.5, color: 'rgba(33,28,38,.5)' }}>{d.email}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{d.vehicle}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(33,28,38,.55)', letterSpacing: '.04em' }}>{d.plateNumber}</div>
                  </td>
                  {d.verification.documents.map((slot) => (
                    <td key={slot.type}><DocumentCell slot={slot} busy={busy} onReview={review} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
