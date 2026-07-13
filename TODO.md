# TODO. cascadia-forestry-demo

<!-- Live work list. [x] done, [~] in-flight, [ ] queued. -->

## Done

- **Session 2 (2026-05-12): build + deploy.** All 9 phases (import fixes, IS_DEMO_MODE
  wiring, fixture data, no-op mutations, auth bypass + banner, Vercel deploy, bobilabs
  rewrite + case study link, smoke test). Live at bobilabs.dev/forestry-demo.
- **Session 3 (2026-07-13): polish + walkthrough video.** The keeper's video work order.
  - Three known follow-ups fixed: Sign Out hidden in demo mode, ops.sh PROJECT_NAME,
    splash/PWA basePath 404s.
  - Deep meh-sweep (surfaced runtime-only bugs the code audit missed): date coherence via
    `nowForDemo()`, stale filtered queries in `useSupabaseQuery`, foreman-submit crash,
    silent office-approve, unmounted `<Toaster/>`, the training-gated foreman wizard,
    missing fixture display fields, admin-only role switcher, empty weather card + dead
    nav, Spanish owner coherence, on-path em dashes.
  - 90s walkthrough video (7 beats + end card) recorded + delivered to
    `bobilabs-dev/public/Images/cascadiaforestrywalkthrough.mp4`, wired as `hero_video`.

## Pending (needs operator / keeper)

- [ ] **Push + deploy** — everything is committed LOCAL in both repos, nothing pushed.
      Push `cascadia-forestry-demo` first (redeploys the polished demo), smoke-test
      bobilabs.dev/forestry-demo, then push `bobilabs-dev` (publishes the video hero).
      Pushing = public Vercel deploy, so this is an operator call.
- [ ] **Keeper sign-off** on the hero render-priority flip (slides>video → video>slides in
      `bobilabs-dev app/work/[slug]/page.tsx`, commit `019a9f2`). Safe: only Cascadia has
      both a video and slides, so only it changes. Alternative is a per-entry slide demote.

## Nice-to-have (off the recorded click-path, low priority)

- [ ] Em dashes remain on the contract-detail Notes/Files tabs (`contracts.tsx:1232/1253/1512`)
      and the standalone Payroll page. The video never visits these; the live demo would
      benefit from a cleanup for full voice-rule compliance.
- [ ] PWA manifest (`app/manifest.ts`) isn't basePath-aware (icon/start_url/scope resolve at
      root). Off-frame, but a genuine basePath-asset instance.
- [ ] Contract-detail still has an "Expenses" tab that references stripped functionality.
