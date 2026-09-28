// Client-side mirror of backend/cloudsuit/schema.py visibility + required rules,
// so the form can hide fields and validate instantly without a round trip.

import type { Answers, Field, Schema, Section } from "./types";

export function isVisible(field: Field, answers: Answers): boolean {
  const cond = field.show_if;
  return !cond || cond.in.includes(answers[cond.field] ?? "");
}

export function sectionErrors(section: Section, answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of section.fields) {
    if (f.required && isVisible(f, answers) && !(answers[f.id] ?? "").trim()) {
      errors[f.id] = "This field is required";
    }
  }
  return errors;
}

/** Drop answers to fields that are currently hidden (e.g. hardware details when dependency = No). */
export function visibleAnswers(schema: Schema, answers: Answers): Answers {
  const out: Answers = {};
  for (const s of schema.sections)
    for (const f of s.fields) if (answers[f.id]?.trim() && isVisible(f, answers)) out[f.id] = answers[f.id];
  return out;
}

export interface Screen {
  stepIndex: number;
  section: Section;
  indexInStep: number;
  countInStep: number;
}

/** One screen per section; the Results step has no sections and is handled separately. */
export function screens(schema: Schema): Screen[] {
  const byId = Object.fromEntries(schema.sections.map((s) => [s.id, s]));
  return schema.steps.flatMap((step, stepIndex) =>
    step.sections.map((sid, i) => ({ stepIndex, section: byId[sid], indexInStep: i, countInStep: step.sections.length })),
  );
}
