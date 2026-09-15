import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import VisionBadge from '../components/VisionBadge';
import Spinner from '../components/Spinner';
import GroupChat from '../components/GroupChat';
import { DEMO_GROUP_ID } from '../api/client';

const PRICE_RANGE_PLACEHOLDER = { min: 25, max: 90 };

export default function Book() {
  const navigate = useNavigate();

  // Stage: 'where' -> 'price' -> 'searching' -> 'grouping' -> 'driver' -> 'summary' -> 'pay' -> 'paid'
  const [stage, setStage] = useState('where');
  const [countdown, setCountdown] = useState(15);
  const [progress, setProgress] = useState(0);

  // Form data
  const [pickupText, setPickupText] = useState('');
  const [dropText, setDropText] = useState('');



  // Auto-progress some stages (Simulates backend matching)
  // TODO: Teammate to replace these timeouts with real requestRide/getMatches API calls
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              {/* Pickup */}
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Pickup</label>
                <div className="input-row">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#211C26', marginRight: 10, flexShrink: 0 }} />
                  <input
                    type="text"
                    value={pickupText}
                    onChange={e => setPickupText(e.target.value)}
                    placeholder="Enter pickup..."
                    style={{ width: '100%', border: 0, outline: 0, background: 'transparent', font: '500 15px Karla,sans-serif', color: '#211C26', padding: '14px 0' }}
                  />
                </div>
              </div>

              {/* Drop-off */}
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Drop-off</label>
                <div className="input-row">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #8A2B6B', marginRight: 10, flexShrink: 0 }} />
                  <input
                    type="text"
                    value={dropText}
                    onChange={e => setDropText(e.target.value)}
                    placeholder="Enter destination..."
                    style={{ width: '100%', border: 0, outline: 0, background: 'transparent', font: '500 15px Karla,sans-serif', color: '#211C26', padding: '14px 0' }}
                  />
                </div>
              </div>
            </div>

            <button
              className="btn-accent"
              disabled={!pickupText || !dropText}
              onClick={() => setStage('price')}
              style={{ opacity: (!pickupText || !dropText) ? 0.5 : 1 }}
            >
              Continue
            </button>
          </div>
        )}

        {stage === 'price' && (
          <div className="card animate-rise">
            <h2 style={{ font: '600 12px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 16px', color: 'rgba(33,28,38,.55)' }}>Estimated Fare</h2>
            <div style={{ textAlign: 'center', margin: '24px 0' }}>
              <div style={{ font: '700 36px Familjen Grotesk,sans-serif', letterSpacing: '-.03em', color: '#211C26' }}>
                ₹{PRICE_RANGE_PLACEHOLDER.min} – ₹{PRICE_RANGE_PLACEHOLDER.max}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(33,28,38,.55)' }}>
                Actual fare may vary based on distance and pool size
              </p>
            </div>
            
            <button
              className="btn-accent"
              onClick={() => setStage('searching')}
            >
              Search for a ride
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
              {pickupText} → {dropText}
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
            <div style={{ fontSize: 13, color: 'rgba(33,28,38,.5)' }}>Scanning for riders heading your way…</div>
          </div>
        )}

        {stage === 'driver' && (
          <div className="animate-rise" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card-dark" style={{ padding: '32px 36px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '700 10px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', background: '#FFF1DB', color: '#A96A0C', padding: '6px 11px', borderRadius: 999, marginBottom: 12 }}>
                    Arriving in {countdown}s
                  </div>
                  <div style={{ font: '700 24px Familjen Grotesk,sans-serif', letterSpacing: '-.03em', marginBottom: 4 }}>Auto · Driver en route</div>
                  <div style={{ fontSize: 13, color: 'rgba(253,250,244,.7)', fontWeight: 600 }}>
                    Driver: Assigned · {pickupText} → {dropText}
                  </div>
                </div>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F4EEE3', border: '2px solid #F2A230', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 18px Familjen Grotesk,sans-serif', color: '#211C26' }}>
                  D
                </div>
              </div>
              <div style={{ background: 'rgba(33,28,38,.4)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                <div style={{ background: '#F2A230', height: '100%', width: `${progress}%`, transition: 'width 1s linear' }} />
              </div>
            </div>

            {/* Inline Chat */}
            <div style={{ position: 'relative', height: 400, borderRadius: 26, overflow: 'hidden', border: '1px solid rgba(33,28,38,.06)', boxShadow: '0 1px 2px rgba(33,28,38,.04), 0 22px 44px -34px rgba(33,28,38,.7)' }}>
              <GroupChat 
                groupId={DEMO_GROUP_ID}
                groupName="Your Pool" 
                route={`${pickupText || 'Pickup'} → ${dropText || 'Drop'}`}
                onClose={() => {}} // No-op, it's inline not an overlay
                inline={true}
              />
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
              {pickupText} → {dropText}
            </p>
            <p style={{ margin: '0 0 32px', fontSize: 14.5, color: 'rgba(33,28,38,.55)' }}>Hope you had a great trip.</p>

            <div style={{ background: '#FDFAF4', border: '1px solid rgba(33,28,38,.08)', borderRadius: 16, padding: 20, marginBottom: 24, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(33,28,38,.08)' }}>
                <span style={{ fontWeight: 600, color: 'rgba(33,28,38,.6)' }}>Fare split</span>
                <span style={{ fontSize: 13, color: 'rgba(33,28,38,.45)', fontWeight: 600 }}>Calculated after matching</span>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(33,28,38,.5)', lineHeight: 1.6 }}>
                ⓘ Phase 2 vision: Once matched, RoutePool will calculate each rider's share based on their drop-off distance.
              </div>
            </div>

            <button className="btn-primary" onClick={() => setStage('pay')}>Pay via UPI</button>
          </div>
        )}

        {stage === 'pay' && (
          <div className="card loading-center animate-rise" style={{ padding: '48px 32px' }}>
            <span className="spinner-lg" style={{ marginBottom: 20 }} />
            <div style={{ font: '700 20px Familjen Grotesk,sans-serif', color: '#211C26', marginBottom: 8 }}>Waiting for UPI payment...</div>
            <div style={{ fontSize: 13, color: 'rgba(33,28,38,.5)', marginBottom: 32 }}>Please complete the payment on your phone.</div>
            <button className="btn-ghost" onClick={() => setStage('paid')}>Simulate Success</button>
          </div>
        )}

        {stage === 'paid' && (
          <div className="card animate-rise" style={{ textAlign: 'center', padding: '60px 32px' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#E4F2EC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#0F6B52', boxShadow: '0 12px 24px -12px rgba(15,107,82,.5)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M5 12.6l4.4 4.4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-.03em', margin: '0 0 12px' }}>Paid successfully</h2>
            <p style={{ margin: '0 0 32px', fontSize: 15, color: 'rgba(33,28,38,.55)' }}>Payment processed. Your fare has been sent to the auto driver.</p>
            <button className="btn-ghost" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
          </div>
        )}

      </main>
    </div>
  );
}
