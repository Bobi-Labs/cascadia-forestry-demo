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
