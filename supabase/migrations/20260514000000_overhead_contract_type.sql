-- ─────────────────────────────────────────────────────────────────────────
-- Add 'overhead' to contract_type + activate Jaime's existing overhead rows
-- ─────────────────────────────────────────────────────────────────────────
--
-- On the May 8 demo call, Jaime mentioned he created project rows for
-- non-project expense categories (Bids, Shop, Sick Time) so he could
-- assign overhead spend to them. Three problems:
--   1. Those rows currently have status='closed' which hides them from
--      the assignment picker entirely.
--   2. They're indistinguishable from real projects in the dropdown,
--      so they don't sort to the top where they belong.
--   3. The picker has no search input — finding any specific item in
--      a 50-row list is slow.
--
-- This migration handles 1 and 2. The picker rewrite handles 3.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Extend the enum.
alter type contract_type add value if not exists 'overhead';
