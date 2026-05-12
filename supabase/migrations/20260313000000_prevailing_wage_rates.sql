-- Prevailing wage rates by county
-- Seeded from DOL prevailing wage determination PDFs
-- Cascadia: P-400-25078-786191, Ramos: P-400-25337-452414

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE prevailing_wage_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id),
  county          text NOT NULL,
  state           text NOT NULL CHECK (char_length(state) = 2),
  hourly_rate     numeric(6,2) NOT NULL,
  bls_area        text,
  pwd_case_number text,
  soc_code        text DEFAULT '45-4011',
  valid_from      date,
  valid_to        date,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  UNIQUE (company_id, county, state, valid_from)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_prevailing_wage_rates_company ON prevailing_wage_rates(company_id);
CREATE INDEX idx_prevailing_wage_rates_county_state ON prevailing_wage_rates(county, state);

-- ============================================================
-- TRIGGER — updated_at auto-update
-- ============================================================

CREATE TRIGGER set_prevailing_wage_rates_updated_at
  BEFORE UPDATE ON prevailing_wage_rates
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- RLS — open access (no auth yet)
-- TODO: lock down when auth is added
-- ============================================================

ALTER TABLE prevailing_wage_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prevailing_wage_rates_anon_all" ON prevailing_wage_rates
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "prevailing_wage_rates_auth_all" ON prevailing_wage_rates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DATA — Cascadia Forestry
-- PWD Case: P-400-25078-786191, valid 4/23/2025 - 7/31/2026
-- SOC: 45-4011 (Forest and Conservation Workers)
-- ============================================================

INSERT INTO prevailing_wage_rates
  (company_id, county, state, hourly_rate, bls_area, pwd_case_number, soc_code, valid_from, valid_to)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Cowlitz',       'WA', 22.00, 'Longview, WA',                            'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Stevens',       'WA', 21.13, 'Spokane-Spokane Valley, WA',               'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Jefferson',     'WA', 22.65, 'Western Washington Nonmetropolitan',       'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Grays Harbor',  'WA', 22.65, 'Western Washington Nonmetropolitan',       'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Klickitat',     'WA', 22.53, 'Eastern Washington Nonmetropolitan',       'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Okanogan',      'WA', 22.53, 'Eastern Washington Nonmetropolitan',       'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Spokane',       'WA', 21.13, 'Spokane-Spokane Valley, WA',               'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Washington',    'OR', 24.25, 'Portland-Vancouver-Hillsboro, OR-WA',     'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Columbia',      'WA', 21.13, 'Walla Walla, WA',                          'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Clallam',       'WA', 22.65, 'Western Washington Nonmetropolitan',       'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Lewis',         'WA', 22.65, 'Western Washington Nonmetropolitan',       'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Hood River',    'OR', 23.91, 'Central Oregon Nonmetropolitan',           'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Whatcom',       'WA', 19.20, 'Bellingham, WA',                           'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Chelan',        'WA', 22.76, 'Wenatchee, WA',                            'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Thurston',      'WA', 22.47, 'Olympia-Tumwater, WA',                     'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Skagit',        'WA', 21.72, 'Mount Vernon-Anacortes, WA',               'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Clatsop',       'OR', 23.91, 'Coast Oregon Nonmetropolitan',             'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Clark',         'WA', 24.25, 'Portland-Vancouver-Hillsboro, OR-WA',     'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Skamania',      'WA', 24.25, 'Portland-Vancouver-Hillsboro, OR-WA',     'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Tillamook',     'OR', 23.91, 'Coast Oregon Nonmetropolitan',             'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Kittitas',      'WA', 22.53, 'Eastern Washington Nonmetropolitan',       'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Multnomah',     'OR', 24.25, 'Portland-Vancouver-Hillsboro, OR-WA',     'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Jackson',       'OR', 25.15, 'Medford, OR',                              'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Pierce',        'WA', 21.73, 'Seattle-Tacoma-Bellevue, WA',              'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Pacific',       'WA', 22.65, 'Western Washington Nonmetropolitan',       'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000001', 'Snohomish',     'WA', 21.73, 'Seattle-Tacoma-Bellevue, WA',              'P-400-25078-786191', '45-4011', '2025-04-23', '2026-07-31'),

-- ============================================================
-- SEED DATA — Ramos Reforestation
-- PWD Case: P-400-25337-452414, valid 12/30/2025 - 7/31/2026
-- SOC: 45-4011 (Forest and Conservation Workers)
-- ============================================================

  ('00000000-0000-0000-0000-000000000002', 'Shoshone',      'ID', 21.02, 'Northwestern Idaho Nonmetropolitan',       'P-400-25337-452414', '45-4011', '2025-12-30', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000002', 'Tillamook',     'OR', 20.88, 'Coast Oregon Nonmetropolitan',             'P-400-25337-452414', '45-4011', '2025-12-30', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000002', 'Mason',         'WA', 19.83, 'Western Washington Nonmetropolitan',       'P-400-25337-452414', '45-4011', '2025-12-30', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000002', 'Benton',        'OR', 20.65, 'Corvallis, OR',                            'P-400-25337-452414', '45-4011', '2025-12-30', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000002', 'Clackamas',     'OR', 21.18, 'Portland-Vancouver-Hillsboro, OR-WA',     'P-400-25337-452414', '45-4011', '2025-12-30', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000002', 'Pend Oreille',  'WA', 21.97, 'Eastern Washington Nonmetropolitan',       'P-400-25337-452414', '45-4011', '2025-12-30', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000002', 'Douglas',       'OR', 20.88, 'Coast Oregon Nonmetropolitan',             'P-400-25337-452414', '45-4011', '2025-12-30', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000002', 'Pacific',       'WA', 19.83, 'Western Washington Nonmetropolitan',       'P-400-25337-452414', '45-4011', '2025-12-30', '2026-07-31'),
  ('00000000-0000-0000-0000-000000000002', 'Clallam',       'WA', 19.83, 'Western Washington Nonmetropolitan',       'P-400-25337-452414', '45-4011', '2025-12-30', '2026-07-31');
