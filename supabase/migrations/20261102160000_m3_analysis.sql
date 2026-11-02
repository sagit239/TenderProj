-- Milestone 3: AI analysis results, holidays, workday helpers and the automatic closing meeting

alter table public.tenders
  add column analysis_status text not null default 'idle'
    check (analysis_status in ('idle', 'running', 'done', 'failed')),
  add column analysis_started_at timestamptz,
  add column analysis_error text;

alter table public.tender_documents
  add column read_warning text check (read_warning in ('partial', 'unreadable')),
  add column read_note text,
  add column analyzed_at timestamptz;

create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  text text not null,
  sort_order int not null default 0,
  is_manual boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  type text not null check (type in (
    'submission', 'bidders_meeting', 'clarification_questions', 'closing_meeting', 'other'
  )),
  title text not null,
  due_at timestamptz not null,
  has_time boolean not null default true,
  source_refs jsonb not null default '[]',
  is_manual boolean not null default false,
  is_auto boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  deadline_id uuid references public.deadlines (id) on delete set null,
  title text not null,
  type text not null default 'regular' check (type in (
    'submission', 'bidders_meeting', 'clarification_questions', 'closing_meeting', 'other', 'regular'
  )),
  -- Null: an AI task with no date of its own
  due_at timestamptz,
  has_time boolean not null default true,
  is_done boolean not null default false,
  remind_at timestamptz,
  is_manual boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  category text not null check (category in (
    'threshold', 'guarantees', 'penalties', 'liability',
    'insurance', 'payment_terms', 'one_sided', 'contradictions'
  )),
  title text not null,
  explanation text not null default '',
  source_refs jsonb not null default '[]',
  suggested_question text not null default '',
  is_manual boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  error text,
  model text,
  input_tokens int,
  output_tokens int,
  change_report jsonb,
  created_at timestamptz not null default now()
);

create index requirements_tender_id_idx on public.requirements (tender_id);
create index deadlines_tender_id_idx on public.deadlines (tender_id);
create index tasks_tender_id_idx on public.tasks (tender_id);
create index tasks_deadline_id_idx on public.tasks (deadline_id);
create index issues_tender_id_idx on public.issues (tender_id);
create index analysis_runs_tender_id_idx on public.analysis_runs (tender_id);

alter table public.requirements enable row level security;
alter table public.deadlines enable row level security;
alter table public.tasks enable row level security;
alter table public.issues enable row level security;
alter table public.analysis_runs enable row level security;
create policy "authenticated full access" on public.requirements
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.deadlines
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.tasks
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.issues
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.analysis_runs
  for all to authenticated using (true) with check (true);

create table public.holidays (
  date date primary key,
  name text not null
);
alter table public.holidays enable row level security;
create policy "authenticated read" on public.holidays
  for select to authenticated using (true);

-- Workdays: not Friday, not Saturday, not a holiday (ADR-6)
create function public.is_workday(d date) returns boolean
language sql stable as $$
  select extract(isodow from d) not in (5, 6)
     and not exists (select 1 from public.holidays h where h.date = d);
$$;

-- The n-th workday before d
create function public.workdays_before(d date, n int) returns date
language plpgsql stable as $$
declare
  result date := d;
  counted int := 0;
begin
  while counted < n loop
    result := result - 1;
    if public.is_workday(result) then
      counted := counted + 1;
    end if;
  end loop;
  return result;
end;
$$;

-- A date (and optional time) in Israel time; no time means 08:00
create function public.israel_ts(d date, t time default null) returns timestamptz
language sql immutable as $$
  select (d + coalesce(t, time '08:00')) at time zone 'Asia/Jerusalem';
$$;

-- Keeps the automatic closing meeting 3 workdays before the earliest submission deadline,
-- unless someone edited it by hand
create function public.sync_closing_meeting(p_tender uuid) returns void
language plpgsql as $$
declare
  submission timestamptz;
  meeting timestamptz;
  auto public.deadlines%rowtype;
begin
  select min(due_at) into submission
    from public.deadlines where tender_id = p_tender and type = 'submission';
  select * into auto
    from public.deadlines where tender_id = p_tender and is_auto limit 1;

  if submission is null then
    if auto.id is not null and not auto.is_manual then
      delete from public.tasks where deadline_id = auto.id;
      delete from public.deadlines where id = auto.id;
    end if;
    return;
  end if;

  meeting := public.israel_ts(
    public.workdays_before((submission at time zone 'Asia/Jerusalem')::date, 3)
  );

  if auto.id is null then
    insert into public.deadlines (tender_id, type, title, due_at, has_time, is_auto)
      values (p_tender, 'closing_meeting', 'פגישת סגירת פינות', meeting, false, true)
      returning * into auto;
    insert into public.tasks (tender_id, deadline_id, title, type, due_at, has_time, sort_order)
      select p_tender, auto.id, 'פגישת סגירת פינות', 'closing_meeting', meeting, false,
             coalesce(max(sort_order), 0) + 1
        from public.tasks where tender_id = p_tender;
  elsif not auto.is_manual and auto.due_at <> meeting then
    update public.deadlines set due_at = meeting, has_time = false where id = auto.id;
    update public.tasks set due_at = meeting, has_time = false where deadline_id = auto.id;
  end if;
end;
$$;

create function public.deadlines_closing_meeting_trigger() returns trigger
language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.type = 'submission' then
    perform public.sync_closing_meeting(old.tender_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.type = 'submission'
     and (tg_op = 'INSERT' or old.type <> 'submission' or old.tender_id <> new.tender_id) then
    perform public.sync_closing_meeting(new.tender_id);
  end if;
  return null;
end;
$$;

create trigger deadlines_closing_meeting
  after insert or update or delete on public.deadlines
  for each row execute function public.deadlines_closing_meeting_trigger();

-- Atomic guard against a double start: returns the new run id, or null if an analysis
-- is already running (started less than 5 minutes ago) or already succeeded (re-analysis is M4)
create function public.start_analysis(p_tender uuid) returns uuid
language plpgsql as $$
declare
  run_id uuid;
begin
  update public.tenders
     set analysis_status = 'running', analysis_started_at = now(), analysis_error = null
   where id = p_tender
     and analysis_status <> 'done'
     and not (analysis_status = 'running' and analysis_started_at > now() - interval '5 minutes');
  if not found then
    return null;
  end if;

  -- A run that never finished (timed out) can no longer save its results
  update public.analysis_runs set status = 'failed', error = 'timeout', finished_at = now()
   where tender_id = p_tender and status = 'running';

  insert into public.analysis_runs (tender_id) values (p_tender) returning id into run_id;
  return run_id;
end;
$$;

-- Saves everything in one transaction. p_result (prepared by the server):
-- { model, input_tokens, output_tokens,
--   requirements: [text], deadlines: [{key, type, title, date, time, source_refs}],
--   tasks: [{title, deadline_key, date, time}], issues: [{category, title, explanation,
--   source_refs, suggested_question}], documents: [{id, read_warning, read_note}] }
create function public.save_analysis(p_run uuid, p_result jsonb) returns void
language plpgsql as $$
declare
  v_tender uuid;
  d jsonb;
  t jsonb;
  new_id uuid;
  ids jsonb := '{}';      -- deadline key -> id
  used jsonb := '{}';     -- deadline keys that already have their linked task
  dl public.deadlines%rowtype;
  pos int := 0;
begin
  select r.tender_id into v_tender
    from public.analysis_runs r join public.tenders tn on tn.id = r.tender_id
   where r.id = p_run and r.status = 'running' and tn.analysis_status = 'running'
   for update;
  if v_tender is null then
    raise exception 'analysis run % is not running', p_run;
  end if;

  insert into public.requirements (tender_id, text, sort_order)
    select v_tender, value #>> '{}', ordinality
      from jsonb_array_elements(p_result -> 'requirements') with ordinality;

  for d in select * from jsonb_array_elements(p_result -> 'deadlines') loop
    insert into public.deadlines (tender_id, type, title, due_at, has_time, source_refs)
      values (
        v_tender, d ->> 'type', d ->> 'title',
        public.israel_ts((d ->> 'date')::date, (d ->> 'time')::time),
        d ->> 'time' is not null, coalesce(d -> 'source_refs', '[]')
      )
      returning id into new_id;
    ids := ids || jsonb_build_object(d ->> 'key', new_id);
  end loop;

  -- AI tasks in order; the first task pointing at a deadline becomes that deadline's linked task
  for t in select * from jsonb_array_elements(p_result -> 'tasks') loop
    pos := pos + 1;
    if ids ? (t ->> 'deadline_key') and not used ? (t ->> 'deadline_key') then
      select * into dl from public.deadlines where id = (ids ->> (t ->> 'deadline_key'))::uuid;
      insert into public.tasks (tender_id, deadline_id, title, type, due_at, has_time, sort_order)
        values (v_tender, dl.id, t ->> 'title', dl.type, dl.due_at, dl.has_time, pos);
      used := used || jsonb_build_object(t ->> 'deadline_key', true);
    else
      insert into public.tasks (tender_id, title, type, due_at, has_time, sort_order)
        values (
          v_tender, t ->> 'title', 'regular',
          case when t ->> 'date' is not null
            then public.israel_ts((t ->> 'date')::date, (t ->> 'time')::time) end,
          t ->> 'time' is not null, pos
        );
    end if;
  end loop;

  -- Every deadline gets a linked task of its type (reminders by type, M5)
  for d in select * from jsonb_array_elements(p_result -> 'deadlines') loop
    if not used ? (d ->> 'key') then
      pos := pos + 1;
      select * into dl from public.deadlines where id = (ids ->> (d ->> 'key'))::uuid;
      insert into public.tasks (tender_id, deadline_id, title, type, due_at, has_time, sort_order)
        values (v_tender, dl.id, dl.title, dl.type, dl.due_at, dl.has_time, pos);
      used := used || jsonb_build_object(d ->> 'key', true);
    end if;
  end loop;

  insert into public.issues
      (tender_id, category, title, explanation, source_refs, suggested_question, sort_order)
    select v_tender, value ->> 'category', value ->> 'title', coalesce(value ->> 'explanation', ''),
           coalesce(value -> 'source_refs', '[]'), coalesce(value ->> 'suggested_question', ''),
           ordinality
      from jsonb_array_elements(p_result -> 'issues') with ordinality;

  update public.tender_documents td
     set read_warning = doc ->> 'read_warning', read_note = doc ->> 'read_note', analyzed_at = now()
    from jsonb_array_elements(p_result -> 'documents') doc
   where td.id = (doc ->> 'id')::uuid and td.tender_id = v_tender;

  update public.analysis_runs
     set status = 'done', finished_at = now(), model = p_result ->> 'model',
         input_tokens = (p_result ->> 'input_tokens')::int,
         output_tokens = (p_result ->> 'output_tokens')::int
   where id = p_run;
  update public.tenders set analysis_status = 'done', analysis_error = null where id = v_tender;
end;
$$;

create function public.fail_analysis(p_run uuid, p_error text) returns void
language plpgsql as $$
begin
  update public.analysis_runs
     set status = 'failed', error = p_error, finished_at = now()
   where id = p_run and status = 'running';
  if found then
    update public.tenders t set analysis_status = 'failed', analysis_error = p_error
      from public.analysis_runs r
     where r.id = p_run and t.id = r.tender_id and t.analysis_status = 'running';
  end if;
end;
$$;

-- Saving and failing are done only by the server (service role)
revoke execute on function public.save_analysis(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_analysis(uuid, text) from public, anon, authenticated;
grant execute on function public.save_analysis(uuid, jsonb) to service_role;
grant execute on function public.fail_analysis(uuid, text) to service_role;

insert into public.app_migrations (name) values ('20261102160000_m3_analysis')
  on conflict (name) do nothing;
