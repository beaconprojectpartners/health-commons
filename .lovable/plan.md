# Plan: Moderation system for user-submitted medical terms (Phase 2a — SHIPPED)

> **Status:** Phase 2a landed. Schema + `scrub-phi` (AWS Comprehend Medical behind the `PhiDetector` interface) deployed. See `supabase/functions/scrub-phi/README.md` for operational notes.

Incorporates required changes 1–13 from review. **Phase 2a only**: schema + `scrub-phi` edge function. No UI. No `submit-pending-term` yet (lands in 2b).

---

## Required changes incorporated

1. **Sign-in required for free-text submissions.** Anon-hash dropped. Anon users may pick existing codes only. RLS on `pending_term_occurrences` and `pending_code_entries` insert paths require `auth.role() = 'authenticated'` for free-text. Threshold logic just counts distinct `submitter_id` (uuid not null).
2. **"Curator" → "moderator"** everywhere. Decision action is **"Defer to moderator."** No `curator` enum values or column names anywhere in schema.
3. **No admin-only confirmation on "Approve as new canonical code."** Full-tier specialists in scope can approve directly. Tagged in code as:
   ```
   -- TODO(governance): Approval rights are currently "any specialist in scope OR admin".
   -- Once peer-governance tiers land, gate on required_tier column on moderation_queue_items.
   -- Removal trigger: governance tier system shipped + tier assignment UI live.
   ```
4. **Audit Supabase logging before shipping.** Action item, executed as part of Phase 2a delivery (not a code change but a documented finding in the migration PR description). Plan:
   - Confirm default Edge Function log behavior (request body capture: yes/no by default).
   - For `scrub-phi` and `submit-pending-term` (when it lands), verify no body logging. If unavoidable at platform layer, scrub at function boundary by never letting raw text touch a `console.log`/`console.error`. All thrown errors carry only `{ counts, model_version, phase }`.
   - Findings documented inline in migration PR.
5. **Error-reporter scrubbing.** No Sentry/error-tracker is currently wired in this project (verified — no `@sentry/*` deps, no DSN secret). When one is added later, the policy is:
   - Configure request-data scrubbing on `submit-pending-term` and `scrub-phi`.
   - In code, raw text variables go out of scope (reassigned to `null` or block-scoped) **before** any awaited call that could throw post-scrub.
   - Documented as a project rule in this plan; will be enforced when error tracking is introduced.
6. **Backup retention window — documented.** Lovable Cloud (Supabase) PITR/backup retention applies to all tables. The currently-empty `pending_code_entries.submitted_text` column is being **renamed to `redacted_text`** in 2a (safe — table is empty so no pre-scrub text exists). Going forward, only redacted text is ever written, so the backup window is not a leak vector for *future* data. **No backup-scrubbing pass needed for Phase 2a** because the table is empty. If we ever discover a regression that wrote raw text post-launch, we'll run a targeted backup-scrub pass at that time. **Decision: accept the window (it's empty), document the policy.**
7. **Presidio for PHI Stage 1+2; LLM only for Stage 3 adjudication.** `scrub-phi` pipeline:
   - **Stage 1 — Regex**: phone, email, SSN, MRN-like, dates, addresses, URLs (kept as today, hardened).
   - **Stage 2 — Presidio NER**: Microsoft Presidio is a Python library; we ship it as a *separate* edge runtime. Since Lovable edge functions are Deno-only, Phase 2a implementation: package Presidio behind a small HTTP service deployed alongside (next sub-step within 2a). The Deno `scrub-phi` function calls it. Presidio recognizers used: `PERSON, LOCATION, DATE_TIME, PHONE_NUMBER, EMAIL_ADDRESS, US_SSN, MEDICAL_LICENSE, US_DRIVER_LICENSE, IP_ADDRESS, URL, AGE`. Plus a custom `MRN` recognizer.
   - **Stage 3 — LLM adjudication (low-confidence only)**: spans below Presidio's confidence threshold (e.g. `<0.55`) get sent to Lovable AI (`google/gemini-2.5-flash`) with a tightly-scoped tool-calling schema and the eponym allowlist as context. Ambiguous → redact (fail closed).
   - **Eponym allowlist** post-pass: `PERSON` spans matching `phi_eponym_allowlist` are un-flagged.
   - **No preview models in core path.** Stage 3 uses a stable model.
   - **If Presidio service is unreachable, scrub-phi returns 503.** Never falls back to "regex only" silently.
8. **Show users what was stored after server-side re-scrub (Pattern B).** When `submit-pending-term` lands in 2b, response shape will be `{ status: 'stored' | 'matched' | 'rejected_phi', stored_redacted_text?, match?: {...}, redactions_applied: { ... } }`. UI surfaces `stored_redacted_text` in a confirmation toast/modal so the user sees the final form. (Phase 2a only sets up the schema to support this; the function itself ships in 2b.)
9. **Surface strong-embedding auto-matches to the user.** When 2b's `submit-pending-term` returns `matched: true`, the response includes `{ matched: true, code: {id, display, system}, alias_used?, score }` and the UI shows a "We matched this to **<display>** — wrong? Flag it" affordance. Flag goes to `phi_reports`-equivalent flow (a new `match_reports` table — added to the 2b plan, not 2a).
10. **Rate limiting on submit-pending-term (2b).** Per-user (e.g. 30/hour, 200/day) and per-IP (e.g. 60/hour) caps via a `submission_rate_buckets` table written in 2b. Phase 2a stub: nothing required, noted here so it lands in 2b.
11. **Span coordinates: indexed into ORIGINAL text.** `scrub-phi` response: `spans: [{type, start, end, score}]` where `start`/`end` are character offsets into the **original input string** the caller supplied. `redacted_text` is the original with each span replaced by `[REDACTED:<TYPE>]`. Documented in the function's response schema and a JSDoc comment.
12. **Shadow-review ground-truth = tech debt.** v1 uses any full-access reviewer's decision as ground truth. Plan flags this as **tech debt: real shadow-review signal requires moderator or panel review; revisit when peer-governance tiers ship.**
13. **`required_tier` column on `moderation_queue_items` (reserved).** Added as `text NULL` with a column comment:
    ```sql
    COMMENT ON COLUMN public.moderation_queue_items.required_tier IS
      'Reserved for peer-governance integration. Unused in Phase 2a. When governance ships, populate with the minimum reviewer tier required to act on this item.';
    ```

---

## Architecture overview (unchanged shape, revised wording)

```
User free text  (REQUIRES SIGN-IN to add new)
   │
   ▼
[1] resolve-medical-term  ── embedding similarity → top 5 matches
   │
   ├── user picks a match            → done (link to existing code)
   ├── strong auto-match returned    → confirmation w/ "wrong? flag it"
   │
   └── user clicks "Add new"
         │
         ▼
   [2] scrub-phi (preview)  ── Presidio (regex + NER)  → eponym un-flag
         │                     → LLM Stage 3 only for low-confidence
         ▼
   Preview modal with redactions highlighted
         │
   Confirm
         ▼
   [3] submit-pending-term  ── re-scrubs (final enforcement)
         │                     → rate-limit check
         │                     → response shows final redacted text
         │                     → never stores original text
         ▼
   pending_code_entries (redacted_text only) + occurrence row
         │
         ▼
   Threshold gate: ≥3 occurrences from distinct signed-in users
   (specialist suggestions + content reports bypass)
         │
         ▼
   moderation_queue_items ── reviewers act
         │
         ▼
   On approve: new medical_code or new code_alias  (no admin gate)
```

---

## Schema additions (Phase 2a)

All tables get RLS. All inserts/updates go through helper functions where useful.

### 1. `phi_eponym_allowlist`
- `id` uuid PK
- `term` citext UNIQUE
- `category` text (`disease_eponym`, `procedure_eponym`)
- `added_by` uuid, `created_at`
- **RLS**: public read; admin insert/update.
- **Seed**: Crohn, Hashimoto, Ehlers-Danlos, Sjögren, Behçet, Raynaud, Wegener, Tourette, Asperger, Parkinson, Alzheimer, Huntington, Down, Marfan, Turner, Klinefelter, Kawasaki, Kaposi, Hodgkin, Bell, Charcot, Guillain-Barré, Lou Gehrig, Lyme, **ALS, myasthenia gravis, Stevens-Johnson, Peyronie, Dupuytren, Osler-Weber-Rendu, von Willebrand, Gilbert, Takayasu**.

### 2. Rename `pending_code_entries.submitted_text` → `redacted_text`
- Table is empty → safe rename, no backfill needed.
- Column comment: `'Redacted text only. Original submitter text MUST NEVER be written here. Enforced by submit-pending-term server-side re-scrub.'`

### 3. `pending_term_occurrences`
- `id` uuid PK
- `pending_code_entry_id` uuid → `pending_code_entries.id`
- `submitter_id` uuid **NOT NULL** (sign-in required)
- `created_at`
- UNIQUE `(pending_code_entry_id, submitter_id)` — one occurrence per user per term.
- **RLS**: submitter reads own; specialists/admins read all; insert only by authenticated user where `submitter_id = auth.uid()`.

### 4. `moderation_queue_items`
- `id` uuid PK
- `pending_code_entry_id` uuid → `pending_code_entries.id` UNIQUE
- `priority` int default 0 (specialist=10, report=20)
- `source` enum `moderation_source`: `threshold | specialist_suggestion | content_report`
- `status` enum `moderation_item_status`: `awaiting | in_review | approved_new | mapped_alias | rejected | needs_info | deferred_to_moderator`
- `claimed_by` uuid nullable, `claimed_at` timestamptz
- `decided_by` uuid nullable, `decided_at` timestamptz
- `decision_notes` text (must be scrubbed before save — enforced in 2c)
- `resolution_alias_id` uuid nullable
- `resolution_code_id` uuid nullable
- `rejection_reason` enum nullable: `duplicate | not_medical | phi_leaked | nonsense | out_of_scope | other`
- `shadow_decision` jsonb nullable
- `required_tier` text NULL  ← **reserved for governance, see #13**
- `created_at`, `updated_at`
- **RLS**: full-access specialists in scope OR admins read/update; trainees read-only filtered by `is_calibration` flag (reserved column too).

### 5. `redaction_log`
- `id` uuid PK
- `pending_code_entry_id` uuid nullable
- `moderation_queue_item_id` uuid nullable
- `phase` enum: `client_preview | server_submit | review_rescrub`
- `counts` jsonb (e.g. `{ "PERSON": 1, "PHONE": 0, ... }`)
- `model_version` text
- `created_at`
- **RLS**: admin read only.
- **Never stores text.**

### 6. `reviewer_status`
- `user_id` uuid PK
- `calibration_completed_at` timestamptz
- `calibration_score` real
- `shadow_reviews_completed` int default 0
- `shadow_reviews_required` int default 20
- `full_access_granted_at` timestamptz
- `full_access_granted_by` uuid
- **RLS**: user reads own; admin reads/writes all.

### 7. `calibration_items`
- `id` uuid PK
- `display_text` text (pre-scrubbed seed; safe)
- `expected_decision` text
- `rationale` text
- `active` bool default true
- **RLS**: trainees + reviewers read active rows; admin writes.
- **Calibration size: 15 items**, **80% pass.** (Up from 10 per review feedback.)

### 8. `reviewer_calibration_attempts`
- `id`, `user_id`, `calibration_item_id`, `chosen_decision`, `correct`, `answered_at`
- **RLS**: user reads own; admin reads all.

### 9. `shadow_review_decisions`
- `id`, `moderation_queue_item_id`, `trainee_id`, `trainee_decision` jsonb, `senior_decision` jsonb, `agreement` bool, `created_at`
- Comment: **TECH DEBT — ground truth is "any full-access reviewer." Real signal requires moderator/panel review.**
- **RLS**: trainee reads own; senior reviewers read where they are senior; admin reads all.

### 10. `phi_reports`
- `id`, `moderation_queue_item_id`, `reporter_id`, `reason`, `resolved` bool, `resolution_notes`, `created_at`
- **RLS**: reporter reads own; reviewers/admin read & resolve.

---

## Edge function in Phase 2a: `scrub-phi`

### PHI detection: AWS Comprehend Medical (Stages 1–2), behind a swappable interface

**Decision:** Stages 1+2 of PHI detection use **AWS Comprehend Medical's `DetectPHI`** operation — purpose-built for the 18 HIPAA identifiers, returns structured entity types that map cleanly to our redaction schema. Stage 3 LLM adjudication remains as designed.

**Swap path:** All PHI-provider logic is hidden behind a TypeScript interface inside `scrub-phi`. A future migration to self-hosted Presidio (Fly.io / Cloud Run) is a backend swap, not a rewrite. Documented in code comments and in `supabase/functions/scrub-phi/README.md`.

```ts
// supabase/functions/scrub-phi/providers/types.ts
export interface PhiDetector {
  detectPhi(text: string): Promise<{
    redacted_text: string;
    spans: Array<{ type: string; start: number; end: number; score: number }>;
    counts: Record<string, number>;
    provider: string;        // e.g. 'aws_comprehend_medical'
    model_version: string;   // provider-reported model version
  }>;
}
```

Implementations: `AwsComprehendMedicalDetector` (Phase 2a). Future: `PresidioSidecarDetector` (drop-in).

### Inputs
```ts
{
  text: string,                // original input
  context?: 'symptom'|'treatment'|'condition'|'note'
}
```

### Output
```ts
{
  redacted_text: string,                              // spans replaced with [REDACTED:<TYPE>]
  spans: Array<{ type: string, start: number, end: number, score: number }>, // start/end into ORIGINAL text (#11)
  counts: Record<string, number>,                     // by type
  provider: string,                                   // 'aws_comprehend_medical'
  model_version: string                               // Comprehend's ModelVersion from response, optionally suffixed with adjudication model
}
```

### Pipeline
1. **Regex** (Deno-side) — phone, email, SSN, MRN, dates, addresses, URLs (defense in depth; cheap pre-filter).
2. **AWS Comprehend Medical `DetectPHI`** via the `PhiDetector` interface. Endpoint: `us-east-1` (primary) with `us-west-2` as documented failover region. Maps Comprehend entity types (`NAME, ADDRESS, AGE, DATE, EMAIL, ID, PHONE_OR_FAX, PROFESSION, URL`, etc.) to our internal types. Captures Comprehend's `ModelVersion` for the log.
3. **Eponym allowlist** — Comprehend `NAME`/`ORGANIZATION`-equivalent spans whose text matches `phi_eponym_allowlist` (citext compare) are filtered out. Mitigates Comprehend flagging "Crohn", "Sjögren", etc. as names.
4. **LLM Stage 3 adjudication** — only spans where Comprehend `score < 0.85`; Lovable AI `google/gemini-2.5-flash` w/ tool-calling schema and the eponym list as context. Ambiguous → redact (fail closed).
5. Span merge + sort by `start`, build `redacted_text`.

### Region & BAA
- Endpoint: `us-east-1` (primary), `us-west-2` (failover). Both support Comprehend Medical.
- DxCommons is **not currently a covered entity**, so no BAA is in place. Documented in `supabase/functions/scrub-phi/README.md` so a future operator knows to execute AWS's BAA before scaling beyond research-pilot status.

### Credentials & IAM
- Secrets: `AWS_COMPREHEND_KEY_ID`, `AWS_COMPREHEND_SECRET`, `AWS_COMPREHEND_REGION` (default `us-east-1`).
- IAM user must be scoped to **only** `comprehendmedical:DetectPHI` — no other actions, no broad-access keys, no root credentials. IAM policy example included in the function README.

### Error handling
- On Comprehend timeout or 5xx: **retry once** with exponential backoff (250ms then 1s). On second failure: submission **fails** (no fallback to storing raw text — preserves the existing rule).
- Failure writes a `redaction_log` row with `provider='aws_comprehend_medical'`, `counts={}`, and `error_code` populated (e.g. `comprehend_timeout`, `comprehend_5xx`, `comprehend_throttled`).
- If Comprehend is unreachable end-to-end, scrub-phi returns **503**. Never silently downgrades to "regex only."

### Logging policy
- No `console.log` / `console.error` ever sees `text`.
- `text` is passed only to scrubbers; once `redacted_text` is built, the local `text` variable is reassigned to `''` before any subsequent `await`.
- All errors carry only `{ counts, provider, model_version, phase, error_code }`.
- Supabase Edge Function default body logging: **verified disabled** (documented in PR).

### Cost & swap-trigger documentation
- Comprehend Medical pricing (current): **$0.0014 per 100 characters** for DetectPHI. ~$1.40 per 100k characters.
- Admin dashboard (Phase 2e) shows daily Comprehend call count, character volume, and estimated cost.
- **Swap-evaluation threshold:** when monthly Comprehend spend exceeds **~$300/mo** (≈21M characters), evaluate migrating to self-hosted Presidio on Fly.io. Documented in the function README.

### Schema addition for #2 (revised): `redaction_log`
The table specified earlier in this plan gains two columns to support the provider abstraction:
- `provider` text NOT NULL
- `error_code` text NULL

### What does NOT ship in Phase 2a
- `submit-pending-term` (Phase 2b)
- `report-phi` (Phase 2c)
- Any UI (`MedicalTermPicker`, `PhiPreviewModal`, queue, onboarding, admin dashboard)
- Rate limiting infra (Phase 2b — `submission_rate_buckets`)
- Match-flag table (Phase 2b — `match_reports`)
- Cost dashboard tile (Phase 2e — admin dashboard)

---

## Phase 2a deliverables checklist (so reviewer can verify)

- [ ] Migration: tables 1–10 above + RLS + the `submitted_text` → `redacted_text` rename + column comments + the governance `required_tier` reserved column + `provider` and `error_code` columns on `redaction_log` + `TODO(governance)` comment block on the medical_codes/code_aliases approve path.
- [ ] Seed: `phi_eponym_allowlist` with the full list (originals + ALS, myasthenia gravis, Stevens-Johnson, Peyronie, Dupuytren, Osler-Weber-Rendu, von Willebrand, Gilbert, Takayasu).
- [ ] Secrets requested: `AWS_COMPREHEND_KEY_ID`, `AWS_COMPREHEND_SECRET`, `AWS_COMPREHEND_REGION`.
- [ ] Edge function `scrub-phi` with the `PhiDetector` interface, the `AwsComprehendMedicalDetector` implementation, the documented pipeline, and `README.md` covering: provider swap path, IAM-policy template, region/BAA note, cost model + swap threshold.
- [ ] PR description includes: Supabase logging audit findings, backup retention decision, error-tracker policy, span-coordinate spec, governance TODO removal trigger, shadow-review tech-debt note.

---

## Confirmations before writing the migration

1. **Provider:** AWS Comprehend Medical `DetectPHI` for Stages 1–2, behind the swappable `PhiDetector` interface. ✅ (per this update)
2. **Rename:** `pending_code_entries.submitted_text` → `redacted_text`. Table is empty — safe rename, no backfill.
3. **Secrets:** I'll request `AWS_COMPREHEND_KEY_ID`, `AWS_COMPREHEND_SECRET`, `AWS_COMPREHEND_REGION` as the next step. The user must create an IAM user scoped to `comprehendmedical:DetectPHI` only and paste the credentials in.

Ready to execute Phase 2a — say the word and I'll request the AWS secrets, then write the migration and the `scrub-phi` function.
