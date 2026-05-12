-- Add foreman assignment to contracts.
-- Each contract can have one primary foreman assigned.
-- The foreman_id references an employee with is_foreman = true.

ALTER TABLE contracts ADD COLUMN foreman_id uuid REFERENCES employees(id);

CREATE INDEX idx_contracts_foreman ON contracts(foreman_id);

COMMENT ON COLUMN contracts.foreman_id IS 'Primary foreman assigned to this contract. Must be an employee with is_foreman = true.';
