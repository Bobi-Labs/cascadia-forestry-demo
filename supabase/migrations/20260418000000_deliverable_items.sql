-- Deliverables panel: DB-backed replacement for the 920-line hard-coded
-- tracker-deliverables-panel.tsx arrays.
--
-- Three tables:
--   deliverable_items           — one row per item (Phase 1 / Phase 1.5 /
--                                 Delivered / Ongoing Work cards)
--   deliverable_questions       — open questions for Jaime per item
--   deliverable_invoice_lines   — bullet-level invoice content (Delivered cards)
--
-- Tab values: 'phase_1', 'phase_1_5', 'delivered', 'ongoing'. Phase 3/4 intentionally omitted.
-- Status values (display-layer semantics — not a DB enum, free text so we can evolve):
--   'delivered' | 'live' | 'active' | 'blocked' | 'pending' | 'future' | 'bid-pending'

CREATE TABLE deliverable_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab                 text NOT NULL,
  item_key            text UNIQUE NOT NULL,  -- stable slug, e.g. 'item-07-scoping'
  item_number         text,                   -- display label, e.g. '7' or '1 (extras)'
  title               text NOT NULL,
  subtitle            text,                   -- e.g. "(hourly)", "(separate bid)"
  status              text NOT NULL DEFAULT 'pending',
  scope_md            text,                   -- markdown for Scope section
  build_notes_md      text,                   -- editor-only view
  guide_md            text,                   -- user-facing guide
  invoice_status      text,                   -- 'pending' | 'sent' | 'paid'
  invoice_number      text,
  invoice_amount      numeric(10,2),
  invoice_sent_at     timestamptz,
  invoice_paid_at     timestamptz,
  invoice_notes_md    text,
  is_out_of_scope_card boolean DEFAULT false, -- bullet-list cards on Delivered tab
  sort_order          int NOT NULL DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_deliverable_items_tab_sort ON deliverable_items (tab, sort_order);
CREATE INDEX idx_deliverable_items_status ON deliverable_items (status);

CREATE TABLE deliverable_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES deliverable_items(id) ON DELETE CASCADE,
  question_md   text NOT NULL,
  answer_md     text,
  status        text NOT NULL DEFAULT 'open',  -- 'open' | 'answered' | 'dismissed'
  category      text,                           -- optional grouping label
  answered_at   timestamptz,
  answered_by   text,                           -- email of whoever answered
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_deliverable_questions_item ON deliverable_questions (item_id, sort_order);
CREATE INDEX idx_deliverable_questions_status ON deliverable_questions (status);

CREATE TABLE deliverable_invoice_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         uuid NOT NULL REFERENCES deliverable_items(id) ON DELETE CASCADE,
  description     text NOT NULL,
  is_out_of_scope boolean DEFAULT false,
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_deliverable_invoice_lines_item ON deliverable_invoice_lines (item_id, sort_order);

-- ── Row Level Security ─────────────────────────────────────────────────

ALTER TABLE deliverable_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverable_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverable_invoice_lines  ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read (admin, owner, office, etc. all see deliverables)
CREATE POLICY "deliverable_items_select_auth" ON deliverable_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "deliverable_questions_select_auth" ON deliverable_questions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "deliverable_invoice_lines_select_auth" ON deliverable_invoice_lines
  FOR SELECT TO authenticated USING (true);

-- Authenticated users can write — app-level EDITORS allowlist gates who
-- actually sees the edit UI. Keeps DB policy simple + pragmatic.
CREATE POLICY "deliverable_items_write_auth" ON deliverable_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "deliverable_questions_write_auth" ON deliverable_questions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "deliverable_invoice_lines_write_auth" ON deliverable_invoice_lines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Dev anon fallback — matches the pattern in tracker_backlog_overrides
-- since auth isn't universally enforced yet. Remove when RLS hardening lands.
CREATE POLICY "deliverable_items_dev_anon" ON deliverable_items
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "deliverable_questions_dev_anon" ON deliverable_questions
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "deliverable_invoice_lines_dev_anon" ON deliverable_invoice_lines
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Auto-update triggers ───────────────────────────────────────────────

CREATE TRIGGER set_deliverable_items_updated_at
  BEFORE UPDATE ON deliverable_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_deliverable_questions_updated_at
  BEFORE UPDATE ON deliverable_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
