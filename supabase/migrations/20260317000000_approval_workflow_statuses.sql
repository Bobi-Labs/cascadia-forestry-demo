-- Add pending_approval status to contract_status enum
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'pending_approval';

-- Add pending status to unit_status enum
ALTER TYPE unit_status ADD VALUE IF NOT EXISTS 'pending';
