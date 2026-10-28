import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminLogin } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../../components/Spinner';
import '../../components/driver/driver.css';

// Staff sign-in: email + password (POST /auth/admin-login). Staff never get an
// OTP, so an emailed code can't be used to get into the admin panel.
// Staff addresses are ADMIN_EMAILS in backend/.env.
export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter your staff email address'); return; }
    if (password.length < 8) { setError('Passwords are at least 8 characters'); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await adminLogin(email.trim(), password);
      if (!res.user?.isAdmin) { setError('This account is not a staff account.'); return; }
      login(res);
      navigate('/admin/drivers');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="driver-app" style={{
      minHeight: '100vh',
      background: 'radial-gradient(1200px 760px at 12% -8%,#FBF3E4 0%,rgba(251,243,228,0) 58%),radial-gradient(1000px 700px at 92% 4%,#F1ECF7 0%,rgba(241,236,247,0) 52%),#EFE8DC',
    }}>
      <header style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 24px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#F2A230', boxShadow: '0 0 0 4px rgba(242,162,48,.2)', display: 'block' }} />
        <span style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: '-.03em' }}>RoutePool</span>
        <span style={{ font: '600 10.5px Karla,sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(33,28,38,.4)', border: '1px solid rgba(33,28,38,.14)', padding: '5px 9px', borderRadius: 999 }}>
          Staff
        </span>
        <Link to="/login" style={{ marginLeft: 'auto', font: '700 13px Karla,sans-serif', color: '#8A2B6B' }}>Student sign-in</Link>
      </header>

      <main style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 70px' }}>
        <form onSubmit={submit} noValidate style={{ background: '#FDFAF4', border: '1px solid rgba(33,28,38,.07)', borderRadius: 30, padding: 'clamp(24px, 6vw, 38px)', boxShadow: '0 2px 4px rgba(33,28,38,.04),0 44px 70px -40px rgba(33,28,38,.55)' }}>
          <span className="badge badge-purple" style={{ marginBottom: 14 }}>RoutePool office</span>
          <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 29, letterSpacing: '-.03em', margin: '0 0 8px' }}>Admin sign-in</h1>
          <p style={{ margin: '0 0 24px', fontSize: 14.5, lineHeight: 1.5, color: 'rgba(33,28,38,.58)' }}>
            For RoutePool staff: approve driver documents, manage rides, students and vehicles.
          </p>

          <label className="input-label" htmlFor="admin-email">Staff email</label>
          <div className="input-row" style={{ marginBottom: 16 }}>
            <input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@spit.ac.in" autoComplete="username" />
          </div>

          <label className="input-label" htmlFor="admin-password">Password</label>
          <div className="input-row">
            <input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </div>

          <button type="submit" className="btn-accent" disabled={loading} style={{ marginTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {loading && <Spinner size="sm" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <p role="alert" style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 600, color: '#C24444' }}>{error}</p>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="3" stroke="#157F63" strokeWidth="2" />
              <path d="M8.5 10V7.5a3.5 3.5 0 017 0V10" stroke="#157F63" strokeWidth="2" />
            </svg>
            <span style={{ fontSize: 12.5, color: '#157F63', fontWeight: 600 }}>Staff only · 5 wrong tries locks the account for 10 minutes</span>
          </div>
        </form>
      </main>
    </div>
  );
}
