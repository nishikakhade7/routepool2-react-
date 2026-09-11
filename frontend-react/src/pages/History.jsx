import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import Spinner from '../components/Spinner';
import { getDashboardStats, getHistory } from '../api/client';

function fmt(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const today    = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const isToday     = d.toDateString() === today.toDateString();
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (isToday)     return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
}

const AVATAR_BG = ['#E7E3F7', '#DCEDE6', '#F7E3F0', '#FFF1DB', '#F4EEE3'];
const AVATAR_FG = ['#3E3470', '#1F5A4A', '#8A4A72', '#A96A0C', '#5C3350'];

export default function History() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getDashboardStats(), getHistory()])
      .then(([s, h]) => {
        if (!cancelled) { setStats(s); setHistory(h); setLoading(false); }
      })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const avgFare = history.length > 0
    ? (history.reduce((s, h) => s + (h.fareShare ?? 0), 0) / history.length).toFixed(0)
    : 0;

  return (
    <div className="animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar />

      <main className="screen-pad" style={{ maxWidth: 900 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-.03em', margin: '0 0 8px' }}>
              Your ride history
            </h1>
            <p style={{ margin: 0, fontSize: 14.5, color: 'rgba(33,28,38,.55)' }}>
              Past pools and lifetime savings.
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 32 }}>
          <div className="card" style={{ padding: '24px 28px' }}>
            <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 8 }}>Total Saved</div>
            <div style={{ font: '700 32px Familjen Grotesk,sans-serif', color: '#0F8A5F' }}>
              {loading ? '—' : `₹${(stats?.totalSavings ?? 0).toLocaleString('en-IN')}`}
            </div>
          </div>
          <div className="card" style={{ padding: '24px 28px' }}>
            <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 8 }}>Pools Joined</div>
            <div style={{ font: '700 32px Familjen Grotesk,sans-serif' }}>
              {loading ? '—' : (stats?.totalRides ?? 0)}
            </div>
          </div>
          <div className="card" style={{ padding: '24px 28px' }}>
            <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 8 }}>Avg Fare</div>
            <div style={{ font: '700 32px Familjen Grotesk,sans-serif' }}>
              {loading ? '—' : `₹${avgFare}`}
            </div>
          </div>
        </div>

        {/* History Table */}
        {loading ? (
          <div className="card loading-center" style={{ padding: 60 }}><Spinner /></div>
        ) : error ? (
          <div className="error-msg-red">{error}</div>
        ) : history.length === 0 ? (
          <div className="card loading-center" style={{ padding: 80 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ opacity: .3 }}>
              <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2" stroke="#211C26" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div style={{ font: '700 16px Familjen Grotesk,sans-serif', color: 'rgba(33,28,38,.5)' }}>No rides yet</div>
            <div style={{ fontSize: 13, color: 'rgba(33,28,38,.4)', fontWeight: 600 }}>Form a group to start pooling!</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F4EEE3', borderBottom: '1px solid rgba(33,28,38,.08)' }}>
                  <th style={{ padding: '16px 24px', font: '600 11px Karla,sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(33,28,38,.5)' }}>Date &amp; Route</th>
                  <th style={{ padding: '16px 24px', font: '600 11px Karla,sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(33,28,38,.5)' }}>Co-riders</th>
                  <th style={{ padding: '16px 24px', font: '600 11px Karla,sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(33,28,38,.5)', textAlign: 'right' }}>Fare (Saved)</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, i) => (
                  <tr key={item.groupId || i} style={{ borderBottom: i < history.length - 1 ? '1px solid rgba(33,28,38,.06)' : 'none' }}>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ font: '700 15px Familjen Grotesk,sans-serif', marginBottom: 4 }}>
                        Gate 2 → {item.dropName}
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(33,28,38,.5)', fontWeight: 500 }}>
                        {fmt(item.departureTime)}
                        {item.status && item.status !== 'completed' && (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#A96A0C', background: '#FFF1DB', padding: '2px 7px', borderRadius: 6 }}>
                            {item.status}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      {item.coRiders?.length > 0 ? (
                        <div style={{ display: 'flex' }}>
                          {item.coRiders.map((initials, ci) => (
                            <div key={ci} style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: AVATAR_BG[ci % AVATAR_BG.length],
                              color: AVATAR_FG[ci % AVATAR_FG.length],
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              font: '700 11px Familjen Grotesk,sans-serif',
                              border: '2px solid #fff',
                              marginLeft: ci > 0 ? -8 : 0,
                            }}>
                              {initials}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: 'rgba(33,28,38,.35)', fontWeight: 600 }}>Solo</span>
                      )}
                    </td>
                    <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                      <div style={{ font: '700 16px Familjen Grotesk,sans-serif' }}>₹{(item.fareShare ?? 0).toFixed(0)}</div>
                      <div style={{ fontSize: 12, color: '#0F8A5F', fontWeight: 600 }}>
                        {(item.saved ?? 0) > 0 ? `Saved ₹${item.saved.toFixed(0)}` : 'No savings'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
