-- ─────────────────────────────────────────────────────────────────────────
-- Add separate Drive file ID for the End 1/2 (delivery) invoice.
-- ─────────────────────────────────────────────────────────────────────────
--
-- Context: half-and-half lifecycle items have two invoice docs — one
-- for kickoff (Start 1/2, e.g. BL-2026-005-A) and one for delivery
-- (End 1/2, e.g. BL-2026-005-B). The existing `invoice_drive_file_id`
-- column was added before the End 1/2 doc was a real artifact, so it
-- holds the kickoff doc only.
--
-- Adding a sibling column so the tracker UI can surface BOTH docs
-- side by side once an item enters delivery — the office shouldn't
-- have to dig through Drive to find the right one.
--
-- Backwards compatible: existing rows keep `invoice_drive_file_id`
-- pointing at the kickoff doc (or the only invoice for non-split items)
-- and `invoice_final_drive_file_id` stays NULL until the End 1/2 ships.
-- ─────────────────────────────────────────────────────────────────────────

alter table deliverable_items
  add column if not exists invoice_final_drive_file_id text;

comment on column deliverable_items.invoice_final_drive_file_id is
  'Drive file ID of the End 1/2 (delivery) invoice doc. NULL for items not yet in delivery, or items billed as a single invoice. Pair with invoice_drive_file_id (kickoff) for half-and-half lifecycle items.';
