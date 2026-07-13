// Demo-mode flag for the public Cascadia Forestry demo at bobilabs.dev/forestry-demo.
//
// When true:
//   - lib/queries/* short-circuit to mock-data fixtures instead of Supabase
//   - lib/mutations/* are no-ops (UI submits, nothing persists)
//   - middleware skips Supabase auth checks
//   - auth-context returns a synthetic admin user
//   - the DEMO MODE banner renders on every page
//
// When false (the default everywhere except the demo Vercel deployment):
//   - app behaves exactly like the source forestry repo
//   - Supabase env vars are required, build will fail loudly without them
//
// Toggled via NEXT_PUBLIC_FORESTRY_DEMO_MODE=true in Vercel project settings
// on the demo deployment only. Local dev stays false unless explicitly set,
// matching the source-app behavior.

export const IS_DEMO_MODE = process.env.NEXT_PUBLIC_FORESTRY_DEMO_MODE === "true";

// Pinned "today" for demo mode. The fixtures in lib/mock-data.ts and
// lib/demo-fixtures.ts are anchored to May 12, 2026 (matching the dollar
// figures and dates in the case-study slider screenshots on
// bobilabs.dev/work/cascadia-forestry). Widgets that seed a date window
// from the real clock (dashboard week, production calendar's open month,
// gantt centering, approval-queue week, compliance countdowns) would
// otherwise compute a window months past the static data and render empty
// or stale. nowForDemo() returns the anchor in demo mode so every relative
// date lines up with the fixtures; outside demo mode it is the real clock.
//
// Local-time construction (month is 0-indexed, so 4 = May) keeps
// getMonth()/getFullYear()/getDay() correct regardless of timezone.
const DEMO_ANCHOR = new Date(2026, 4, 12, 9, 0, 0);

export function nowForDemo(): Date {
  return IS_DEMO_MODE ? new Date(DEMO_ANCHOR) : new Date();
}
