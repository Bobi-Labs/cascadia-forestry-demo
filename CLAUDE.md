# CLAUDE.md. cascadia-forestry-demo

## ⚠️ Session-start checklist. READ THIS FIRST, EVERY TIME

1. **Read `~/.claude/projects/C--dev-cascadia-forestry-demo/memory/session_history.md` in full.** It's the briefing.
2. **Read these umbrella feedback files** (they apply here):
   - `~/.claude/projects/C--dev-mastjoba-dev/memory/feedback_voice_no_ai_tells.md` (voice rules, strict)
   - `~/.claude/projects/C--dev-mastjoba-dev/memory/feedback_client_facing_quality.md` (client trust framing)
3. **Read `TODO.md`** in this repo for the live work list.
4. **Read `C:/dev/mastjoba-dev/docs/STRATEGY.md`** for umbrella context (this demo is a sub-product of the Bobi Labs studio).
5. **Run a health check.** `./ops.sh build` should NOT pass yet (10 broken imports from the strip pass). That's expected at this checkpoint.
6. **Summarize current state back to the user before proposing changes.**
7. **One commit per logical change.** No "while I'm at it" bundling.

If anything here conflicts with a memory file, the memory file wins.

## What this repo is

Public read-only demo of the Cascadia Forestry operations platform. **Not** the client engagement. Source code was cloned at a point in time from `Cascadia-Forestry/cascadia-ramos-forestry-project` (private client repo). This repo evolves independently as a portfolio asset for Bobi Labs.

**Goal:** clickable demo at `bobilabs.dev/forestry-demo` that lets prospects experience the actual UI with synthetic data. Conversion asset for the studio's Cascadia case study.

## Hard rules

1. **Never connect to the client Supabase** (`zcimpedwjwwmxooaxtsw`). Demo has NO Supabase, runs entirely off `lib/mock-data.ts`. If env vars accidentally point at any real DB, the build must fail loudly rather than serve real data.
2. **Read-only by design.** Mutations in the UI submit but the demo branches make them no-ops. No writes happen anywhere.
3. **No real-data leakage paths.** Anything that pulls from external systems (Google Drive, Google Sheets, OCR ingest, expense imports) was stripped or stubbed during the prep pass.
4. **Voice rules apply** to any operator-facing copy (banner text, role labels). See `~/.claude/projects/C--dev-mastjoba-dev/memory/feedback_voice_no_ai_tells.md`. Zero em dashes. Plain. Direct.
5. **Never push to the client repo.** This repo evolves independently. The clone is point-in-time only.

## Tech Stack

Inherited from source app:
- Next.js 16 (App Router)
- TypeScript / React 19
- Tailwind CSS + shadcn/ui
- TanStack React Query (for client-side data fetching, even though we won't hit a real DB)
- React Hook Form + Zod
- Recharts
- pnpm

**Notably absent in demo mode:**
- Supabase client (still imported, but only reached when IS_DEMO_MODE is false; the data layer demo branches short-circuit before any client creation)
- Supabase Auth
- Any external integrations

## Commands

```bash
./ops.sh dev          # Start Next.js dev server
./ops.sh build        # Production build (currently fails. fixes are TODO #1)
./ops.sh typecheck    # TypeScript check (will show pre-existing source errors, ignoreBuildErrors is on)
```

## Routing

The internal app mounts at root. The main dashboard (DashboardShell) is at `app/page.tsx`. The `app/tracker/` route was stripped (that was the WorkTracker integration, a separate Bobi Labs product, not the forestry dashboard).

When deployed and accessed via `bobilabs.dev/forestry-demo/*`:
- bobilabs's `vercel.json` rewrites `/forestry-demo/:path*` to this demo deployment root
- Visitor lands at the dashboard directly

## Demo-mode plumbing (TODO state)

- `lib/demo-mode.ts` currently exports `IS_DEMO_MODE = false`. TODO: change to read `NEXT_PUBLIC_FORESTRY_DEMO_MODE === "true"`.
- When IS_DEMO_MODE is true (set via Vercel env var on demo deployment):
  - 6 remaining queries return shaped data from `lib/mock-data.ts`
  - 10 remaining mutations are no-ops
  - middleware skips Supabase auth
  - auth-context returns synthetic admin user
  - DEMO MODE banner renders on every page
  - Role-switcher widget visible to swap between admin / foreman / office / owner Spanish views

## What was stripped during the prep pass

Removed before this CLAUDE.md was written:

- `lib/expenses/`, `lib/ingest/`, `lib/tests/`, `lib/tracker/`
- `lib/google-drive.ts`, `lib/google-sheets.ts`, `lib/ops-bots.ts`
- `app/tracker/` (worktracker integration)
- `app/api/expenses`, `ops-bot`, `tests`, `units`, `communications`, `drive`, `ingest`, `tracker`, `admin`
- `components/tracker/`
- 11 page components: communications, expenses-hub, files-page, imports-hub, pending-expenses, pending-units, projects-hub, unit-ingest-audit, weather-page, work-tracker, expense-shared
- 12 query files (all expense queries, all tracker queries, weather)
- 9 mutation files (expense mutations, tracker mutations)

## What is intentionally NOT in this repo

- No `.env*` files (all env vars come from Vercel)
- No client-engagement docs, transcripts, internal memory
- No `knowledge/` folder for call-bobi (this is not a call surface)
- No `phase2-doc.txt` or other client phase planning
- No `scripts/` (operator-side dev helpers, not needed at runtime)
- No `e2e/` or `__tests__/` (real-data adjacent fixtures)
- No git history from the source repo (clean start)

## Memory + cross-Claude coordination

This repo is part of the Bobi Labs umbrella but lives at the demo periphery. Operates under the umbrella protocol when changes cross-cut (rare for this repo). Otherwise self-contained.

Cross-cutting log file: `C:/dev/mastjoba-dev/docs/umbrella/cascadia-forestry-demo.log.md` (created when first cross-cut happens).
