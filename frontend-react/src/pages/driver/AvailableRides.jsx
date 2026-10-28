import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DriverLayout from '../../components/driver/DriverLayout';
import RideOfferCard from '../../components/driver/RideOfferCard';
import Spinner from '../../components/Spinner';
import { getRideOffers, acceptRide, declineRide } from '../../api/driver';
import { useDriver } from '../../contexts/DriverContext';

// New bookings are assigned to drivers as they come in, so check every so often.
const REFRESH_MS = 30000;

export default function AvailableRides() {
  const { me, refresh } = useDriver();
  const navigate = useNavigate();
  const [rides, setRides] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => getRideOffers().then((r) => { setRides(r.rides); setError(null); }).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  async function act(ride, fn, after) {
    setBusyId(ride.groupId);
    setError(null);
    try {
      await fn(ride.groupId);
      after();
    } catch (e) {
      setError(e.message);
      load();
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  const accept = (ride) => act(ride, acceptRide, () => navigate('/driver/trips'));
  const decline = (ride) => act(ride, declineRide, () => setRides((prev) => prev.filter((r) => r.groupId !== ride.groupId)));

  const blocked = me && !me.verification.verified;

  return (
    <DriverLayout showGreeting subtitle="Rides assigned to you that are waiting for your answer.">
      {error && <div className="error-msg-red">{error}</div>}

      {blocked ? (
        // The banner above says what's missing; the list stays hidden until it's fixed.
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ font: '700 18px Familjen Grotesk,sans-serif', marginBottom: 6 }}>Rides are paused for now</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(33,28,38,.55)', marginBottom: 18 }}>
            Once both documents are verified you can go online and rides will show up here.
          </div>
          <Link to="/driver/profile#documents" className="btn-accent" style={{ display: 'inline-block', width: 'auto', padding: '12px 22px', textDecoration: 'none' }}>
            Go to documents
          </Link>
        </div>
      ) : !rides && !error ? (
        <div className="loading-center" style={{ padding: 40 }}><Spinner /></div>
      ) : rides?.length === 0 ? (
        <div className="card loading-center" style={{ padding: 56 }}>
          <div style={{ font: '700 16px Familjen Grotesk,sans-serif', color: 'rgba(33,28,38,.6)' }}>No rides waiting right now</div>
          <div style={{ fontSize: 13, color: 'rgba(33,28,38,.45)', fontWeight: 600, maxWidth: 360 }}>
            {me?.online
              ? "You're online. When students book a ride that fits you, it appears here."
              : 'Switch to Online to start getting rides.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rides?.map((r) => (
            <RideOfferCard key={r.groupId} ride={r} busy={busyId === r.groupId} onAccept={accept} onDecline={decline} />
          ))}
        </div>
      )}
    </DriverLayout>
  );
}
