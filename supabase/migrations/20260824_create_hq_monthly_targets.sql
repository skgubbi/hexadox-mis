-- HQ-level monthly cumulative target values
create table if not exists public.hq_monthly_targets (
  id uuid primary key default gen_random_uuid(),
  hq_id uuid not null references public.hqs(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2020 and 2100),
  target_value numeric(14,2) not null check (target_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hq_id, month, year)
);

alter table public.hq_monthly_targets enable row level security;

-- Match the access policy used for the existing targets table:
-- grant authenticated users the same select/insert/update permissions
-- appropriate for their assigned HQs.
