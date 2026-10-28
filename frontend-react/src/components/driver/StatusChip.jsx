// Status of one uploaded document, in the same small uppercase pill as the
// rest of the app: grey / amber / green / red.
const LOOK = {
  not_uploaded: { bg: '#F4EEE3', fg: 'rgba(33,28,38,.6)', label: () => 'Not uploaded' },
  pending: { bg: '#FFF1DB', fg: '#A96A0C', label: () => 'Pending review' },
  verified: { bg: '#E4F2EC', fg: '#0F6B52', label: () => 'Verified' },
  expiring: { bg: '#FFF1DB', fg: '#A96A0C', label: (n) => `Expires in ${n} day${n === 1 ? '' : 's'}` },
  expired: { bg: '#FDECEA', fg: '#B3261E', label: () => 'Expired' },
  rejected: { bg: '#FDECEA', fg: '#B3261E', label: () => 'Not accepted' },
};

export default function StatusChip({ state, daysLeft, style }) {
  const look = LOOK[state] || LOOK.not_uploaded;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
      font: '700 10.5px Karla,sans-serif', letterSpacing: '.08em', textTransform: 'uppercase',
      background: look.bg, color: look.fg, borderRadius: 999, padding: '5px 10px', ...style,
    }}>
      {look.label(daysLeft)}
    </span>
  );
}
