-- Unit Draws — partial payment tracking for contract units.
-- Like a construction draw schedule: crew completes a portion of a unit,
-- requests inspection on that portion, and gets paid for just that portion.
-- The unit record stays intact; draws track partial completions against it.

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE unit_draws (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id                  uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  draw_number              integer NOT NULL,
  description              text,
  acres_submitted          numeric,
  amount_invoiced          numeric,
  amount_paid              numeric,
  inspection_requested_at  timestamptz,
  inspection_completed_at  timestamptz,
  payment_received_at      timestamptz,
  status                   text NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','submitted','inspected','approved','paid','rejected')),
  inspector_name           text,
  notes                    text,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now(),

  UNIQUE (unit_id, draw_number)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_unit_draws_unit_id ON unit_draws(unit_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER set_updated_at_unit_draws
  BEFORE UPDATE ON unit_draws
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE unit_draws ENABLE ROW LEVEL SECURITY;

-- Dev open-read policy (delete when auth is added)
CREATE POLICY "dev_anon_read_unit_draws" ON public.unit_draws
  FOR SELECT TO anon USING (true);

-- Dev open-write policies (delete when auth is added)
CREATE POLICY "dev_anon_insert_unit_draws" ON public.unit_draws
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "dev_anon_update_unit_draws" ON public.unit_draws
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_delete_unit_draws" ON public.unit_draws
  FOR DELETE TO anon USING (true);

-- Authenticated policies (permissive — tighten with role system later)
CREATE POLICY "auth_select_unit_draws" ON public.unit_draws
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_unit_draws" ON public.unit_draws
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_unit_draws" ON public.unit_draws
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_unit_draws" ON public.unit_draws
  FOR DELETE TO authenticated USING (true);
