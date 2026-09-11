import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import RouteVisual from '../components/RouteVisual';
import Spinner from '../components/Spinner';
import { getDashboardStats, getBusyRoutes } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

function fmt(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [busyRoutes, setBusyRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getDashboardStats(), getBusyRoutes()])
      .then(([s, b]) => {
        if (!cancelled) { setStats(s); setBusyRoutes(b); setLoading(false); }
      })
      .catch(e => {
        if (!cancelled) { setError(e.message); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  const activeGroup = stats?.recentActivity?.find(a => a.status === 'forming' || a.status === 'confirmed');
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar />
      
      <main className="screen-pad" style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 46 }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          <header>
            <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 38, letterSpacing: '-.03em', margin: '0 0 4px' }}>
              Good evening, {firstName}.
            </h1>
            <p style={{ margin: 0, fontSize: 14.5, color: 'rgba(33,28,38,.55)', fontWeight: 600 }}>{dateStr}</p>
          </header>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ font: '600 12px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', margin: 0, color: 'rgba(33,28,38,.55)' }}>
                Tonight's pool
              </h2>
            </div>
            
            {loading ? (
              <div className="card loading-center">
                <Spinner />
                Loading your pool...
              </div>
            ) : error ? (
              <div className="error-msg-red">{error}</div>
            ) : activeGroup ? (
              <div className="card-dark" style={{ cursor: 'pointer' }} onClick={() => navigate('/form-group')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, position: 'relative', zIndex: 2 }}>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '700 10px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', background: '#FFF1DB', color: '#A96A0C', padding: '6px 11px', borderRadius: 999, marginBottom: 12 }}>
                      <span className="spinner-sm" style={{ borderTopColor: '#A96A0C', width: 11, height: 11, borderWidth: 1.5 }}/>
                      Finding matches
                    </div>
                    <div style={{ font: '700 24px Familjen Grotesk,sans-serif', letterSpacing: '-.03em', marginBottom: 4 }}>
                      Departs {fmt(activeGroup.departureTime)}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(253,250,244,.7)', fontWeight: 600 }}>
                      Gate 2 to {activeGroup.dropName}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ font: '700 24px Familjen Grotesk,sans-serif', letterSpacing: '-.03em', color: '#F2A230' }}>
                      ₹{(activeGroup.fareShare ?? 0).toFixed(0)}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(253,250,244,.5)', fontWeight: 600 }}>
                      vs ₹{(activeGroup.soloFare ?? 0).toFixed(0)} solo
                    </div>
                  </div>
                </div>
                
                <div style={{ margin: '0 -28px -40px', opacity: .85 }}>
                  <RouteVisual height={140} variant="dark" />
                </div>
              </div>
            ) : (
              <div
                className="card"
                onClick={() => navigate('/form-group')}
                style={{
                  border: '2px dashed rgba(33,28,38,.15)', background: 'transparent', boxShadow: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
                  padding: 42, cursor: 'pointer', transition: 'border-color .18s, background .18s'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(242,162,48,.6)'; e.currentTarget.style.background = '#FDFAF4'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(33,28,38,.15)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 14, background: '#FDFAF4', border: '1px solid rgba(33,28,38,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#211C26" strokeWidth="2.4" strokeLinecap="round"/></svg>
                </div>
                <div style={{ font: '700 16px Karla,sans-serif' }}>No active pool yet</div>
                <div style={{ fontSize: 13, color: 'rgba(33,28,38,.5)', fontWeight: 600 }}>Click to form a group</div>
              </div>
            )}
          </section>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ font: '600 12px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', margin: 0, color: 'rgba(33,28,38,.55)' }}>
                Recent activity
              </h2>
            </div>
            
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {loading ? (
                <div className="loading-center" style={{ padding: 40 }}><Spinner /></div>
              ) : stats?.recentActivity?.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'rgba(33,28,38,.4)', font: '600 13px Karla,sans-serif' }}>No recent pools</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {stats?.recentActivity?.slice(0, 3).map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderBottom: i < 2 ? '1px solid rgba(33,28,38,.06)' : 'none' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: a.status === 'completed' ? '#E4F2EC' : '#F4EEE3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M14 6l6 6-6 6M4 12h16" stroke={a.status === 'completed' ? '#0F6B52' : '#211C26'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ font: '700 15px Familjen Grotesk,sans-serif', letterSpacing: '-.02em', marginBottom: 2 }}>Gate 2 to {a.dropName}</div>
                        <div style={{ fontSize: 12, color: 'rgba(33,28,38,.5)', fontWeight: 600 }}>
                          {new Date(a.departureTime).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} · {a.status}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ font: '700 15px Familjen Grotesk,sans-serif', letterSpacing: '-.02em' }}>₹{(a.fareShare ?? 0).toFixed(0)}</div>
                        <div style={{ fontSize: 11.5, color: '#0F8A5F', fontWeight: 600, marginTop: 2 }}>saved ₹{(a.saved ?? 0).toFixed(0)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 64 }}>
          
          <button className="btn-accent" onClick={() => navigate('/form-group')}>
            Find my pool
          </button>

          <div className="card" style={{ padding: '24px 28px' }}>
            <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 8 }}>Saved so far</div>
            <div style={{ font: '700 34px Familjen Grotesk,sans-serif', letterSpacing: '-.03em', marginBottom: 18 }}>
              {loading ? '—' : `₹${stats?.totalSavings?.toFixed(0) || 0}`}
            </div>
            
            <svg viewBox="0 0 200 40" style={{ width: '100%', height: 40, display: 'block', overflow: 'visible' }}>
              <path d="M0 30 L40 25 L80 32 L120 15 L160 20 L200 5" fill="none" stroke="#F2A230" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="200" cy="5" r="4" fill="#F2A230" />
            </svg>
          </div>

          <div className="card" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8A2B6B', animation: 'nodeBlink 2s infinite' }} />
              <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.55)' }}>Busy right now</div>
            </div>
            
            {loading ? (
              <div className="loading-center" style={{ padding: 20 }}><Spinner size="sm" /></div>
            ) : busyRoutes.length === 0 ? (
              <div style={{ fontSize: 13, color: 'rgba(33,28,38,.4)', fontWeight: 600, textAlign: 'center' }}>No active requests</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {busyRoutes.map((br, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
                      <span>{br.dropShort}</span>
                      <span style={{ color: 'rgba(33,28,38,.5)' }}>{br.count} req</span>
                    </div>
                    <div className="progress-track" style={{ height: 5 }}>
                      <div className="progress-fill" style={{ width: `${br.widthPct}%`, background: i === 0 ? '#8A2B6B' : 'rgba(33,28,38,.12)', animationDelay: `${i * 0.1}s`, animation: 'growBar .6s cubic-bezier(.2,.8,.2,1) both', transformOrigin: 'left' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#FFF1DB', border: '1px solid rgba(169,106,12,.25)', borderRadius: 20, padding: 22, marginTop: 12 }}>
            <div style={{ font: '700 13px Karla,sans-serif', color: '#A96A0C', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="#A96A0C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              No driver in Phase 1
            </div>
            <div style={{ fontSize: 13, color: 'rgba(169,106,12,.8)', lineHeight: 1.5, fontWeight: 500 }}>
              Right now, RoutePool only matches you with a group. You still need to hail your own auto at the gate.
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
