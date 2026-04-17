

## Connect Profile ↔ Submit data

Right now Profile and Submit are completely disconnected. A user picks conditions on their profile, but Submit doesn't know about them; conversely, submitting data doesn't update profile completeness. Let's tie them together in two directions.

### Direction 1: Profile → Submit (prefill + nudge)

When a user with profile-listed conditions hits **Submit**:

- **Prefill the condition picker.** If `patient_profiles.condition_ids` has entries, the Step 0 condition dropdown defaults to the first one (or shows a "Your conditions" group at the top of the list).
- **Quick-pick chips.** Above the condition select, render small chips for each condition the user follows: "Submit data for: [Lupus] [Fibromyalgia]". Clicking one sets `conditionId` instantly.
- **"Add a condition" inline link.** If the user has *no* conditions on their profile, show a soft note: "Tip: Add your conditions on your profile to skip this step next time." → links to `/profile`.

### Direction 2: Submit → Profile (completeness tracking)

The Profile page should reflect, per-condition, how complete the user's data contribution is.

**New section on Profile: "Your contributions"**

A list/table of the user's conditions (from `condition_ids`), each with a completeness status pulled by querying `submissions` where `submitter_account_id = user.id` grouped by `condition_id`:

| Condition | Status | Action |
|---|---|---|
| Lupus | ✓ Complete (5/5 sections) | Edit |
| Fibromyalgia | ⚠ Incomplete (2/5 sections) | Continue |
| Crohn's | ✗ Not started | Start submission |

**Completeness rule** (computed client-side from the submission's `universal_fields`):
- Section "filled" if it has any non-empty value
- 5 sections tracked: Condition details, Symptoms, Treatments, Demographics, Quality of life
- Status: `Not started` (no submission), `Incomplete` (1–4 sections), `Complete` (5/5)

**Profile header badge.** Small pill near the top: "Profile completeness: 60%" — combines profile fields (sharing mode set, conditions selected, bio if named) + at least one submission per listed condition.

### Direction 3: Auto-suggest profile updates from Submit

After a successful submission for a condition not yet in the user's profile `condition_ids`, show a one-time prompt on the Thank You screen:

> "Add **Lupus** to your profile so peers with the same condition can find you?"
> [Add to profile] [Not now]

Clicking adds the `condition_id` to `patient_profiles.condition_ids` (with upsert if no profile exists yet — defaulting to anonymous mode).

### Files to change

- `src/pages/Submit.tsx` — read user's `patient_profiles.condition_ids`, prefill + chips, post-submit prompt to add condition to profile.
- `src/pages/Profile.tsx` — add "Your contributions" section with per-condition completeness, plus a header completeness pill.
- New small helper (inline or `src/lib/completeness.ts`) — pure function that takes a submission row and returns `{ filledSections, totalSections, status }`.

No DB schema or RLS changes needed — `submissions` is already readable by the submitter and `patient_profiles` already has `condition_ids`.

