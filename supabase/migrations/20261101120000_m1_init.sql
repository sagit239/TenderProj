-- Milestone 1: migration log and team members

-- Migration log, one row per applied migration (per environment)
create table if not exists public.app_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
alter table public.app_migrations enable row level security;
-- No policies: only the service role / SQL Editor can read or write

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  role text not null check (role in (
    'legal', 'accounting', 'team_manager', 'agent', 'division_manager', 'service_manager'
  )),
  email text not null check (position('@' in email) > 1),
  created_at timestamptz not null default now()
);
alter table public.team_members enable row level security;
create policy "authenticated full access" on public.team_members
  for all to authenticated using (true) with check (true);

insert into public.app_migrations (name) values ('20261101120000_m1_init')
  on conflict (name) do nothing;
