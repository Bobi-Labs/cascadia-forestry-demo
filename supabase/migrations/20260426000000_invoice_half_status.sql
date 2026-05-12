-- Split invoice_status into kickoff + final halves so the Work Tracker
-- Ongoing Work row can show "1st ½" and "2nd ½" columns separately.
--
-- New per-half lifecycle:
--   NULL    — N/A (one-shot items skip the kickoff half)
--   pending — invoice not yet issued
--   due     — invoice sent, payment owed
--   sent    — Jaime confirmed payment is on the way (clicks the Sent button)
--   paid    — Bees confirmed wire received
--
-- Existing single invoice_status column stays as-is for backward-compat
-- (some renders may still reference it). New columns are the source of
-- truth going forward.

ALTER TABLE deliverable_items
  ADD COLUMN IF NOT EXISTS invoice_kickoff_status text,
  ADD COLUMN IF NOT EXISTS invoice_final_status   text;

COMMENT ON COLUMN deliverable_items.invoice_kickoff_status IS
  'Half-up-front kickoff invoice state. NULL for one-shot items. Conventional values: pending, due, sent, paid.';
COMMENT ON COLUMN deliverable_items.invoice_final_status IS
  'Delivery / final invoice state. NULL until an invoice is issued. Conventional values: pending, due, sent, paid.';

-- Backfill from existing invoice_status. Items currently 'paid' get both
-- halves marked paid (assume they were half-up-front and both halves landed,
-- or one-shot and the single payment counts as the final).
UPDATE deliverable_items
   SET invoice_kickoff_status = 'paid',
       invoice_final_status   = 'paid'
 WHERE invoice_status = 'paid'
   AND invoice_final_status IS NULL;

-- Items currently 'sent' (e.g. Item 7's hourly invoice) — final due, no
-- kickoff half (one-shot pattern). Don't backfill kickoff_status.
UPDATE deliverable_items
   SET invoice_final_status = 'due'
 WHERE invoice_status = 'sent'
   AND invoice_final_status IS NULL;

-- Items currently 'pending' or NULL stay null on both halves until a
-- real kickoff invoice issues + flips to 'due' explicitly.
