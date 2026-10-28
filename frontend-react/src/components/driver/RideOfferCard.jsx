import RouteVisual from '../RouteVisual';
import WomenOnlyBadge from '../WomenOnlyBadge';
import { pickupTime, rupees } from './format';

// A ride waiting for the driver, laid out like the customer app's match cards.
export default function RideOfferCard({ ride, busy, onAccept, onDecline }) {
  const riders = ride.riders.length;
  return (
    <article className="card dp-ride" aria-label={`Ride from ${ride.pickupName} to ${ride.dropName}`}>
      <div className="dp-ride-visual"><RouteVisual variant="light" height={86} animated={false} /></div>

      <div style={{ minWidth: 0 }}>
        <div style={{ font: '700 19px Familjen Grotesk,sans-serif', letterSpacing: '-.02em', marginBottom: 6 }}>
          {ride.pickupName} → {ride.dropName} <WomenOnlyBadge show={ride.womenOnly} style={{ marginLeft: 6 }} />
        </div>
        <div style={{ fontSize: 13.5, color: 'rgba(33,28,38,.6)', fontWeight: 600, marginBottom: 8 }}>
          Pickup {pickupTime(ride.pickupTime)} · {riders} rider{riders === 1 ? '' : 's'} · {ride.distanceKm.toFixed(1)} km
        </div>
        {ride.drops.length > 1 && (
          <div style={{ fontSize: 12.5, color: 'rgba(33,28,38,.5)', fontWeight: 600 }}>Drops: {ride.drops.join(' → ')}</div>
        )}
      </div>

      <div className="dp-ride-money">
        <div>
          <div style={{ font: '700 24px Familjen Grotesk,sans-serif', color: '#0F6B52' }}>{rupees(ride.payout)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(33,28,38,.5)' }}>your payout · fare {rupees(ride.totalFare)}</div>
        </div>
        <div className="dp-actions">
          <button className="btn-ghost" disabled={busy} onClick={() => onDecline(ride)}>Decline</button>
          <button className="btn-accent" style={{ width: 'auto', padding: '12px 22px', fontSize: 15 }} disabled={busy} onClick={() => onAccept(ride)}>
            Accept
          </button>
        </div>
      </div>
    </article>
  );
}
