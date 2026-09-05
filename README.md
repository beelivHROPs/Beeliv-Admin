# Beeliv-Admin

Serves `admin.beeliv.co` — the Assigned HR and Head of Operations dashboards, extracted from the shared `my-app` prototype repo (`babaloloademola320-glitch/beeliv-hr-ops`) on 2026-09-05, per the project lead's live confirmation of the real subdomain split:

- `beeliv.co` (public landing + recruitment) + `client.beeliv.co` (Client dashboard) → `Beeliv-Client`
- `admin.beeliv.co` (HR + Ops) → **this repo**
- `talent.beeliv.co` (Applicant + Staff, so an applicant can transition into a staff account) → `Beeliv-Staff`

## What's duplicated here, and why

This app carries its own copies of every shared component, hook, and lib file it needs (`components/shared/*`, `components/ui/*`, `hooks/useCountUp.ts`, `lib/*`) rather than depending on a shared package. That's a deliberate, documented tradeoff for this stage — the project is still Stage 1/prototype (see `my-app`'s `CLAUDE.md` and `docs/STAGE-1-MASTER-PLAN.md`), and standing up a real shared-package/monorepo workflow across three separate GitHub repos is its own significant piece of tooling work, not something to bolt on silently while splitting the app. If the three apps diverge on shared UI in the future, that's the moment to revisit this — extracting a real `@beeliv/ui` package (or similar) shared across all three.

**No cross-role links exist in HR/Ops** (verified before this split) — nothing needed rewiring to a cross-subdomain URL here.

## Auth (not yet wired)

No Supabase Auth/session handling exists in this app yet — `app/page.tsx`'s root redirect to `/hr/dashboard` is a structural placeholder, not real role detection. The intended design (see `my-app`'s `docs/STAGE-1-MASTER-PLAN.md` §15 and the reconciliation notes from this split): a shared login on `beeliv.co`, a Supabase Auth session cookie scoped to the parent domain `.beeliv.co` so it's valid across all three subdomains, and a post-login redirect based on the authenticated user's role (from a `profiles` table, not yet created).

## Stage boundary

Same as `my-app`: this is Stage 1 prototype work. No database tables, RLS, or real authentication exist. Every disabled/structural pattern from the source repo (disabled form fields, `title="..."` explanations, etc.) is preserved as-is.
