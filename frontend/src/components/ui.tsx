import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Band, Rating, SixR } from "../types";

// Status colours always come with an icon and a text label, never colour alone.
export const RATING_STYLE: Record<Rating, { icon: string; cls: string }> = {
  cloud_ready: { icon: "✓", cls: "bg-good/15 text-green-800 ring-good/40" },
  needs_upgrade: { icon: "!", cls: "bg-warning/20 text-amber-900 ring-warning/60" },
  not_suitable: { icon: "✕", cls: "bg-critical/15 text-red-800 ring-critical/40" },
  na: { icon: "–", cls: "bg-slate-100 text-slate-600 ring-slate-300" },
};

export const BAND_COLOR: Record<Band["level"], string> = {
  high: "var(--color-good)",
  medium: "var(--color-warning)",
  low: "var(--color-serious)",
  very_low: "var(--color-critical)",
};

export const SIX_R_STYLE: Record<SixR, string> = {
  rehost: "bg-emerald-600 text-white",
  replatform: "bg-sky-600 text-white",
  refactor: "bg-indigo-600 text-white",
  replace: "bg-violet-600 text-white",
  retire: "bg-slate-600 text-white",
  retain: "bg-amber-600 text-white",
};

export function RatingPill({ rating, label }: { rating: Rating; label: string }) {
  const s = RATING_STYLE[rating];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${s.cls}`}>
      <span aria-hidden className="font-bold">
        {s.icon}
      </span>
      {label}
    </span>
  );
}

export function SixRBadge({ code, headline, large = false }: { code: SixR; headline: string; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg font-semibold tracking-wide ${SIX_R_STYLE[code]} ${
        large ? "px-4 py-2 text-lg" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span aria-hidden>★</span>
      {headline}
    </span>
  );
}

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>}
      {children}
    </section>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-brand-700 text-white hover:bg-brand-900 disabled:bg-slate-300",
    secondary: "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:text-slate-400",
    ghost: "text-brand-700 hover:bg-brand-50",
    danger: "text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="More information"
        className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 hover:bg-brand-100 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-600"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
