-- ─────────────────────────────────────────────────────────────────────────
-- Bid price on deliverable_items — visible in the tracker BEFORE invoicing.
-- ─────────────────────────────────────────────────────────────────────────
--
-- Per the May 13 conversation: every scoped item should show its bid
-- price (the agreed-upon dollar amount) on the tracker card before
-- the invoice exists. Today the only price field is invoice_amount,
-- which is only set after the invoice is generated — so an item that's
-- scoped + agreed but pre-invoice has no visible price anywhere.
--
-- Adding two columns:
--
--   bid_price_cents  — the proposed/agreed price in CENTS (avoids
--                      float drift). Format on render with /100.
--                      $4,500 invoice → 450000 here.
--
--   bid_status       — proposed / approved / rejected. Lifecycle
--                      goes proposed → approved (Bees has confirmed
--                      with Jaime) → then invoice gets generated
--                      under the same number. NULL keeps backwards
--                      compat with all existing rows.
--
-- Convention: bid_price_cents stays populated AFTER invoice ships —
-- it's the historical bid, not a draft. invoice_amount is the actual
-- invoiced amount. They should match for clean items but can diverge
-- if scope grows mid-build.
-- ─────────────────────────────────────────────────────────────────────────

alter table deliverable_items
  add column if not exists bid_price_cents bigint,
  add column if not exists bid_status text;

comment on column deliverable_items.bid_price_cents is
  'Proposed/agreed price for this item in cents. Set when scope is locked + bid is given; stays populated after invoicing for historical reference. Pair with bid_status for lifecycle.';

comment on column deliverable_items.bid_status is
  'Bid lifecycle: proposed | approved | rejected. NULL = no bid logged yet (legacy row or pure-spec item). approved = Bees has confirmed price with Jaime; build can begin or invoice can go out.';

-- Light sanity check — only allow known statuses going forward.
alter table deliverable_items
  drop constraint if exists deliverable_items_bid_status_check;
alter table deliverable_items
  add constraint deliverable_items_bid_status_check
  check (bid_status is null or bid_status in ('proposed', 'approved', 'rejected'));
