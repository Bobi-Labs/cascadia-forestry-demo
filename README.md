# Cascadia Forestry Demo

Public, read-only demo of the Cascadia Forestry Platform built by [Bobi Labs](https://bobilabs.dev). Click around the actual UI with synthetic data; no signup required.

**Live:** [bobilabs.dev/forestry-demo](https://bobilabs.dev/forestry-demo) (when deployed)

## What this is

A clone of the production forestry operations platform Bobi Labs built for Cascadia Forestry Inc and Ramos Reforestation Inc. Source is identical to the client app. Data is fully synthetic: fake names, fake dollar amounts, fake contracts. The Cascadia Forestry and Ramos Reforestation brand names are the real public-facing companies and are intentionally preserved.

## What it's NOT

Not the production app. Not connected to client data. Not writable (read-only RLS on the demo Supabase). Mutations are surfaced in the UI but the data layer rejects writes silently.

## Architecture

| Layer | Demo deployment |
|---|---|
| Source code | This repo (cloned from `Cascadia-Forestry/cascadia-ramos-forestry-project` for demo purposes, evolves independently) |
| Database | Dedicated Supabase project (separate from client production) |
| Hosting | Vercel under the `bobilabs` team |
| Domain | `bobilabs.dev/forestry-demo` (path rewrite from the studio site) |
| Auth | Bypassed for demo. Visitor drops directly into a synthetic admin role. Role-switcher in the UI lets visitors try foreman / office / owner Spanish views. |
| Reset cadence | Daily at 3am UTC the demo DB resets to the seed state |

## What you'll see

The 9 operational surfaces showcased in the [Cascadia case study slider on bobilabs.dev/work/cascadia-forestry](https://bobilabs.dev/work/cascadia-forestry):

- Admin dashboard with KPIs and daily trends
- Contracts list with progress bars
- Contract detail with payroll roll-up and partial-payment ledger
- Production calendar (heatmap + Gantt)
- Crew roster across two companies
- Foreman timesheet wizard
- Office timesheet entry
- Office approval queue
- Owner view in Spanish (bilingual EN/ES)
- Mobile foreman timesheet (responsive)

## Tech

Next.js 16 (App Router), TypeScript, Supabase, TanStack React Query, Tailwind, shadcn/ui. Same stack as the client app.

## Studio

Built and operated by [Bobi Labs](https://bobilabs.dev). Want similar work for your operation? [bobilabs.dev/work-with-us](https://freelance.bobilabs.dev/work-with-us).
