-- Milestone 2: tenders, their documents, and the private Storage bucket

create table public.tenders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  department text not null check (department in ('medical', 'safety')),
  status text not null default 'reviewing' check (status in (
    'reviewing', 'preparing', 'not_bidding', 'submitted', 'won', 'lost'
  )),
  decided_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create index tenders_status_idx on public.tenders (status);
alter table public.tenders enable row level security;
create policy "authenticated full access" on public.tenders
  for all to authenticated using (true) with check (true);

-- Status dates: set on the transition, so they are right no matter where the change came from
create function public.tenders_set_status_dates() returns trigger
language plpgsql as $$
begin
  if new.status = 'not_bidding' and old.status <> 'not_bidding' then
    new.decided_at := now();
  end if;
  -- Entering the "submitted" group (also a direct jump to won / lost); moves inside the group keep the date
  if new.status in ('submitted', 'won', 'lost')
     and old.status not in ('submitted', 'won', 'lost') then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

create trigger tenders_status_dates
  before update of status on public.tenders
  for each row execute function public.tenders_set_status_dates();

create table public.tender_documents (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  file_type text not null check (file_type in ('pdf', 'word', 'excel')),
  created_at timestamptz not null default now()
);
create index tender_documents_tender_id_idx on public.tender_documents (tender_id);
alter table public.tender_documents enable row level security;
create policy "authenticated full access" on public.tender_documents
  for all to authenticated using (true) with check (true);

-- Private bucket for the original tender files (50MB per file)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tender-files', 'tender-files', false, 52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

create policy "tender files: authenticated read" on storage.objects
  for select to authenticated using (bucket_id = 'tender-files');
create policy "tender files: authenticated insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'tender-files');
create policy "tender files: authenticated update" on storage.objects
  for update to authenticated using (bucket_id = 'tender-files') with check (bucket_id = 'tender-files');
create policy "tender files: authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'tender-files');

insert into public.app_migrations (name) values ('20261102140000_m2_tenders')
  on conflict (name) do nothing;
