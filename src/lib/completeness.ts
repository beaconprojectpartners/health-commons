// Section completeness helper for submissions

export type CompletenessStatus = "not_started" | "incomplete" | "complete";

export const TRACKED_SECTIONS = [
  "Condition details",
  "Symptoms",
  "Treatments",
  "Demographics",
  "Quality of life",
] as const;

const hasValue = (v: any): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v).some(hasValue);
  return true;
};

export interface CompletenessResult {
  filledSections: number;
  totalSections: number;
  status: CompletenessStatus;
  sections: Record<string, boolean>;
}

export function getCompleteness(submission: { universal_fields?: any } | null | undefined): CompletenessResult {
  const total = TRACKED_SECTIONS.length;
  if (!submission) {
    return {
      filledSections: 0,
      totalSections: total,
      status: "not_started",
      sections: Object.fromEntries(TRACKED_SECTIONS.map((s) => [s, false])),
    };
  }

  const u = submission.universal_fields || {};
  const sections: Record<string, boolean> = {
    "Condition details": [u.diagnosis_status, u.year_of_diagnosis, u.time_to_diagnosis, u.providers_count, u.misdiagnoses].some(hasValue),
    Symptoms: hasValue(u.symptoms),
    Treatments: hasValue(u.treatments),
    Demographics: hasValue(u.demographics),
    "Quality of life": hasValue(u.quality_of_life),
  };

  const filled = Object.values(sections).filter(Boolean).length;
  return {
    filledSections: filled,
    totalSections: total,
    status: filled === 0 ? "not_started" : filled === total ? "complete" : "incomplete",
    sections,
  };
}
