import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOtp, verifyOtp } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';

const DOMAIN = `@${import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || 'spit.ac.in'}`;
const KEYS = ['1','2','3','4','5','6','7','8','9','←','0','✓'];

export default function Login() {
  const [stage, setStage] = useState('email'); // 'email' | 'otp' | 'verified'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [verifiedUser, setVerifiedUser] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const emailFull = `${email.trim()}${DOMAIN}`;
  const lineAnim = 'drawLine 1.8s cubic-bezier(.4,0,.2,1) both';

  async function handleSendCode() {
    setError(null);
    if (!email.trim()) { setError('Please enter your name before the @spit.ac.in'); return; }
    setLoading(true);
    try {
      const res = await sendOtp(emailFull);
      if (res.devCode) setDevCode(res.devCode);
      setStage('otp');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function pressKey(k) {
    if (k === '←') {
      setOtp(prev => prev.slice(0, -1));
    } else if (k === '✓') {
      handleVerify();
    } else if (otp.length < 4) {
      setOtp(prev => prev + k);
    }
  }

  async function handleVerify() {
    if (otp.length < 4) { setError('Enter the full verification code'); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await verifyOtp(emailFull, otp);
      login(res);
      setVerifiedUser(res.user);
      setStage('verified');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function enterApp() {
    navigate('/dashboard');
  }

  // OTP display cells (show typed digits, blanks for rest)
  const cellCount = 4;
  const cells = Array.from({ length: cellCount }, (_, i) => otp[i] || '');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(1200px 760px at 12% -8%,#FBF3E4 0%,rgba(251,243,228,0) 58%),radial-gradient(1000px 700px at 92% 4%,#F6E6F0 0%,rgba(246,230,240,0) 52%),#EFE8DC',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated background SVG */}
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .42 }}
        fill="none" aria-hidden="true">
        <path d="M-40 700 C300 700 260 300 620 300 C960 300 940 520 1500 480"
          stroke="#F2A230" strokeWidth="3" strokeDasharray="900"
          style={{ animation: lineAnim }}/>
        <path d="M-40 820 C360 820 420 420 760 420 C1080 420 1120 640 1500 620"
          stroke="#8A2B6B" strokeOpacity=".35" strokeWidth="1.6" strokeDasharray="4 9"/>
        <path d="M-40 560 C240 560 200 180 520 180 C820 180 860 320 1500 300"
          stroke="#8A2B6B" strokeOpacity=".18" strokeWidth="1.4" strokeDasharray="4 9"/>
        <circle cx="620" cy="300" r="8" fill="#F2A230"/>
        <circle cx="620" cy="300" r="8" fill="#F2A230"
          style={{ transformOrigin: '620px 300px', animation: 'pulseRing 3s ease-out infinite' }}/>
        <circle cx="760" cy="420" r="6" fill="#8A2B6B" fillOpacity=".45"/>
        <circle cx="520" cy="180" r="5" fill="#8A2B6B" fillOpacity=".3"/>
      </svg>

      {/* Header */}
      <header style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: '26px 32px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#F2A230', boxShadow: '0 0 0 4px rgba(242,162,48,.2)', display: 'block' }}/>
        <span style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: '-.03em' }}>RoutePool</span>
        <span style={{ font: '600 10.5px Karla,sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(33,28,38,.4)', border: '1px solid rgba(33,28,38,.14)', padding: '5px 9px', borderRadius: 999 }}>
          Phase 1 · requests &amp; matching
        </span>
      </header>

      {/* Main grid */}
      <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: '34px 32px 80px', display: 'grid', gridTemplateColumns: '1.08fr .92fr', gap: 56, alignItems: 'center', minHeight: '70vh' }}>

        {/* Left — hero copy */}
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#E4F2EC', color: '#0F6B52', font: '700 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', padding: '8px 13px', borderRadius: 999, marginBottom: 22 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" fill="#157F63"/>
              <path d="M8.8 12.2l2.3 2.3 4.2-4.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/>
            </svg>
            Verified students only
          </div>
          <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 70, lineHeight: .96, letterSpacing: '-.04em', margin: '0 0 20px', textWrap: 'balance' }}>
            Pool the route,<br/>split the fare.
          </h1>
          <p style={{ margin: '0 0 32px', fontSize: 18, lineHeight: 1.55, color: 'rgba(33,28,38,.62)', maxWidth: 480 }}>
            RoutePool reads your route as a graph and finds the S.P.I.T students already heading your way. Match, meet at the gate, share one auto.
          </p>
          <div style={{ display: 'flex', gap: 34, paddingTop: 26, borderTop: '1px solid rgba(33,28,38,.1)' }}>
            {[['500+','verified students'],['₹800+','pooled fares saved'],['85%','requests matched']].map(([v,l]) => (
              <div key={l}>
                <div style={{ font: '700 30px Familjen Grotesk,sans-serif', letterSpacing: '-.03em' }}>{v}</div>
                <div style={{ fontSize: 12.5, color: 'rgba(33,28,38,.5)', fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — auth card */}
        <div style={{ background: '#FDFAF4', border: '1px solid rgba(33,28,38,.07)', borderRadius: 30, padding: 38, boxShadow: '0 2px 4px rgba(33,28,38,.04),0 44px 70px -40px rgba(33,28,38,.55)' }}>

          {/* Stage: email */}
          {stage === 'email' && (
            <div>
              <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(33,28,38,.42)', marginBottom: 10 }}>Step 1 of 2</div>
              <h2 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 29, letterSpacing: '-.03em', margin: '0 0 8px' }}>Sign in with your institute email</h2>
              <p style={{ margin: '0 0 26px', fontSize: 14.5, lineHeight: 1.5, color: 'rgba(33,28,38,.58)' }}>
                Personal Gmail addresses are rejected. Only @spit.ac.in students can request or join a pool.
              </p>
              <label className="input-label" htmlFor="email-input">Institutional email</label>
              <div className="input-row" style={{ marginBottom: 14 }}>
                <input
                  id="email-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your.name"
                  onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                  autoComplete="email"
                />
                <span className="input-suffix">{DOMAIN}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="10" width="16" height="10" rx="3" stroke="#157F63" strokeWidth="2"/>
                  <path d="M8.5 10V7.5a3.5 3.5 0 017 0V10" stroke="#157F63" strokeWidth="2"/>
                </svg>
                <span style={{ fontSize: 12.5, color: '#157F63', fontWeight: 600 }}>One-time code, no password stored</span>
              </div>
              <button
                className="btn-accent"
                onClick={handleSendCode}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                {loading ? <Spinner size="sm" /> : null}
                {loading ? 'Sending…' : 'Send verification code'}
              </button>
              {error && <p style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 600, color: '#C24444' }}>{error}</p>}
            </div>
          )}

          {/* Stage: OTP */}
          {stage === 'otp' && (
            <div style={{ animation: 'screenIn .34s cubic-bezier(.2,.7,.2,1)' }}>
              <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(33,28,38,.42)', marginBottom: 10 }}>Step 2 of 2</div>
              <h2 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 29, letterSpacing: '-.03em', margin: '0 0 8px' }}>Enter your code</h2>
              <p style={{ margin: '0 0 26px', fontSize: 14.5, lineHeight: 1.5, color: 'rgba(33,28,38,.58)' }}>
                Sent to <span style={{ color: '#8A2B6B', fontWeight: 700 }}>{emailFull}</span>
              </p>

              {/* Dev OTP hint */}
              {devCode && (
                <div style={{ background: '#FFF1DB', border: '1px solid rgba(169,106,12,.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 700, color: '#A96A0C' }}>
                  Dev OTP: <span style={{ fontFamily: 'monospace', fontSize: 16, letterSpacing: 3 }}>{devCode}</span>
                </div>
              )}

              {/* OTP cells */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {cells.map((d, i) => (
                  <div key={i} style={{
                    flex: 1, height: 72, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 28,
                    background: '#fff',
                    border: `1.5px solid ${d ? '#F2A230' : 'rgba(33,28,38,.12)'}`,
                    boxShadow: d ? '0 0 0 3px rgba(242,162,48,.15)' : 'none',
                    transition: 'all .2s',
                  }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Numpad */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9, marginBottom: 18 }}>
                {KEYS.map(k => (
                  <button
                    key={k}
                    onClick={() => pressKey(k)}
                    style={{
                      border: '1px solid rgba(33,28,38,.09)', background: '#fff', borderRadius: 14,
                      padding: '14px 0', font: '600 20px Familjen Grotesk,sans-serif', color: '#211C26',
                      cursor: 'pointer', transition: 'all .14s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background='#F4EEE3'; e.currentTarget.style.transform='translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.transform='none'; }}
                    onMouseDown={e => e.currentTarget.style.transform='scale(.96)'}
                    onMouseUp={e => e.currentTarget.style.transform='none'}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'rgba(33,28,38,.45)', fontWeight: 600 }}>
                <span onClick={() => setStage('email')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Change email</span>
                {loading && <Spinner size="sm" />}
              </div>
              {error && <p style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 600, color: '#C24444' }}>{error}</p>}
            </div>
          )}

          {/* Stage: verified */}
          {stage === 'verified' && (
            <div style={{ textAlign: 'center', padding: '10px 0', animation: 'screenIn .34s cubic-bezier(.2,.7,.2,1)' }}>
              <div style={{ position: 'relative', width: 132, height: 132, margin: '0 auto 26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(21,127,99,.15)', animation: 'pulseRing 2.6s ease-out infinite' }}/>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(21,127,99,.15)', animation: 'pulseRing 2.6s .9s ease-out infinite' }}/>
                <div style={{ width: 98, height: 98, borderRadius: '50%', background: 'linear-gradient(160deg,#1B9B75,#157F63)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 36px -14px rgba(21,127,99,.85)', animation: 'popIn .5s cubic-bezier(.2,1.3,.4,1) both' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12.6l4.4 4.4L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#E4F2EC', color: '#0F6B52', font: '700 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', padding: '7px 13px', borderRadius: 999, marginBottom: 16, animation: 'rise .5s .1s both' }}>
                Verified student
              </div>
              <h2 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 34, letterSpacing: '-.035em', margin: '0 0 12px', animation: 'rise .5s .16s both' }}>
                Welcome, {verifiedUser?.name?.split(' ')[0] ?? 'there'}!
              </h2>
              <p style={{ margin: '0 auto 28px', fontSize: 14.5, lineHeight: 1.55, color: 'rgba(33,28,38,.6)', maxWidth: 320, animation: 'rise .5s .22s both' }}>
                Your institute email is verified. Find students already heading your way.
              </p>
              <button
                className="btn-primary"
                onClick={enterApp}
                style={{ animation: 'rise .5s .28s both' }}
              >
                Enter RoutePool
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
