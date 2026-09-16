import { useState } from 'react';
import Spinner from './Spinner';
import GroupChat from './GroupChat';
import { joinGroup, DEMO_GROUP_ID } from '../api/client';
import { formatFare } from '../utils/formatFare';

// Deterministic avatar colors based on name hash
const AVATAR_PALETTE = [
  { bg: '#F7E3F0', fg: '#8A4A72' },
  { bg: '#DCEDE6', fg: '#1F5A4A' },
  { bg: '#E7E3F7', fg: '#3E3470' },
  { bg: '#FFF1DB', fg: '#A96A0C' },
  { bg: 'linear-gradient(150deg,#F7D9A8,#E8C9DE)', fg: '#5C3350' },
];
function avatarColor(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function fmt(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const LINE_COLORS = ['#F2A230', '#8A2B6B', '#157F63', '#5B57E0'];

export default function MatchCard({ group, index, myRideRequestId }) {
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [joinedGroup, setJoinedGroup] = useState(null); // backend group after join
  const [chatOpen, setChatOpen] = useState(false);

  const lineColor = LINE_COLORS[index % LINE_COLORS.length];
  const isBest = index === 0;

  const youMember = group.members?.find(m => m.isYou);

  async function handleJoin() {
    if (joining || joinedGroup) return;
    setJoining(true);
    setJoinError(null);

    if (group.isMock) {
      setTimeout(() => {
        setJoinedGroup({ id: DEMO_GROUP_ID });
        setJoining(false);
      }, 800);
      return;
    }

    try {
      const result = await joinGroup(myRideRequestId, group.memberRideRequestIds);
      setJoinedGroup(result);
    } catch (e) {
      setJoinError(e.message);
    } finally {
      setJoining(false);
    }
  }

  const departureFmt = fmt(group.departureTime);
  const totalFare = group.totalFare ?? 0;
  const youPay = youMember?.fareShare ?? 0;
  const youSolo = youMember?.soloFare;
  // See BookingConfirmation.jsx's hasRealSavings — youPay/youSolo may be
  // mock placeholder strings, which can't be subtracted.
  const hasRealSavings = typeof youPay === 'number' && typeof youSolo === 'number';
  const youSave = hasRealSavings ? Math.max(0, youSolo - youPay) : null;

  return (
    <>
      <div
        style={{
          background: '#fff',
          border: `1.5px solid ${isBest ? '#F2A230' : 'rgba(33,28,38,.08)'}`,
          borderRadius: 26,
          padding: '28px 30px',
          boxShadow: isBest
            ? '0 4px 8px rgba(242,162,48,.12), 0 30px 56px -30px rgba(33,28,38,.8)'
            : '0 1px 2px rgba(33,28,38,.04), 0 22px 44px -34px rgba(33,28,38,.7)',
          transition: 'transform .18s, box-shadow .18s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 20 }}>
          <span style={{ font: '700 22px Familjen Grotesk,sans-serif', letterSpacing: '-.03em' }}>
            Group {index + 1}
          </span>
          <span style={{
            background: isBest ? '#FFF1DB' : '#F4EEE3',
            color: isBest ? '#A96A0C' : 'rgba(33,28,38,.6)',
            font: '700 10.5px Karla,sans-serif',
            letterSpacing: '.11em',
            textTransform: 'uppercase',
            padding: '6px 11px',
            borderRadius: 999,
          }}>
            {isBest ? 'Best match' : `Score ${group.score?.toFixed(2) ?? '—'}`}
          </span>
        </div>

        {/* Members */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
          {(group.members ?? []).map((m, i) => {
            const { bg, fg } = avatarColor(m.name);
            return (
              <div key={m.userId || i} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span style={{ width: 40, height: 40, borderRadius: 13, background: bg, color: fg, font: '700 14px Familjen Grotesk,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {m.initials}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ font: '700 15px Familjen Grotesk,sans-serif', letterSpacing: '-.02em' }}>
                      {m.name}{m.isYou ? ' (you)' : ''}
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" fill="#157F63"/>
                      <path d="M7.6 12.3l3 3 5.6-6" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span style={{ display: 'block', fontSize: 12.5, color: 'rgba(33,28,38,.55)', fontWeight: 600, marginTop: 2 }}>
                    {m.branch || 'S.P.I.T'} · drops at {m.dropNode?.name ?? '—'}
                  </span>
                </span>
                <span style={{ textAlign: 'right', flexShrink: 0, display: 'block' }}>
                  <span style={{ display: 'block', font: '700 15px Familjen Grotesk,sans-serif', letterSpacing: '-.02em' }}>
                    {formatFare(m.fareShare) ?? '—'}
                  </span>
                  <span style={{ display: 'block', font: '600 10.5px Karla,sans-serif', color: 'rgba(33,28,38,.45)', marginTop: 2 }}>
                    {m.dropDistanceKm?.toFixed(1) ?? '?'} km
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Route SVG */}
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <svg viewBox="0 0 480 104" style={{ width: '100%', height: 104, display: 'block' }} fill="none">
            <path d="M24 76 C150 76 140 30 250 30 C350 30 360 52 456 48" stroke="rgba(33,28,38,.1)" strokeWidth="4.5" strokeLinecap="round"/>
            <path d="M24 76 C150 76 140 30 250 30 C350 30 360 52 456 48" pathLength="100"
              stroke={lineColor} strokeWidth="4.5" strokeLinecap="round"
              strokeDasharray="100" strokeDashoffset="0"/>
            <circle cx="24" cy="76" r="6.5" fill="#211C26"/>
            <circle cx="250" cy="30" r="6" fill={lineColor}/>
            <circle cx="456" cy="48" r="6.5" fill="#211C26"/>
          </svg>
          <span style={{ position: 'absolute', left: '1%', bottom: 0, font: '700 10.5px Karla,sans-serif', letterSpacing: '.06em', color: 'rgba(33,28,38,.5)' }}>
            {group.pickupNode?.shortName ?? 'PICKUP'}
          </span>
          <span style={{ position: 'absolute', right: '1%', bottom: 0, font: '700 10.5px Karla,sans-serif', letterSpacing: '.06em', color: 'rgba(33,28,38,.5)', textAlign: 'right' }}>
            {group.members?.slice(-1)[0]?.dropNode?.shortName ?? 'DROP'}
          </span>
        </div>

        <div style={{ fontSize: 13, color: 'rgba(33,28,38,.55)', fontWeight: 600, marginBottom: 20 }}>
          Departs {departureFmt} · {group.distanceKm?.toFixed(1) ?? '?'} km route
        </div>

        {/* Fare summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, padding: '18px 0', borderTop: '1px solid rgba(33,28,38,.08)', borderBottom: '1px solid rgba(33,28,38,.08)', marginBottom: 20 }}>
          <div>
            <div style={{ font: '600 10px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.42)', marginBottom: 4 }}>Total fare</div>
            <div style={{ font: '700 19px Familjen Grotesk,sans-serif', letterSpacing: '-.03em' }}>{formatFare(totalFare)}</div>
          </div>
          <div>
            <div style={{ font: '600 10px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.42)', marginBottom: 4 }}>You pay</div>
            <div style={{ font: '700 19px Familjen Grotesk,sans-serif', letterSpacing: '-.03em' }}>{formatFare(youPay)}</div>
            <div style={{ font: '600 10.5px Karla,sans-serif', color: 'rgba(33,28,38,.45)', marginTop: 3 }}>vs {formatFare(youSolo) ?? '—'} solo</div>
          </div>
          <div>
            <div style={{ font: '600 10px Karla,sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(33,28,38,.42)', marginBottom: 4 }}>You save</div>
            <div style={{ font: '700 19px Familjen Grotesk,sans-serif', letterSpacing: '-.03em', color: '#0F8A5F' }}>{hasRealSavings ? formatFare(youSave) : '—'}</div>
          </div>
        </div>

        {/* Error */}
        {joinError && <div className="error-msg-red" style={{ marginBottom: 12 }}>{joinError}</div>}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {joinedGroup ? (
            <div style={{ padding: '14px 16px', borderRadius: 14, background: '#E4F2EC', color: '#0F6B52', font: '700 14.5px Karla,sans-serif', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.6l4.4 4.4L19 7" stroke="#0F6B52" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Joined Group {index + 1}!
            </div>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joining}
              style={{
                border: 0, borderRadius: 14, padding: 16,
                background: isBest ? '#F2A230' : '#211C26',
                color: isBest ? '#211C26' : '#FDFAF4',
                font: '700 14.5px Karla,sans-serif',
                cursor: joining ? 'not-allowed' : 'pointer',
                transition: 'transform .16s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                opacity: joining ? .7 : 1,
              }}
              onMouseEnter={e => { if (!joining) e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              {joining ? <Spinner size="sm" light={!isBest} /> : null}
              Request to join Group {index + 1}
            </button>
          )}

          <button
            onClick={() => setChatOpen(true)}
            disabled={!(joinedGroup || group.isMock)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: '1.5px solid rgba(33,28,38,.14)', borderRadius: 14, padding: 13,
              background: '#fff', font: '700 13.5px Karla,sans-serif',
              cursor: (joinedGroup || group.isMock) ? 'pointer' : 'not-allowed',
              opacity: (joinedGroup || group.isMock) ? 1 : .4,
              transition: 'background .16s',
            }}
            onMouseEnter={e => { if (joinedGroup || group.isMock) e.currentTarget.style.background = '#F4EEE3'; }}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            title={(joinedGroup || group.isMock) ? 'Open group chat' : 'Join the group first to chat'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H10l-5 4v-4H6.5A2.5 2.5 0 014 13.5v-7z" stroke="#211C26" strokeWidth="1.9" strokeLinejoin="round"/>
            </svg>
            Message group
          </button>
        </div>
      </div>

      {/* Chat drawer */}
      {chatOpen && (joinedGroup || group.isMock) && (
        <GroupChat
          groupId={joinedGroup?.id || DEMO_GROUP_ID}
          groupName={`Group ${index + 1}`}
          route={`${group.pickupNode?.name ?? 'Pickup'} → ${group.members?.slice(-1)[0]?.dropNode?.name ?? '—'}`}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  );
}
