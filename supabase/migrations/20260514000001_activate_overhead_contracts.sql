-- ─────────────────────────────────────────────────────────────────────────
-- Activate Jaime's existing overhead-style contract rows + tag them.
-- ─────────────────────────────────────────────────────────────────────────
--
-- Companion to 20260514000000_overhead_contract_type. The enum value
-- has to be added in its own committed transaction before any UPDATE
-- can reference it, so this is a separate migration.
--
-- Rows being updated:
--   - Bids       (currently closed, no type)
--   - Shop       (currently closed, no type)
--   - Sick Time  (currently closed, no type)
--
-- After migration: active + contract_type='overhead'. The expense
-- assignment picker filters and sorts overhead rows to the top.
--
-- Adding a new "Hearing Work" row Jaime mentioned on the call but
-- hadn't created yet. Same shape — closed by default but available
-- as a category. Bees can add more via SQL or future UI.
-- ─────────────────────────────────────────────────────────────────────────

update contracts
set contract_type = 'overhead', status = 'active'
where lower(name) in ('bids', 'shop', 'sick time')
  and (contract_type is null or contract_type = 'other');

insert into contracts (name, contract_type, status, company_id, notes)
select 'Hearing Work', 'overhead', 'active',
       '00000000-0000-0000-0000-000000000002'::uuid, -- Ramos
       'Overhead category for hearing-protection / safety related expenses. Added 2026-05-14 per May 8 call.'
where not exists (select 1 from contracts where lower(name) = 'hearing work');
