-- Add pending_approval to timesheet_status enum.
--
-- Context: the approval workflow migration
-- (20260317000000_approval_workflow_statuses.sql) added pending_approval
-- to contract_status and pending to unit_status, but timesheet_status
-- was missed. The office timesheet flow (office submits → admin
-- approves) needs the same intermediate state that contracts have, and
-- lib/ops-bots.ts + alert-bell queries already filter on
-- ["submitted", "pending_approval"] for timesheets.
--
-- This is a purely additive enum change — no existing rows change,
-- no columns added or altered.

ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'pending_approval';
