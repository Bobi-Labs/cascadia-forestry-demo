-- Contract contacts table (replaces localStorage-based contacts)
create table if not exists public.contract_contacts (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  name text not null,
  title text not null default '',
  email text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast lookup by contract
create index if not exists idx_contract_contacts_contract_id on public.contract_contacts(contract_id);

-- Auto-update updated_at
create trigger set_contract_contacts_updated_at
  before update on public.contract_contacts
  for each row execute function handle_updated_at();

-- Dev open-read RLS (matches existing pattern — will be tightened with auth)
alter table public.contract_contacts enable row level security;

create policy "dev_anon_read" on public.contract_contacts
  for select using (true);

create policy "dev_anon_write" on public.contract_contacts
  for all using (true) with check (true);
