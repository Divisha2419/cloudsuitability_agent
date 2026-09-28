import type { Step } from "../types";

interface Props {
  steps: Step[];
  current: number;
  /** Highest step the user may jump to (completed steps + the current one). */
  reachable: number;
  onSelect: (index: number) => void;
}

export default function Stepper({ steps, current, reachable, onSelect }: Props) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const enabled = i <= reachable;
          return (
            <li key={step.id} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
              <button
                type="button"
                disabled={!enabled}
                onClick={() => onSelect(i)}
                aria-current={active ? "step" : undefined}
                className="group flex items-center gap-2 disabled:cursor-not-allowed"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-2 transition ${
                    active
                      ? "bg-brand-700 text-white ring-brand-700"
                      : done
                        ? "bg-brand-100 text-brand-700 ring-brand-600 group-hover:bg-brand-50"
                        : "bg-white text-slate-400 ring-slate-300"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={`hidden text-sm font-medium sm:block ${
                    active ? "text-brand-900" : enabled ? "text-slate-600" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span className={`mx-3 h-0.5 flex-1 rounded ${i < current ? "bg-brand-600" : "bg-slate-200"}`} />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-xs font-medium text-slate-600 sm:hidden">
        Step {current + 1} of {steps.length}: {steps[current].label}
      </p>
    </nav>
  );
}
