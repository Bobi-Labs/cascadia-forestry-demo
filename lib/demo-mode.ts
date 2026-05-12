// Forestry-side stub for the bobi-worktracker `demo-mode` plumbing.
//
// bobi-worktracker is a public/demo-able app that gates write affordances
// behind IS_DEMO_MODE when NEXT_PUBLIC_TRACKER_DEMO_MODE=true. Forestry
// has no demo mode — RLS + role-based access control handle authorization
// — so this is permanently `false`.
//
// Exported as a constant (not a getter) so build-time tree-shaking can
// drop demo-only branches.

export const IS_DEMO_MODE = false as const;
