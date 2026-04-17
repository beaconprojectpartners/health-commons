

User likes the prior condition page plan and wants symptom/treatment lists to show a count badge of how many patients reported each item. Quick refinement plan.

## Refinement: Add count badges to aggregated lists

### What changes
- **Symptoms section**: each row shows the symptom name, a `Badge` with the patient count (e.g. `142`), and a percentage bar (% of submissions for this condition that reported it). Sorted by count desc.
- **Treatments section**: same pattern — name, count badge, % bar. If we capture helpfulness later, add a small avg-rating chip next to the count.
- **Comorbidities tile** (in the at-a-glance strip): also gets count badges next to each comorbidity name.
- **Scoring Tools / Labs / Imaging / Criteria**: stay as curated lists from `disease_profiles` (no badges — these aren't patient-reported).

### Visual pattern
```text
Fatigue          [ 142 ]  ████████████░░░░  78%
Joint pain       [ 119 ]  ██████████░░░░░░  65%
Brain fog        [  87 ]  ███████░░░░░░░░░  47%
```
Badge uses the existing `src/components/ui/badge.tsx` (`secondary` variant). Bar is a thin div with `bg-primary/20` fill.

### Empty / low-data states
- If a condition has < 5 submissions: hide the % bar, show only the count, and render a small note: "Based on N submissions — more data needed for reliable percentages."
- If 0 submissions: hide the section entirely and show a single CTA card: "Be the first to share your experience."

### Data approach (v1, no schema change)
- Client-side aggregation: fetch `submissions` filtered by `condition_id`, walk `universal_fields.symptoms` and `dynamic_fields.treatments` arrays, count occurrences, divide by total submissions for %.
- Cap at top 15 per section with a "Show all" toggle.
- Total submission count comes from `conditions.submission_count` (already in the hero).

### Later (v2, optional)
- Add a SQL view `condition_symptom_counts` / `condition_treatment_counts` for performance once submissions per condition exceed a few hundred.

### Files affected (when implementing)
- `src/pages/ConditionDetail.tsx` — wire aggregation + render
- New: `src/components/condition/AggregatedList.tsx` — reusable name + count badge + bar row
- Reuse existing `Badge` from `src/components/ui/badge.tsx`

No other changes to the previously approved plan.

