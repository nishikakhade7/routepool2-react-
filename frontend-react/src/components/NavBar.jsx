import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard',       label: 'Dashboard' },
  { to: '/form-group',      label: 'Form a group' },
  { to: '/book',            label: 'Book a ride' },
  { to: '/history',         label: 'History' },
  { to: '/campus-insights', label: 'Campus insights' },
];

export default function NavBar() {
  const { user } = useAuth();

  const initials = user?.initials || '??';
  const firstName = user?.name?.split(' ')[0] || 'You';

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <NavLink to="/dashboard" className="navbar-logo">
          <span className="navbar-logo-dot" />
          <span className="navbar-logo-name font-heading">RoutePool</span>
        </NavLink>

        {/* Nav */}
        <nav className="navbar-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Actions */}
        <div className="navbar-actions">
          <NavLink to="/notifications" className="notif-btn" title="Notifications">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 4a5.5 5.5 0 015.5 5.5c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5A5.5 5.5 0 0112 4z"
                stroke="#211C26" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M10 18a2 2 0 004 0" stroke="#211C26" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span className="notif-dot" />
          </NavLink>

          <NavLink to="/profile" className="user-pill" title="Profile">
            <span className="user-avatar">{initials}</span>
            <span className="user-name">{firstName}</span>
          </NavLink>
        </div>
      </div>
    </header>
  );
}
