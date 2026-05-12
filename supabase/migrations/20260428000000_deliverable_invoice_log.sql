-- Audit trail for deliverable_items invoice-status changes.
--
-- Captures every Sent? / Paid? button click + the email of the user who
-- clicked it. Drives Telegram alerts when Jaime (or anyone other than
-- Bees) flips an invoice from due → sent or sent → paid, so Bees doesn't
-- have to refresh the tracker to find out a payment has been claimed.

CREATE TABLE IF NOT EXISTS deliverable_invoice_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES deliverable_items(id) ON DELETE CASCADE,
  invoice_field text NOT NULL CHECK (invoice_field IN ('kickoff', 'final')),
  old_status    text,
  new_status    text NOT NULL,
  changed_by    text,    -- email from the auth profile, nullable for system writes
  changed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliverable_invoice_log_item
  ON deliverable_invoice_log (item_id, changed_at DESC);

ALTER TABLE deliverable_invoice_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY dev_anon_all ON deliverable_invoice_log FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY auth_all     ON deliverable_invoice_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
