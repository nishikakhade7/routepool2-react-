import NavBar from '../components/NavBar';
import DemoDataBadge from '../components/DemoDataBadge';

const HISTORY = [
  { id: '1', date: 'Yesterday, 5:45 PM', route: 'Gate 2 to Andheri West', fare: 30, saved: 20, status: 'Completed', users: ['AK', 'JD'] },
  { id: '2', date: 'Sep 12, 6:10 PM', route: 'Gate 2 to DN Nagar', fare: 45, saved: 30, status: 'Completed', users: ['SP'] },
  { id: '3', date: 'Sep 10, 5:30 PM', route: 'Gate 2 to Jogeshwari', fare: 35, saved: 15, status: 'Completed', users: ['MK', 'RJ'] },
  { id: '4', date: 'Sep 08, 6:00 PM', route: 'Gate 2 to Andheri West', fare: 30, saved: 20, status: 'Completed', users: ['AK', 'PT'] },
];

export default function History() {
  return (
    <div className="animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar />
      
      <main className="screen-pad" style={{ maxWidth: 900 }}>
        <DemoDataBadge />
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 32 }}>
          <div className="card" style={{ padding: '24px 28px' }}>
            <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 8 }}>Total Saved</div>
            <div style={{ font: '700 32px Familjen Grotesk,sans-serif', color: '#0F8A5F' }}>₹2,340</div>
          </div>
          <div className="card" style={{ padding: '24px 28px' }}>
            <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 8 }}>Pools Joined</div>
            <div style={{ font: '700 32px Familjen Grotesk,sans-serif' }}>18</div>
          </div>
          <div className="card" style={{ padding: '24px 28px' }}>
            <div style={{ font: '600 11px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.45)', marginBottom: 8 }}>Avg Fare</div>
            <div style={{ font: '700 32px Familjen Grotesk,sans-serif' }}>₹130</div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F4EEE3', borderBottom: '1px solid rgba(33,28,38,.08)' }}>
                <th style={{ padding: '16px 24px', font: '600 11px Karla,sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(33,28,38,.5)' }}>Date & Route</th>
                <th style={{ padding: '16px 24px', font: '600 11px Karla,sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(33,28,38,.5)' }}>Co-riders</th>
                <th style={{ padding: '16px 24px', font: '600 11px Karla,sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(33,28,38,.5)', textAlign: 'right' }}>Fare (Saved)</th>
              </tr>
            </thead>
            <tbody>
              {HISTORY.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < HISTORY.length - 1 ? '1px solid rgba(33,28,38,.06)' : 'none' }}>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ font: '700 15px Familjen Grotesk,sans-serif', marginBottom: 4 }}>{item.route}</div>
                    <div style={{ fontSize: 13, color: 'rgba(33,28,38,.5)', fontWeight: 500 }}>{item.date}</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', gap: -8 }}>
                      {item.users.map((u, ui) => (
                        <div key={ui} style={{ width: 28, height: 28, borderRadius: '50%', background: '#E7E3F7', color: '#3E3470', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 11px Familjen Grotesk,sans-serif', border: '2px solid #fff', marginLeft: ui > 0 ? -8 : 0 }}>
                          {u}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                    <div style={{ font: '700 16px Familjen Grotesk,sans-serif' }}>₹{item.fare}</div>
                    <div style={{ fontSize: 12, color: '#0F8A5F', fontWeight: 600 }}>Saved ₹{item.saved}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
