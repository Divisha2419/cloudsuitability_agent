import { type ButtonHTMLAttributes, type ReactNode, useEffect, useState } from "react";
import type { Rating, SixR } from "../types";

// Status colours always come with an icon and a text label, never colour alone.
// Red is reserved for "not cloud compatible" and high risks.
export const RATING_STYLE: Record<Rating, { icon: string; cls: string; bar: string }> = {
  cloud_ready: { icon: "✓", cls: "bg-good/10 text-good ring-good/40", bar: "bg-good" },
  needs_upgrade: { icon: "!", cls: "bg-warning/10 text-[#9a5a00] ring-warning/50", bar: "bg-warning" },
  not_suitable: { icon: "✕", cls: "bg-critical/10 text-critical ring-critical/40", bar: "bg-critical" },
  na: { icon: "–", cls: "bg-slate-100 text-ink-muted ring-ink-line", bar: "bg-ink-line" },
};

// 6R badges use the Deloitte greens/blues/greys (no red).
export const SIX_R_STYLE: Record<SixR, string> = {
  rehost: "bg-good text-white",
  replatform: "bg-teal-600 text-white",
  refactor: "bg-dblue-600 text-white",
  replace: "bg-brand-700 text-white",
  retire: "bg-ink-muted text-white",
  retain: "bg-dblue-700 text-white",
};

export function RatingPill({ rating, label }: { rating: Rating; label: string }) {
  const s = RATING_STYLE[rating];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${s.cls}`}>
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
      className={`inline-flex items-center gap-2 rounded font-bold tracking-wide ${SIX_R_STYLE[code]} ${
        large ? "px-4 py-2 text-lg" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span aria-hidden>★</span>
      {headline}
    </span>
  );
}

/** A white panel; an optional title renders as a filled dark-green header band, as in the report deck. */
export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-md border border-ink-line bg-white shadow-sm ${className}`}>
      {title && <h3 className="bg-brand-700 px-5 py-2.5 text-[15px] font-bold text-white">{title}</h3>}
      <div className="p-5">{children}</div>
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
    secondary: "bg-white text-ink ring-1 ring-ink-line hover:bg-brand-50 disabled:text-slate-400",
    ghost: "text-brand-700 hover:bg-brand-50",
    danger: "text-ink-muted hover:bg-slate-100 hover:text-critical",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}

/**
 * Logo at the top left. Shows config/branding/logo.(svg|png|jpg) when that file
 * exists (served at /api/branding/logo); otherwise the text wordmark
 * "Deloitte" with the green full stop.
 */
export function DeloitteLogo({ className = "" }: { className?: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/branding")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => setLogoUrl(b?.logo_url ?? null))
      .catch(() => {});
  }, []);
  if (logoUrl) return <img src={logoUrl} alt="Deloitte" className="h-8 w-auto" onError={() => setLogoUrl(null)} />;
  return (
    <span className={`select-none font-bold leading-none tracking-tight text-ink ${className}`} aria-label="Deloitte">
      Deloitte<span className="text-brand-400">.</span>
    </span>
  );
}
