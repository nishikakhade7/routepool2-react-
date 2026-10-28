import { Link } from 'react-router-dom';
import NavBar from '../NavBar';
import Spinner from '../Spinner';
import AvailabilityToggle from './AvailabilityToggle';
import { useDriver } from '../../contexts/DriverContext';
import './driver.css';

const DRIVER_NAV = [
  { to: '/driver/rides', label: 'Available rides' },
  { to: '/driver/trips', label: 'My trips' },
  { to: '/driver/profile', label: 'Profile' },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// Shown on every driver page: blocked (documents missing/expired) or a reminder
// from 30 days before a document runs out.
export function VerificationBanner({ verification }) {
  if (!verification?.message) return null;
  const blocked = !verification.verified;
  return (
    <div role="status" className="card" style={{
      marginBottom: 24, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      background: blocked ? '#FFF6F4' : '#FFF8EC',
      border: `1px solid ${blocked ? 'rgba(179,38,30,.18)' : 'rgba(169,106,12,.22)'}`,
      boxShadow: 'none',
    }}>
      <div style={{ flex: '1 1 260px' }}>
        <div style={{ font: '700 15px Familjen Grotesk,sans-serif', color: blocked ? '#8E2A22' : '#8A5A0E', marginBottom: 3 }}>
          {verification.reverificationRequired ? 'Re-verification required' : blocked ? 'Verification needed' : 'Document expiring soon'}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(33,28,38,.65)' }}>{verification.message}</div>
      </div>
      <Link to="/driver/profile#documents" className="btn-ghost" style={{ textDecoration: 'none', color: '#211C26' }}>
        Upload document
      </Link>
    </div>
  );
}

// Driver pages: the shared pill nav, greeting + Online/Offline, the banner, then the page.
export default function DriverLayout({ title, subtitle, children, showGreeting = false }) {
  const { me, error } = useDriver();
  const firstName = me?.name?.split(' ')[0];

  return (
    <div className="driver-app animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar items={DRIVER_NAV} home="/driver/rides" profileTo="/driver/profile" showNotifications={false} />
      <main className="screen-pad" style={{ maxWidth: 960 }}>
        <div className="dp-head">
          <div>
            <h1 className="dp-title">{showGreeting && firstName ? `${greeting()}, ${firstName}.` : title}</h1>
            {subtitle && <div className="dp-sub">{subtitle}</div>}
          </div>
          <AvailabilityToggle />
        </div>

        {error && <div className="error-msg-red">{error}</div>}
        {!me && !error ? (
          <div className="loading-center" style={{ padding: 60 }}><Spinner /></div>
        ) : me && (
          <>
            <VerificationBanner verification={me.verification} />
            {children}
          </>
        )}
      </main>
    </div>
  );
}
