-- Milestone 4: task assignees, task <-> deadline sync, paired deletes, re-analysis proposals

-- Several assignees per task (ADR-7); deleting a team member removes them from tasks
create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  team_member_id uuid not null references public.team_members (id) on delete cascade,
  primary key (task_id, team_member_id)
);
create index task_assignees_member_idx on public.task_assignees (team_member_id);
alter table public.task_assignees enable row level security;
create policy "authenticated full access" on public.task_assignees
  for all to authenticated using (true) with check (true);

-- New items from a re-analysis, waiting for approval (ADR-5)
create table public.analysis_proposals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.analysis_runs (id) on delete cascade,
  tender_id uuid not null references public.tenders (id) on delete cascade,
  item_type text not null check (item_type in ('requirement', 'deadline', 'task', 'issue')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index analysis_proposals_run_idx on public.analysis_proposals (run_id);
create index analysis_proposals_tender_idx on public.analysis_proposals (tender_id);
alter table public.analysis_proposals enable row level security;
create policy "authenticated full access" on public.analysis_proposals
  for all to authenticated using (true) with check (true);

alter table public.analysis_runs
  add column is_reanalysis boolean not null default false;

-- Set when the user deletes the automatic closing meeting, so it is not created again
alter table public.tenders
  add column closing_meeting_dismissed boolean not null default false;

-- A deadline and its linked task are a pair: deleting the deadline deletes the task
alter table public.tasks drop constraint tasks_deadline_id_fkey;
alter table public.tasks
  add constraint tasks_deadline_id_fkey foreign key (deadline_id)
  references public.deadlines (id) on delete cascade;

-- ...and deleting the linked task (directly, not through a cascade) deletes the deadline
create function public.tasks_delete_pair_trigger() returns trigger
language plpgsql as $$
begin
  if old.deadline_id is not null and pg_trigger_depth() = 1 then
    delete from public.deadlines where id = old.deadline_id;
  end if;
  return null;
end;
$$;

create trigger tasks_delete_pair
  after delete on public.tasks
  for each row execute function public.tasks_delete_pair_trigger();

-- Deleting the automatic closing meeting by hand keeps it from coming back
create function public.deadlines_dismiss_closing_trigger() returns trigger
language plpgsql as $$
begin
  if old.is_auto and coalesce(current_setting('app.closing_sync', true), '') <> 'on' then
    update public.tenders set closing_meeting_dismissed = true where id = old.tender_id;
  end if;
  return null;
end;
$$;

create trigger deadlines_dismiss_closing
  after delete on public.deadlines
  for each row execute function public.deadlines_dismiss_closing_trigger();

-- Same as M3, plus: respects a dismissed meeting, and marks its own deletes as internal
create or replace function public.sync_closing_meeting(p_tender uuid) returns void
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
      perform set_config('app.closing_sync', 'on', true);
      delete from public.deadlines where id = auto.id;
      perform set_config('app.closing_sync', 'off', true);
    end if;
    return;
  end if;

  meeting := public.israel_ts(
    public.workdays_before((submission at time zone 'Asia/Jerusalem')::date, 3)
  );

  if auto.id is null then
    if exists (select 1 from public.tenders where id = p_tender and closing_meeting_dismissed) then
      return;
    end if;
    insert into public.deadlines (tender_id, type, title, due_at, has_time, is_auto)
      values (p_tender, 'closing_meeting', 'פגישת סגירת פינות', meeting, false, true)
      returning * into auto;
    insert into public.tasks (tender_id, deadline_id, title, type, due_at, has_time, sort_order)
      select p_tender, auto.id, 'פגישת סגירת פינות', 'closing_meeting', meeting, false,
             coalesce(max(sort_order), 0) + 1
        from public.tasks where tender_id = p_tender;
  elsif not auto.is_manual and auto.due_at <> meeting then
    update public.deadlines set due_at = meeting, has_time = false where id = auto.id;
  end if;
end;
$$;

-- Deadline -> linked tasks: date, time and type follow the deadline. Editing by hand
-- (is_manual) also marks the task, so an edited closing meeting is no longer moved.
create function public.deadlines_sync_tasks_trigger() returns trigger
language plpgsql as $$
begin
  if new.due_at is distinct from old.due_at or new.has_time is distinct from old.has_time
     or new.type is distinct from old.type or (new.is_manual and not old.is_manual) then
    update public.tasks t
       set due_at = new.due_at, has_time = new.has_time, type = new.type,
           is_manual = t.is_manual or new.is_manual
     where t.deadline_id = new.id
       and (t.due_at is distinct from new.due_at or t.has_time is distinct from new.has_time
            or t.type is distinct from new.type or (new.is_manual and not t.is_manual));
  end if;
  return null;
end;
$$;

create trigger deadlines_sync_tasks
  after update on public.deadlines
  for each row execute function public.deadlines_sync_tasks_trigger();

-- Linked task -> deadline: changing the task's date changes the deadline
create function public.tasks_sync_deadline_trigger() returns trigger
language plpgsql as $$
begin
  if new.deadline_id is not null
     and (new.due_at is distinct from old.due_at or new.has_time is distinct from old.has_time)
     and new.due_at is not null then
    update public.deadlines d
       set due_at = new.due_at, has_time = new.has_time, is_manual = d.is_manual or new.is_manual
     where d.id = new.deadline_id
       and (d.due_at is distinct from new.due_at or d.has_time is distinct from new.has_time
            or (new.is_manual and not d.is_manual));
  end if;
  return null;
end;
$$;

create trigger tasks_sync_deadline
  after update on public.tasks
  for each row execute function public.tasks_sync_deadline_trigger();

-- A deadline added by hand gets its linked task, like analysed deadlines (ADR-17)
create function public.deadlines_manual_task_trigger() returns trigger
language plpgsql as $$
begin
  if new.is_manual then
    insert into public.tasks
        (tender_id, deadline_id, title, type, due_at, has_time, is_manual, sort_order)
      select new.tender_id, new.id, new.title, new.type, new.due_at, new.has_time, true,
             coalesce(max(sort_order), 0) + 1
        from public.tasks where tender_id = new.tender_id;
  end if;
  return null;
end;
$$;

create trigger deadlines_manual_task
  after insert on public.deadlines
  for each row execute function public.deadlines_manual_task_trigger();

-- Re-analysis is allowed now; only a double start is blocked.
-- A run is a re-analysis when the tender already has a successful run.
create or replace function public.start_analysis(p_tender uuid) returns uuid
language plpgsql as $$
declare
  run_id uuid;
begin
  update public.tenders
     set analysis_status = 'running', analysis_started_at = now(), analysis_error = null
   where id = p_tender
     and not (analysis_status = 'running' and analysis_started_at > now() - interval '5 minutes');
  if not found then
    return null;
  end if;

  -- A run that never finished (timed out) can no longer save its results
  update public.analysis_runs set status = 'failed', error = 'timeout', finished_at = now()
   where tender_id = p_tender and status = 'running';

  insert into public.analysis_runs (tender_id, is_reanalysis)
    values (
      p_tender,
      exists (select 1 from public.analysis_runs where tender_id = p_tender and status = 'done')
    )
    returning id into run_id;
  return run_id;
end;
$$;

-- Saves a re-analysis: new items become proposals, existing items are not touched.
-- p_result: like save_analysis, plus missing: [{item_type, item_id, label}]
create function public.save_reanalysis(p_run uuid, p_result jsonb) returns void
language plpgsql as $$
declare
  v_tender uuid;
begin
  select r.tender_id into v_tender
    from public.analysis_runs r join public.tenders tn on tn.id = r.tender_id
   where r.id = p_run and r.status = 'running' and r.is_reanalysis
     and tn.analysis_status = 'running'
   for update;
  if v_tender is null then
    raise exception 'analysis run % is not a running re-analysis', p_run;
  end if;

  insert into public.analysis_proposals (run_id, tender_id, item_type, payload, sort_order)
    select p_run, v_tender, 'requirement', jsonb_build_object('text', value #>> '{}'), ordinality
      from jsonb_array_elements(p_result -> 'requirements') with ordinality;
  insert into public.analysis_proposals (run_id, tender_id, item_type, payload, sort_order)
    select p_run, v_tender, 'deadline', value, ordinality
      from jsonb_array_elements(p_result -> 'deadlines') with ordinality;
  insert into public.analysis_proposals (run_id, tender_id, item_type, payload, sort_order)
    select p_run, v_tender, 'task', value, ordinality
      from jsonb_array_elements(p_result -> 'tasks') with ordinality;
  insert into public.analysis_proposals (run_id, tender_id, item_type, payload, sort_order)
    select p_run, v_tender, 'issue', value, ordinality
      from jsonb_array_elements(p_result -> 'issues') with ordinality;

  update public.tender_documents td
     set read_warning = doc ->> 'read_warning', read_note = doc ->> 'read_note', analyzed_at = now()
    from jsonb_array_elements(p_result -> 'documents') doc
   where td.id = (doc ->> 'id')::uuid and td.tender_id = v_tender;

  update public.analysis_runs
     set status = 'done', finished_at = now(), model = p_result ->> 'model',
         input_tokens = (p_result ->> 'input_tokens')::int,
         output_tokens = (p_result ->> 'output_tokens')::int,
         change_report = jsonb_build_object(
           'added', jsonb_build_object(
             'requirements', jsonb_array_length(p_result -> 'requirements'),
             'deadlines', jsonb_array_length(p_result -> 'deadlines'),
             'tasks', jsonb_array_length(p_result -> 'tasks'),
             'issues', jsonb_array_length(p_result -> 'issues')
           ),
           'missing', coalesce(p_result -> 'missing', '[]')
         )
   where id = p_run;
  update public.tenders set analysis_status = 'done', analysis_error = null where id = v_tender;
end;
$$;

revoke execute on function public.save_reanalysis(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_reanalysis(uuid, jsonb) to service_role;

-- Adds the approved proposals of a run as items; the other pending ones are rejected.
-- An approved deadline gets its linked task: the first approved task pointing at it,
-- or a task named after the deadline (same rule as save_analysis, ADR-17).
create function public.accept_proposals(p_run uuid, p_accept uuid[]) returns int
language plpgsql as $$
declare
  v_tender uuid;
  p public.analysis_proposals%rowtype;
  d jsonb;
  dl public.deadlines%rowtype;
  ids jsonb := '{}';      -- deadline key -> new deadline id
  used jsonb := '{}';     -- deadline keys that already have their linked task
  linked uuid;
  base int;
  added int := 0;
begin
  select tender_id into v_tender from public.analysis_runs where id = p_run;
  if v_tender is null then
    raise exception 'analysis run % not found', p_run;
  end if;

  select coalesce(max(sort_order), 0) into base from public.requirements where tender_id = v_tender;
  for p in select * from public.analysis_proposals
            where run_id = p_run and status = 'pending' and item_type = 'requirement'
              and id = any (p_accept) order by sort_order loop
    base := base + 1;
    insert into public.requirements (tender_id, text, sort_order)
      values (v_tender, p.payload ->> 'text', base);
    added := added + 1;
  end loop;

  for p in select * from public.analysis_proposals
            where run_id = p_run and status = 'pending' and item_type = 'deadline'
              and id = any (p_accept) order by sort_order loop
    d := p.payload;
    insert into public.deadlines (tender_id, type, title, due_at, has_time, source_refs)
      values (
        v_tender, d ->> 'type', d ->> 'title',
        public.israel_ts((d ->> 'date')::date, (d ->> 'time')::time),
        d ->> 'time' is not null, coalesce(d -> 'source_refs', '[]')
      )
      returning id into linked;
    ids := ids || jsonb_build_object(d ->> 'key', linked);
    added := added + 1;
  end loop;

  select coalesce(max(sort_order), 0) into base from public.tasks where tender_id = v_tender;
  for p in select * from public.analysis_proposals
            where run_id = p_run and status = 'pending' and item_type = 'task'
              and id = any (p_accept) order by sort_order loop
    d := p.payload;
    base := base + 1;
    if ids ? (d ->> 'deadline_key') and not used ? (d ->> 'deadline_key') then
      select * into dl from public.deadlines where id = (ids ->> (d ->> 'deadline_key'))::uuid;
      insert into public.tasks (tender_id, deadline_id, title, type, due_at, has_time, sort_order)
        values (v_tender, dl.id, d ->> 'title', dl.type, dl.due_at, dl.has_time, base);
      used := used || jsonb_build_object(d ->> 'deadline_key', true);
    else
      insert into public.tasks (tender_id, title, type, due_at, has_time, sort_order)
        values (
          v_tender, d ->> 'title', 'regular',
          case when d ->> 'date' is not null
            then public.israel_ts((d ->> 'date')::date, (d ->> 'time')::time) end,
          d ->> 'time' is not null, base
        );
    end if;
    added := added + 1;
  end loop;

  -- Approved deadlines without an approved task get one named after the deadline
  for d in select key, value from jsonb_each(ids) loop
    if not used ? (d ->> 'key') then
      base := base + 1;
      select * into dl from public.deadlines where id = (d ->> 'value')::uuid;
      insert into public.tasks (tender_id, deadline_id, title, type, due_at, has_time, sort_order)
        values (v_tender, dl.id, dl.title, dl.type, dl.due_at, dl.has_time, base);
    end if;
  end loop;

  select coalesce(max(sort_order), 0) into base from public.issues where tender_id = v_tender;
  for p in select * from public.analysis_proposals
            where run_id = p_run and status = 'pending' and item_type = 'issue'
              and id = any (p_accept) order by sort_order loop
    base := base + 1;
    insert into public.issues
        (tender_id, category, title, explanation, source_refs, suggested_question, sort_order)
      values (
        v_tender, p.payload ->> 'category', p.payload ->> 'title',
        coalesce(p.payload ->> 'explanation', ''), coalesce(p.payload -> 'source_refs', '[]'),
        coalesce(p.payload ->> 'suggested_question', ''), base
      );
    added := added + 1;
  end loop;

  update public.analysis_proposals
     set status = case when id = any (p_accept) then 'accepted' else 'rejected' end
   where run_id = p_run and status = 'pending';
  return added;
end;
$$;

insert into public.app_migrations (name) values ('20261102180000_m4_editing')
  on conflict (name) do nothing;
