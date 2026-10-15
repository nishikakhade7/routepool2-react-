import { useState, useEffect } from 'react';
import Spinner from './Spinner';
import {
  getVehicles, updateVehicleDocuments, setVehicleStatus,
  logVehicleService, submitInspection, reviewInspection,
} from '../api/client';

const day = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const chip = (bg, color) => ({ font: '700 10.5px Karla,sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', background: bg, color, borderRadius: 7, padding: '3px 7px' });

function DocRow({ doc, onRenew, busy }) {
  const color = doc.expired ? '#B3261E' : doc.expiringSoon ? '#A96A0C' : 'rgba(33,28,38,.6)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '4px 0', fontSize: 13 }}>
      <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{doc.document}</span>
      <span style={{ color, fontWeight: 600 }}>
        {day(doc.expiresOn)}
        {doc.expired ? ' · expired' : doc.expiringSoon ? ` · ${doc.daysLeft}d left` : ''}
      </span>
      <button className="btn-ghost" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }} disabled={busy} onClick={() => onRenew(doc.document)}>
        Renew 1y
      </button>
    </div>
  );
}

export default function VehiclesPanel() {
  const [vehicles, setVehicles] = useState(null);
  const [error, setError] = useState(null);
  const [busyPlate, setBusyPlate] = useState(null);

  const load = () => getVehicles().then(setVehicles).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function act(plate, fn) {
    setBusyPlate(plate);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyPlate(null);
    }
  }

  const renew = (v, doc) => act(v.plateNumber, () =>
    updateVehicleDocuments(v.plateNumber, { [doc]: new Date(Date.now() + 365 * 86400000).toISOString() }));

  // No driver app yet, so staff file the self-inspection photos from here.
  const fileInspection = (v) => act(v.plateNumber, () =>
    submitInspection(v.plateNumber, { tyres: 'tyres.jpg', lights: 'lights.jpg', seats: 'seats.jpg', meter: 'meter.jpg' }));

  if (!vehicles && !error) return <div className="loading-center" style={{ padding: 60 }}><Spinner /></div>;

  return (
    <div>
      <p style={{ margin: '0 0 24px', fontSize: 14.5, color: 'rgba(33,28,38,.55)' }}>
        Autos with an expired document, or suspended over rider complaints, are never assigned a ride.
      </p>

        {error && <div className="error-msg-red" style={{ marginBottom: 20 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 20 }}>
          {vehicles?.map((v) => {
            const busy = busyPlate === v.plateNumber;
            return (
              <div key={v.plateNumber} className="card" style={{ opacity: busy ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <div style={{ font: '700 16px Familjen Grotesk,sans-serif', letterSpacing: '-.02em' }}>{v.driverName}</div>
                    <div style={{ fontSize: 12.5, color: 'rgba(33,28,38,.55)', fontWeight: 600 }}>{v.vehicle} · {v.plateNumber}</div>
                  </div>
                  <span style={v.eligible ? chip('#E4F2EC', '#0F6B52') : chip('#FDECEA', '#B3261E')}>
                    {v.eligible ? 'On the road' : 'Off the road'}
                  </span>
                </div>

                {v.blockedReason && <div style={{ marginTop: 8, fontSize: 12.5, color: '#B3261E', fontWeight: 700 }}>{v.blockedReason}</div>}
                {v.flaggedReason && <div style={{ marginTop: 6, fontSize: 12.5, color: '#A96A0C', fontWeight: 700 }}>{v.flaggedReason}</div>}

                <div style={{ marginTop: 14, borderTop: '1px solid rgba(33,28,38,.08)', paddingTop: 10 }}>
                  {v.documents.map((d) => <DocRow key={d.document} doc={d} busy={busy} onRenew={(doc) => renew(v, doc)} />)}
                </div>

                <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: 'rgba(33,28,38,.6)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>
                    Inspection: {v.inspection.inspectedOn ? day(v.inspection.inspectedOn) : 'never'}
                    {v.inspection.overdue ? ' · due' : ' · current'}
                    {v.inspection.pending ? ' · awaiting approval' : ''}
                  </span>
                  <span>
                    Service: {day(v.service.lastServicedOn)} · {v.service.kmSinceService} km since
                    {v.service.overdue ? ' · overdue' : ''}
                  </span>
                  <span>
                    Riders: {v.feedback.ratingCount ? `${v.feedback.avgRating}★ from ${v.feedback.ratingCount}` : 'no ratings yet'}
                    {v.feedback.complaints ? ` · ${v.feedback.complaints} complaints` : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {v.inspection.pending ? (
                    <>
                      <button className="btn-ghost" style={{ width: 'auto', padding: '8px 12px' }} disabled={busy}
                        onClick={() => act(v.plateNumber, () => reviewInspection(v.inspection.pendingId, true))}>
                        Approve inspection
                      </button>
                      <button className="btn-ghost" style={{ width: 'auto', padding: '8px 12px' }} disabled={busy}
                        onClick={() => act(v.plateNumber, () => reviewInspection(v.inspection.pendingId, false, 'Rejected'))}>
                        Reject
                      </button>
                    </>
                  ) : (
                    <button className="btn-ghost" style={{ width: 'auto', padding: '8px 12px' }} disabled={busy} onClick={() => fileInspection(v)}>
                      File inspection photos
                    </button>
                  )}
                  <button className="btn-ghost" style={{ width: 'auto', padding: '8px 12px' }} disabled={busy}
                    onClick={() => act(v.plateNumber, () => logVehicleService(v.plateNumber))}>
                    Log service today
                  </button>
                  <button className="btn-ghost" style={{ width: 'auto', padding: '8px 12px' }} disabled={busy}
                    onClick={() => act(v.plateNumber, () => setVehicleStatus(v.plateNumber, v.status === 'suspended' ? 'active' : 'suspended', 'Admin decision'))}>
                    {v.status === 'suspended' ? 'Put back on road' : 'Suspend'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
    </div>
  );
}
