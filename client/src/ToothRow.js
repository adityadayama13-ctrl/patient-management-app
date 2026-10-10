// The app's one signature illustration: a single row of teeth drawn like a
// dental chart (short wide molars, long incisors, one highlighted). It settles
// into place once when it appears and is used only on sign-in and empty screens.
const HALF = [[21, 23], [23, 25], [24, 26], [17, 28], [17, 29], [16, 33], [14, 31], [17, 34]]; // [width, height], outer to centre
const TEETH = [...HALF, ...HALF.slice().reverse()];
const GAP = 3;
const VIEW_W = 360;
const VIEW_H = 46;
const HIGHLIGHT = 8; // central incisor

function layout() {
  const total = TEETH.reduce((sum, [w]) => sum + w, 0) + GAP * (TEETH.length - 1);
  let x = (VIEW_W - total) / 2;
  return TEETH.map(([w, h]) => {
    const rx = Math.min(w / 2.2, h * 0.5);
    const d = `M0 0H${w}V${h - rx}A${rx} ${rx} 0 0 1 ${w - rx} ${h}H${rx}A${rx} ${rx} 0 0 1 0 ${h - rx}Z`;
    const tooth = { x, d };
    x += w + GAP;
    return tooth;
  });
}
const SHAPES = layout();

export default function ToothRow({ width = 340, className = '' }) {
  return (
    <svg
      className={`tooth-row ${className}`.trim()}
      style={{ width }}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES.map((t, i) => (
        <g key={i} transform={`translate(${t.x.toFixed(1)} 4)`}>
          <g className={`tooth${i === HIGHLIGHT ? ' tooth-on' : ''}`} style={{ '--i': i }}>
            <path d={t.d} />
          </g>
        </g>
      ))}
    </svg>
  );
}
