import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import VisionBadge from '../components/VisionBadge';
import RouteVisual from '../components/RouteVisual';
import BookingConfirmation from '../components/BookingConfirmation';
import CustomTimePicker from '../components/CustomTimePicker';
import PaymentMethodSelect from '../components/PaymentMethodSelect';
import PaymentSuccess from '../components/PaymentSuccess';
import { bookSoloRide, getGroup, leaveGroup, getAssignedDriver } from '../api/client';
import { formatRating, formatEta } from '../utils/formatDriver';

// Reference-design widths per stage (design/RoutePool.dc.html screens 10-15):
// the location form and the full booking summary use the page's full grid
// width; the searching/driver/payment/success moments are single-focus and
// sit narrower and centered.
const STAGE_WIDTH = {
  where: 1180,
  searching: 760,
  grouping: 760,
  results: 1180,
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
  // Solo booking. Stage: 'where' -> 'searching' (booking) -> 'confirm'
  //   -> 'driverAssigned' -> 'payment' -> 'success'.
  // Pooling with other students lives on "Form a group", not here.
  const [searchParams, setSearchParams] = useSearchParams();
  const [stage, setStage] = useState('where');

  // Form data
  const [pickupText, setPickupText] = useState(() => searchParams.get('pickup') || '');
  const [dropText, setDropText] = useState(() => searchParams.get('drop') || '');
  const [pickupTime, setPickupTime] = useState(() => searchParams.get('time') || ''); // HH:MM today; empty = now

  // The group the user picked (and has joined) — refreshed from the backend.
  const [groupId, setGroupId] = useState(null);
  const [group, setGroup] = useState(null);
  const [driver, setDriver] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);

  const [bookError, setBookError] = useState(null);
  const [notice, setNotice] = useState(null);

  // True cancellation only ever means "this component unmounted" — NOT
  // "stage changed", since the matching flow itself changes `stage` via
  // onStageChange as it progresses.
  // Dashboard "Join" lands here as /book?group=: the prefilled search runs
  // straight away; drop the params so a reload doesn't repeat it.
  useEffect(() => {
    if (searchParams.get('group')) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    // Re-arm on setup too: StrictMode's dev-only mount->cleanup->mount would
    // otherwise leave this false for the component's life.
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);



  // While the user is looking at their group, keep it in sync with the backend
  // so riders joining/leaving from other browsers show up here too.
  useEffect(() => {
    if (!groupId || !['confirm', 'driverAssigned'].includes(stage)) return;
    const t = setInterval(() => {
      getGroup(groupId).then((g) => { if (isMountedRef.current) setGroup(g); }).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [groupId, stage]);

  async function openGroup(id) {
    const g = await getGroup(id);
    if (!isMountedRef.current) return;
    setGroupId(id);
    setGroup(g);
    setDriver(null);
    setBookError(null);
    setStage('confirm');
  }

  // Book a ride is a SOLO ride: no matching, no pooling. It books the rider
  // their own auto straight away (a one-person group the backend closes, so
  // nobody can join it) and goes to the confirm screen. Pooling lives on
  // "Form a group". Guarded by a ref so its own stage change doesn't restart it.
  const bookingStartedRef = useRef(false);
  useEffect(() => {
    if (stage !== 'searching') {
      bookingStartedRef.current = false;
      return;
    }
    if (bookingStartedRef.current) return;
    bookingStartedRef.current = true;

    (async () => {
      try {
        let pickupISO;
        if (pickupTime) {
          const [hh, mm] = pickupTime.split(':').map(Number);
          const d = new Date();
          d.setHours(hh, mm, 0, 0);
          pickupISO = d.toISOString();
        }
        const booked = await bookSoloRide({ pickupText, dropText, pickupTime: pickupISO || new Date().toISOString() });
        if (!isMountedRef.current) return;
        await openGroup(booked.id);
      } catch (e) {
        console.error('[Book] solo booking failed:', e);
        if (!isMountedRef.current) return;
        setBookError(e.message || 'Something went wrong while booking. Please try again.');
        setStage('where');
      }
    })();
  }, [stage, pickupText, dropText, pickupTime]);


  // e. "Can't make it? Leave group" -> removed from the group, back to search.
  async function handleLeaveGroup() {
    try {
      await leaveGroup(groupId);
    } catch (e) {
      setBookError(e.message);
      return;
    }
    setGroupId(null);
    setGroup(null);
    setDriver(null);
    setMyRequest(null);
    setMatches([]);
    setBookError(null);
    setNotice('You left the group. Search again whenever you are ready.');
    setStage('where');
  }

  // f. Confirm -> driver for this group (decided once by the backend, same for every member).
  async function handleConfirmBooking() {
    try {
      const d = await getAssignedDriver(groupId);
      if (!isMountedRef.current) return;
      setDriver(d);
      setStage('driverAssigned');
    } catch (e) {
      setBookError(e.message);
    }
  }

  const youMember = group?.members?.find(m => m.isYou);
  const youShare = youMember?.fareShare ?? group?.totalFare ?? 0;
  const hasRealSavings = typeof youShare === 'number' && typeof youMember?.soloFare === 'number';
  const youSave = hasRealSavings ? Math.max(0, youMember.soloFare - youShare) : 0;
  const pickupName = group?.pickupNode?.name || pickupText;
  const dropName = youMember?.dropNode?.name || dropText;

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
              Book your own auto — you ride alone and pay the full fare. To share the ride and split the fare, use Form a group.
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

                <div style={{ marginBottom: 24 }}>
                  <label className="input-label">Pickup time (leave empty for now)</label>
                  <div className="input-row">
                    <CustomTimePicker value={pickupTime} onChange={setPickupTime} />
                  </div>
                </div>

                {bookError && <div className="error-msg-red">{bookError}</div>}

                {notice && <div style={{ marginBottom: 12, fontWeight: 600, color: 'rgba(33,28,38,.7)' }}>{notice}</div>}

                <button
                  className="btn-primary"
                  disabled={!pickupText || !dropText}
                  onClick={() => { setBookError(null); setNotice(null); setStage('searching'); }}
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
                    ? `${pickupText} → ${dropText} — your own auto, full fare, no sharing`
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
              Your own auto. {driver.name} is on the way to {pickupName || 'your pickup point'}.
            </p>

            <div className="card animate-rise" style={{ textAlign: 'left', padding: 30 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                <div style={{ width: 68, height: 68, borderRadius: 20, background: '#F4EEE3', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 22px Familjen Grotesk,sans-serif', flexShrink: 0 }}>
                  {driver.name.split(' ').map(p => p[0]).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ font: '700 22px Familjen Grotesk,sans-serif', letterSpacing: '-.03em' }}>{driver.name}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F4EEE3', font: '700 12px Karla,sans-serif', padding: '5px 9px', borderRadius: 8 }}>★ {formatRating(driver.rating)}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: 'rgba(33,28,38,.55)', fontWeight: 600, marginTop: 4 }}>{driver.vehicle}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="input-label" style={{ marginBottom: 3 }}>ETA</div>
                  <div style={{ font: '700 28px Familjen Grotesk,sans-serif', letterSpacing: '-.04em' }}>{formatEta(driver.etaMinutes)}</div>
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
                  <div style={{ font: '700 16px Familjen Grotesk,sans-serif', letterSpacing: '-.02em' }}>{pickupName || '—'}</div>
                </div>
              </div>
            </div>

            <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => setStage('payment')}>
              Continue to payment
            </button>
          </div>
        )}

        {stage === 'confirm' && group && (
          <>
            {bookError && <div className="error-msg-red" style={{ marginBottom: 16 }}>{bookError}</div>}
            <BookingConfirmation
              solo
              group={group}
              groupId={groupId}
              continueLabel="Confirm booking"
              onContinue={handleConfirmBooking}
              onLeave={handleLeaveGroup}
            />
          </>
        )}

        {stage === 'payment' && (
          <PaymentMethodSelect
            amount={youShare}
            savings={youSave}
            vehicleName={driver?.vehicle}
            pickupText={pickupName}
            dropText={dropName}
            onConfirm={(method) => { setPaymentMethod(method); setStage('success'); }}
          />
        )}

        {stage === 'success' && group && driver && (
          <PaymentSuccess
            driver={driver}
            amount={youShare}
            tripTotal={group.totalFare ?? 0}
            paymentMethodLabel={paymentMethod?.label ?? 'UPI'}
            pickupText={pickupName}
            groupId={groupId}
          />
        )}

      </main>
    </div>
  );
}
