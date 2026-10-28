import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendDriverOtp, verifyDriverOtp } from '../../api/driver';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../../components/Spinner';
import DemoDataBadge from '../../components/DemoDataBadge';
import '../../components/driver/driver.css';

// PLACEHOLDER for a real driver-verification process: for now a driver is
// recognised by name.YY@spit.ac.in (first name on the RoutePool roster + the
// year they joined), or a demo account listed in backend config/driverPortal.js.
// The screen only checks it's an institute address; the backend decides the rest
// and its message shows under the field.
const INSTITUTE_EMAIL = /^[^\s@]+@spit\.ac\.in$/i;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '✓'];
const CODE_LENGTH = 4;

const eyebrow = { font: '600 11px Karla,sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(33,28,38,.42)', marginBottom: 10 };
const heading = { fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 29, letterSpacing: '-.03em', margin: '0 0 8px' };
const lead = { margin: '0 0 24px', fontSize: 14.5, lineHeight: 1.5, color: 'rgba(33,28,38,.58)' };
const errorText = { margin: '12px 0 0', fontSize: 13, fontWeight: 600, color: '#C24444' };

export default function DriverLogin() {
  const [stage, setStage] = useState('email'); // 'email' | 'otp' | 'verified'
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [demoCode, setDemoCode] = useState(null);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSendCode(e) {
    e?.preventDefault();
    setError(null);
    const value = email.trim();
    if (!INSTITUTE_EMAIL.test(value)) {
      setEmailError('Driver emails look like name.YY@spit.ac.in, for example priya.24@spit.ac.in');
      return;
    }
    setEmailError(null);
    setLoading(true);
    try {
      const res = await sendDriverOtp(value);
      setDemoCode(res.demoCode || null);
      setOtp('');
      setStage('otp');
    } catch (err) {
      // "Not a driver address" / "not on the roster" belong under the field.
      if (err.status === 400 || err.status === 404) setEmailError(err.message);
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(code = otp) {
    if (code.length < CODE_LENGTH) { setError('Enter the full verification code'); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await verifyDriverOtp(email.trim(), code);
      setSession(res);
      setStage('verified');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function typeCode(value) {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setOtp(digits);
    if (digits.length === CODE_LENGTH) handleVerify(digits);
  }

  function pressKey(k) {
    if (k === '←') setOtp((p) => p.slice(0, -1));
    else if (k === '✓') handleVerify();
    else if (otp.length < CODE_LENGTH) typeCode(otp + k);
  }

  function enterPortal() {
    login(session, 'driver');
    navigate('/driver/rides');
  }

  const cells = Array.from({ length: CODE_LENGTH }, (_, i) => otp[i] || '');

  return (
    <div className="driver-app" style={{
      minHeight: '100vh',
      background: 'radial-gradient(1200px 760px at 12% -8%,#FBF3E4 0%,rgba(251,243,228,0) 58%),radial-gradient(1000px 700px at 92% 4%,#F6E6F0 0%,rgba(246,230,240,0) 52%),#EFE8DC',
    }}>
      <header style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 24px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#F2A230', boxShadow: '0 0 0 4px rgba(242,162,48,.2)', display: 'block' }} />
        <span style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: '-.03em' }}>RoutePool</span>
        <span style={{ font: '600 10.5px Karla,sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(33,28,38,.4)', border: '1px solid rgba(33,28,38,.14)', padding: '5px 9px', borderRadius: 999 }}>
          Driver portal
        </span>
        <Link to="/login" style={{ marginLeft: 'auto', font: '700 13px Karla,sans-serif', color: '#8A2B6B' }}>Student sign-in</Link>
      </header>

      <main style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 70px' }}>
        <div style={{ background: '#FDFAF4', border: '1px solid rgba(33,28,38,.07)', borderRadius: 30, padding: 'clamp(24px, 6vw, 38px)', boxShadow: '0 2px 4px rgba(33,28,38,.04),0 44px 70px -40px rgba(33,28,38,.55)' }}>

          {stage === 'email' && (
            <form onSubmit={handleSendCode} noValidate>
              <div style={eyebrow}>Driver · step 1 of 2</div>
              <h1 style={heading}>Sign in to drive</h1>
              <p style={lead}>Use the RoutePool driver email the office gave you. We'll check it's you with a one-time code.</p>

              <label className="input-label" htmlFor="driver-email">Driver email</label>
              <div className="input-row" style={{ borderColor: emailError ? 'rgba(194,68,68,.6)' : undefined }}>
                <input
                  id="driver-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                  placeholder="priya.24@spit.ac.in"
                  autoComplete="email"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'driver-email-error' : undefined}
                />
              </div>
              {emailError && <p id="driver-email-error" className="dp-field-error" role="alert">{emailError}</p>}

              <button type="submit" className="btn-accent" disabled={loading} style={{ marginTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                {loading && <Spinner size="sm" />}
                {loading ? 'Checking…' : 'Send verification code'}
              </button>
              {error && <p style={errorText} role="alert">{error}</p>}
            </form>
          )}

          {stage === 'otp' && (
            <div style={{ animation: 'screenIn .34s cubic-bezier(.2,.7,.2,1)' }}>
              <div style={eyebrow}>Driver · step 2 of 2</div>
              <h1 style={heading}>Enter your code</h1>
              <p style={lead}>For <span style={{ color: '#8A2B6B', fontWeight: 700 }}>{email.trim()}</span></p>

              {demoCode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#FFF8EC', border: '1px solid rgba(169,106,12,.2)', borderRadius: 14, padding: '10px 14px', marginBottom: 18 }}>
                  {/* DemoDataBadge carries a bottom margin for page headers; cancel it inline. */}
                  <span style={{ display: 'inline-flex', marginBottom: -14 }}><DemoDataBadge /></span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(33,28,38,.7)' }}>
                    Driver codes aren't emailed yet. Use <strong style={{ letterSpacing: '.12em' }}>{demoCode}</strong>
                  </span>
                </div>
              )}

              {/* Typing works too: a real input sits over the cells. */}
              <div style={{ position: 'relative', display: 'flex', gap: 10, marginBottom: 16 }}>
                {cells.map((d, i) => (
                  <div key={i} aria-hidden="true" style={{
                    flex: 1, height: 68, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    font: '700 28px Familjen Grotesk,sans-serif', background: '#fff',
                    border: `1.5px solid ${d ? '#F2A230' : 'rgba(33,28,38,.12)'}`,
                    boxShadow: d ? '0 0 0 3px rgba(242,162,48,.15)' : 'none', transition: 'all .2s',
                  }}>{d}</div>
                ))}
                <label htmlFor="driver-otp" className="visually-hidden">Verification code</label>
                <input
                  id="driver-otp"
                  value={otp}
                  onChange={(e) => typeCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={CODE_LENGTH}
                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'text' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9, marginBottom: 18 }}>
                {KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pressKey(k)}
                    aria-label={k === '←' ? 'Delete' : k === '✓' ? 'Verify' : k}
                    style={{ border: '1px solid rgba(33,28,38,.09)', background: '#fff', borderRadius: 14, padding: '14px 0', font: '600 20px Familjen Grotesk,sans-serif', color: '#211C26' }}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'rgba(33,28,38,.5)', fontWeight: 600 }}>
                <button type="button" onClick={() => { setStage('email'); setError(null); }} style={{ border: 0, background: 'transparent', padding: 0, font: 'inherit', color: 'inherit', textDecoration: 'underline' }}>
                  Change email
                </button>
                {loading && <Spinner size="sm" />}
              </div>
              {error && <p style={errorText} role="alert">{error}</p>}
            </div>
          )}

          {stage === 'verified' && session && (
            <div style={{ textAlign: 'center', padding: '6px 0', animation: 'screenIn .34s cubic-bezier(.2,.7,.2,1)' }}>
              <div style={{ width: 92, height: 92, margin: '0 auto 22px', borderRadius: '50%', background: 'linear-gradient(160deg,#1B9B75,#157F63)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 36px -14px rgba(21,127,99,.85)', animation: 'popIn .5s cubic-bezier(.2,1.3,.4,1) both' }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.6l4.4 4.4L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="badge badge-green" style={{ marginBottom: 14 }}>Verified S.P.I.T driver</span>
              <h1 style={{ ...heading, fontSize: 32, margin: '0 0 10px' }}>Welcome, {session.user.name.split(' ')[0]}!</h1>
              <p style={{ ...lead, margin: '0 0 8px' }}>Your RoutePool driver ID</p>
              <div style={{ font: '700 26px Familjen Grotesk,sans-serif', letterSpacing: '.08em', marginBottom: 26 }}>{session.user.driverCode}</div>
              <button className="btn-primary" onClick={enterPortal}>Open driver portal</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
