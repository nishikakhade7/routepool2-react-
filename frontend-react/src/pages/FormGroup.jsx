import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import RouteVisual from '../components/RouteVisual';
import Spinner from '../components/Spinner';
import MatchCard from '../components/MatchCard';
import CustomTimePicker from '../components/CustomTimePicker';
import { getNodes, requestRide, getMatches, USE_MOCK_MATCHING } from '../api/client';

export default function FormGroup() {
  // 'form' | 'searching' | 'results'
  const [stage, setStage] = useState('form');
  
  // Form data
  const [nodes, setNodes] = useState([]);
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [pickupText, setPickupText] = useState('');
  const [dropText, setDropText] = useState('');
  const [pickupTime, setPickupTime] = useState(''); // HH:MM local time
  const [formError, setFormError] = useState(null);
  
  // Results
  const [myRequestId, setMyRequestId] = useState(null);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getNodes().then(data => {
      if (!cancelled) {
        setNodes(data);
        setLoadingNodes(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingNodes(false);
    });
    return () => { cancelled = true; };
  }, []);


  async function handleFindMatches() {
    setFormError(null);
    if (!pickupText || !dropText) { setFormError('Enter both pickup and drop'); return; }
    if (pickupText.toLowerCase() === dropText.toLowerCase()) { setFormError('Pickup and drop must be different'); return; }
    if (!pickupTime) { setFormError('Select a pickup time'); return; }

    setStage('searching');

    if (USE_MOCK_MATCHING) {
      // Simulate stages
      await new Promise(r => setTimeout(r, 1500));
      setStage('grouping');
      await new Promise(r => setTimeout(r, 1500));
      
      // TODO: Replace this simulated match with real matching/fare logic when USE_MOCK_MATCHING is false
      setMatches([{
        groupKey: 'mock1',
        isMock: true,
        score: 0.98,
        pickupNode: { name: pickupText, shortName: pickupText },
        distanceKm: 8.5,
        totalFare: 150,
        departureTime: new Date().toISOString(),
        members: [
          { isYou: true, name: 'You', initials: 'YOU', dropNode: { name: dropText, shortName: dropText }, fareShare: 85, soloFare: 150, dropDistanceKm: 5.2 },
          { name: 'Student 2', initials: 'S2', dropNode: { name: dropText, shortName: dropText }, fareShare: 65, dropDistanceKm: 3.1 }
        ]
      }]);
      setStage('results');
      return;
    }

    // Combine today's date with the HH:MM value from the time input to get an ISO string.
    const today = new Date();
    const [hours, minutes] = pickupTime.split(':').map(Number);
    const pickupDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, 0, 0);
    const pickupISO = pickupDate.toISOString();

    try {
      // (This would normally use pickupId and dropId, which we've removed, 
      // but keeping the block intact behind the flag as requested)
      const req = await requestRide({
        pickupNodeId: pickupText, // Mock mapping
        dropNodeId: dropText, // Mock mapping
        pickupTime: pickupISO,
      });
      setMyRequestId(req.id);

      await new Promise(r => setTimeout(r, 1500));
      setStage('grouping');
      await new Promise(r => setTimeout(r, 1500));

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
                  <div style={{ marginBottom: 16 }}>
                    <label className="input-label">Pickup</label>
                    <div className="input-row" style={{ padding: '0 16px' }}>
                      <input
                        type="text"
                        value={pickupText}
                        onChange={e => setPickupText(e.target.value)}
                        placeholder="Enter pickup..."
                        style={{ width: '100%', border: 0, outline: 0, background: 'transparent', font: '500 15px Karla,sans-serif', color: '#211C26', padding: '14px 0' }}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label className="input-label">Drop-off</label>
                    <div className="input-row" style={{ padding: '0 16px' }}>
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

                <div>
                  <label className="input-label" style={{ marginBottom: 12 }}>Pickup time</label>
                  <div className="input-row" style={{ padding: '0 16px' }}>
                    <CustomTimePicker
                      value={pickupTime}
                      onChange={setPickupTime}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(33,28,38,.45)', fontWeight: 600, marginTop: 8 }}>
                    Riders within 5 minutes of your time will be matched with you.
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
            <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#F2A230', boxShadow: '0 0 0 8px rgba(242,162,48,.2)' }} />
            </div>
          </div>
          <div style={{ font: '700 24px Familjen Grotesk,sans-serif', letterSpacing: '-.03em', color: '#211C26' }}>Finding students...</div>
          <div style={{ fontSize: 15, color: 'rgba(33,28,38,.55)', fontWeight: 500 }}>Scanning graph for overlapping routes</div>
        </main>
      )}

      {stage === 'grouping' && (
        <main className="screen-pad loading-center" style={{ minHeight: '80vh', position: 'relative' }}>
          <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(138,43,107,.3)', animation: 'radar 1.5s linear infinite' }} />
            <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#8A2B6B', boxShadow: '0 0 0 8px rgba(138,43,107,.2)' }} />
            </div>
          </div>
          <div style={{ font: '700 24px Familjen Grotesk,sans-serif', letterSpacing: '-.03em', color: '#211C26' }}>Grouping/matching...</div>
          <div style={{ fontSize: 15, color: 'rgba(33,28,38,.55)', fontWeight: 500 }}>Optimizing pool routes</div>
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
              <div>Try a different pickup time.</div>
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
