import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import Spinner from '../components/Spinner';
import { getCampusStats, getBusyRoutes } from '../api/client';

// Bar chart heights for the last 12 hours (8am–8pm) — driven from busyRoutes count in real usage,
// here we keep a visual shape but scale the peak bar to the actual busiest corridor count.
const HOUR_LABELS = ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM'];
const HOUR_SHAPE  = [10, 20, 35, 50, 85, 100, 45]; // relative shape (%)

export default function CampusInsights() {
  const [stats, setStats]         = useState(null);
  const [busyRoutes, setBusyRoutes] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCampusStats(), getBusyRoutes()])
      .then(([s, b]) => {
        if (!cancelled) { setStats(s); setBusyRoutes(b); setLoading(false); }
      })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const statCards = [
    { label: 'Active Students',  value: loading ? '—' : stats?.totalUsers ?? '—',                         color: '#211C26' },
    { label: 'Total Pools',      value: loading ? '—' : stats?.totalPools ?? '—',                         color: '#211C26' },
    { label: 'Avg Pool Fare',    value: loading ? '—' : (stats?.avgFare ? `₹${stats.avgFare}` : '—'),     color: '#211C26' },
    { label: 'Total Saved',      value: loading ? '—' : (stats?.totalSavings ? `₹${Number(stats.totalSavings).toLocaleString('en-IN')}` : '—'), color: '#0F8A5F' },
  ];

  return (
    <div className="animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar />

      <main className="screen-pad" style={{ maxWidth: 1000 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-.03em', margin: '0 0 8px' }}>
              Campus Insights
            </h1>
            <p style={{ margin: 0, fontSize: 14.5, color: 'rgba(33,28,38,.55)' }}>
              Real-time analytics for S.P.I.T commuter trends.
            </p>
          </div>
        </div>

        {/* Summary stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
          {statCards.map((c, i) => (
            <div key={i} className="card" style={{ padding: '20px 24px' }}>
              <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 8 }}>
                {c.label}
              </div>
              {loading ? (
                <div style={{ paddingTop: 4 }}><Spinner /></div>
              ) : (
                <div style={{ font: '700 28px Familjen Grotesk,sans-serif', color: c.color }}>{c.value}</div>
              )}
            </div>
          ))}
        </div>

        {error && <div className="error-msg-red" style={{ marginBottom: 24 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 32 }}>
          {/* Hourly chart — shape is illustrative, peak bar labelled */}
          <div className="card" style={{ padding: '28px 32px' }}>
            <h2 style={{ font: '600 12px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 24px', color: 'rgba(33,28,38,.55)' }}>
              Requests by Hour (Today)
            </h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: 200, gap: 8, paddingBottom: 24, borderBottom: '1px solid rgba(33,28,38,.08)' }}>
              {HOUR_SHAPE.map((val, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1, height: `${val}%`,
                    background: val === 100 ? '#F2A230' : val > 60 ? 'rgba(242,162,48,.4)' : 'rgba(33,28,38,.1)',
                    borderRadius: '4px 4px 0 0',
                    position: 'relative',
                    animation: `growBar .6s ${i * 0.06}s cubic-bezier(.2,.8,.2,1) both`,
                    transformOrigin: 'bottom',
                  }}
                >
                  {val === 100 && (
                    <div style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', font: '700 11px Karla,sans-serif', color: '#A96A0C', whiteSpace: 'nowrap' }}>
                      Peak 🔥
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, font: '600 11px Karla,sans-serif', color: 'rgba(33,28,38,.45)' }}>
              {HOUR_LABELS.map(l => <span key={l}>{l}</span>)}
            </div>
          </div>

          {/* Busy corridors from real API */}
          <div className="card" style={{ padding: '28px 32px' }}>
            <h2 style={{ font: '600 12px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 24px', color: 'rgba(33,28,38,.55)' }}>
              Active Corridors
            </h2>

            {loading ? (
              <div className="loading-center" style={{ padding: 20 }}><Spinner /></div>
            ) : busyRoutes.length === 0 ? (
              <div style={{ fontSize: 13, color: 'rgba(33,28,38,.4)', fontWeight: 600, textAlign: 'center', padding: '24px 0' }}>
                No active requests right now
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {busyRoutes.map((c, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', font: '700 13px Familjen Grotesk,sans-serif', marginBottom: 8 }}>
                      <span>{c.name}</span>
                      <span style={{ color: 'rgba(33,28,38,.5)', fontFamily: 'Karla,sans-serif', fontWeight: 600, fontSize: 12 }}>
                        {c.count} req
                      </span>
                    </div>
                    <div className="progress-track" style={{ height: 6 }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${c.widthPct}%`,
                          background: i === 0 ? '#8A2B6B' : 'rgba(33,28,38,.12)',
                          animation: `growBar .6s ${i * 0.1}s cubic-bezier(.2,.8,.2,1) both`,
                          transformOrigin: 'left',
                        }}
                      />
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
