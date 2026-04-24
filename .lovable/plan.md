

# Specialist Governance & Moderation System

Build the peer-led specialist governance infrastructure now and operate it manually through Phases 0–1. No patient moderation tier. No "trainee" tier. Researchers are unrelated to specialists.

## Roles (independent)

```text
Patient        default; submits data, participates in community
Researcher    self-registers, signs DUA, gets data access — no credentials
Specialist    NPI + institutional email + document + 3-peer panel approval
              ├─ Contributing  (entry; all edits → moderation queue)
              ├─ Core          (~20 approved + 90 days; in-scope direct edits)
              └─ Moderator     (elected; cross-specialty + dispute oversight)
```

A user can hold any combination. Permission checks are per-view, scoped to the active role.

## What gets built

### 1. Specialist application & vetting (peer panels)

- `/specialists/apply` — collects NPI, institutional email (verified via emailed token), credential document upload, primary specialty confirmation. Calls NPPES API edge function to fetch authoritative name + taxonomy + active status.
- On submit, system assigns a random panel of 3 existing specialists (2 in-specialty, 1 cross-specialty when possible), weighted toward those who haven't served recently.
- `/specialists/panels` — invited panelists see open applications, cast approve / reject / needs-info with written reasoning visible to other panelists. 7-day SLA.
- Approval = 2-of-3 with no unresolved concerns. Auto-grants Contributing tier.
- During Phase 0 (no specialists yet), the founder/admin acts as the panel and all decisions are logged identically.

### 2. Specialty + cluster declaration

- NPI taxonomy is authoritative for specialty; specialist confirms primary if dual-boarded but cannot edit.
- `/specialists/clusters` — opt into disease clusters (MCAS/EDS/POTS, Long COVID, Pediatric rare, Chronic pain, Mental health) seeded at launch. Cluster membership is the "focus not in NPI" escape hatch.
- Periodic NPI re-verification job (90–180 days) flags drift and license loss.

### 3. Tier progression (per specialty + per cluster, independent)

- Contributing → Core auto-promotion eligibility check: ≥20 approved contributions in scope, ≥90 days, no sustained reversals. Promotion logged.
- Tier dashboard at `/specialists` shows progress per scope.

### 4. Moderation queue with scope enforcement

- All vocabulary edits from Contributing specialists go to `moderation_queue_items`.
- Core specialists' in-scope edits apply directly and stream into `vocabulary_edit_log` (public).
- Out-of-scope Core edits route to the queue regardless of tier.
- Existing `/admin/moderation` page becomes `/specialists/moderation`, filtered by viewer's scope (specialty + clusters). Only Core and Moderator tiers see it. Admins see all.
- The `required_tier` column on `moderation_queue_items` becomes `'core' | 'moderator' | 'admin'` (no community tier).

### 5. Elections, juries, recalls (Phase 2-ready, built now)

- `/governance/elections` — annual moderator elections per cluster, staggered 6-month cycles, vote weighting (1.0 own / 0.25 adjacent / 0 unrelated), 2-term limit + 1-term cooldown.
- Recall: 10% of cluster initiates → majority passes.
- Sortition juries: random panels of 5 Core specialists for contested edits, application appeals, moderator action challenges. `/governance/juries`.
- Built and visible from launch; founder operates manually until thresholds hit.

### 6. Transparency layer (public to all signed-in users, including patients)

- `/governance/log` — immutable feed of vocabulary edits, panel decisions, moderator actions, election results, jury reasoning. Aggregate vote patterns visible; individual votes can be private.
- Public review period: significant edits (e.g., new code aliases tagged "high-impact") sit 7 days before taking effect; any signed-in user can flag during the window.

### 7. Emergency powers

- Admins/Moderators can act unilaterally on PHI leaks and harassment. Every emergency action writes to `emergency_action_log` and surfaces in the public transparency feed for post-hoc review.

### 8. Bootstrap phase indicator

- `/governance` shows current Phase (0/1/2/3), the Phase-2 trigger (~50 specialists across 5 clusters), and a public commitment statement. Phase advancement is admin-only and logged.

## Data model additions

- `specialist_applications` — npi, institutional_email, email_verified_at, document_url, primary_taxonomy, secondary_taxonomies, status, decided_at
- `vetting_panels` (id, application_id, sla_due_at) and `vetting_panel_votes` (panel_id, voter_id, vote, reasoning, created_at)
- `specialty_clusters` — id, name, terminology_scope (seed: 5 clusters above)
- `cluster_memberships` (user_id, cluster_id, joined_at)
- `cluster_proposals` (proposer_id, name, scope, supporters[]) for new clusters
- `specialist_tiers` (user_id, scope_type 'specialty'|'cluster', scope_id, tier 'contributing'|'core'|'moderator', granted_at, granted_reason, granted_by)
- `moderator_seats` (cluster_id, scope_type, term_start, term_end, holder_id)
- `elections`, `election_candidates`, `election_votes`, `recalls`, `recall_votes`
- `juries`, `jury_decisions`, `jury_deliberations`
- `vocabulary_edit_log` — immutable, public; references medical_codes/code_aliases/disease_profiles
- `npi_reverification_log` (user_id, checked_at, status, taxonomy_drift)
- `emergency_action_log` (actor_id, target_type, target_id, action, reason, created_at)

Reuse existing: `user_roles`, `specialist_scopes` (deprecate in favor of `specialist_tiers`), `moderation_queue_items`, `phi_reports`, `match_reports`. Drop trainee/calibration UI usage; keep the tables dormant for now (no schema removal yet).

## Routing additions to `App.tsx`

```text
/specialists/apply              public-to-authed application form
/specialists                    specialist hub (tiers, scopes, clusters)
/specialists/panels             invited panel reviews
/specialists/clusters           cluster opt-in
/specialists/moderation         scope-filtered queue (Core+ only)
/specialists/profiles/new       Claude-assisted disease profile authoring
/specialists/profiles/:id/edit
/specialists/aliases            in-scope alias proposals
/governance                     phase indicator + commitments
/governance/log                 public transparency feed
/governance/elections           election center
/governance/juries              jury participation
/admin/specialists              admin: applications, tiers, panels, phases
```

`HowItWorks` Specialist CTA → `/specialists/apply` (signed in) or `/auth?next=/specialists/apply`.

## Edge functions

- `nppes-lookup` — NPPES NPI Registry API proxy (public API, no key required); returns name, taxonomy[], status.
- `verify-institutional-email` — sends/validates token to .edu/.org/hospital domains via existing email infra.
- `assign-vetting-panel` — service-role function to pick 3 specialists with weighting + recency.
- `tier-promotion-check` — nightly job evaluating Contributing→Core eligibility.
- `npi-reverify` — periodic re-check job.
- Reuse `claude-profile-draft`, `claude-code-suggest` inside specialist tools.

## Phase 0/1 operating mode

All structures live; founder/admin can act as panel-of-1, jury-of-1, election-of-0 with every decision recorded in the same logs the elected system will use. `/governance` displays current phase and the public Phase-2 trigger. No code paths short-circuit transparency.

## Out of scope for this build

- No patient moderation tier or `community_votes` table.
- No trainee/calibration/shadow-review UI; existing tables remain untouched but unused.
- Researcher flow unchanged (already uses DUA model via `researchers` table).
- Rate limiting on submission viewing (correlation defense) is a known gap; logged in `/governance` roadmap, not implemented now.

