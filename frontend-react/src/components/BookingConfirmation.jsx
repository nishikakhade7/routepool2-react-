import { useState } from 'react';
import VisionBadge from './VisionBadge';
import RouteVisual from './RouteVisual';
import GroupChat from './GroupChat';
import { ALLOWED_EMAIL_DOMAIN } from '../constants';
import { formatRating, formatEta } from '../utils/formatDriver';
import { formatFare } from '../utils/formatFare';
import { FareBreakupDetails } from './FareBreakup';

function initialsOf(name) {
  return name.split(' ').map((p) => p[0]).join('');
}

/**
 * @param {object} props
 * @param {object} props.group   Matched-group shape from runMatchingFlow
 *   (same object FormGroup/MatchCard consume). fareShare/totalFare/soloFare
 *   are real numbers once matched against the real backend; the mock branch
 *   (USE_MOCK_MATCHING) puts field-name placeholder strings in these same
 *   fields instead — formatFare() below renders whichever it gets.
 * @param {object|null} [props.driver]  From getAssignedDriver(), or null before
 *   the booking is confirmed (the driver card is hidden until then).
 * @param {string|null} [props.groupId]  Real/demo chat group id, or null if
 *   this is a real (non-mock) match the user hasn't joined yet — chat isn't
 *   reachable until then, same restriction MatchCard already applies.
 * @param {() => void} props.onContinue
 * @param {string} [props.continueLabel]
 * @param {() => void} [props.onLeave]  Shows "Can't make it? Leave group".
 */
export default function BookingConfirmation({ group, driver = null, groupId, onContinue, continueLabel = 'Continue to payment', onLeave }) {
  const [busy, setBusy] = useState(false);
  const run = (fn) => async () => {
    if (busy || !fn) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };
  const [showWhy, setShowWhy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const members = group?.members ?? [];
  const totalFare = group?.totalFare ?? 0;
  const youMember = members.find((m) => m.isYou);
  const share = youMember?.fareShare ?? totalFare;
  // "You save" needs real numbers on both sides of the subtraction — a
  // placeholder string can't be subtracted. Stays hidden (see the `save !=
  // null` check below) until the real backend supplies both, same as
  // PaymentSuccess.jsx's hasRealEta gate.
  const hasRealSavings = typeof share === 'number' && typeof youMember?.soloFare === 'number';
  const save = hasRealSavings ? Math.max(0, youMember.soloFare - share) : null;
  const fromName = group?.pickupNode?.name ?? 'Pickup';
  const toName = [...members].sort((a, b) => (b.dropDistanceKm ?? 0) - (a.dropDistanceKm ?? 0))[0]?.dropNode?.name ?? '—';
  const seatsLeft = group?.seatsLeft;
  const route = `${fromName} → ${toName}`;

  return (
    <div className="animate-rise">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 26, flexWrap: 'wrap' }}>
        <div>
          <VisionBadge />
          <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 40, letterSpacing: '-.035em', margin: '0 0 8px' }}>
            Confirm your booking
          </h1>
          <p style={{ margin: 0, fontSize: 15.5, color: 'rgba(33,28,38,.58)' }}>
            {route} · {members.length} rider{members.length === 1 ? '' : 's'}
            {driver ? ` · ${driver.name} arriving in ${formatEta(driver.etaMinutes)}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="input-label" style={{ marginBottom: 4 }}>Your share</div>
          <div style={{ font: '700 34px Familjen Grotesk,sans-serif', letterSpacing: '-.04em' }}>{formatFare(share)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr .75fr', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Driver / vehicle card — only once a driver is assigned */}
          {driver && <div style={{ border: '1.5px solid #F2A230', borderRadius: 24, padding: '24px 26px', display: 'flex', alignItems: 'center', gap: 20, background: '#fff' }}>
            <div style={{ width: 60, height: 60, borderRadius: 19, background: '#F4EEE3', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 20px Familjen Grotesk,sans-serif', flexShrink: 0 }}>
              {initialsOf(driver.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '700 19px Familjen Grotesk,sans-serif', letterSpacing: '-.025em' }}>
                {driver.name} · ★ {formatRating(driver.rating)}
              </div>
              <div style={{ fontSize: 13.5, color: 'rgba(33,28,38,.55)', fontWeight: 600, marginTop: 3 }}>
                {driver.vehicle} · {driver.plate}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ font: '700 22px Familjen Grotesk,sans-serif', letterSpacing: '-.03em' }}>{formatEta(driver.etaMinutes)}</div>
              <div style={{ fontSize: 12, color: 'rgba(33,28,38,.5)', fontWeight: 700, marginTop: 2 }}>to {fromName}</div>
            </div>
          </div>}

          {/* Your group — real matched members */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="input-label" style={{ marginBottom: 0 }}>Your group</div>
              <button
                onClick={() => setChatOpen(true)}
                disabled={!groupId}
                title={groupId ? 'Open group chat' : 'Join the group first to chat'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  border: '1.5px solid rgba(33,28,38,.14)', borderRadius: 12, padding: '9px 14px',
                  background: '#fff', font: '700 13px Karla,sans-serif',
                  cursor: groupId ? 'pointer' : 'not-allowed',
                  opacity: groupId ? 1 : 0.4,
                  transition: 'background .16s',
                }}
                onMouseEnter={(e) => { if (groupId) e.currentTarget.style.background = '#F4EEE3'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H10l-5 4v-4H6.5A2.5 2.5 0 014 13.5v-7z" stroke="#211C26" strokeWidth="1.9" strokeLinejoin="round" />
                </svg>
                Group chat
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {members.map((m, i) => (
                <div key={m.userId || i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 14, background: '#F4EEE3', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 15px Familjen Grotesk,sans-serif', flexShrink: 0 }}>
                    {m.initials}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ font: '700 15.5px Familjen Grotesk,sans-serif', letterSpacing: '-.02em' }}>
                        {m.name}{m.isYou ? ' (you)' : ''}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" fill="#157F63" />
                        <path d="M7.6 12.3l3 3 5.6-6" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'rgba(33,28,38,.55)', fontWeight: 600, marginTop: 2 }}>
                      drops at {m.dropNode?.name ?? '—'}
                    </span>
                  </span>
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ display: 'block', font: '700 15px Familjen Grotesk,sans-serif' }}>{formatFare(m.fareShare) ?? '—'}</span>
                    {typeof m.dropDistanceKm === 'number' && (
                      <span style={{ display: 'block', font: '600 10.5px Karla,sans-serif', color: 'rgba(33,28,38,.45)', marginTop: 2 }}>{m.dropDistanceKm.toFixed(1)} km</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowWhy((s) => !s)}
              style={{ marginTop: 18, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '1px dashed rgba(33,28,38,.2)', borderRadius: 14, padding: '13px 16px', background: '#FDFAF4', font: '700 12.5px Karla,sans-serif', color: '#8A2B6B', cursor: 'pointer' }}
            >
              {showWhy ? 'Hide fare breakdown' : 'Why this price?'}
              <span style={{ fontSize: 14 }}>{showWhy ? '︿' : '⌄'}</span>
            </button>
            {showWhy && (
              <div className="animate-rise" style={{ marginTop: 12, background: '#FDFAF4', border: '1px solid rgba(33,28,38,.08)', borderRadius: 16, padding: '18px 20px' }}>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'rgba(33,28,38,.6)' }}>
                  The full auto fare is split by how far each rider actually stays on board —
                  everyone pays only for the stretch of the shared route they're riding, not an
                  equal share of the whole trip.
                </p>
                <FareBreakupDetails fare={group?.fare} />
              </div>
            )}

            {seatsLeft === 0 && (
              <div style={{ marginTop: 14, fontSize: 12.5, color: '#0F6B52', fontWeight: 700 }}>
                Group full ({members.length}/{members.length}) · 0 seats left
              </div>
            )}
            {typeof seatsLeft === 'number' && seatsLeft > 0 && (
              <div style={{ marginTop: 14, fontSize: 12.5, color: 'rgba(33,28,38,.55)', fontWeight: 600 }}>
                {seatsLeft} seat{seatsLeft === 1 ? '' : 's'} still open — students heading your way can still join, which lowers everyone's share.
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(33,28,38,.07)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#157F63', fontWeight: 600 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#157F63" />
                <path d="M7.6 12.3l3 3 5.6-6" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Everyone verified @{ALLOWED_EMAIL_DOMAIN}
            </div>
          </div>

          {/* Route line — real pickup/drop names, purely visual */}
          <div className="card">
            <div className="input-label">Your route</div>
            <RouteVisual height={110} variant="light" animated={false} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'rgba(33,28,38,.55)', fontWeight: 700 }}>
              <span>{fromName}</span>
              <span>{toName}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="input-label" style={{ marginBottom: 16 }}>Booking summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 20 }}>
            {driver && (
              <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 14px Karla,sans-serif' }}>
                <span style={{ color: 'rgba(33,28,38,.6)' }}>Vehicle</span>
                <span style={{ fontWeight: 700 }}>{driver.vehicle}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 14px Karla,sans-serif' }}>
              <span style={{ color: 'rgba(33,28,38,.6)' }}>Riders</span>
              <span style={{ fontWeight: 700 }}>{members.length} rider{members.length === 1 ? '' : 's'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 14px Karla,sans-serif' }}>
              <span style={{ color: 'rgba(33,28,38,.6)' }}>Trip total</span>
              <span style={{ fontWeight: 700 }}>{formatFare(totalFare)}</span>
            </div>
            {hasRealSavings && save > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 14px Karla,sans-serif' }}>
                <span style={{ color: 'rgba(33,28,38,.6)' }}>You save</span>
                <span style={{ fontWeight: 700, color: '#0F8A5F' }}>−{formatFare(save)}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 17, borderTop: '1px solid rgba(33,28,38,.08)' }}>
            <span style={{ font: '700 15px Familjen Grotesk,sans-serif' }}>You pay</span>
            <span style={{ font: '700 30px Familjen Grotesk,sans-serif', letterSpacing: '-.04em' }}>{formatFare(share)}</span>
          </div>
          <button className="btn-primary" style={{ marginTop: 22, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={run(onContinue)}>{continueLabel}</button>
          {onLeave && (
            <button
              onClick={run(onLeave)}
              disabled={busy}
              style={{ marginTop: 12, width: '100%', border: 0, background: 'transparent', font: '700 13px Karla,sans-serif', color: '#B3261E', cursor: busy ? 'not-allowed' : 'pointer', textDecoration: 'underline' }}
            >
              Can't make it? Leave group
            </button>
          )}
          <p style={{ margin: '14px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'rgba(33,28,38,.5)', textAlign: 'center' }}>
            Split by distance. Each rider pays only for the segments they travel.
          </p>
        </div>
      </div>

      {chatOpen && groupId && (
        <GroupChat
          groupId={groupId}
          groupName="Your Pool"
          route={route}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
