// Shapes returned by the FastAPI backend (backend/cloudsuit).

export type Answers = Record<string, string>;

export interface Option {
  value: string;
  label: string;
}

export interface Field {
  id: string;
  label: string;
  type: "select" | "text" | "textarea";
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: Option[];
  show_if?: { field: string; in: string[] };
  origin?: "instructions" | "added";
  /** Auto-generated "Additional Information" box (not counted in Data Completeness). */
  additional?: boolean;
}

export interface TechCheck {
  status: "ok" | "missing_version" | "suggestion" | "unrecognized" | "empty";
  message: string;
  /** For "suggestion": the whole input with the misspelling corrected. */
  suggestion: string;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  fields: Field[];
}

export interface Step {
  id: string;
  label: string;
  sections: string[];
}

export interface Schema {
  steps: Step[];
  sections: Section[];
  completeness_groups: { label: string; sections: string[] }[];
}

export type Rating = "cloud_ready" | "needs_upgrade" | "not_suitable" | "na";
export type SixR = "rehost" | "replatform" | "refactor" | "retire" | "replace" | "retain";

export interface Band {
  min: number;
  label: string;
  level: "high" | "medium" | "low" | "very_low";
}

export interface Result {
  application: { project: string; name: string; id: string; manager: string; date: string };
  cloud_suitability: { suitable: boolean; label: string };
  complete: boolean;
  missing_required: string[];
  errors: Record<string, string>;
  answers: Answers;
  phase1: {
    triggered: boolean;
    status: "PASS" | "TRIGGERED";
    filters: { id: string; reason: string; outcome: string; recommendation: SixR }[];
  };
  phase2: {
    components: {
      id: string;
      label: string;
      input: string;
      rating: Rating;
      rating_label: string;
      matched: string;
      detail: string;
      verification_required: boolean;
      check: TechCheck;
    }[];
    overall: "fully_ready" | "conditional" | "not_suitable";
    overall_label: string;
  };
  phase3: {
    dimensions: { id: string; label: string; short: string; weight: number; score: number; answer: string; answered: boolean }[];
    total: number;
    max: number;
    band: Band;
  };
  recommendation: {
    code: SixR;
    label: string;
    headline: string;
    definition: string;
    rule: number;
    rationale: string[];
    next_steps: string[];
    notes: string[];
  };
  risks: { severity: "high" | "medium" | "low"; message: string }[];
  on_premise_dependencies: { id: string; label: string; detail: string }[];
  additional_info: { section: string; text: string }[];
  six_r_definitions: Record<SixR, string>;
}

/** One line of the Admin table. */
export interface AdminRow {
  s_no: number;
  id: number;
  project: string;
  app_id: string;
  app_name: string;
  suitable: boolean;
  suitability: string;
  recommendation: SixR;
  recommendation_headline: string;
  /** Only set for cloud-suitable applications. */
  score: number | null;
  rationale: string[];
  updated_at: string;
}

export interface ProjectSummary {
  project: string;
  total: number;
  suitable: number;
  not_suitable: number;
  six_r: Partial<Record<SixR, number>>;
  rows: AdminRow[];
}
