

## Community page rebuild — full plan

### Why your named profile didn't appear

1. Community page hides your own profile by design (you only see *others*).
2. Profile creation never collects `condition_ids`, so the RLS policy `Named profiles visible to peers` (which requires a shared condition) returns nothing.
3. The condition filter also finds nothing because no profile has conditions tagged.

Fix the data first, then rebuild the page around it.

### 1. Profile: collect conditions (prerequisite)

Update `src/pages/Profile.tsx`:
- Add a multi-select **My conditions** (reads `conditions`, writes `patient_profiles.condition_ids`).
- Available for all sharing modes.
- Helper text: "Selecting conditions lets you see and connect with peers who share them."

### 2. Community page structure

New layout for `src/pages/Community.tsx`, top to bottom:

**a. Header + medical disclaimer** (keep existing).

**b. Anonymity guard** — if `sharing_mode != 'named'`, soft prompt: "You're browsing anonymously. Switch to a Named profile so peers can wave back." → links to `/profile`.

**c. Snapshot stat row**
- Conditions you follow
- Peers visible to you
- Pending waves received
- Active conversations

**d. Filter bar** — defaults to "Conditions I follow" (with "All" option).

**e. People with your conditions** (primary section — table + accordion)

Table columns:

| Column | Content |
|---|---|
| Name | Avatar initial + display name |
| Shared conditions | Badges for overlap |
| Bio (short) | Truncated first line |
| Actions | Wave / Chat |

Each row is an `AccordionItem` (header row = trigger, expanded row spans all columns) revealing:
- Full bio
- All listed conditions
- Aggregated symptoms/treatments from their public submissions (`submissions` where `submitter_account_id = peer.user_id` and `sharing_preference in ('anonymized_public','named_public')`)
- Inline Wave + Chat

Empty states:
- No conditions on profile → CTA to `/profile`.
- Conditions set, no peers → "No named peers yet for [Condition]."

Mobile (≤768px): collapse table to stacked accordion cards (table doesn't fit at 990px and below).

**f. Waves inbox** — list received waves (who, which condition, "Wave back" / "Open chat"). Mark `waves.seen_at` when viewed.

**g. Conversations** — counterparties from `messages`, unread counts, last preview, click opens `SimpleChat`.

**h. Community pulse** (public-friendly)
- Top conditions by `submission_count`
- Recently active conditions → link to `/conditions/:slug`

### Files to change

- `src/pages/Profile.tsx` — add conditions multi-select.
- `src/pages/Community.tsx` — full restructure with table + accordion peer list, waves inbox, conversations, pulse.
- No DB schema or RLS changes needed.

### Components used
Existing `Table`, `Accordion`, `Badge`, `Select`, `Button` from `src/components/ui/`.

