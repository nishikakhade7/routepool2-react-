import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VisionBadge from './VisionBadge';
import GroupChat from './GroupChat';

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I

function generateReceiptRef() {
  let s = '';
  for (let i = 0; i < 6; i++) s += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)];
  return `RP-${s}`;
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Post-payment success screen: driver ETA countdown (Phase 2 vision, same as
 * the rest of this flow), a receipt built from the real matched group's
 * numbers, and navigation to the rest of the app.
 *
 * @param {object} props
 * @param {object} props.driver          Picked driver (vision only).
 * @param {number} props.amount          Real fare share, already agreed.
 * @param {number} props.tripTotal       Real group total fare.
 * @param {string} props.paymentMethodLabel
 * @param {string} [props.pickupText]
 * @param {string|null} [props.groupId]  Chat group id (null disables chat).
 */
export default function PaymentSuccess({ driver, amount, tripTotal, paymentMethodLabel, pickupText, groupId }) {
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [receiptRef] = useState(generateReceiptRef); // fresh every mount, stable across re-renders

  const [totalSeconds] = useState(() => Math.max(1, Math.round((driver?.etaMinutes ?? 4) * 60)));
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const arrived = secondsLeft <= 0;

  useEffect(() => {
    if (arrived) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [arrived]);

  const fraction = secondsLeft / totalSeconds;
  const timerColor = fraction <= 1 / 6 ? '#FF9A8B' : fraction <= 0.5 ? '#F7C15B' : '#8FE3C4';
  const progressPct = Math.min(100, ((totalSeconds - secondsLeft) / totalSeconds) * 100);

  return (
    <div className="animate-rise" style={{ textAlign: 'center' }}>
      <span style={{
        width: 82, height: 82, borderRadius: '50%', background: '#E4F2EC',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, color: '#0F6B52',
        animation: 'popIn .55s cubic-bezier(.2,1.3,.4,1) both',
      }}>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
          <path d="M5 12.6l4.4 4.4L19 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <VisionBadge />
      </div>

      <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 42, letterSpacing: '-.04em', margin: '0 0 10px' }}>
        Paid ₹{amount.toFixed(0)}
      </h1>
      <p style={{ margin: '0 auto 28px', fontSize: 15.5, color: 'rgba(33,28,38,.58)', maxWidth: 420 }}>
        {driver?.vehicle} booked with {driver?.name} · {driver?.plate}. Meet your group at {pickupText || 'the pickup point'}.
      </p>

      <div className="card-dark" style={{ textAlign: 'left', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 60, letterSpacing: '-.05em', lineHeight: 1, color: timerColor, fontVariantNumeric: 'tabular-nums' }}>
            {formatClock(secondsLeft)}
          </span>
          <span style={{ font: '600 13px Karla,sans-serif', color: arrived ? '#8FE3C4' : 'rgba(253,250,244,.72)', maxWidth: 200, lineHeight: 1.35 }}>
            {arrived ? `${driver?.name} has arrived — find your group` : `until ${driver?.name} reaches pickup`}
          </span>
        </div>
        <div className="progress-track" style={{ background: 'rgba(253,250,244,.2)' }}>
          <div className="progress-fill" style={{ width: `${progressPct}%`, background: timerColor }} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, textAlign: 'left' }}>
        <div className="input-label" style={{ marginBottom: 14 }}>Receipt</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 600 }}>
            <span style={{ color: 'rgba(33,28,38,.6)' }}>Reference</span>
            <span style={{ fontWeight: 700 }}>{receiptRef}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 600 }}>
            <span style={{ color: 'rgba(33,28,38,.6)' }}>Method</span>
            <span style={{ fontWeight: 700 }}>{paymentMethodLabel}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 600 }}>
            <span style={{ color: 'rgba(33,28,38,.6)' }}>Trip total</span>
            <span style={{ fontWeight: 700 }}>₹{tripTotal.toFixed(0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(33,28,38,.08)', font: '700 15px Familjen Grotesk,sans-serif' }}>
            <span>Your share</span>
            <span>₹{amount.toFixed(0)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => setChatOpen(true)}
          disabled={!groupId}
          title={groupId ? 'Open group chat' : 'Join the group first to chat'}
          style={{
            flex: 1, minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            border: 0, borderRadius: 14, padding: 15,
            background: '#F2A230', color: '#211C26', font: '700 13.5px Karla,sans-serif',
            cursor: groupId ? 'pointer' : 'not-allowed', opacity: groupId ? 1 : 0.4,
            transition: 'transform .16s',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H10l-5 4v-4H6.5A2.5 2.5 0 014 13.5v-7z" stroke="#211C26" strokeWidth="1.9" strokeLinejoin="round" />
          </svg>
          Group chat
        </button>
        <button
          onClick={() => navigate('/history')}
          style={{ flex: 1, minWidth: 140, border: 0, borderRadius: 14, padding: 15, background: '#211C26', color: '#FDFAF4', font: '700 13.5px Karla,sans-serif', cursor: 'pointer', transition: 'transform .16s' }}
        >
          View in history
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-ghost"
          style={{ flex: 1, minWidth: 140 }}
        >
          Back to dashboard
        </button>
      </div>

      {chatOpen && groupId && (
        <GroupChat
          groupId={groupId}
          groupName="Your Pool"
          route={pickupText}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
