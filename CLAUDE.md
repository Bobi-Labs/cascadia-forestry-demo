# CLAUDE.md. cascadia-forestry-demo

## What this repo is

Public, read-only demo of the Cascadia Forestry operations platform. **Not** the client app. Source code is a clone of `Cascadia-Forestry/cascadia-ramos-forestry-project` taken at a point in time; this repo evolves independently as a portfolio asset for Bobi Labs.

**Goal:** clickable demo at `bobilabs.dev/forestry-demo` that lets prospects experience the actual UI with synthetic data. Conversion asset for the studio.

## Hard rules

1. **Never connect to the client Supabase** (`zcimpedwjwwmxooaxtsw`). The demo has its own dedicated Supabase project. If env vars accidentally point at the client DB, the build must fail loudly rather than serve real data.
2. **Read-only by design.** The demo Supabase RLS policies are anon-SELECT-only. UI mutations submit but get rejected at the DB layer. No writes possible.
3. **Daily reset.** The demo DB resets to seed state at 3am UTC via cron. Any visitor "edits" disappear.
4. **No real-data leakage paths.** Anything that pulls from external systems (Google Drive, Google Sheets, OCR ingest, expense imports) must be stripped or stubbed. Demo only renders synthetic data.
5. **Voice rules apply** to any operator-facing copy added here (README, in-app text overlays). See `~/.claude/projects/C--dev-mastjoba-dev/memory/feedback_voice_no_ai_tells.md`. No em dashes.

## Tech Stack

Inherited from the source app:
- Next.js 16 (App Router)
- TypeScript / React 19
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + RLS)
- TanStack React Query
- React Hook Form + Zod
- Recharts
- pnpm

## Commands

```bash
./ops.sh dev          # Start Next.js dev server
./ops.sh build        # Production build
./ops.sh typecheck    # TypeScript check
```

## Routing

The internal app mounts at root with `/tracker/*` paths for the operational dashboard surfaces. The marketing landing at `/` is preserved from source but mostly bypassed by the rewrite.

When deployed and accessed via `bobilabs.dev/forestry-demo/*`:
- bobilabs.dev's `vercel.json` rewrites `/forestry-demo/:path*` to this demo deployment
- Visitor lands at `/tracker` (auto-redirect from `/` for demo deployments)
- Inside the app, `lib/base-path.ts` continues to return empty string

## Demo-mode plumbing

- `NEXT_PUBLIC_FORESTRY_DEMO_MODE=true` flips `lib/demo-mode.ts` `IS_DEMO_MODE` constant
- When true: auth gated UI is bypassed, a synthetic admin user is auto-selected, a role-switcher widget appears, a DEMO MODE banner renders at the top of every page
- When false: app behaves identically to the source (still hits whatever Supabase the env points at, but no demo affordances surface)

## What was stripped from the source

This list will fill out as the strip pass proceeds:

- (TBD) `lib/expenses/`. Out of scope, real-data adjacent
- (TBD) `lib/ingest/`. OCR pipeline, out of scope
- (TBD) `lib/google-drive.ts`, `lib/google-sheets.ts`. External integrations
- (TBD) `lib/ops-bots.ts`. Operational bots
- (TBD) `lib/tests/`, `__tests__/`, `e2e/`. Test fixtures with real-data references
- (TBD) `scripts/`. Operator-side dev helpers

## What is intentionally NOT in this repo

- No `.env*` files (all env vars come from Vercel)
- No client-engagement docs, transcripts, internal memory
- No knowledge folder for call-bobi (this is not a call surface)
- No `phase2-doc.txt` or other client phase planning
- No git history from the source repo (clean start)

## Memory + cross-Claude coordination

This repo is part of the Bobi Labs umbrella but lives at the demo periphery. Operates under the umbrella protocol when changes cross-cut (rare for this repo). Otherwise self-contained.
