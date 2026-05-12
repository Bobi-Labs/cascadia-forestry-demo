# TODO. cascadia-forestry-demo

<!-- Execution checklist for the fresh session. Work through in order.
     [~] in-flight, [x] done, [ ] queued. -->

**Status:** strip + scaffolding checkpoint complete at commit `53df37a`. Resuming from a fresh session for the build + deploy. See `~/.claude/projects/C--dev-cascadia-forestry-demo/memory/session_history.md` for the full briefing.

## Phase 1. Fix import breakage from strip pass

Build currently fails on these 10 files:

- [ ] `lib/queries/index.ts` (remove dead query exports)
- [ ] `lib/mutations/index.ts` (remove dead mutation exports)
- [ ] `lib/queries/get-pending-decisions.ts` (likely tracker refs)
- [ ] `lib/queries/get-recent-activity.ts` (likely tracker refs)
- [ ] `lib/supabase/paginate.ts` (check imports)
- [ ] `lib/supabase/raw-rest.ts` (check imports)
- [ ] `app/conditional-auth-provider.tsx` (probably tracker auth provider import)
- [ ] `components/dashboard-shell.tsx` (likely refs stripped components)
- [ ] `components/pages/admin-pages.tsx` (2195 lines, may have many out-of-scope refs)
- [ ] `components/pages/role-views.tsx` (role-based view dispatcher)

For each: open, identify the broken import, remove the dead reference OR delete the file if it's wholly out-of-scope. Run `./ops.sh build` after each batch to confirm the error list shrinks.

## Phase 2. Wire IS_DEMO_MODE env

- [ ] Update `lib/demo-mode.ts`:
  ```ts
  export const IS_DEMO_MODE = process.env.NEXT_PUBLIC_FORESTRY_DEMO_MODE === "true";
  ```

## Phase 3. Demo branches in 6 remaining queries

For each, add an `if (IS_DEMO_MODE)` branch at the top that returns mock-data-shaped fixtures matching the calling component's expectations:

- [ ] `lib/queries/get-contracts.ts` (simple list)
- [ ] `lib/queries/get-contract-payroll.ts` (per-contract aggregation)
- [ ] `lib/queries/get-overview-metrics.ts` (dashboard KPI computation)
- [ ] `lib/queries/get-payroll-analytics.ts` (payroll aggregation)
- [ ] `lib/queries/get-pending-decisions.ts` (alerts feed)
- [ ] `lib/queries/get-recent-activity.ts` (activity log)

Use `lib/mock-data.ts` entities (contracts, employees, timeSheets, alerts) as the source.

## Phase 4. No-op mutations in demo mode

For each, add early-return when IS_DEMO_MODE. Don't actually mutate. Optimistic update may show in UI but next refresh shows static mock state:

- [ ] `create-contract`, `update-contract`
- [ ] `create-crew-set`, `update-crew-set`, `delete-crew-set`
- [ ] `create-employee`, `update-employee`
- [ ] `create-unit`, `update-unit`, `delete-unit`

## Phase 5. Auth bypass + DEMO MODE banner

- [ ] `middleware.ts`: skip `updateSession` when IS_DEMO_MODE
- [ ] `lib/auth-context.tsx`: return synthetic admin user when IS_DEMO_MODE; expose `setDemoRole(role)`
- [ ] `app/conditional-auth-provider.tsx`: short-circuit Supabase provider when IS_DEMO_MODE
- [ ] New: `components/demo-mode-banner.tsx`: top bar with "DEMO MODE: synthetic data..." text + role-switcher affordance
- [ ] `app/layout.tsx`: render banner conditional on IS_DEMO_MODE

Optional polish:
- [ ] Splash screen on first visit explaining the demo (one-time, dismiss to localStorage)

## Phase 6. Deploy to Vercel

- [ ] `vercel link` in this dir, scope to bobilabs team
- [ ] Project name: `cascadia-forestry-demo`
- [ ] Set env var: `NEXT_PUBLIC_FORESTRY_DEMO_MODE=true`
- [ ] No Supabase env vars in Vercel project (confirm)
- [ ] `vercel --prod` for first deploy
- [ ] Capture the deployment URL

## Phase 7. Wire bobilabs.dev rewrite + case study link

In `C:/dev/bobilabs-dev/vercel.json`, append:
```json
{
  "source": "/forestry-demo/:path*",
  "destination": "https://cascadia-forestry-demo.vercel.app/:path*"
}
```

- [ ] Add rewrite, commit + push bobilabs-dev
- [ ] Update `C:/dev/bobilabs-dev/lib/case-studies.ts` Cascadia entry:
  - `live_url: "https://bobilabs.dev/forestry-demo"`
  - `live_url_label: "Try the demo"` (or "Demo the work!" matching the Work Tracker pattern)
  - Update `confidentiality` field to reference the live demo URL
- [ ] Commit + push bobilabs-dev

## Phase 8. Smoke test

Visit `https://bobilabs.dev/forestry-demo` in a real browser:
- [ ] All 9 surfaces render without console errors
- [ ] DEMO MODE banner visible everywhere
- [ ] Role-switcher works (admin / foreman / office / owner Spanish)
- [ ] Mobile responsive at ~375px width
- [ ] DevTools network tab: zero requests to any `supabase.co` domain
- [ ] No real client data anywhere (every name, dollar, date, contract # is from mock-data)

## Phase 9. Update memory

When all phases complete, append a "Session 2" entry to `~/.claude/projects/C--dev-cascadia-forestry-demo/memory/MEMORY.md` with:
- Final deployment URL
- Bobilabs case study URL where it's linked
- Any deviations from the plan
- Any follow-up work surfaced

Then the operator can return to the umbrella session knowing the demo is locked in.
