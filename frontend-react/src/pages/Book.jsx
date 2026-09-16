import { useState, useEffect, useRef } from 'react';
import NavBar from '../components/NavBar';
import VisionBadge from '../components/VisionBadge';
import RouteVisual from '../components/RouteVisual';
import BookingConfirmation from '../components/BookingConfirmation';
import PaymentMethodSelect from '../components/PaymentMethodSelect';
import PaymentSuccess from '../components/PaymentSuccess';
import { DEMO_GROUP_ID, joinGroup } from '../api/client';
import { runMatchingFlow } from '../api/matching';
import { pickRandomDriver } from '../data/drivers';

// Reference-design widths per stage (design/RoutePool.dc.html screens 10-15):
// the location form and the full booking summary use the page's full grid
// width; the searching/driver/payment/success moments are single-focus and
// sit narrower and centered.
const STAGE_WIDTH = {
  where: 1180,
  searching: 760,
  grouping: 760,
  driverAssigned: 820,
  confirm: 1180,
  payment: 820,
  success: 820,
};

/**
 * Decorative "scanning the graph" motif for the searching/grouping stages —
 * a bigger version of RouteVisual's route line plus radar rings and
 * blinking mid-route nodes. Purely animation, no data.
 */
function ScanningVisual({ color }) {
  return (
    <svg viewBox="0 0 520 220" style={{ width: '100%', maxWidth: 480, height: 200, margin: '0 auto 8px', display: 'block' }} fill="none" aria-hidden="true">
      <circle cx="260" cy="110" r="28" fill="none" stroke={color} strokeOpacity=".5" strokeWidth="2" style={{ transformOrigin: '260px 110px', animation: 'radar 2.4s ease-out infinite' }} />
      <circle cx="260" cy="110" r="28" fill="none" stroke={color} strokeOpacity=".3" strokeWidth="2" style={{ transformOrigin: '260px 110px', animation: 'radar 2.4s ease-out .8s infinite' }} />
      <path d="M40 172 C170 172 160 66 280 66 C390 66 390 118 490 110" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray="18 14" style={{ animation: 'dashRun 1.5s linear infinite' }} />
      <path d="M40 196 C190 196 220 96 330 96 C430 96 450 138 490 132" stroke="#8A2B6B" strokeOpacity=".35" strokeWidth="1.7" strokeDasharray="10 12" style={{ animation: 'dashRun 2.2s linear infinite' }} />
      <circle cx="260" cy="110" r="9" fill={color} />
      <circle cx="140" cy="150" r="5.5" fill="#8A2B6B" style={{ animation: 'nodeBlink 1.3s infinite' }} />
      <circle cx="368" cy="82" r="5.5" fill="#8A2B6B" style={{ animation: 'nodeBlink 1.3s .6s infinite' }} />
      <circle cx="40" cy="172" r="7" fill="#211C26" />
      <circle cx="490" cy="110" r="6" fill="#211C26" />
    </svg>
  );
}

export default function Book() {
  // Stage: 'where' -> 'searching' -> 'grouping' -> 'driverAssigned' -> 'confirm' -> 'payment' -> 'success'
  const [stage, setStage] = useState('where');

  // Form data
  const [pickupText, setPickupText] = useState('');
  const [dropText, setDropText] = useState('');

  // Matching results (real data/shape from runMatchingFlow, same as FormGroup)
  const [myRequestId, setMyRequestId] = useState(null);
  const [group, setGroup] = useState(null);
  const [driver, setDriver] = useState(null);
  const [bookError, setBookError] = useState(null);

  // Set once handleConfirmBooking's real (non-mock) joinGroup() call succeeds —
  // group chat isn't reachable before then, same restriction MatchCard applies.
  const [joinedGroupId, setJoinedGroupId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);

  // True cancellation only ever means "this component unmounted" — NOT
  // "stage changed", since the matching flow itself changes `stage` via
  // onStageChange as it progresses. Tying cancellation to the effect's own
  // `[stage]` dependency previously caused the effect's cleanup to fire
  // (and silently discard the in-flight result) the moment onStageChange
  // moved stage from 'searching' to 'grouping' — see bug writeup.
  const isMountedRef = useRef(true);
  useEffect(() => {
    // Explicitly (re-)arm on setup, not just cleanup — StrictMode's dev-only
    // mount->cleanup->mount double-invoke would otherwise flip this false
    // on the first simulated cleanup and never flip it back, permanently
    // breaking every isMountedRef.current check for the component's life.
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Kick off the real matching flow once the user reaches 'searching'; it
  // drives 'searching' -> 'grouping' itself via onStageChange, then this
  // resolves the best match and moves on to 'driverAssigned'. Guarded by a
  // ref (not the effect's cleanup) so the flow it starts isn't torn down by
  // its own onStageChange calls re-running this effect.
  const matchingStartedRef = useRef(false);
  useEffect(() => {
    if (stage !== 'searching') {
      matchingStartedRef.current = false; // allow a future retry to start again
      return;
    }
    if (matchingStartedRef.current) return; // already in flight, don't double-start
    matchingStartedRef.current = true;

    runMatchingFlow({ pickupText, dropText, onStageChange: setStage })
      .then(({ requestId, matches }) => {
        if (!isMountedRef.current) return;
        const best = [...matches].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;
        if (!best) {
          setBookError('No students heading your way right now — try a different time.');
          setStage('where');
          return;
        }
        setMyRequestId(requestId);
        setGroup(best);
        setDriver(pickRandomDriver());
        setStage('driverAssigned');
      })
      .catch((e) => {
        console.error('[Book] runMatchingFlow failed:', e);
        if (!isMountedRef.current) return;
        setBookError(e.message || 'Something went wrong while finding a match. Please try again.');
        setStage('where');
      });
  }, [stage, pickupText, dropText]);

  // Locks in the auto-picked match for real (non-mock) groups, the same way
  // MatchCard.handleJoin does — mock groups skip the real API, also matching
  // MatchCard's existing pattern. Captures the real group id so group chat
  // (which requires real membership) becomes reachable afterward.
  async function handleConfirmBooking() {
    if (group?.isMock) {
      setStage('payment');
      return;
    }
    try {
      const result = await joinGroup(myRequestId, group.memberRideRequestIds);
      setJoinedGroupId(result.id);
      setStage('payment');
    } catch (e) {
      setBookError(e.message);
    }
  }

  const youMember = group?.members?.find(m => m.isYou);
  const youShare = youMember?.fareShare ?? group?.totalFare ?? 0;
  const youSave = Math.max(0, (youMember?.soloFare ?? 0) - youShare);
  const chatGroupId = group?.isMock ? DEMO_GROUP_ID : joinedGroupId;

  return (
    <div className="animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar />

      <main className="screen-pad" style={{ maxWidth: STAGE_WIDTH[stage] }}>

        {stage === 'where' && (
          <div className="animate-rise">
            <VisionBadge />
            <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 40, letterSpacing: '-.035em', margin: '0 0 8px' }}>
              Where are you going?
            </h1>
            <p style={{ margin: '0 0 28px', fontSize: 15.5, color: 'rgba(33,28,38,.58)' }}>
              Enter your pickup and drop-off — RoutePool matches you with students already heading your way and pools an auto automatically.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 22, alignItems: 'start' }}>
              {/* Left: real, free-text pickup/drop-off form */}
              <div className="card">
                <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                  {/* Purely decorative pickup/drop timeline connector */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 42, paddingBottom: 18, flexShrink: 0 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', border: '3px solid #8A2B6B', flexShrink: 0 }} />
                    <span style={{ width: 2, flex: 1, minHeight: 46, background: 'repeating-linear-gradient(to bottom, rgba(33,28,38,.25) 0 4px, transparent 4px 9px)' }} />
                    <span style={{ width: 12, height: 12, background: '#211C26', borderRadius: 3, flexShrink: 0 }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label className="input-label">Pickup node</label>
                      <div className="input-row">
                        <input
                          type="text"
                          value={pickupText}
                          onChange={e => setPickupText(e.target.value)}
                          placeholder="Enter pickup..."
                          style={{ width: '100%', border: 0, outline: 0, background: 'transparent', font: '600 15px Karla,sans-serif', color: '#211C26', padding: '14px 0' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="input-label">Drop node</label>
                      <div className="input-row">
                        <input
                          type="text"
                          value={dropText}
                          onChange={e => setDropText(e.target.value)}
                          placeholder="Enter destination..."
                          style={{ width: '100%', border: 0, outline: 0, background: 'transparent', font: '600 15px Karla,sans-serif', color: '#211C26', padding: '14px 0' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {bookError && <div className="error-msg-red">{bookError}</div>}

                <button
                  className="btn-primary"
                  disabled={!pickupText || !dropText}
                  onClick={() => { setBookError(null); setStage('searching'); }}
                  style={{ opacity: (!pickupText || !dropText) ? 0.5 : 1 }}
                >
                  Find a ride
                </button>
              </div>

              {/* Right: real route line for what's typed so far — no distance/
                  fare numbers here. Those require a resolved match (a node
                  graph lookup would normally supply them instantly, but this
                  app now takes free-text pickup/drop, so there's no route
                  distance until the backend actually matches a group), same
                  limitation FormGroup.jsx already carries for its identical
                  preview panel. */}
              <div className="card-dark" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ font: '600 10.5px Karla,sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(253,250,244,.55)', marginBottom: 20 }}>
                  Route preview
                </div>
                <RouteVisual height={180} variant="dark" animated />
                <div style={{ textAlign: 'center', marginTop: 24, font: '600 14px Karla,sans-serif', color: 'rgba(253,250,244,.6)' }}>
                  {pickupText && dropText
                    ? `${pickupText} → ${dropText} — distance and fare split appear once you're matched`
                    : "Enter both pickup and drop-off to preview your route"}
                </div>
              </div>
            </div>
          </div>
        )}

        {stage === 'searching' && (
          <div className="loading-center animate-rise" style={{ minHeight: '60vh' }}>
            <ScanningVisual color="#F2A230" />
            <VisionBadge />
            <div style={{ font: '700 34px Familjen Grotesk,sans-serif', letterSpacing: '-.035em', color: '#211C26' }}>
              Looking for students heading your way
            </div>
            <div style={{ fontSize: 15, color: 'rgba(33,28,38,.55)', fontWeight: 500 }}>
              {pickupText} → {dropText}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span className="spinner spinner-sm" />
              Scanning open requests
            </div>
          </div>
        )}

        {stage === 'grouping' && (
          <div className="loading-center animate-rise" style={{ minHeight: '60vh' }}>
            <ScanningVisual color="#8A2B6B" />
            <VisionBadge />
            <div style={{ font: '700 34px Familjen Grotesk,sans-serif', letterSpacing: '-.035em', color: '#211C26' }}>
              Grouping you with matched students
            </div>
            <div style={{ fontSize: 15, color: 'rgba(33,28,38,.55)', fontWeight: 500 }}>Building your pool…</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span className="spinner spinner-sm" />
              Optimizing the shared route
            </div>
          </div>
        )}

        {stage === 'driverAssigned' && group && driver && (
          <div className="animate-rise" style={{ textAlign: 'center' }}>
            <VisionBadge />
            <span style={{
              width: 74, height: 74, borderRadius: '50%', background: '#8FE3C4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', animation: 'popIn .55s cubic-bezier(.2,1.3,.4,1) both',
            }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.6l4.4 4.4L19 7" stroke="#20402F" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 40, letterSpacing: '-.04em', margin: '0 0 8px' }}>
              Driver assigned
            </h1>
            <p style={{ margin: '0 0 28px', fontSize: 15.5, color: 'rgba(33,28,38,.58)' }}>
              Your pool of {group.members.length} is full. {driver.name} is on the way to {pickupText || 'your pickup point'}.
            </p>

            <div className="card animate-rise" style={{ textAlign: 'left', padding: 30 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                <div style={{ width: 68, height: 68, borderRadius: 20, background: '#F4EEE3', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 22px Familjen Grotesk,sans-serif', flexShrink: 0 }}>
                  {driver.name.split(' ').map(p => p[0]).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ font: '700 22px Familjen Grotesk,sans-serif', letterSpacing: '-.03em' }}>{driver.name}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F4EEE3', font: '700 12px Karla,sans-serif', padding: '5px 9px', borderRadius: 8 }}>★ {driver.rating.toFixed(1)}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: 'rgba(33,28,38,.55)', fontWeight: 600, marginTop: 4 }}>{driver.vehicle}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="input-label" style={{ marginBottom: 3 }}>ETA</div>
                  <div style={{ font: '700 28px Familjen Grotesk,sans-serif', letterSpacing: '-.04em' }}>{driver.etaMinutes} min</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, paddingTop: 22, borderTop: '1px solid rgba(33,28,38,.08)' }}>
                <div>
                  <div className="input-label" style={{ marginBottom: 5 }}>Vehicle no.</div>
                  <div style={{ font: '700 16px Familjen Grotesk,sans-serif', letterSpacing: '-.02em' }}>{driver.plate}</div>
                </div>
                <div>
                  <div className="input-label" style={{ marginBottom: 5 }}>Model</div>
                  <div style={{ font: '700 16px Familjen Grotesk,sans-serif', letterSpacing: '-.02em' }}>{driver.vehicle}</div>
                </div>
                <div>
                  <div className="input-label" style={{ marginBottom: 5 }}>Pickup</div>
                  <div style={{ font: '700 16px Familjen Grotesk,sans-serif', letterSpacing: '-.02em' }}>{pickupText || '—'}</div>
                </div>
              </div>
            </div>

            <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => setStage('confirm')}>
              Review and pay
            </button>
          </div>
        )}

        {stage === 'confirm' && group && driver && (
          <BookingConfirmation group={group} driver={driver} groupId={chatGroupId} onContinue={handleConfirmBooking} />
        )}

        {stage === 'payment' && (
          <PaymentMethodSelect
            amount={youShare}
            savings={youSave}
            vehicleName={driver?.vehicle}
            pickupText={pickupText}
            dropText={dropText}
            onConfirm={(method) => { setPaymentMethod(method); setStage('success'); }}
          />
        )}

        {stage === 'success' && group && driver && (
          <PaymentSuccess
            driver={driver}
            amount={youShare}
            tripTotal={group.totalFare ?? 0}
            paymentMethodLabel={paymentMethod?.label ?? 'UPI'}
            pickupText={pickupText}
            groupId={chatGroupId}
          />
        )}

      </main>
    </div>
  );
}
