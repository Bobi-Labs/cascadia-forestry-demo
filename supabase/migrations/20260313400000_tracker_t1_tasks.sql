-- (T1) Sprint tasks: auth, work tracker, calendar, sidebar improvements
-- These track the Phase 1 development work completed in the T1 sprint

INSERT INTO tracker_items (project_id, category, title, description, priority, status, assigned_to, sort_order) VALUES

-- Auth features
('10000000-0000-0000-0000-000000000001', 'task', '(T1) Email+password auth login flow',
 'Supabase Auth login page at /auth/login with session management, auth context, and protected routes.',
 'high', 'done', 'Bees', 1000),

('10000000-0000-0000-0000-000000000001', 'task', '(T1) Forgot password flow',
 'Forgot password page at /auth/forgot-password using Supabase resetPasswordForEmail.',
 'high', 'done', 'Bees', 1010),

('10000000-0000-0000-0000-000000000001', 'task', '(T1) Change password in Settings',
 'Working change password form in Settings page via /api/auth/update-password.',
 'high', 'done', 'Bees', 1020),

('10000000-0000-0000-0000-000000000001', 'task', '(T1) Admin password reset for users',
 'Admin can reset user passwords via /api/auth/reset-password route using Supabase admin API.',
 'medium', 'done', 'Bees', 1030),

-- Work Tracker (CLIENT board)
('10000000-0000-0000-0000-000000000001', 'task', '(T1) Client Work Tracker board',
 'Full kanban+list board for the forestry app with 4 columns (To Do, In Progress, Blocked, Done), card creation, column move arrows, boxed filter groups.',
 'high', 'done', 'Bees', 1040),

('10000000-0000-0000-0000-000000000001', 'task', '(T1) Work Tracker filters — status/priority/category/user',
 'Boxed filter cards for Status, Priority, Category, and Assigned To with toggle pill buttons.',
 'medium', 'done', 'Bees', 1050),

-- Calendar
('10000000-0000-0000-0000-000000000001', 'task', '(T1) Calendar page redesign',
 'Rebuilt calendar with proper week rows, solid borders, circular today badge, month navigation arrows.',
 'medium', 'done', 'Bees', 1060),

('10000000-0000-0000-0000-000000000001', 'task', '(T1) Contract calendar tab with month nav',
 'Calendar tab in contract detail view with forward/back month navigation.',
 'low', 'done', 'Bees', 1070),

-- Sidebar & navigation
('10000000-0000-0000-0000-000000000001', 'task', '(T1) Role-based sidebar access for Work Tracker',
 'Work Tracker visible under Operations for admin, owner, and office roles. Proper section placement.',
 'medium', 'done', 'Bees', 1080),

('10000000-0000-0000-0000-000000000001', 'task', '(T1) Rename Dad to Jose in tracker users',
 'Updated all references from "Dad" to "Jose" in the work tracker user list.',
 'low', 'done', 'Bees', 1090),

-- OUR tracker improvements
('10000000-0000-0000-0000-000000000001', 'task', '(T1) Column move arrows on dev tracker cards',
 'Added forward/back arrow buttons on hover for kanban cards in the /tracker dev board.',
 'medium', 'done', 'Bees', 1100),

('10000000-0000-0000-0000-000000000001', 'task', '(T1) Summary strip above filters on client board',
 'Moved the To Do/In Progress/Blocked/Done count strip above the filter boxes on the client work tracker.',
 'low', 'done', 'Bees', 1110);
