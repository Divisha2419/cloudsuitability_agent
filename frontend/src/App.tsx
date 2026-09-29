import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "./api";
import FieldInput from "./components/FieldInput";
import Portfolio from "./components/Portfolio";
import Results from "./components/Results";
import ReadinessPanel from "./components/ReadinessPanel";
import Stepper from "./components/Stepper";
import { Button, DeloitteLogo } from "./components/ui";
import { TECH_FIELDS, isVisible, normText, screens as buildScreens, sectionErrors, visibleAnswers } from "./form";
import type { Answers, Result, Schema, TechCheck } from "./types";

type View = "assess" | "portfolio";

interface TechAlert {
  /** The answers the alert was shown for; clicking Next again with the same answers continues. */
  key: string;
  items: { fid: string; label: string; check: TechCheck }[];
}

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
  const [techAlert, setTechAlert] = useState<TechAlert | null>(null);
  // Tech-stack fields the user has left at least once; their version check shows from then on.
  const [touched, setTouched] = useState<Set<string>>(new Set());
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
    setTechAlert(null);
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

  async function next() {
    const errs = sectionErrors(current!.section, answers);
    if (Object.keys(errs).length) {
      setErrors(errs);
      document.getElementById(`f-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    // Tech-stack entries: point out missing versions, misspellings and unrecognised
    // products under each field once; clicking Next again with the same entries continues.
    const techFields = current!.section.fields.filter(
      (f) => TECH_FIELDS.includes(f.id) && isVisible(f, answers) && (answers[f.id] ?? "").trim(),
    );
    if (techFields.length) {
      const res = await api.assess(cleanAnswers);
      setPreview(res);
      const items = techFields
        .map((f) => ({ fid: f.id, label: f.label, check: res.phase2.components.find((c) => c.id === f.id)!.check }))
        .filter((i) => i.check.status !== "ok" && i.check.status !== "empty");
      const key = JSON.stringify(items.map((i) => [i.fid, normText(answers[i.fid] ?? "")]));
      if (items.length && techAlert?.key !== key) {
        setTechAlert({ key, items });
        setTouched((t) => new Set([...t, ...items.map((i) => i.fid)]));
        setTimeout(() => {
          const el = document.getElementById(`f-${items[0].fid}`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          el?.focus();
        }, 50);
        return;
      }
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
    setTouched(new Set());
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

  function hintFor(fid: string): TechCheck | null {
    if (!TECH_FIELDS.includes(fid)) return null;
    const text = normText(answers[fid] ?? "");
    const c = preview?.phase2.components.find((x) => x.id === fid);
    if (!text || !c || normText(c.input) !== text) return null;
    if (c.check.status === "suggestion" || c.check.status === "unrecognized") return c.check;
    // Missing versions are pointed out once the user has left the field (or clicked Next).
    if (c.check.status === "missing_version" && touched.has(fid)) return c.check;
    return null;
  }

  return (
    <div ref={topRef} className="min-h-screen">
      <header className="border-b border-ink-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-4 py-4">
            <DeloitteLogo className="text-[28px]" />
            <span className="h-7 w-px bg-ink-line" aria-hidden />
            <div>
              <p className="text-[17px] font-bold leading-tight text-ink">Cloud Suitability Assessment</p>
              <p className="text-xs text-ink-muted">Application disposition &amp; cloud readiness</p>
            </div>
          </div>
          <nav className="flex gap-6 self-stretch text-[15px]">
            {(["assess", "portfolio"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`border-b-[3px] px-1 pt-1 font-semibold transition ${
                  view === v ? "border-brand-400 text-ink" : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {v === "assess" ? "Assessment" : "Portfolio"}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {view === "portfolio" ? (
          <Portfolio onOpen={open} onNew={reset} />
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-[28px] font-bold leading-tight text-ink">Application Cloud Suitability</h1>
              <p className="mt-1 text-[15px] text-ink-muted">
                Capture the business and technical attributes of an application to assess its cloud readiness, 6R disposition and
                on-premise dependencies.
              </p>
            </div>
            <div className="mb-6 rounded-md border border-ink-line bg-white px-4 py-4 shadow-sm sm:px-6">
              <Stepper steps={schema.steps} current={currentStep} reachable={reachableStep} onSelect={selectStep} />
            </div>

            {onResults && finalResult ? (
              <Results result={finalResult} answers={cleanAnswers} savedId={savedId} onSave={save} onEdit={() => goTo(0)} onNew={reset} />
            ) : (
              current && (
                <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
                  <form
                    className="rounded-md border border-ink-line bg-white p-5 shadow-sm sm:p-7"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void next();
                    }}
                    noValidate
                  >
                    <div className="mb-6">
                      {current.countInStep > 1 && (
                        <p className="text-xs font-bold uppercase tracking-wider text-brand-600">
                          Part {current.indexInStep + 1} of {current.countInStep}
                        </p>
                      )}
                      <h2 className="text-[22px] font-bold text-ink">{current.section.title}</h2>
                      {current.section.description && <p className="mt-1 text-[15px] text-ink-muted">{current.section.description}</p>}
                      <p className="mt-1 text-xs text-ink-muted">
                        Fields marked <span className="font-bold text-brand-600">*</span> are mandatory.
                      </p>
                    </div>

                    {Object.keys(errors).length > 0 && (
                      <p role="alert" className="mb-5 rounded border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-[#7a4700]">
                        Please complete the highlighted fields before continuing.
                      </p>
                    )}

                    <div className="space-y-6">
                      {current.section.fields
                        .filter((f) => isVisible(f, answers))
                        .map((f) => (
                          <FieldInput
                            key={f.id}
                            field={f}
                            value={answers[f.id] ?? ""}
                            error={errors[f.id]}
                            hint={hintFor(f.id)}
                            onChange={(v) => setAnswer(f.id, v)}
                            onBlur={TECH_FIELDS.includes(f.id) ? () => setTouched((t) => new Set(t).add(f.id)) : undefined}
                          />
                        ))}
                    </div>

                    {techAlert && (
                      <p role="alert" className="mt-6 text-[13px] text-[#7a4700]">
                        Please review the technology stack details highlighted above, or click Next again to continue as entered.
                      </p>
                    )}

                    <div className="mt-8 flex items-center justify-between border-t border-ink-line pt-5">
                      <Button type="button" variant="secondary" disabled={screenIdx === 0} onClick={() => goTo(screenIdx - 1)}>
                        ← Back
                      </Button>
                      <Button type="submit">{screenIdx === screens.length - 1 ? "Generate report →" : "Next →"}</Button>
                    </div>
                  </form>

                  <aside className="lg:sticky lg:top-6 lg:self-start">
                    <ReadinessPanel schema={schema} answers={cleanAnswers} result={preview} loading={previewLoading} />
                  </aside>
                </div>
              )
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-ink-muted sm:px-6">Private and confidential</footer>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6 text-center text-ink-muted">{children}</div>;
}
