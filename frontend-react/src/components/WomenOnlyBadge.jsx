// The only gender information other students ever see: a group's "Women-only"
// label (never any member's gender). Renders nothing for other groups.
export default function WomenOnlyBadge({ show, style }) {
  if (!show) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', background: '#F7E3F0', color: '#8A2B6B',
      font: '700 10.5px Karla,sans-serif', letterSpacing: '.08em', textTransform: 'uppercase',
      padding: '4px 9px', borderRadius: 999, verticalAlign: 'middle', ...style,
    }}>
      Women-only
    </span>
  );
}
