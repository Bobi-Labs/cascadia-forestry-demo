-- ─────────────────────────────────────────────────────────────────────────
-- Replace 30 `dev_anon_*` policies with role-scoped RLS
-- ─────────────────────────────────────────────────────────────────────────
--
-- Background: while auth was being built we shipped permissive
-- anon-role policies on 22 tables so the dashboard could read/write
-- without a logged-in session (USING true for everything). Now that
-- auth is in place across all surfaces, the anon policies are pure
-- exposure. Anyone with the anon key (which lives in client bundles)
-- can hit these tables directly.
--
-- Two categories of fix:
--
--   A. INTERNAL TABLES — no app-side reason for anon to ever touch.
--      Strategy: drop the anon policies entirely. RLS stays on, but
--      with no anon policy the role can't read/write. Authenticated
--      users still have separate `_authenticated` or admin policies
--      that we keep.
--
--      Most-sensitive: tracker_telegram_config — contains bot tokens
--      that should never be world-readable.
--
--      Also internal: unit_ingest_*, unit_column_maps, tracker_files,
--      tracker_telegram_config, tracker_backlog_overrides.
--
--   B. APP-FACING TABLES — dashboard needs read (and sometimes write).
--      Strategy: drop the anon policy, then add a replacement scoped
--      to role 'authenticated'. Same shape, different role. Office
--      and admin both fall under 'authenticated' once they sign in.
--
--      Tables: contracts, units, unit_draws, timesheets,
--      prevailing_wage_rates, tracker_items, tracker_notes,
--      tracker_projects, tracker_messages, tracker_users,
--      deliverable_items, deliverable_questions,
--      deliverable_invoice_lines, deliverable_invoice_log.
--
-- Pre-existing role-based policies (e.g. "..._select_auth") are
-- preserved everywhere — this migration only removes the anon
-- companion policies and ensures an authenticated equivalent exists.
-- ─────────────────────────────────────────────────────────────────────────

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  A. INTERNAL — drop anon policies entirely                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- tracker_telegram_config — bot tokens. Highest sensitivity. Anon read
-- is the worst offender on the list.
drop policy if exists "tracker_telegram_config_anon_all" on tracker_telegram_config;

-- tracker_files — file metadata. Storage-side bucket already locked
-- down via 20260513000000; this drops the table-side anon row read.
drop policy if exists "tracker_files_read" on tracker_files;

-- Tracker backlog overrides — internal team backlog state.
drop policy if exists "backlog_overrides_dev_anon_read" on tracker_backlog_overrides;
drop policy if exists "backlog_overrides_dev_anon_write" on tracker_backlog_overrides;

-- Unit ingest internals — admin-only diagnostic + config tables.
drop policy if exists "dev_anon_all" on unit_ingest_audit;
drop policy if exists "dev_anon_all" on unit_ingest_batches;
drop policy if exists "dev_anon_all" on unit_ingest_excludes;
drop policy if exists "dev_anon_all" on unit_pending_review;
drop policy if exists "dev_anon_all" on unit_column_maps;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  B. APP-FACING — drop anon, replace with `to authenticated`         ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── Contracts ──
drop policy if exists "dev_anon_insert_contracts" on contracts;
drop policy if exists "dev_anon_update_contracts" on contracts;
-- contracts already has a select_auth policy from the original migration;
-- write policies replace the dev_anon ones.
create policy "auth_insert_contracts" on contracts
  for insert to authenticated with check (true);
create policy "auth_update_contracts" on contracts
  for update to authenticated using (true) with check (true);

-- ── Units ──
drop policy if exists "dev_anon_insert_units" on units;
drop policy if exists "dev_anon_update_units" on units;
drop policy if exists "dev_anon_delete_units" on units;
create policy "auth_insert_units" on units
  for insert to authenticated with check (true);
create policy "auth_update_units" on units
  for update to authenticated using (true) with check (true);
create policy "auth_delete_units" on units
  for delete to authenticated using (true);

-- ── Unit draws ──
drop policy if exists "dev_anon_read_unit_draws" on unit_draws;
drop policy if exists "dev_anon_insert_unit_draws" on unit_draws;
drop policy if exists "dev_anon_update_unit_draws" on unit_draws;
drop policy if exists "dev_anon_delete_unit_draws" on unit_draws;
create policy "auth_read_unit_draws" on unit_draws
  for select to authenticated using (true);
create policy "auth_insert_unit_draws" on unit_draws
  for insert to authenticated with check (true);
create policy "auth_update_unit_draws" on unit_draws
  for update to authenticated using (true) with check (true);
create policy "auth_delete_unit_draws" on unit_draws
  for delete to authenticated using (true);

-- ── Timesheets ──
drop policy if exists "dev_anon_update_timesheets" on timesheets;
create policy "auth_update_timesheets" on timesheets
  for update to authenticated using (true) with check (true);

-- ── Prevailing wage rates (admin-readable reference table) ──
drop policy if exists "prevailing_wage_rates_anon_all" on prevailing_wage_rates;
create policy "prevailing_wage_rates_auth_read" on prevailing_wage_rates
  for select to authenticated using (true);

-- ── Tracker items / projects / users / messages / notes ──
drop policy if exists "tracker_items_anon_all" on tracker_items;
create policy "tracker_items_auth_all" on tracker_items
  for all to authenticated using (true) with check (true);

drop policy if exists "tracker_projects_anon_all" on tracker_projects;
create policy "tracker_projects_auth_all" on tracker_projects
  for all to authenticated using (true) with check (true);

drop policy if exists "tracker_users_read" on tracker_users;
create policy "tracker_users_auth_read" on tracker_users
  for select to authenticated using (true);

drop policy if exists "tracker_messages_anon_insert" on tracker_messages;
drop policy if exists "tracker_messages_read" on tracker_messages;
create policy "tracker_messages_auth_read" on tracker_messages
  for select to authenticated using (true);
create policy "tracker_messages_auth_insert" on tracker_messages
  for insert to authenticated with check (true);

drop policy if exists "tracker_notes_anon_all" on tracker_notes;
create policy "tracker_notes_auth_all" on tracker_notes
  for all to authenticated using (true) with check (true);

-- ── Deliverables panel ──
drop policy if exists "deliverable_items_dev_anon" on deliverable_items;
drop policy if exists "deliverable_questions_dev_anon" on deliverable_questions;
drop policy if exists "deliverable_invoice_lines_dev_anon" on deliverable_invoice_lines;
drop policy if exists "dev_anon_all" on deliverable_invoice_log;
-- All four tables already have authenticated select+write policies from
-- the original migration (e.g. deliverable_items_select_auth + _write_auth);
-- this migration just removes the anon companion. No replacement needed.
