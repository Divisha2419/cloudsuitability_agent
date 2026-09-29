import type { Field } from "../types";
import { InfoTip } from "./ui";

interface Props {
  field: Field;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

export default function FieldInput({ field, value, error, onChange }: Props) {
  const inputId = `f-${field.id}`;
  const describedBy = error ? `${inputId}-err` : undefined;
  const base =
    "w-full rounded border bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-brand-600";
  const border = error ? "border-warning" : "border-ink-line";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor={field.type === "select" ? undefined : inputId} id={`${inputId}-label`} className="text-[15px] font-semibold text-ink">
          {field.label}
          {field.required && <span className="ml-0.5 font-bold text-brand-600">*</span>}
        </label>
        {field.help && <InfoTip text={field.help} />}
        {field.origin === "added" && (
          <span
            title="Not in the intake steps of the instructions, but needed by the scoring or hard-filter rules."
            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            scoring input
          </span>
        )}
      </div>

      {field.type === "select" && (
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
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} ${border}`}
        />
      )}

      {field.type === "textarea" && (
        <textarea
          id={inputId}
          rows={3}
          value={value}
          placeholder={field.placeholder}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} ${border}`}
        />
      )}

      {error && (
        <p id={describedBy} className="text-xs font-semibold text-[#9a5a00]">
          {error}
        </p>
      )}
    </div>
  );
}
