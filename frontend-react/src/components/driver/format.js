// Shared formatting for the driver portal's ride and trip cards.
export const pickupTime = (iso) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
export const rupees = (n) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
