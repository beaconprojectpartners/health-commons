# DxCommons

A community-driven health data platform where patients describe their diagnoses, symptoms, and treatments, and researchers can explore the resulting dataset under transparent consent rules.

> **Live URLs**
> - Preview: `https://id-preview--<project-id>.lovable.app`
> - Published: `https://health-commons.lovable.app`
> - Custom domain: `https://dxcommons.com`

---

## 1. About DxCommons

DxCommons has three user types:

- **Patients** create profiles describing their conditions, symptoms, and treatments. Each submission is marked as **private**, **anonymous**, or **identified**, and patients can opt in to being contacted by researchers.
- **Researchers** explore the dataset through a visual UI, file downloads, or a paid API.
- **Specialists** (verified) curate the per-condition schema: symptom lists, test types, scoring tools, and dynamic question sets.

**Public-vs-auth rule:** Individual condition pages (`/conditions/:slug`) and the conditions index are **public** — never gate them behind sign-in. Contribution actions (submitting, messaging, accessing the API) require auth.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite 5 + TypeScript 5 |
| Styling | Tailwind CSS v3 + shadcn/ui (Radix primitives) |
| Routing | React Router v6 |
| Data fetching | TanStack Query |
| Forms | React Hook Form + Zod (`@hookform/resolvers`) |
| Backend | Lovable Cloud (Supabase) — Postgres, Auth, Storage, Edge Functions |
| Payments | Stripe (researcher API billing) |
| Tests | Vitest + Testing Library |

---

## 3. Local development

```bash
npm install        # or: bun install
npm run dev        # start Vite dev server
npm run build      # production build
npm run build:dev  # dev-mode build
npm run lint       # eslint
npm test           # vitest (run once)
npm run test:watch # vitest watch
npm run preview    # preview built app
```

### Environment variables

`.env` is **auto-managed by Lovable Cloud — do not edit by hand**. It provides:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Build-time only:

- `VITE_PAYMENTS_CLIENT_TOKEN` — Stripe publishable client token used during build.

Edge function secrets (server-side, set via Lovable Cloud secrets, never committed):

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `LOVABLE_API_KEY` (AI Gateway)
- Standard Supabase service vars are auto-injected.

---

## 4. Project layout

```
src/
  pages/                  # Route components (one file per route)
  components/             # Feature components (Navbar, Footer, DatasetSearch, …)
  components/ui/          # shadcn/ui primitives — prefer these over new libs
  hooks/                  # useAuth, useSubscription, use-toast, use-mobile
  lib/                    # Pure helpers (utils, completeness scoring)
  integrations/
    supabase/             # client.ts + types.ts — AUTO-GENERATED, do not edit
    lovable/              # Lovable platform integration
  test/                   # Vitest setup + examples
supabase/
  config.toml             # Project + per-function config (do not change project_id)
  functions/              # Edge functions (Deno)
    _shared/              # Shared helpers (stripe, scrub)
  migrations/             # Timestamped SQL migrations — append-only
```

---

## 5. Routes

Defined in `src/App.tsx`.

| Path | Component | Auth required |
|---|---|---|
| `/` | `Index` | No |
| `/auth` | `Auth` | No (sign in / up) |
| `/conditions` | `Conditions` | **No (public)** |
| `/conditions/:slug` | `ConditionDetail` | **No (public)** |
| `/submit` | `Submit` | Yes (patient) |
| `/profile` | `Profile` | Yes |
| `/community` | `Community` | Yes |
| `/researchers` | `Researchers` | Yes (researcher) |
| `*` | `NotFound` | No |

---

## 6. Backend (Lovable Cloud)

### Key tables

| Table | Purpose |
|---|---|
| `patient_profiles` | One row per patient (display name, bio, condition list, sharing/contact prefs) |
| `submissions` | Submitted condition data (`universal_fields`, `dynamic_fields`, sharing pref) |
| `submission_pii` | PII split out from submissions, stricter RLS |
| `conditions` | Catalog of conditions (slug, ICD-10, approved flag) |
| `disease_profiles` | Specialist-authored schemas per condition (criteria, labs, imaging, scoring) |
| `researchers` | Researcher metadata + API key |
| `api_usage` / `download_log` | Researcher metering |
| `user_roles` | **Only place roles live.** Enum `app_role`: `admin` \| `specialist` \| `researcher` |
| `messages` / `waves` | Patient ↔ researcher contact (consent-gated) |
| `subscriptions` | Stripe subscription state |

### Roles & RLS pattern

Roles are checked via the `SECURITY DEFINER` function `public.has_role(_user_id uuid, _role app_role)`. **Never** store roles on `patient_profiles` or any user-facing table — this prevents privilege escalation. RLS policies must call `has_role(auth.uid(), 'admin')` rather than reading roles directly.

### Supabase client

```ts
import { supabase } from "@/integrations/supabase/client";
```

Generated DB types live in `src/integrations/supabase/types.ts`. **Both files are auto-generated — do not edit manually.**

---

## 7. Edge functions

Located in `supabase/functions/`. They auto-deploy on push.

| Function | Purpose | Auth |
|---|---|---|
| `create-checkout` | Start Stripe checkout for researcher subscription | User JWT |
| `create-portal-session` | Open Stripe billing portal | User JWT |
| `payments-webhook` | Stripe webhook → updates `subscriptions` | Stripe signature (no JWT) |
| `dataset-api` | Public researcher API; auths via `researchers.api_key` + active subscription | API key |
| `dataset-search` | AI-assisted dataset search via Lovable AI Gateway | User JWT |

`_shared/` contains `stripe.ts` (Stripe client) and `scrub.ts` (PII scrubbing for outbound payloads).

Per-function config (e.g. `verify_jwt = false` for webhooks) lives in `supabase/config.toml`. Most functions deploy with `verify_jwt = false` and verify auth themselves; do not change project-level fields in that file.

---

## 8. Database migrations

- All schema changes go through **new** timestamped files in `supabase/migrations/`. Never edit an existing migration.
- Use the migration tool — it handles approval and applies the SQL.
- Prefer **validation triggers** over `CHECK` constraints (Postgres requires CHECKs to be immutable, which breaks time-based or large-payload validations).
- **Never** modify the `auth`, `storage`, `realtime`, `supabase_functions`, or `vault` schemas. No triggers on tables in those schemas.
- Never include `ALTER DATABASE postgres` statements.

---

## 9. Conventions & guardrails

Read this section before changing anything.

**Files you must never edit:**

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `.env` (and `.env.development`)
- Anything in `supabase/migrations/` that already exists

**Code conventions:**

- Use the `@/` alias for all imports from `src`.
- **Roles** live only in `user_roles`. Always check via `has_role()`.
- **Condition detail pages are public.** Do not redirect or gate `/conditions` or `/conditions/:slug` behind auth.
- **Design tokens only.** Use the HSL semantic tokens defined in `src/index.css` and `tailwind.config.ts`. No hard-coded hex colors, no `text-white`/`bg-black` in components — extend the token system instead.
- **UI components:** use the shadcn primitives in `src/components/ui` before reaching for a new library.
- **Forms:** React Hook Form + Zod via `@hookform/resolvers`.
- **Data fetching:** TanStack Query, not bare `useEffect` + `fetch`.
- **Auth state:** use `useAuth` from `src/hooks/useAuth.tsx`. Subscription state via `useSubscription`.

**AI / backend:**

- Prefer the Lovable AI Gateway (`LOVABLE_API_KEY`) over user-supplied API keys when the model is supported (`google/gemini-*`, `openai/gpt-5*`).
- Edge functions that touch user data must validate the JWT via `supabase.auth.getUser(token)` before doing work.

---

## 10. Testing

- **Runner:** Vitest with jsdom.
- **Setup:** `src/test/setup.ts` (Testing Library matchers).
- **Example:** `src/test/example.test.ts`.
- Run: `npm test` (single run) or `npm run test:watch`.

Add tests next to the code they cover (`Foo.test.tsx` next to `Foo.tsx`) or under `src/test/`.

---

## 11. Deployment

Deployment is handled by Lovable — there is no separate CI pipeline.

- Pushing to `main` updates the preview at `id-preview--<project-id>.lovable.app`.
- Publishing from the Lovable UI promotes to `health-commons.lovable.app` and the custom domain `dxcommons.com`.
- Edge functions in `supabase/functions/` auto-deploy on every change.
- Database migrations apply when their migration tool call is approved.

---

## 12. Security notes

See https://docs.lovable.dev/features/security for the platform security model.

**Known open findings to address before public launch:**

- `researchers` insert policy needs a `WITH CHECK` clause to prevent users from creating researcher rows for other `user_id`s.
- Realtime channel auth on `messages` should verify the subscriber is the sender or receiver before delivering events.
- `user_roles` insert policy must prevent self-insert of `admin`/`specialist` roles (only admins may grant elevated roles).

When fixing security findings, always add a regression test or RLS policy test where feasible, and re-run the security scan to confirm the finding is closed.
