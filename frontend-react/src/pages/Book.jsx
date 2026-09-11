import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import VisionBadge from '../components/VisionBadge';
import Spinner from '../components/Spinner';
import { getNodes } from '../api/client';

export default function Book() {
  const navigate = useNavigate();

  // Stage: 'where' -> 'searching' -> 'grouping' -> 'driver' -> 'summary' -> 'pay' -> 'paid'
  const [stage, setStage] = useState('where');
  const [countdown, setCountdown] = useState(15);
  const [progress, setProgress] = useState(0);

  // Real node data
  const [nodes, setNodes] = useState([]);
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [pickupId, setPickupId] = useState('');
  const [dropId, setDropId] = useState('');

  // Load nodes from the API
  useEffect(() => {
    let cancelled = false;
    getNodes().then(data => {
      if (!cancelled) {
        setNodes(data);
        const campus = data.find(n => n.area === 'campus' || n.shortName === 'SPIT');
        if (campus) setPickupId(campus.id);
        setLoadingNodes(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingNodes(false);
    });
    return () => { cancelled = true; };
  }, []);

  const pickupNode = nodes.find(n => n.id === pickupId);
  const dropNode   = nodes.find(n => n.id === dropId);
  const dropNodes  = nodes.filter(n => n.id !== pickupId);

  // Auto-progress some stages
  useEffect(() => {
    let timer;
    if (stage === 'searching') {
      timer = setTimeout(() => setStage('grouping'), 2500);
    } else if (stage === 'grouping') {
      timer = setTimeout(() => setStage('driver'), 2500);
    } else if (stage === 'driver') {
      setCountdown(15);
      setProgress(0);
      const interval = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(interval); setStage('summary'); return 0; }
          return c - 1;
        });
        setProgress(p => Math.min(100, p + (100 / 15)));
      }, 1000);
      return () => clearInterval(interval);
    }
    return () => clearTimeout(timer);
  }, [stage]);

  const selectStyle = {
    flex: 1, border: 0, outline: 0, background: 'transparent',
    font: '500 16px Karla,sans-serif', color: '#211C26',
    padding: '14px 0', cursor: 'pointer',
  };

  return (
    <div className="animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar />

      <main className="screen-pad" style={{ maxWidth: 640 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <VisionBadge />
          <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-.03em', margin: '0 0 8px' }}>
            Book a ride
          </h1>
          <p style={{ margin: 0, fontSize: 14.5, color: 'rgba(33,28,38,.55)' }}>
            Phase 2 vision: RoutePool hails the auto automatically once matched.
          </p>
        </div>

        {stage === 'where' && (
          <div className="card animate-rise">
            <h2 style={{ font: '600 12px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 16px', color: 'rgba(33,28,38,.55)' }}>Where to?</h2>

            {loadingNodes ? (
              <div className="loading-center" style={{ padding: 40 }}><Spinner /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
                {/* Pickup */}
                <div className="input-row">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#211C26', marginRight: 10, flexShrink: 0 }} />
                  <select
                    value={pickupId}
                    onChange={e => setPickupId(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="" disabled>Select pickup…</option>
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>

                {/* Drop-off */}
                <div className="input-row">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #8A2B6B', marginRight: 10, flexShrink: 0 }} />
                  <select
                    value={dropId}
                    onChange={e => setDropId(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="" disabled>Select destination…</option>
                    {dropNodes.map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button
              className="btn-accent"
              disabled={!pickupId || !dropId || loadingNodes}
              onClick={() => setStage('searching')}
              style={{ opacity: (!pickupId || !dropId) ? 0.5 : 1 }}
            >
              Find a ride
            </button>
          </div>
        )}

        {stage === 'searching' && (
          <div className="card loading-center animate-rise" style={{ padding: '60px 32px' }}>
            <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(242,162,48,.3)', animation: 'radar 1.5s linear infinite' }} />
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F2A230' }} />
            </div>
            <div style={{ font: '700 20px Familjen Grotesk,sans-serif', color: '#211C26' }}>Finding nearby drivers...</div>
            <div style={{ fontSize: 13, color: 'rgba(33,28,38,.5)' }}>
              {pickupNode?.name} → {dropNode?.name}
            </div>
          </div>
        )}

        {stage === 'grouping' && (
          <div className="card loading-center animate-rise" style={{ padding: '60px 32px' }}>
            <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(138,43,107,.3)', animation: 'radar 1.5s linear infinite' }} />
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#8A2B6B' }} />
            </div>
            <div style={{ font: '700 20px Familjen Grotesk,sans-serif', color: '#211C26' }}>Matching with students...</div>
            <div style={{ fontSize: 13, color: 'rgba(33,28,38,.5)' }}>Found 2 riders heading your way</div>
          </div>
        )}

        {stage === 'driver' && (
          <div className="card-dark animate-rise" style={{ padding: '32px 36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '700 10px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', background: '#FFF1DB', color: '#A96A0C', padding: '6px 11px', borderRadius: 999, marginBottom: 12 }}>
                  Arriving in {countdown}s
                </div>
                <div style={{ font: '700 24px Familjen Grotesk,sans-serif', letterSpacing: '-.03em', marginBottom: 4 }}>Auto MH 02 AB 1234</div>
                <div style={{ fontSize: 13, color: 'rgba(253,250,244,.7)', fontWeight: 600 }}>
                  Driver: Ramesh · {pickupNode?.name} → {dropNode?.name}
                </div>
              </div>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F4EEE3', border: '2px solid #F2A230', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 18px Familjen Grotesk,sans-serif', color: '#211C26' }}>
                RC
              </div>
            </div>
            <div style={{ background: 'rgba(33,28,38,.4)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
              <div style={{ background: '#F2A230', height: '100%', width: `${progress}%`, transition: 'width 1s linear' }} />
            </div>
          </div>
        )}

        {stage === 'summary' && (
          <div className="card animate-rise" style={{ textAlign: 'center', padding: '42px 32px' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E4F2EC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#0F6B52' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M5 12.6l4.4 4.4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 26, letterSpacing: '-.03em', margin: '0 0 4px' }}>Ride completed</h2>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'rgba(33,28,38,.45)', fontWeight: 600 }}>
              {pickupNode?.name} → {dropNode?.name}
            </p>
            <p style={{ margin: '0 0 32px', fontSize: 14.5, color: 'rgba(33,28,38,.55)' }}>Hope you had a great trip.</p>

            <div style={{ background: '#FDFAF4', border: '1px solid rgba(33,28,38,.08)', borderRadius: 16, padding: 20, marginBottom: 24, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontWeight: 600, color: 'rgba(33,28,38,.6)' }}>Total Fare</span>
                <span style={{ fontWeight: 700 }}>₹90</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(33,28,38,.08)' }}>
                <span style={{ fontWeight: 600, color: 'rgba(33,28,38,.6)' }}>Pooled with 2 others</span>
                <span style={{ fontWeight: 700, color: '#0F8A5F' }}>-₹60</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
                <span style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700 }}>Your share</span>
                <span style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700 }}>₹30</span>
              </div>
            </div>

            <button className="btn-primary" onClick={() => setStage('pay')}>Pay via UPI</button>
          </div>
        )}

        {stage === 'pay' && (
          <div className="card loading-center animate-rise" style={{ padding: '80px 32px' }}>
            <span className="spinner-lg" style={{ marginBottom: 16 }} />
            <div style={{ font: '700 20px Familjen Grotesk,sans-serif', color: '#211C26' }}>Waiting for UPI payment...</div>
            <button className="btn-ghost" style={{ marginTop: 24 }} onClick={() => setStage('paid')}>Simulate Success</button>
          </div>
        )}

        {stage === 'paid' && (
          <div className="card animate-rise" style={{ textAlign: 'center', padding: '60px 32px' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#E4F2EC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#0F6B52', boxShadow: '0 12px 24px -12px rgba(15,107,82,.5)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M5 12.6l4.4 4.4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-.03em', margin: '0 0 12px' }}>Paid successfully</h2>
            <p style={{ margin: '0 0 32px', fontSize: 15, color: 'rgba(33,28,38,.55)' }}>₹30 sent to Ramesh (Auto driver).</p>
            <button className="btn-ghost" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
          </div>
        )}

      </main>
    </div>
  );
}
