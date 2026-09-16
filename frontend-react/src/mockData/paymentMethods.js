// MOCK DATA — Phase 2 placeholder only.
// No real payment gateway is integrated — selecting a method only ever leads
// to a fake success state, never a real transaction.
//
// The "detail" lines are deliberately field-name placeholders ("UPI ID",
// "Wallet Balance", "Card Number") rather than realistic-looking fake values
// (a specific handle, balance, or masked card number) — so it's obvious at
// a glance that nothing here is real data tied to the logged-in user.
export const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI', tag: 'UPI', detail: 'UPI ID · instant' },
  { id: 'wallet', label: 'RoutePool wallet', tag: '₹', detail: 'Wallet Balance' },
  { id: 'card', label: 'Card', tag: 'CARD', detail: 'Card Number · instant' },
  { id: 'cash', label: 'Cash', tag: 'CASH', detail: 'Pay the driver directly' },
];
