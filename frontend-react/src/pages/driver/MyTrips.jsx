import { useState, useEffect, useCallback } from 'react';
import DriverLayout from '../../components/driver/DriverLayout';
import TripCard from '../../components/driver/TripCard';
import Spinner from '../../components/Spinner';
import { pickupTime, rupees } from '../../components/driver/format';
import { getDriverTrips } from '../../api/driver';

function Stat({ label, value, color }) {
  return (
    <div className="card" style={{ padding: '24px 28px' }}>
      <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 8 }}>{label}</div>
      <div style={{ font: '700 32px Familjen Grotesk,sans-serif', color }}>{value}</div>
    </div>
  );
}

const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

// Upcoming trips (with their next step) and completed ones, laid out like History.
export default function MyTrips() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => getDriverTrips().then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  // A finished trip moves to the completed table; anything else updates in place.
  function onChange(trip) {
    if (trip.status === 'completed') load();
    else setData((d) => ({ ...d, upcoming: d.upcoming.map((t) => (t.groupId === trip.groupId ? trip : t)) }));
  }

  const s = data?.summary;

  return (
    <DriverLayout title="My trips">
      <div className="dp-stats">
        <Stat label="Trips completed" value={s ? s.completedTrips : '—'} />
        <Stat label="Earned" value={s ? rupees(s.earned) : '—'} color="#0F8A5F" />
        <Stat label="Rider rating" value={s?.avgRating != null ? `${s.avgRating.toFixed(1)} ★` : '—'} />
      </div>

      {error && <div className="error-msg-red">{error}</div>}
      {!data && !error && <div className="loading-center" style={{ padding: 40 }}><Spinner /></div>}

      {data && (
        <>
          <h2 className="dp-section-label">Upcoming</h2>
          {data.upcoming.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'rgba(33,28,38,.5)', fontWeight: 600, marginBottom: 32 }}>
              No upcoming trips. Accepted rides show up here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
              {data.upcoming.map((t) => <TripCard key={t.groupId} trip={t} onChange={onChange} />)}
            </div>
          )}

          <h2 className="dp-section-label">Completed</h2>
          {data.completed.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'rgba(33,28,38,.5)', fontWeight: 600 }}>
              No completed trips yet.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="dp-table">
                <thead>
                  <tr>
                    <th scope="col">Date &amp; route</th>
                    <th scope="col">Riders</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Earned (rating)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.completed.map((t) => (
                    <tr key={t.groupId}>
                      <td>
                        <div style={{ font: '700 15px Familjen Grotesk,sans-serif', marginBottom: 4 }}>{t.pickupName} → {t.dropName}</div>
                        <div style={{ fontSize: 13, color: 'rgba(33,28,38,.5)', fontWeight: 500 }}>{pickupTime(t.pickupTime)}</div>
                      </td>
                      <td style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(33,28,38,.65)' }}>{t.riders.map((r) => r.name).join(', ')}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ font: '700 16px Familjen Grotesk,sans-serif' }}>{rupees(t.payout)}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: t.riderRating != null ? '#F2A230' : 'rgba(33,28,38,.4)' }}
                          aria-label={t.riderRating != null ? `Rated ${t.riderRating} of 5` : 'Not rated yet'}>
                          {t.riderRating != null ? stars(t.riderRating) : 'Not rated yet'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </DriverLayout>
  );
}
