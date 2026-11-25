import { useRef } from 'react';
import { fromNorm, toNorm, formatParam, type ParamSpec } from '../state/specs';
import { store } from '../app';

// A rotary control. Drag vertically (Shift = fine), wheel, arrow keys; double-click resets to default.
// `onChange(v, live)` is called with live=true during a drag; the gesture becomes one undo step on release.
export function Knob({ spec, value, onChange, size = 38, color = '#f2a541', automated }: { spec: ParamSpec; value: number; onChange: (v: number, live: boolean) => void; size?: number; color?: string; automated?: boolean }) {
  const drag = useRef<{ y: number; n: number } | null>(null);
  const n = Math.min(1, Math.max(0, toNorm(spec, value)));
  const a0 = -135;
  const a = a0 + n * 270;
  const r = size / 2 - 3;
  const arc = (from: number, to: number) => {
    const p = (deg: number) => [size / 2 + r * Math.sin((deg * Math.PI) / 180), size / 2 - r * Math.cos((deg * Math.PI) / 180)];
    const [x0, y0] = p(from);
    const [x1, y1] = p(to);
    return `M${x0},${y0} A${r},${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1},${y1}`;
  };
  const set = (nn: number, live: boolean) => onChange(fromNorm(spec, Math.min(1, Math.max(0, nn))), live);
  return (
    <div className="knob" title={`${spec.label}: ${formatParam(spec, value)}${automated ? ' (automated)' : ''}`}>
      <svg
        width={size}
        height={size}
        role="slider"
        aria-label={spec.label}
        aria-valuemin={spec.min}
        aria-valuemax={spec.max}
        aria-valuenow={value}
        tabIndex={0}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, n };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const d = (drag.current.y - e.clientY) / (e.shiftKey ? 600 : 150);
          set(drag.current.n + d, true);
        }}
        onPointerUp={() => {
          if (drag.current) store.commitGesture(`Adjust ${spec.label}`);
          drag.current = null;
        }}
        onWheel={(e) => set(n - Math.sign(e.deltaY) * 0.02, false)}
        onDoubleClick={() => onChange(spec.def, false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(n + 0.02, false);
          else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(n - 0.02, false);
          else return;
          e.preventDefault();
        }}
      >
        <path d={arc(a0, 135)} stroke="var(--knob-track)" strokeWidth="4" fill="none" strokeLinecap="round" />
        {n > 0.005 && <path d={arc(a0, a)} stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />}
        <circle cx={size / 2} cy={size / 2} r={r - 6} fill="var(--knob-cap)" />
        <line x1={size / 2} y1={size / 2} x2={size / 2 + (r - 8) * Math.sin((a * Math.PI) / 180)} y2={size / 2 - (r - 8) * Math.cos((a * Math.PI) / 180)} stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" />
        {automated && <circle cx={size - 5} cy={5} r={3} fill="#4ab3c9" />}
      </svg>
      <span className="knob-label">{spec.label}</span>
      <span className="knob-value">{formatParam(spec, value)}</span>
    </div>
  );
}
