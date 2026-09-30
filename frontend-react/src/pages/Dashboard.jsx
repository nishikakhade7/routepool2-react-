import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import RouteVisual from '../components/RouteVisual';
import Spinner from '../components/Spinner';
import FareBreakup from '../components/FareBreakup';
import { getDashboardStats, getBusyRoutes, getAvailableGroups, joinGroupById } from '../api/client';
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
  // Each card loads independently, so one failing endpoint shows its own error
  // instead of blanking every card.
  const [cardErrors, setCardErrors] = useState({});
  const [available, setAvailable] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getDashboardStats(), getBusyRoutes(), getAvailableGroups()])
      .then(([s, b, a]) => {
        if (cancelled) return;
        if (s.status === 'fulfilled') setStats(s.value);
        if (b.status === 'fulfilled') setBusyRoutes(b.value);
        if (a.status === 'fulfilled') setAvailable(a.value);
        setCardErrors({
          stats: s.reason?.message,
          busy: b.reason?.message,
          available: a.reason?.message,
        });
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Join this group directly (Book a ride is solo-only), then show the
  // confirmation and its chat on the Joined groups tab.
  const [joiningId, setJoiningId] = useState(null);
  async function openInBook(g) {
    setJoiningId(g.id);
    setCardErrors((prev) => ({ ...prev, available: null }));
    try {
      const joined = await joinGroupById(g.id);
      navigate(`/groups?joined=${joined.id}`);
    } catch (e) {
      setCardErrors((prev) => ({ ...prev, available: e.message }));
    } finally {
      setJoiningId(null);
    }
  }

  // The one-active-group rule from the backend (same message as a refused join).
  const joinBlockedReason = available.find((g) => g.joinBlockedReason)?.joinBlockedReason;

  // Same row the History table shows for this ride (backend getHistory).
  const activeGroup = stats?.activeRide ?? null;
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
            ) : cardErrors.stats ? (
              <div className="error-msg-red">Couldn't load your pool: {cardErrors.stats}</div>
            ) : activeGroup ? (
              <div className="card-dark" style={{ cursor: 'pointer' }} onClick={() => navigate('/groups')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, position: 'relative', zIndex: 2 }}>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '700 10px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', background: activeGroup.status === 'confirmed' ? '#E4F2EC' : '#FFF1DB', color: activeGroup.status === 'confirmed' ? '#0F6B52' : '#A96A0C', padding: '6px 11px', borderRadius: 999, marginBottom: 12 }}>
                      {activeGroup.status === 'confirmed' ? 'Full · confirmed' : (
                        <>
                          <span className="spinner-sm" style={{ borderTopColor: '#A96A0C', width: 11, height: 11, borderWidth: 1.5 }}/>
                          Forming · open for riders
                        </>
                      )}
                    </div>
                    <div style={{ font: '700 24px Familjen Grotesk,sans-serif', letterSpacing: '-.03em', marginBottom: 4 }}>
                      Departs {fmt(activeGroup.departureTime)}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(253,250,244,.7)', fontWeight: 600 }}>
                      {activeGroup.pickupName ?? '—'} → {activeGroup.dropName}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'rgba(253,250,244,.6)', fontWeight: 600, marginTop: 6 }}>
                      {activeGroup.coRiderNames?.length
                        ? `With ${activeGroup.coRiderNames.join(', ')}`
                        : 'No co-riders yet'}
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
            <h2 style={{ font: '600 12px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 16px', color: 'rgba(33,28,38,.55)' }}>
              Available groups
            </h2>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {joinBlockedReason && <div className="error-msg-red" style={{ margin: 16 }}>{joinBlockedReason}</div>}
              {loading ? (
                <div className="loading-center" style={{ padding: 40 }}><Spinner /></div>
              ) : cardErrors.available ? (
                <div className="error-msg-red" style={{ margin: 16 }}>Couldn't load open groups: {cardErrors.available}</div>
              ) : available.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'rgba(33,28,38,.4)', font: '600 13px Karla,sans-serif' }}>No open groups right now</div>
              ) : available.map((g, i) => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderBottom: i < available.length - 1 ? '1px solid rgba(33,28,38,.06)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 15px Familjen Grotesk,sans-serif', letterSpacing: '-.02em', marginBottom: 2 }}>
                      {g.pickupName} → {g.dropName}
                      {g.isMine && <span style={{ marginLeft: 8, font: '700 10.5px Karla,sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', color: '#0F6B52', background: '#E4F2EC', borderRadius: 7, padding: '3px 7px' }}>You're in</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(33,28,38,.5)', fontWeight: 600 }}>
                      {fmt(g.pickupTime)} · {g.members.map(m => m.name).join(', ')} · {g.seatsLeft} seat{g.seatsLeft === 1 ? '' : 's'} left
                    </div>
                    <FareBreakup fare={g.fare} />
                  </div>
                  <button
                    className="btn-primary"
                    style={{ width: 'auto', padding: '10px 18px', opacity: g.joinBlockedReason ? 0.4 : 1, cursor: g.joinBlockedReason ? 'not-allowed' : 'pointer' }}
                    disabled={!!g.joinBlockedReason || joiningId === g.id}
                    title={g.joinBlockedReason || (g.isMine ? 'Open this group and its chat' : 'Join this group and open its chat')}
                    onClick={() => (g.isMine ? navigate(`/groups?joined=${g.id}`) : openInBook(g))}
                  >
                    {joiningId === g.id ? 'Joining…' : g.isMine ? 'Open' : 'Join'}
                  </button>
                </div>
              ))}
            </div>
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
                        <div style={{ font: '700 15px Familjen Grotesk,sans-serif', letterSpacing: '-.02em', marginBottom: 2 }}>{a.pickupName ?? '—'} → {a.dropName}</div>
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
            ) : cardErrors.busy ? (
              <div className="error-msg-red">Couldn't load busy routes: {cardErrors.busy}</div>
            ) : busyRoutes.length === 0 ? (
              <div style={{ fontSize: 13, color: 'rgba(33,28,38,.4)', fontWeight: 600, textAlign: 'center' }}>No active requests</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {busyRoutes.map((br, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
                      <span>{br.pickupShort} → {br.dropShort}</span>
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


        </div>
      </main>
    </div>
  );
}
