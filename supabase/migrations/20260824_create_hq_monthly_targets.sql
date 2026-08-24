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

create policy "hq monthly targets read assigned hqs"
on public.hq_monthly_targets for select to authenticated
using (
  exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.active = true
      and (
        p.role in ('Admin', 'ABM')
        or exists (
          select 1 from public.user_hq_mapping m
          where m.user_id = auth.uid()
            and m.hq_id = hq_monthly_targets.hq_id
        )
      )
  )
);

create policy "hq monthly targets write admin abm"
on public.hq_monthly_targets for all to authenticated
using (
  exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.active = true
      and p.role in ('Admin', 'ABM')
  )
)
with check (
  exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.active = true
      and p.role in ('Admin', 'ABM')
  )
);