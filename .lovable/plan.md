
## Plan: Rewrite README.md as a developer onboarding doc

The current README is a one-line placeholder. I'll replace it with a focused doc that tells AI agents and human contributors what they need to safely change code in this repo.

### Sections to include

1. **About DxCommons** — one-paragraph summary of the three user types (patients, researchers, specialists), the data-sharing model (private / anonymous / identified, opt-in researcher contact), and the public-vs-auth pages rule.

2. **Tech stack** — React 18 + Vite 5 + TS 5, Tailwind v3, shadcn/ui, React Router v6, TanStack Query, React Hook Form + Zod, Lovable Cloud (Supabase) for DB / auth / storage / edge functions, Stripe for researcher API billing, Vitest for tests.

3. **Local development** — install with `npm i` / `bun i`, scripts (`dev`, `build`, `build:dev`, `lint`, `test`, `test:watch`, `preview`), required env vars (auto-injected by Lovable: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`; build-time `VITE_PAYMENTS_CLIENT_TOKEN`).

4. **Project layout** — short tree of `src/pages`, `src/components`, `src/components/ui`, `src/hooks`, `src/lib`, `src/integrations/supabase`, `supabase/functions`, `supabase/migrations`, with one-line purpose for each.

5. **Routes** — table of the routes in `App.tsx` and which require auth.

6. **Backend (Lovable Cloud)** — key tables (`patient_profiles`, `submissions`, `conditions`, `researchers`, `user_roles`, `messages`, `subscribers`), the `app_role` enum + `has_role` SECURITY DEFINER pattern, where to find generated types (`src/integrations/supabase/types.ts` — DO NOT edit), and the supabase client import path.

7. **Edge functions** — list each function in `supabase/functions/` (`create-checkout`, `create-portal-session`, `payments-webhook`, `dataset-api`, `dataset-search`) with a one-liner on what it does and which require auth. Note shared helpers in `_shared/`.

8. **Database migrations** — explain that schema changes go through new timestamped files in `supabase/migrations/`, never edit existing migrations, prefer validation triggers over CHECK constraints, never touch `auth` / `storage` / `realtime` / `supabase_functions` / `vault` schemas.

9. **Conventions & guardrails** (the part agents most need):
   - Never edit `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, or `.env`.
   - Roles live in `user_roles` only — never on profiles. Always check via `has_role()`.
   - Condition detail pages are public; do not gate them behind auth.
   - Use the design tokens in `src/index.css` and `tailwind.config.ts` — no hard-coded hex colors in components.
   - Use shadcn primitives in `src/components/ui` rather than installing new UI libs.
   - Use `@/` alias for imports from `src`.
   - Forms: React Hook Form + Zod via `@hookform/resolvers`.
   - Data fetching: TanStack Query, not bare `useEffect` + fetch.

10. **Testing** — Vitest + Testing Library, setup in `src/test/setup.ts`, example in `src/test/example.test.ts`, run with `npm test`.

11. **Deployment** — handled by Lovable; preview at `id-preview--…lovable.app`, published at `health-commons.lovable.app`, custom domain `dxcommons.com`. Edge functions auto-deploy on push.

12. **Security notes** — link to `docs.lovable.dev/features/security`, mention that there are open findings (researcher API key WITH CHECK, realtime channel auth on `messages`, `user_roles` self-insert) that should be addressed before launch.

### Files touched
- `README.md` (overwrite the placeholder)

No code, schema, or config changes.
