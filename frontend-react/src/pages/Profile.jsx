import NavBar from '../components/NavBar';
import DemoDataBadge from '../components/DemoDataBadge';
import { useAuth } from '../contexts/AuthContext';

export default function Profile() {
  const { user, logout } = useAuth();
  
  const initials = user?.initials || '??';
  
  return (
    <div className="animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar />
      
      <main className="screen-pad" style={{ maxWidth: 800 }}>
        <DemoDataBadge />
        <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-.03em', margin: '0 0 32px' }}>
          Profile & Settings
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* Identity Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(150deg, #F7D9A8, #E8C9DE)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 24px Karla,sans-serif', color: '#5C3350' }}>
                {initials}
              </div>
              <div>
                <div style={{ font: '700 22px Familjen Grotesk,sans-serif', letterSpacing: '-.02em', marginBottom: 4 }}>{user?.name || 'User'}</div>
                <div style={{ fontSize: 14, color: 'rgba(33,28,38,.55)', fontWeight: 500 }}>{user?.email || 'student@spit.ac.in'}</div>
              </div>
            </div>
            
            <div style={{ background: '#E4F2EC', border: '1px solid rgba(15,107,82,.16)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" fill="#0F6B52"/>
                <path d="M8.8 12.2l2.3 2.3 4.2-4.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/>
              </svg>
              <div>
                <div style={{ font: '700 14px Karla,sans-serif', color: '#0F6B52', marginBottom: 2 }}>Verified S.P.I.T Student</div>
                <div style={{ fontSize: 12, color: 'rgba(15,107,82,.8)' }}>Institute ID verified via OTP</div>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ font: '600 12px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', margin: 0, color: 'rgba(33,28,38,.45)' }}>Pooling Preferences</h2>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ font: '700 15px Familjen Grotesk,sans-serif', marginBottom: 4 }}>Only match same branch</div>
                <div style={{ fontSize: 12.5, color: 'rgba(33,28,38,.5)' }}>Limit matches to your department</div>
              </div>
              <div style={{ width: 44, height: 24, borderRadius: 12, background: 'rgba(33,28,38,.1)', position: 'relative' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', left: 2, top: 2, boxShadow: '0 1px 3px rgba(0,0,0,.1)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ font: '700 15px Familjen Grotesk,sans-serif', marginBottom: 4 }}>Push notifications</div>
                <div style={{ fontSize: 12.5, color: 'rgba(33,28,38,.5)' }}>When matches are found</div>
              </div>
              <div style={{ width: 44, height: 24, borderRadius: 12, background: '#157F63', position: 'relative' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', right: 2, top: 2, boxShadow: '0 1px 3px rgba(0,0,0,.1)' }} />
              </div>
            </div>
          </div>
        </div>

        <button className="btn-ghost" onClick={logout} style={{ color: '#C24444', borderColor: 'rgba(194,68,68,.3)' }}>
          Log out
        </button>
      </main>
    </div>
  );
}
