-- Add a Discovery + Plan surface to deliverable items.
--
-- Used primarily on Item 7 (Scope + Data Discovery) to show the client
-- what we've found in their data, what the canonical model looks like,
-- and how Items 8-10 flow from that discovery. "Show our work" for a
-- billable scoping phase — also serves as a visible artifact for any
-- future discovery-style items.

ALTER TABLE deliverable_items
  ADD COLUMN discovery_plan_md text;
