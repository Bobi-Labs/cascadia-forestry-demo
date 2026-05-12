-- ─────────────────────────────────────────────────────────────────────────
-- Multi-price fields on units — same unit, multiple billing dimensions.
-- ─────────────────────────────────────────────────────────────────────────
--
-- Per Bees on May 13: a single unit can be priced multiple ways at the
-- same time. Common case: a thinning unit billed per-acre for the bulk
-- work AND per-hour for any clean-up time. The existing single
-- price_per_unit column collapses to one rate, forcing office to pick
-- one and lose the other.
--
-- Three additive columns. All NULL by default — backwards compatible.
-- The existing price_per_unit column stays for single-rate cases and
-- as a fallback if no specific column is populated.
--
--   price_per_tree   — planting work (Manulife, Weyerhaeuser plug units)
--   price_per_acre   — area-based work (PCT, thinning, herbicide)
--   price_per_hour   — time-based work (foreman, packer support)
--
-- Forms render only fields relevant to the unit's work type, but ANY
-- combination is allowed at the data layer. Office picks what to use
-- when invoicing.
-- ─────────────────────────────────────────────────────────────────────────

alter table units
  add column if not exists price_per_tree numeric,
  add column if not exists price_per_acre numeric,
  add column if not exists price_per_hour numeric;

comment on column units.price_per_tree is
  'Per-tree contract price (e.g. Manulife $0.2950/plug). NULL when not applicable. Pairs with amount when amount_type=tree.';

comment on column units.price_per_acre is
  'Per-acre contract price (e.g. PCT $250/acre). NULL when not applicable. Pairs with amount when amount_type=acre.';

comment on column units.price_per_hour is
  'Per-hour contract price (e.g. foreman support $40/hr). NULL when not applicable. Pairs with amount when amount_type=hour.';
