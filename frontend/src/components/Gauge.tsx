import type { Band } from "../types";
import { BAND_COLOR } from "./ui";

// Semicircular 0–100 gauge. The track shows the four readiness bands as a
// recessive backdrop; the filled arc and the number carry the score, and the
// band name is always printed underneath (colour is never the only cue).

const BANDS: { from: number; to: number; level: Band["level"] }[] = [
  { from: 0, to: 40, level: "very_low" },
  { from: 40, to: 60, level: "low" },
  { from: 60, to: 80, level: "medium" },
  { from: 80, to: 100, level: "high" },
];

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
        {BANDS.map((b) => (
          <path
            key={b.level}
            d={arc(b.from + (b.from ? 0.8 : 0), b.to - (b.to < 100 ? 0.8 : 0))}
            stroke={BAND_COLOR[b.level]}
            strokeOpacity={0.22}
            strokeWidth={14}
            fill="none"
          />
        ))}
        {value > 0 && (
          <path d={arc(0, value)} stroke={BAND_COLOR[band.level]} strokeWidth={14} strokeLinecap="round" fill="none" />
        )}
        {[0, 40, 60, 80, 100].map((t) => {
          const [x, y] = point(t, R + 16);
          return (
            <text key={t} x={x} y={y + 3} textAnchor="middle" className="fill-slate-400 text-[8px]">
              {t}
            </text>
          );
        })}
        <text x={CX} y={CY - 12} textAnchor="middle" className="fill-slate-900 text-[34px] font-bold">
          {score}
        </text>
        <text x={CX} y={CY + 6} textAnchor="middle" className="fill-slate-500 text-[9px]">
          out of {max}
        </text>
      </svg>
      <figcaption className="mt-1 text-center text-sm font-semibold text-slate-700">{band.label}</figcaption>
    </figure>
  );
}
