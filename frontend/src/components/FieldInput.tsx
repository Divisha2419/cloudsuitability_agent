import type { Field, TechCheck } from "../types";

interface Props {
  field: Field;
  value: string;
  error?: string;
  /** Tech-stack input check (version missing, spelling suggestion, unrecognised). */
  hint?: TechCheck | null;
  onChange: (value: string) => void;
  /** Called when the user leaves a text field (used to show the version check). */
  onBlur?: () => void;
}

export default function FieldInput({ field, value, error, hint, onChange, onBlur }: Props) {
  const inputId = `f-${field.id}`;
  const helpId = `${inputId}-help`;
  const msgId = `${inputId}-msg`;
  const describedBy = [field.help && helpId, (error || hint) && msgId].filter(Boolean).join(" ") || undefined;
  const flagged = !!error || hint?.status === "missing_version";
  const base =
    "w-full rounded border bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-brand-600";
  const border = flagged ? "border-warning" : "border-ink-line";

  return (
    <div className={field.additional ? "border-t border-ink-line pt-6" : ""}>
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={field.type === "select" && field.widget !== "dropdown" ? undefined : inputId}
          id={`${inputId}-label`}
          className="text-[15px] font-semibold text-ink"
        >
          {field.label}
          {field.required && <span className="ml-0.5 font-bold text-brand-600">*</span>}
        </label>
        {field.origin === "added" && (
          <span
            title="Needed by the scoring or hard-filter rules."
            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted"
          >
            scoring input
          </span>
        )}
      </div>
      {field.help && (
        <p id={helpId} className="mb-2 mt-0.5 text-[13px] leading-snug text-ink-muted">
          {field.help}
        </p>
      )}

      {field.type === "select" && field.widget === "dropdown" && (
        <select
          id={inputId}
          value={value}
          aria-invalid={flagged}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} ${border} max-w-md`}
        >
          <option value="">Select…</option>
          {field.options!.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {field.type === "select" && field.widget !== "dropdown" && (
        <div role="radiogroup" aria-labelledby={`${inputId}-label`} aria-describedby={describedBy} className="flex flex-wrap gap-2">
          {field.options!.map((opt) => {
            const selected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(selected && !field.required ? "" : opt.value)}
                className={`rounded border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-brand-600 ${
                  selected
                    ? "border-brand-700 bg-brand-700 text-white"
                    : `${error ? "border-warning" : "border-ink-line"} bg-white text-slate-700 hover:border-brand-600 hover:bg-brand-50`
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {field.type === "text" && (
        <input
          id={inputId}
          type="text"
          value={value}
          placeholder={field.placeholder}
          aria-invalid={flagged}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`${base} ${border}`}
        />
      )}

      {field.type === "textarea" && (
        <textarea
          id={inputId}
          rows={field.additional ? 2 : 3}
          value={value}
          placeholder={field.placeholder}
          aria-invalid={flagged}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`${base} ${border}`}
        />
      )}

      {error ? (
        <p id={msgId} className="mt-1 text-xs font-semibold text-[#9a5a00]">
          {error}
        </p>
      ) : (
        hint && (
          <p
            id={msgId}
            className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] ${
              hint.status === "unrecognized" ? "text-ink-muted" : "font-semibold text-[#9a5a00]"
            }`}
          >
            <span aria-hidden>{hint.status === "unrecognized" ? "?" : "!"}</span>
            {hint.message}
            {hint.status === "suggestion" && hint.suggestion && (
              <button
                type="button"
                onClick={() => onChange(hint.suggestion)}
                className="rounded border border-brand-600 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
              >
                Use “{hint.suggestion}”
              </button>
            )}
          </p>
        )
      )}
    </div>
  );
}
