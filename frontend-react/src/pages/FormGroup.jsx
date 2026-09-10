import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import RouteVisual from '../components/RouteVisual';
import Spinner from '../components/Spinner';
import MatchCard from '../components/MatchCard';
import { getNodes, requestRide, getMatches } from '../api/client';

export default function FormGroup() {
  const navigate = useNavigate();
  // 'form' | 'searching' | 'results'
  const [stage, setStage] = useState('form');
  
  // Form data
  const [nodes, setNodes] = useState([]);
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [pickupId, setPickupId] = useState('');
  const [dropId, setDropId] = useState('');
  const [windowStart, setWindowStart] = useState('');
  const [flexMinutes, setFlexMinutes] = useState(10);
  const [formError, setFormError] = useState(null);
  
  // Results
  const [myRequestId, setMyRequestId] = useState(null);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getNodes().then(data => {
      if (!cancelled) {
        setNodes(data);
        const campus = data.find(n => n.shortName === 'GATE 2');
        if (campus) setPickupId(campus.id);
        setLoadingNodes(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingNodes(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Time slot helper: generates 3 slots from now
  const timeSlots = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getTime() + i * 30 * 60000);
    const end = new Date(d.getTime() + 30 * 60000);
    const label = `${d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})} – ${end.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})}`;
    timeSlots.push({ start: d.toISOString(), end: end.toISOString(), label });
  }

  async function handleFindMatches() {
    setFormError(null);
    if (!pickupId || !dropId) { setFormError('Select both pickup and drop'); return; }
    if (pickupId === dropId) { setFormError('Pickup and drop must be different'); return; }
    if (!windowStart) { setFormError('Select a time slot'); return; }

    const slot = timeSlots.find(s => s.start === windowStart);
    setStage('searching');
    
    try {
      const req = await requestRide({
        pickupNodeId: pickupId,
        dropNodeId: dropId,
        windowStart: slot.start,
        windowEnd: slot.end,
        flexMinutes,
      });
      setMyRequestId(req.id);
      
      // Artificial delay for the cool radar animation
      await new Promise(r => setTimeout(r, 1800));
      
      const m = await getMatches(req.id);
      setMatches(m);
      setStage('results');
    } catch (e) {
      setFormError(e.message);
      setStage('form');
    }
  }

  return (
    <div className="animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar />
      
      {stage === 'form' && (
        <main className="screen-pad" style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 46 }}>
          {/* Left: Form */}
          <div className="card">
            <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-.03em', margin: '0 0 8px' }}>
              Form a group
            </h1>
            <p style={{ margin: '0 0 32px', fontSize: 14.5, color: 'rgba(33,28,38,.55)' }}>
              Enter your route and time to find students heading your way.
            </p>

            {loadingNodes ? (
              <div className="loading-center"><Spinner /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="input-label">Pickup</label>
                    <div className="input-row" style={{ padding: '0 16px' }}>
                      <select
                        value={pickupId}
                        onChange={e => setPickupId(e.target.value)}
                        style={{ flex: 1, border: 0, outline: 0, background: 'transparent', font: '500 15px Karla,sans-serif', color: '#211C26', padding: '14px 0', cursor: 'pointer' }}
                      >
                        <option value="" disabled>Select pickup...</option>
                        {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="input-label">Drop-off</label>
                    <div className="input-row" style={{ padding: '0 16px' }}>
                      <select
                        value={dropId}
                        onChange={e => setDropId(e.target.value)}
                        style={{ flex: 1, border: 0, outline: 0, background: 'transparent', font: '500 15px Karla,sans-serif', color: '#211C26', padding: '14px 0', cursor: 'pointer' }}
                      >
                        <option value="" disabled>Select destination...</option>
                        {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="input-label" style={{ marginBottom: 12 }}>Time window</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {timeSlots.map(s => (
                      <button
                        key={s.start}
                        className={`chip-btn ${windowStart === s.start ? 'selected' : ''}`}
                        onClick={() => setWindowStart(s.start)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <label className="input-label" style={{ margin: 0 }}>Flexibility</label>
                    <span style={{ font: '600 13px Karla,sans-serif', color: 'rgba(33,28,38,.5)' }}>±{flexMinutes} mins</span>
                  </div>
                  <input
                    type="range"
                    min="0" max="30" step="5"
                    value={flexMinutes}
                    onChange={e => setFlexMinutes(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#211C26', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(33,28,38,.4)', marginTop: 8, fontWeight: 600 }}>
                    <span>Strict</span>
                    <span>Flexible</span>
                  </div>
                </div>

                {formError && <div className="error-msg-red">{formError}</div>}

                <div style={{ marginTop: 12 }}>
                  <button className="btn-accent" onClick={handleFindMatches}>
                    Find matches
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Preview visual */}
          <div className="card-dark" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <RouteVisual height={180} variant="dark" animated={false} />
            <div style={{ textAlign: 'center', marginTop: 24, font: '600 14px Karla,sans-serif', color: 'rgba(253,250,244,.6)' }}>
              Select a drop-off point to see estimate
            </div>
          </div>
        </main>
      )}

      {stage === 'searching' && (
        <main className="screen-pad loading-center" style={{ minHeight: '80vh', position: 'relative' }}>
          <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(242,162,48,.3)', animation: 'radar 2s linear infinite' }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(242,162,48,.3)', animation: 'radar 2s 1s linear infinite' }} />
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F2A230', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 8px rgba(242,162,48,.2)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 4a5.5 5.5 0 015.5 5.5c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5A5.5 5.5 0 0112 4z" stroke="#211C26" strokeWidth="2.4" strokeLinejoin="round"/></svg>
            </div>
          </div>
          <div style={{ font: '700 24px Familjen Grotesk,sans-serif', letterSpacing: '-.03em', color: '#211C26' }}>Finding students...</div>
          <div style={{ fontSize: 15, color: 'rgba(33,28,38,.55)', fontWeight: 500 }}>Scanning graph for overlapping routes</div>
        </main>
      )}

      {stage === 'results' && (
        <main className="screen-pad animate-rise">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <div>
              <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-.03em', margin: '0 0 6px' }}>
                Found {matches.length} matches
              </h1>
              <p style={{ margin: 0, fontSize: 14.5, color: 'rgba(33,28,38,.55)' }}>
                Groups with shared routes, ready to depart.
              </p>
            </div>
            <button className="btn-ghost" onClick={() => setStage('form')}>
              Edit request
            </button>
          </div>

          {matches.length === 0 ? (
            <div className="card loading-center" style={{ padding: 80 }}>
              <div style={{ font: '700 18px Familjen Grotesk,sans-serif', marginBottom: 8, color: '#211C26' }}>No exact matches right now</div>
              <div>Try widening your time window or flexibility.</div>
              <button className="btn-ghost" style={{ marginTop: 24 }} onClick={() => setStage('form')}>Back to form</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 32 }}>
              {matches.map((m, i) => (
                <MatchCard key={m.groupKey} group={m} index={i} myRideRequestId={myRequestId} />
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
