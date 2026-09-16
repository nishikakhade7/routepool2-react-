import { useState } from 'react';
import VisionBadge from './VisionBadge';

// No real payment gateway is integrated — selecting a method only ever leads
// to a fake success state, never a real transaction. The "detail" lines below
// (UPI handle, wallet balance, masked card number) are generic placeholder
// text, not real data tied to the logged-in user — there's no real UPI/
// wallet/card-storage system behind this app.
const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI', tag: 'UPI', detail: 'you@upi · instant' },
  { id: 'wallet', label: 'RoutePool wallet', tag: '₹', detail: 'Balance ₹340' },
  { id: 'card', label: 'Card', tag: 'CARD', detail: '•••• 4417 · instant' },
  { id: 'cash', label: 'Cash', tag: 'CASH', detail: 'Pay the driver directly' },
];

/**
 * @param {object} props
 * @param {number} props.amount    The rider's own fare share — real value
 *   from the matched group, not invented here.
 * @param {number} [props.savings] Real solo-fare-minus-share savings, same
 *   formula MatchCard already uses — 0/undefined hides the savings line.
 * @param {string} [props.vehicleName]  Real picked-driver vehicle name.
 * @param {string} [props.pickupText]
 * @param {string} [props.dropText]
 * @param {(method: { id: string, label: string }) => void} props.onConfirm
 *   Called with the chosen method once the user confirms; the caller owns
 *   what happens next (this component no longer shows its own success page).
 */
export default function PaymentMethodSelect({ amount, savings = 0, vehicleName, pickupText, dropText, onConfirm }) {
  const [selected, setSelected] = useState('upi');

  return (
    <div className="animate-rise">
      <VisionBadge />
      <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 40, letterSpacing: '-.035em', margin: '0 0 8px' }}>
        Pay your share
      </h1>
      <p style={{ margin: '0 0 28px', fontSize: 15.5, color: 'rgba(33,28,38,.58)' }}>
        {[vehicleName, pickupText && dropText ? `${pickupText} → ${dropText}` : null].filter(Boolean).join(' · ')}
      </p>

      <div className="card-dark" style={{ marginBottom: 22 }}>
        <div style={{ font: '600 10.5px Karla,sans-serif', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(253,250,244,.55)', marginBottom: 8 }}>
          Amount due
        </div>
        <div style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 64, letterSpacing: '-.05em', lineHeight: 1 }}>
          ₹{amount.toFixed(0)}
        </div>
        {savings > 0 && (
          <div style={{ fontSize: 13.5, color: '#8FE3C4', fontWeight: 700, marginTop: 8 }}>
            You save ₹{savings.toFixed(0)} versus riding solo
          </div>
        )}
      </div>

      <div className="input-label" style={{ marginBottom: 12 }}>Pay with</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {PAYMENT_METHODS.map((m) => {
          const isSelected = selected === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                border: `1.5px solid ${isSelected ? '#211C26' : 'rgba(33,28,38,.12)'}`,
                background: isSelected ? '#F4EEE3' : '#fff',
                borderRadius: 18, padding: '18px 20px', cursor: 'pointer', transition: 'all .16s',
              }}
            >
              <span style={{ width: 44, height: 44, borderRadius: 14, background: isSelected ? '#F2A230' : '#F4EEE3', color: '#211C26', font: '700 11px Familjen Grotesk,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {m.tag}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 14.5 }}>{m.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'rgba(33,28,38,.5)', fontWeight: 600, marginTop: 2 }}>{m.detail}</span>
              </span>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${isSelected ? '#211C26' : 'rgba(33,28,38,.2)'}`,
                background: isSelected ? '#211C26' : 'transparent',
              }} />
            </button>
          );
        })}
      </div>

      <button className="btn-accent" onClick={() => onConfirm(PAYMENT_METHODS.find((m) => m.id === selected))}>
        Confirm payment
      </button>
      <p style={{ marginTop: 14, fontSize: 12, color: 'rgba(33,28,38,.4)', textAlign: 'center' }}>
        No real payment processor is connected — this is a Phase 2 vision demo.
      </p>
    </div>
  );
}
