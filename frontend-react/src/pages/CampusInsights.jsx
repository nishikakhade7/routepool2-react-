import NavBar from '../components/NavBar';
import DemoDataBadge from '../components/DemoDataBadge';

export default function CampusInsights() {
  return (
    <div className="animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar />
      
      <main className="screen-pad" style={{ maxWidth: 1000 }}>
        <DemoDataBadge />
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 8 }}>Active Students</div>
            <div style={{ font: '700 28px Familjen Grotesk,sans-serif' }}>1,240</div>
          </div>
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 8 }}>Total Pools</div>
            <div style={{ font: '700 28px Familjen Grotesk,sans-serif' }}>8,450</div>
          </div>
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 8 }}>Avg Wait Time</div>
            <div style={{ font: '700 28px Familjen Grotesk,sans-serif' }}>4.2m</div>
          </div>
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 8 }}>Emissions Saved</div>
            <div style={{ font: '700 28px Familjen Grotesk,sans-serif', color: '#0F8A5F' }}>2.1t</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 32 }}>
          {/* Chart */}
          <div className="card" style={{ padding: '28px 32px' }}>
            <h2 style={{ font: '600 12px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 24px', color: 'rgba(33,28,38,.55)' }}>Requests by Hour (Today)</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: 200, gap: 8, paddingBottom: 24, borderBottom: '1px solid rgba(33,28,38,.08)' }}>
              {[12, 8, 30, 45, 80, 100, 60, 40, 25, 15, 10, 5].map((val, i) => (
                <div key={i} style={{ flex: 1, height: `${val}%`, background: val > 70 ? '#F2A230' : 'rgba(33,28,38,.1)', borderRadius: '4px 4px 0 0', position: 'relative' }}>
                  {val > 70 && <div style={{ position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)', font: '700 11px Karla,sans-serif' }}>{val}</div>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, font: '600 11px Karla,sans-serif', color: 'rgba(33,28,38,.45)' }}>
              <span>8 AM</span>
              <span>12 PM</span>
              <span>4 PM</span>
              <span>8 PM</span>
            </div>
          </div>

          {/* Corridors */}
          <div className="card" style={{ padding: '28px 32px' }}>
            <h2 style={{ font: '600 12px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 24px', color: 'rgba(33,28,38,.55)' }}>Popular Corridors</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { name: 'Andheri West', val: 85 },
                { name: 'DN Nagar', val: 60 },
                { name: 'Jogeshwari', val: 40 },
                { name: 'Goregaon', val: 25 },
              ].map((c, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', font: '700 13px Familjen Grotesk,sans-serif', marginBottom: 8 }}>
                    <span>Gate 2 → {c.name}</span>
                    <span style={{ color: 'rgba(33,28,38,.5)' }}>{c.val}%</span>
                  </div>
                  <div className="progress-track" style={{ height: 6 }}>
                    <div className="progress-fill" style={{ width: `${c.val}%`, background: i === 0 ? '#8A2B6B' : 'rgba(33,28,38,.12)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
