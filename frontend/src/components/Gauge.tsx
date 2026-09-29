import type { Band } from "../types";

// Semicircular 0–100 gauge: grey track, Deloitte-green filled arc, the score in
// the middle and the readiness band printed underneath.

const R = 80;
const CX = 100;
const CY = 95;

function point(value: number, r = R) {
  const angle = Math.PI * (1 - value / 100);
  return [CX + r * Math.cos(angle), CY - r * Math.sin(angle)];
}

function arc(from: number, to: number) {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
}

export default function Gauge({ score, max = 100, band, size = 220 }: { score: number; max?: number; band: Band; size?: number }) {
  const value = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <figure className="flex flex-col items-center" aria-label={`Cloud Native Score ${score} of ${max}, ${band.label}`}>
      <svg viewBox="-14 0 228 110" width={size} role="img" aria-hidden>
        <path d={arc(0, 100)} stroke="var(--color-track)" strokeWidth={14} fill="none" />
        {value > 0 && <path d={arc(0, value)} stroke="var(--color-brand)" strokeWidth={14} strokeLinecap="round" fill="none" />}
        {[0, 40, 60, 80, 100].map((t) => {
          const [x, y] = point(t, R + 16);
          return (
            <text key={t} x={x} y={y + 3} textAnchor="middle" className="fill-slate-400 text-[8px]">
              {t}
            </text>
          );
        })}
        <text x={CX} y={CY - 12} textAnchor="middle" className="fill-black text-[34px] font-bold">
          {score}
        </text>
        <text x={CX} y={CY + 6} textAnchor="middle" className="fill-slate-500 text-[9px]">
          out of {max}
        </text>
      </svg>
      <figcaption className="mt-1 text-center text-sm font-bold text-brand-700">{band.label}</figcaption>
    </figure>
  );
}
