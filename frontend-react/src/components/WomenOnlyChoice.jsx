// Shown when a student's own women-only preference hid groups from their search
// (backend hiddenByPreference). Used by Book a ride and Form a group, so both
// explain it the same way and offer the same explicit choice.

const plural = (n, one, many) => (n === 1 ? one : many);

/**
 * variant 'empty': nothing else matched - offer to start a women-only group or see the others.
 * variant 'note':  other groups were found - a one-line note with "Show them for this ride".
 */
export default function WomenOnlyChoice({ variant, hiddenCount, aroundTime, starting, onStart, onShowOthers }) {
  if (variant === 'note') {
    return (
      <div className="card" style={{ marginBottom: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(33,28,38,.65)' }}>
          Showing women-only groups. {hiddenCount} other {plural(hiddenCount, 'group', 'groups')} on this route {plural(hiddenCount, "isn't", "aren't")} shown.
        </span>
        <button className="btn-ghost" style={{ width: 'auto', padding: '8px 14px' }} onClick={onShowOthers}>Show them for this ride</button>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: 32 }}>
      <div style={{ font: '700 22px Familjen Grotesk,sans-serif', letterSpacing: '-.02em', marginBottom: 8 }}>
        No women-only groups on this route yet
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 14.5, color: 'rgba(33,28,38,.6)', lineHeight: 1.55 }}>
        There {plural(hiddenCount, 'is', 'are')} {hiddenCount} other {plural(hiddenCount, 'group', 'groups')} going your way{aroundTime ? ` around ${aroundTime}` : ''} that {plural(hiddenCount, "isn't", "aren't")} women-only.
        Start a women-only group (only women can see and join it), or see the other {plural(hiddenCount, 'group', 'groups')} for this ride only — your profile setting stays on.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn-accent" style={{ width: 'auto', padding: '14px 24px', opacity: starting ? 0.7 : 1 }} disabled={starting} onClick={onStart}>
          {starting ? 'Starting…' : 'Start a women-only group'}
        </button>
        <button className="btn-ghost" style={{ width: 'auto', padding: '14px 24px' }} onClick={onShowOthers}>
          Show the other {hiddenCount === 1 ? 'group' : `${hiddenCount} groups`}
        </button>
      </div>
    </div>
  );
}
