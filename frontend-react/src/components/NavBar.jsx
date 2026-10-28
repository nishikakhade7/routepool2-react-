import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard',       label: 'Dashboard' },
  { to: '/form-group',      label: 'Form a group' },
  { to: '/book',            label: 'Book a ride' },
  { to: '/groups',          label: 'Joined groups' },
  { to: '/history',         label: 'History' },
  { to: '/campus-insights', label: 'Campus insights' },
];

// The driver portal passes its own items/links; the customer app uses the defaults.
// Staff get only the admin panel: no student pages, no notifications.
export default function NavBar(props) {
  const { user, role } = useAuth();
  const isStaff = !props.items && role === 'admin';
  const navItems = props.items || (isStaff ? [{ to: '/admin', label: 'Admin panel' }] : NAV_ITEMS);
  const home = isStaff ? '/admin/drivers' : props.home || '/dashboard';
  const profileTo = isStaff ? '/admin/drivers' : props.profileTo || '/profile';
  const showNotifications = !isStaff && props.showNotifications !== false;

  const initials = user?.initials || '??';
  const firstName = user?.name?.split(' ')[0] || 'You';

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <NavLink to={home} className="navbar-logo">
          <span className="navbar-logo-dot" />
          <span className="navbar-logo-name font-heading">RoutePool</span>
        </NavLink>

        {/* Nav */}
        <nav className="navbar-nav" aria-label="Main navigation">
          {navItems.map(({ to, label }) => (
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
          {showNotifications && (
            <NavLink to="/notifications" className="notif-btn" title="Notifications">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 4a5.5 5.5 0 015.5 5.5c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5A5.5 5.5 0 0112 4z"
                  stroke="#211C26" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M10 18a2 2 0 004 0" stroke="#211C26" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span className="notif-dot" />
            </NavLink>
          )}

          <NavLink to={profileTo} className="user-pill" title="Profile">
            <span className="user-avatar">{initials}</span>
            <span className="user-name">{firstName}</span>
          </NavLink>
        </div>
      </div>
    </header>
  );
}
