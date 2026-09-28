import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "./api";
import FieldInput from "./components/FieldInput";
import Portfolio from "./components/Portfolio";
import Results from "./components/Results";
import ScorePreview from "./components/ScorePreview";
import Stepper from "./components/Stepper";
import { Button } from "./components/ui";
import { isVisible, screens as buildScreens, sectionErrors, visibleAnswers } from "./form";
import type { Answers, Result, Schema } from "./types";

type View = "assess" | "portfolio";

export default function App() {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>("assess");
  const [answers, setAnswers] = useState<Answers>({});
  const [screenIdx, setScreenIdx] = useState(0); // === screens.length means Results
  const [furthest, setFurthest] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Result | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [finalResult, setFinalResult] = useState<Result | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.schema().then(setSchema).catch((e) => setLoadError(e.message));
  }, []);

  const screens = useMemo(() => (schema ? buildScreens(schema) : []), [schema]);
  const onResults = screenIdx >= screens.length && screens.length > 0;
  const cleanAnswers = useMemo(() => (schema ? visibleAnswers(schema, answers) : {}), [schema, answers]);

  // Live score preview: re-score (debounced) whenever an answer changes.
  useEffect(() => {
    if (!schema || !Object.keys(cleanAnswers).length) {
      setPreview(null);
      return;
    }
    const ctrl = new AbortController();
    setPreviewLoading(true);
    const t = setTimeout(() => {
      api
        .assess(cleanAnswers, ctrl.signal)
        .then(setPreview)
        .catch(() => {})
        .finally(() => !ctrl.signal.aborted && setPreviewLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [schema, cleanAnswers]);

  if (loadError) return <Centered>Could not reach the assessment API: {loadError}. Is the backend running on port 8000?</Centered>;
  if (!schema) return <Centered>Loading…</Centered>;

  const resultsStep = schema.steps.length - 1;
  const current = onResults ? null : screens[screenIdx];
  const currentStep = onResults ? resultsStep : current!.stepIndex;
  const firstInvalid = screens.findIndex((s) => Object.keys(sectionErrors(s.section, answers)).length > 0);
  const reachableStep = onResults || (firstInvalid === -1 && furthest >= screens.length)
    ? resultsStep
    : screens[Math.min(furthest, screens.length - 1)].stepIndex;

  function goTo(idx: number) {
    setErrors({});
    setScreenIdx(idx);
    setFurthest((f) => Math.max(f, idx));
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function setAnswer(id: string, value: string) {
    setAnswers((a) => ({ ...a, [id]: value }));
    setErrors((e) => {
      if (!e[id]) return e;
      const { [id]: _, ...rest } = e;
      return rest;
    });
  }

  async function showResults() {
    const bad = screens.findIndex((s) => Object.keys(sectionErrors(s.section, answers)).length > 0);
    if (bad !== -1) {
      goTo(bad);
      setErrors(sectionErrors(screens[bad].section, answers));
      return;
    }
    const result = await api.assess(cleanAnswers);
    if (!result.complete) {
      // Server-side validation disagreed (e.g. an invalid value) — send the user to it.
      const fid = Object.keys(result.errors)[0] ?? result.missing_required[0];
      const idx = screens.findIndex((s) => s.section.fields.some((f) => f.id === fid));
      goTo(Math.max(idx, 0));
      setErrors({ ...result.errors, ...Object.fromEntries(result.missing_required.map((m) => [m, "This field is required"])) });
      return;
    }
    setFinalResult(result);
    goTo(screens.length);
  }

  function next() {
    const errs = sectionErrors(current!.section, answers);
    if (Object.keys(errs).length) {
      setErrors(errs);
      document.getElementById(`f-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    if (screenIdx === screens.length - 1) void showResults();
    else goTo(screenIdx + 1);
  }

  function selectStep(stepIndex: number) {
    if (stepIndex === resultsStep) void showResults();
    else goTo(screens.findIndex((s) => s.stepIndex === stepIndex));
  }

  function reset() {
    setAnswers({});
    setSavedId(null);
    setFinalResult(null);
    setFurthest(0);
    setView("assess");
    goTo(0);
  }

  async function save() {
    try {
      const res = savedId ? await api.update(savedId, cleanAnswers) : await api.create(cleanAnswers);
      setSavedId(res.id);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrors(e.fieldErrors);
      throw e;
    }
  }

  async function open(id: number) {
    const saved = await api.get(id);
    setAnswers(saved.answers);
    setSavedId(saved.id);
    setFinalResult(await api.assess(saved.answers));
    setFurthest(screens.length);
    setView("assess");
    setErrors({});
    setScreenIdx(screens.length);
  }

  return (
    <div ref={topRef} className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold text-brand-900">Cloud Suitability Assessment</h1>
            <p className="text-xs text-slate-500">Hard filters → Tech stack → Cloud Native Score &amp; 6R</p>
          </div>
          <nav className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            {(["assess", "portfolio"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 font-medium capitalize ${view === v ? "bg-white text-brand-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                {v === "assess" ? "Assessment" : "Portfolio"}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {view === "portfolio" ? (
          <Portfolio onOpen={open} onNew={reset} />
        ) : (
          <>
            <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
              <Stepper steps={schema.steps} current={currentStep} reachable={reachableStep} onSelect={selectStep} />
            </div>

            {onResults && finalResult ? (
              <Results result={finalResult} answers={cleanAnswers} savedId={savedId} onSave={save} onEdit={() => goTo(0)} onNew={reset} />
            ) : (
              current && (
                <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                  <form
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      next();
                    }}
                    noValidate
                  >
                    <div className="mb-5">
                      {current.countInStep > 1 && (
                        <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
                          Part {current.indexInStep + 1} of {current.countInStep}
                        </p>
                      )}
                      <h2 className="text-xl font-semibold text-slate-900">{current.section.title}</h2>
                      {current.section.description && <p className="mt-1 text-sm text-slate-500">{current.section.description}</p>}
                      <p className="mt-1 text-xs text-slate-400">
                        Fields marked <span className="text-critical">*</span> are required.
                      </p>
                    </div>

                    {Object.keys(errors).length > 0 && (
                      <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">
                        Please complete the highlighted fields before continuing.
                      </p>
                    )}

                    <div className="space-y-5">
                      {current.section.fields
                        .filter((f) => isVisible(f, answers))
                        .map((f) => (
                          <FieldInput key={f.id} field={f} value={answers[f.id] ?? ""} error={errors[f.id]} onChange={(v) => setAnswer(f.id, v)} />
                        ))}
                    </div>

                    <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
                      <Button type="button" variant="secondary" disabled={screenIdx === 0} onClick={() => goTo(screenIdx - 1)}>
                        ← Back
                      </Button>
                      <Button type="submit">{screenIdx === screens.length - 1 ? "Generate report →" : "Next →"}</Button>
                    </div>
                  </form>

                  <aside className="lg:sticky lg:top-6 lg:self-start">
                    <ScorePreview result={preview} loading={previewLoading} />
                  </aside>
                </div>
              )
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6 text-center text-slate-600">{children}</div>;
}
