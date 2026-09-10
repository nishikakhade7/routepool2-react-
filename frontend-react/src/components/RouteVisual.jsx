/**
 * RouteVisual — reusable curved Bézier route-line SVG motif.
 * variant: 'dark' (light strokes on purple bg) | 'light' (colored strokes on white bg)
 * height: SVG height in px (default 200)
 */
export default function RouteVisual({ variant = 'dark', height = 200, animated = true }) {
  const accent = '#F2A230';
  const secondary = variant === 'dark' ? '#FDFAF4' : '#8A2B6B';
  const lineAnim = animated ? 'drawLine 1.8s cubic-bezier(.4,0,.2,1) both' : undefined;
  const secOpacity = variant === 'dark' ? .3 : .35;

  return (
    <svg
      viewBox="0 0 380 210"
      style={{ width: '100%', height, display: 'block' }}
      fill="none"
      aria-hidden="true"
    >
      {/* Primary animated route line */}
      <path
        d="M30 170 C120 170 110 60 210 60 C300 60 300 110 350 104"
        stroke={accent}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeDasharray="900"
        style={lineAnim ? { animation: lineAnim } : undefined}
      />
      {/* Secondary dashed line */}
      <path
        d="M30 194 C140 194 160 96 250 96 C320 96 330 140 350 138"
        stroke={secondary}
        strokeOpacity={secOpacity}
        strokeWidth="1.4"
        strokeDasharray="3 8"
      />
      {/* Start node */}
      <circle cx="30" cy="170" r="7" fill={secondary} fillOpacity={variant === 'dark' ? 1 : 0.8} />
      {/* Mid pulsing node */}
      <circle cx="210" cy="60" r="7" fill={accent} />
      <circle
        cx="210" cy="60" r="7" fill={accent}
        style={{ transformOrigin: '210px 60px', animation: 'pulseRing 2.8s ease-out infinite' }}
      />
      {/* End node */}
      <circle cx="350" cy="104" r="6" fill={secondary} fillOpacity={variant === 'dark' ? 1 : 0.6} />
    </svg>
  );
}
