

The user is describing the architecture for the medical coding layer of the app — this is a substantial backend + data model decision, not an implementation request. Per project conventions I should plan this out before touching schema or code. Let me lay out the proposed implementation so they can approve before I write migrations.

## Plan: ICD-10-CM canonical coding layer

### Design summary
- **Canonical layer**: immutable code records keyed by `(code_system, code_system_version, code)`.
- **Alias layer**: many-to-one patient-facing labels mapped to a canonical code, editable by specialists via moderation.
- **Pending layer**: free-text submissions awaiting moderation, optionally linked to a candidate code from embedding search.
- **Patients never pick codes** — they type free text, the app maps to a code via embedding similarity, and unmatched text becomes a pending entry.
- **Severity / duration / frequency / onset stay on the submission record**, never baked into the code.
- **Specialty scope** lives on each canonical code so specialist edit rights can be scoped (e.g. a rheumatologist can curate rheum codes, not cardiology).

### Code systems supported (versioned)
| System | Use | Notes |
|---|---|---|
| `ICD-10-CM` | Diagnoses + symptoms (Ch. 18) | Primary system; track version (e.g. `2025`) |
| `ICD-10-PCS` | Procedures | US inpatient procedures |
| `ORPHA` | Rare diseases | Layered when ICD is too coarse; can co-exist with an ICD code |
| `RxNorm` | Medications | RXCUI as the code |
| (future) `ICD-11-MMS` / `ICD-11-CM` | Drop-in via mapping table | Designed for; not loaded yet |

### Schema (new tables in `public`)

**`code_systems`** — registry of supported systems
- `id` (text PK, e.g. `'ICD-10-CM'`)
- `name`, `description`, `current_version` (text), `url`

**`medical_codes`** — canonical, immutable code records
- `id` uuid PK
- `code_system` text → `code_systems.id`
- `code_system_version` text (e.g. `'2025'`)
- `code` text (e.g. `'M79.7'`, `'ORPHA:36397'`, `'1234567'` for RxNorm)
- `display` text (official descriptor)
- `kind` enum: `diagnosis | symptom | procedure | medication | finding`
- `specialty_scope` text[] (e.g. `{rheumatology, endocrinology}`; empty = general)
- `parent_code_id` uuid nullable (self-ref for hierarchy)
- `embedding` vector(1536) nullable (for similarity search; pgvector)
- `metadata` jsonb (chapter, block, etc.)
- `retired_at` timestamptz nullable (soft retire — never delete)
- `created_at`
- **Unique** `(code_system, code_system_version, code)`
- **RLS**: public read; insert/update only by admin or specialist with matching `specialty_scope`

**`code_aliases`** — patient-facing labels, many-to-one to a canonical code
- `id` uuid PK
- `medical_code_id` uuid → `medical_codes.id`
- `label` text (e.g. "joint pain", "achy joints")
- `locale` text default `'en'`
- `embedding` vector(1536) nullable
- `created_by` uuid, `approved_by` uuid nullable, `approved_at` timestamptz nullable
- `status` enum: `approved | pending | rejected`
- **RLS**: public read of `approved`; specialists with matching scope can insert/update; admins can do anything

**`pending_code_entries`** — free-text awaiting review
- `id` uuid PK
- `submitted_text` text
- `code_system_hint` text nullable (which system reviewer should target)
- `submission_id` uuid nullable (link back to the submission that produced it)
- `submitter_id` uuid nullable
- `candidate_code_id` uuid nullable (top embedding match)
- `candidate_score` real nullable
- `status` enum: `pending | mapped | new_code_created | rejected`
- `resolved_alias_id` uuid nullable, `resolved_code_id` uuid nullable
- `resolved_by` uuid nullable, `resolved_at` timestamptz nullable
- **RLS**: submitter can read own; specialists/admins can read all and update

**`code_mappings`** — cross-system / cross-version mappings (the ICD-11 swap path)
- `id` uuid PK
- `from_code_id` uuid → `medical_codes.id`
- `to_code_id` uuid → `medical_codes.id`
- `relation` enum: `equivalent | broader | narrower | related`
- `source` text (e.g. `'WHO ICD-10→11 map v2024'`)
- Used to migrate existing data when ICD-11-CM becomes available without rewriting submissions.

### Submission integration
- `submissions.universal_fields.symptoms[]` and `dynamic_fields.treatments[]` change from free strings to objects:
  ```ts
  { code_id: uuid | null, raw_text: string, severity?, duration?, frequency?, onset? }
  ```
- If `code_id` is null, a `pending_code_entries` row is created automatically.
- Aggregation on the condition page (which we just built) keys off `code_id`, falling back to `raw_text` so unmapped data still shows.

### Mapping flow (free text → code)
1. User types "achy joints".
2. Client calls edge function `resolve-medical-term` with `{ text, kind, code_system_hint? }`.
3. Function embeds the text via Lovable AI (`google/text-embedding-004` or similar), runs cosine search against `code_aliases.embedding` and `medical_codes.embedding`, returns top N candidates with scores.
4. UI shows: top match auto-selected if score ≥ threshold; otherwise "We'll add this for review" → creates a `pending_code_entries` row on submit.
5. Specialists work the pending queue: map to existing code, create new alias, or propose a new canonical code (admin approval required for new canonical codes).

### Specialist scoping
- `user_roles` already has `specialist`. Add `specialist_scopes` table:
  - `user_id` uuid, `specialty` text, `granted_by` uuid, `granted_at`
- Helper function `has_specialty(_user_id uuid, _specialty text)` returning bool, SECURITY DEFINER.
- RLS on `code_aliases`/`medical_codes` insert/update checks that at least one of the canonical code's `specialty_scope` entries matches a row in `specialist_scopes` for the user (or user is admin).

### Why this supports an ICD-11 swap later
- Codes are immutable rows tagged with system + version; ICD-11 entries get loaded as new rows in the same table.
- `code_mappings` lets us translate `submissions[*].code_id` from ICD-10 → ICD-11 in a single migration script.
- Aliases are decoupled from the system, so the patient-facing vocabulary survives the swap untouched.

### Implementation phases (suggest doing in order, separate approvals)

**Phase 1 — Schema only** (this plan, if approved)
- Enable `pgvector` extension.
- Create `code_systems`, `medical_codes`, `code_aliases`, `pending_code_entries`, `code_mappings`, `specialist_scopes`.
- RLS + helper functions (`has_specialty`).
- Seed `code_systems` rows; no code data loaded yet.

**Phase 2 — Seed data**
- Load ICD-10-CM 2025 (diagnoses + Ch. 18 symptoms) from CMS public release.
- Load a starter ORPHA subset for the conditions already in the registry.
- Load RxNorm subset (current monthly release).
- Generate embeddings for `display` text.

**Phase 3 — Edge function + UI**
- `resolve-medical-term` edge function (embedding search).
- Update Submit form: free-text inputs with autocomplete from resolver, "add for review" fallback.
- Update aggregation on condition page to key off `code_id`.

**Phase 4 — Specialist moderation queue**
- `/specialists/queue` page: pending entries + alias proposals, scoped by `specialist_scopes`.

**Phase 5 — ICD-11 readiness (no work now)**
- Documented migration path using `code_mappings`.

### Open questions before I write the migration
1. Do you want me to scope **Phase 1 (schema only)** in this round, or also include **Phase 2 seed plumbing** (the loader edge function — without actually running the seed)?
2. For ORPHA + RxNorm: include them in the schema now (just `code_systems` rows), defer loading to Phase 2 — agreed?
3. `pgvector` is required for embedding similarity — OK to enable the extension?
4. Should `pending_code_entries` be visible to the original submitter so they can see the status of their suggestion, or admin/specialist only?

Reply with answers (or "go ahead with Phase 1, defaults") and I'll write the migration.

