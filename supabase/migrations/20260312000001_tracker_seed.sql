-- Seed data for work tracker
-- Migrated from Google Sheets project tracker (Data Needed, Questions, Decisions tabs)
-- Plus Phase 1 remaining development tasks

-- ============================================================
-- PROJECT
-- ============================================================

INSERT INTO tracker_projects (id, name, client_name, phase, budget, hours_total, hours_used, status)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Cascadia & Ramos Forestry Platform',
  'Jaime Contreras',
  'Phase 1',
  9999.00,
  124.0,
  62.0,
  'active'
);

-- ============================================================
-- DATA NEEDED (from client)
-- ============================================================

INSERT INTO tracker_items (project_id, category, title, description, priority, status, assigned_to, sort_order) VALUES
('10000000-0000-0000-0000-000000000001', 'data_needed', 'Employee roster with real names',
 'Full roster: names, hourly rates, driver/foreman/H2B designation, company assignment. Currently using placeholder names.',
 'blocking', 'pending', 'client', 10),

('10000000-0000-0000-0000-000000000001', 'data_needed', 'Units for 8 remaining contracts',
 'Need unit names + acreage for: Vaagan, Manulife, Weyerhaeuser x2, USACE x2, DNR 7044, DNR Nursery. Currently 0 units on these contracts.',
 'blocking', 'pending', 'client', 20),

('10000000-0000-0000-0000-000000000001', 'data_needed', 'County per unit',
 'County assignment for each unit — required for prevailing wage rate lookups in payroll.',
 'blocking', 'pending', 'client', 30),

('10000000-0000-0000-0000-000000000001', 'data_needed', 'County wage rate table',
 'Prevailing wage rates by county. Needed for payroll calculation engine.',
 'blocking', 'pending', 'client', 40),

('10000000-0000-0000-0000-000000000001', 'data_needed', 'Completion percentages per contract/unit',
 'Current progress estimates for all active contracts and their units. Rough estimates OK.',
 'high', 'pending', 'client', 50),

('10000000-0000-0000-0000-000000000001', 'data_needed', 'Bags-to-trees ratio per species',
 'Trees per bag varies by species. Default ~300/bag but some species differ. Need actual numbers.',
 'medium', 'pending', 'client', 60),

('10000000-0000-0000-0000-000000000001', 'data_needed', 'Pay period start dates per company',
 'Bi-weekly confirmed. Need actual calendar start dates for Cascadia and Ramos.',
 'medium', 'pending', 'client', 70),

('10000000-0000-0000-0000-000000000001', 'data_needed', 'Sample payroll export',
 'Example of current Excel payroll output for office view design reference.',
 'medium', 'pending', 'client', 80);

-- ============================================================
-- QUESTIONS (clarifications needed)
-- ============================================================

INSERT INTO tracker_items (project_id, category, title, description, priority, status, assigned_to, sort_order) VALUES
('10000000-0000-0000-0000-000000000001', 'question', 'What tedious tasks can office staff do to build data collection infrastructure?',
 'Identifying manual data entry work that office staff can handle to populate the system.',
 'medium', 'pending', 'client', 100),

('10000000-0000-0000-0000-000000000001', 'question', 'Use Telegram instead of WhatsApp for notifications?',
 'Telegram has better bot API and is easier to integrate. Client confirmed preference for Telegram.',
 'medium', 'done', 'client', 110),

('10000000-0000-0000-0000-000000000001', 'question', 'How should employee access levels differ between foremen?',
 'Can Agustin and Maya see each others crew data? Or strictly isolated to their own crews?',
 'high', 'pending', 'client', 120),

('10000000-0000-0000-0000-000000000001', 'question', 'What are the exact prevailing wage rates by county?',
 'Need the specific rate table. Tied to data_needed item for county wage rates.',
 'high', 'pending', 'client', 130),

('10000000-0000-0000-0000-000000000001', 'question', 'Should inventory include chainsaws separately from vehicles?',
 'Equipment tracking scope — vehicles are in DB, but hand tools/chainsaws may need separate tracking.',
 'low', 'pending', 'client', 140);

-- ============================================================
-- DECISIONS (made during planning)
-- ============================================================

INSERT INTO tracker_items (project_id, category, title, description, priority, status, assigned_to, sort_order) VALUES
('10000000-0000-0000-0000-000000000001', 'decision', 'Payroll calculation engine moved to Phase 2',
 'Full payroll engine too complex for Phase 1 budget. Simplified payroll estimates (avg rate × hours) replace full engine in Phase 1.',
 'high', 'done', 'developer', 200),

('10000000-0000-0000-0000-000000000001', 'decision', 'Contract management pulled up from Phase 2 to Phase 1',
 'Contract CRUD is essential for daily operations. Moved into Phase 1 scope.',
 'high', 'done', 'developer', 210),

('10000000-0000-0000-0000-000000000001', 'decision', 'Voice-to-text stays in Phase 1',
 'Foremen requested it for field notes. Keeps it in timesheet Part 2 (Unit Review).',
 'medium', 'done', 'developer', 220),

('10000000-0000-0000-0000-000000000001', 'decision', 'Telegram bot deferred to Phase 2',
 'Bot notifications are nice-to-have. Core platform features take priority in Phase 1.',
 'medium', 'done', 'developer', 230),

('10000000-0000-0000-0000-000000000001', 'decision', 'Use Supabase Auth with magic links',
 'No password management. Email magic links for login. Role stored in public.users table.',
 'high', 'done', 'developer', 240);

-- ============================================================
-- DEVELOPMENT TASKS (Phase 1 remaining)
-- ============================================================

INSERT INTO tracker_items (project_id, category, title, description, priority, status, assigned_to, sort_order) VALUES
('10000000-0000-0000-0000-000000000001', 'task', 'Authentication (Supabase Auth + RLS)',
 'Magic link login, role-based sessions, RLS policies enforcing access. ~8-10 hours.',
 'blocking', 'done', 'developer', 300),

('10000000-0000-0000-0000-000000000001', 'task', 'Swap placeholder employee names with real roster',
 'Replace 32 placeholder names when Jaime sends the real employee list. ~2 hours.',
 'blocking', 'pending', 'developer', 310),

('10000000-0000-0000-0000-000000000001', 'task', 'Contract creation form',
 'Full form to create new contracts with all fields. React Hook Form + Zod. ~6 hours.',
 'high', 'pending', 'developer', 320),

('10000000-0000-0000-0000-000000000001', 'task', 'Contract edit form',
 'Edit existing contract details. Pre-populated form. ~4 hours.',
 'high', 'pending', 'developer', 330),

('10000000-0000-0000-0000-000000000001', 'task', 'Employee edit/detail view',
 'Click employee → detail panel with editable fields. ~4 hours.',
 'high', 'pending', 'developer', 340),

('10000000-0000-0000-0000-000000000001', 'task', 'Payroll calculation engine (simplified)',
 'Avg rate × hours estimates for Phase 1. Full prevailing wage engine in Phase 2. ~8 hours.',
 'high', 'pending', 'developer', 350),

('10000000-0000-0000-0000-000000000001', 'task', 'Office payroll view',
 'Payroll period summary with compensation table for office role. ~6 hours.',
 'high', 'pending', 'developer', 360),

('10000000-0000-0000-0000-000000000001', 'task', 'Payroll export (CSV/Sheets)',
 'Export payroll data as CSV download. ~3 hours.',
 'high', 'pending', 'developer', 370),

('10000000-0000-0000-0000-000000000001', 'task', 'Crew set CRUD',
 'Create, edit, delete crew sets. Foremen and admins can manage.',
 'medium', 'done', 'developer', 380),

('10000000-0000-0000-0000-000000000001', 'task', 'PDF upload UI for contracts and maps',
 'Upload contract PDFs and site maps to Supabase Storage. ~4 hours.',
 'medium', 'pending', 'developer', 390),

('10000000-0000-0000-0000-000000000001', 'task', 'Offline/PWA basics',
 'Service worker, IndexedDB cache for offline timesheet submission. ~8 hours.',
 'medium', 'pending', 'developer', 400),

('10000000-0000-0000-0000-000000000001', 'task', 'Bids section (list + create)',
 'Bid tracking for upcoming contract opportunities. ~4 hours.',
 'medium', 'pending', 'developer', 410),

('10000000-0000-0000-0000-000000000001', 'task', 'Owner view wiring to live data',
 'Connect Dad/owner view KPIs to real Supabase data. ~3 hours.',
 'medium', 'pending', 'developer', 420);

-- ============================================================
-- FEATURE REQUESTS
-- ============================================================

INSERT INTO tracker_items (project_id, category, title, description, priority, status, assigned_to, sort_order) VALUES
('10000000-0000-0000-0000-000000000001', 'feature', 'Telegram bot for operational notifications',
 'Timesheet submissions, OT alerts, compliance deadlines pushed to Telegram group.',
 'medium', 'pending', 'developer', 500),

('10000000-0000-0000-0000-000000000001', 'feature', 'Weather integration for spray operations',
 'Real-time weather data (wind, temp, humidity) for herbicide spray windows.',
 'low', 'pending', 'developer', 510),

('10000000-0000-0000-0000-000000000001', 'feature', 'Competitor bid tracking',
 'Track competitor bid prices for market intelligence.',
 'low', 'pending', 'developer', 520);
