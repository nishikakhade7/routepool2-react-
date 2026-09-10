import NavBar from '../components/NavBar';
import DemoDataBadge from '../components/DemoDataBadge';

const NOTIFICATIONS = [
  { id: 1, title: 'Your pool is ready!', body: 'Gate 2 to Andheri West has 3 confirmed riders. Meet at the gate in 15 mins.', time: '2 mins ago', type: 'success' },
  { id: 2, title: 'New message in Group 1', body: 'Rohan: "I am waiting near the tea stall."', time: '10 mins ago', type: 'message' },
  { id: 3, title: 'Price drop alert', body: 'Average fare to DN Nagar is currently ₹45 (usually ₹60).', time: '1 hour ago', type: 'info' },
  { id: 4, title: 'Ride completed', body: 'Hope you had a great trip to Jogeshwari. You saved ₹25.', time: 'Yesterday', type: 'success' },
];

export default function Notifications() {
  return (
    <div className="animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar />
      
      <main className="screen-pad" style={{ maxWidth: 700 }}>
        <DemoDataBadge />
        <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-.03em', margin: '0 0 32px' }}>
          Notifications
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {NOTIFICATIONS.map(n => (
            <div key={n.id} className="card" style={{ padding: '20px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ 
                width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: n.type === 'success' ? '#E4F2EC' : n.type === 'message' ? '#F7E3F0' : '#FFF1DB',
                color: n.type === 'success' ? '#0F6B52' : n.type === 'message' ? '#8A4A72' : '#A96A0C'
              }}>
                {n.type === 'success' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12.6l4.4 4.4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : n.type === 'message' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V6c0-1.1-.9-2-2-2z" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.4"/><path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ font: '700 16px Familjen Grotesk,sans-serif' }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(33,28,38,.45)', fontWeight: 600 }}>{n.time}</div>
                </div>
                <div style={{ fontSize: 14, color: 'rgba(33,28,38,.6)', lineHeight: 1.4 }}>{n.body}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
