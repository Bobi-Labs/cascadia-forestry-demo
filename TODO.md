# TODO — cascadia-forestry-demo

<!-- Working list for the demo build. [~] in-flight, [x] done, [ ] queued. -->

## In flight

- [~] Initial clone + scaffolding
- [ ] Create dedicated demo Supabase project (free tier)
- [ ] Apply schema migrations to demo Supabase
- [ ] Seed synthetic data matching the slider screenshots
- [ ] Wire `NEXT_PUBLIC_FORESTRY_DEMO_MODE=true` through `lib/demo-mode.ts`
- [ ] Patch auth bypass: skip login when demo mode is on, auto-select admin
- [ ] Add DEMO MODE banner UI component, render on every page
- [ ] Add role-switcher widget for visitors to try foreman / office / owner Spanish views
- [ ] Lock down RLS on demo Supabase to anon-SELECT-only

## Strip out-of-scope surfaces

- [ ] Strip `lib/expenses/`, `lib/ingest/`, `lib/tests/`, `lib/tracker/`
- [ ] Strip `lib/google-drive.ts`, `lib/google-sheets.ts`, `lib/ops-bots.ts`
- [ ] Strip any app routes / components that reference the above
- [ ] Strip `scripts/` (operator-side dev helpers, not needed at runtime)

## Deploy + wire

- [ ] Create Vercel project under `bobilabs` team
- [ ] Set env vars (demo Supabase URL + anon key, FORESTRY_DEMO_MODE=true)
- [ ] Verify NO client Supabase keys present in Vercel project
- [ ] Add path rewrite to `bobilabs-dev/vercel.json` (`/forestry-demo/:path*`)
- [ ] Update Cascadia case study confidentiality field on bobilabs to link the live demo
- [ ] Set up daily 3am UTC cron to reset demo Supabase to seed

## Verification

- [ ] Smoke test all 9 surfaces with the role-switcher
- [ ] Confirm no real-data leakage paths (env vars correct, demo Supabase only)
- [ ] Mobile responsive on the foreman timesheet
- [ ] DEMO MODE banner visible on every page
