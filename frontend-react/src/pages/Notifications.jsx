import NavBar from '../components/NavBar';

export default function Notifications() {
  return (
    <div className="animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar />

      <main className="screen-pad" style={{ maxWidth: 700 }}>
        <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-.03em', margin: '0 0 32px' }}>
          Notifications
        </h1>

        <div className="card loading-center" style={{ padding: '80px 40px', flexDirection: 'column', gap: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: '#F4EEE3', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 4a5.5 5.5 0 015.5 5.5c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5A5.5 5.5 0 0112 4z"
                stroke="#211C26" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M10 18a2 2 0 004 0" stroke="#211C26" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ font: '700 18px Familjen Grotesk,sans-serif', marginBottom: 8, color: '#211C26' }}>
              You're all caught up
            </div>
            <div style={{ fontSize: 14, color: 'rgba(33,28,38,.5)', lineHeight: 1.6, fontWeight: 500, maxWidth: 300, textAlign: 'center' }}>
              You'll get notified here when someone joins your pool, sends you a message, or when it's time to meet at the gate.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
