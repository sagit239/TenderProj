-- Milestone 10 (ADR-33): a details line on tasks, and re-analysis proposals that update
-- existing items in place, only when approved.

-- How and where to do the task (site, address, contact, email, phone, envelope, copies)
alter table public.tasks add column details text;

-- target_id set = the proposal updates that existing item (of item_type) instead of adding one.
-- old_payload = the old values at analysis time, for the "before" column.
-- No foreign key: target_id points at different tables; a deleted target is detected on accept.
alter table public.analysis_proposals
  add column target_id uuid,
  add column old_payload jsonb;

-- Same as M3, plus tasks.details
create or replace function public.save_analysis(p_run uuid, p_result jsonb) returns void
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
      insert into public.tasks (tender_id, deadline_id, title, details, type, due_at, has_time, sort_order)
        values (v_tender, dl.id, t ->> 'title', nullif(btrim(t ->> 'details'), ''),
                dl.type, dl.due_at, dl.has_time, pos);
      used := used || jsonb_build_object(t ->> 'deadline_key', true);
    else
      insert into public.tasks (tender_id, title, details, type, due_at, has_time, sort_order)
        values (
          v_tender, t ->> 'title', nullif(btrim(t ->> 'details'), ''), 'regular',
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

-- Saves a re-analysis: new items and updates of existing items become proposals;
-- existing items are not touched.
-- p_result: like save_analysis, plus missing: [{item_type, item_id, label}]
-- and changes: [{item_type, target_id, payload, old_payload}]
create or replace function public.save_reanalysis(p_run uuid, p_result jsonb) returns void
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

  insert into public.analysis_proposals (run_id, tender_id, item_type, payload, sort_order, target_id, old_payload)
    select p_run, v_tender, value ->> 'item_type', value -> 'payload', ordinality,
           (value ->> 'target_id')::uuid, value -> 'old_payload'
      from jsonb_array_elements(coalesce(p_result -> 'changes', '[]')) with ordinality;
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
           'changed', jsonb_array_length(coalesce(p_result -> 'changes', '[]')),
           'missing', coalesce(p_result -> 'missing', '[]')
         )
   where id = p_run;
  update public.tenders set analysis_status = 'done', analysis_error = null where id = v_tender;
end;
$$;

-- The return type changes (int -> jsonb), so the function is recreated
drop function public.accept_proposals(uuid, uuid[]);

-- Applies the approved proposals of a run; the other pending ones are rejected.
-- Updates (target_id set) change only the content of the existing item: assignees, "done",
-- the task-deadline link and "no reminder" stay. A deadline whose date changes drops the
-- reminder time chosen by hand (back to automatic). The existing triggers sync the linked
-- task, move the closing meeting and rebuild the reminders.
-- New items: an approved deadline gets its linked task: the first approved task pointing at it,
-- or a task named after the deadline (same rule as save_analysis, ADR-17).
-- Returns {added, updated}.
create function public.accept_proposals(p_run uuid, p_accept uuid[]) returns jsonb
language plpgsql as $$
declare
  v_tender uuid;
  p public.analysis_proposals%rowtype;
  d jsonb;
  dl public.deadlines%rowtype;
  ids jsonb := '{}';      -- deadline key -> new deadline id
  used jsonb := '{}';     -- deadline keys that already have their linked task
  linked uuid;
  k record;
  base int;
  added int := 0;
  updated int := 0;
  hit int;
begin
  select tender_id into v_tender from public.analysis_runs where id = p_run;
  if v_tender is null then
    raise exception 'analysis run % not found', p_run;
  end if;

  -- Updates of existing items
  for p in select * from public.analysis_proposals
            where run_id = p_run and status = 'pending' and target_id is not null
              and id = any (p_accept) order by sort_order loop
    d := p.payload;
    hit := 0;
    if p.item_type = 'requirement' then
      update public.requirements set text = coalesce(d ->> 'text', text)
       where id = p.target_id and tender_id = v_tender;
      get diagnostics hit = row_count;
    elsif p.item_type = 'deadline' then
      if d ? 'date' then
        update public.tasks set remind_at = null
         where deadline_id = p.target_id and remind_at is not null;
      end if;
      update public.deadlines
         set title = coalesce(d ->> 'title', title),
             due_at = case when d ? 'date'
                        then public.israel_ts((d ->> 'date')::date, (d ->> 'time')::time) else due_at end,
             has_time = case when d ? 'date' then d ->> 'time' is not null else has_time end,
             source_refs = coalesce(d -> 'source_refs', source_refs)
       where id = p.target_id and tender_id = v_tender;
      get diagnostics hit = row_count;
    elsif p.item_type = 'task' then
      update public.tasks
         set title = coalesce(d ->> 'title', title),
             details = coalesce(nullif(btrim(d ->> 'details'), ''), details),
             due_at = case when d ? 'date' and deadline_id is null
                        then public.israel_ts((d ->> 'date')::date, (d ->> 'time')::time) else due_at end,
             has_time = case when d ? 'date' and deadline_id is null
                          then d ->> 'time' is not null else has_time end
       where id = p.target_id and tender_id = v_tender;
      get diagnostics hit = row_count;
    elsif p.item_type = 'issue' then
      update public.issues
         set title = coalesce(d ->> 'title', title),
             explanation = coalesce(d ->> 'explanation', explanation),
             suggested_question = coalesce(d ->> 'suggested_question', suggested_question),
             source_refs = coalesce(d -> 'source_refs', source_refs)
       where id = p.target_id and tender_id = v_tender;
      get diagnostics hit = row_count;
    end if;
    -- An item deleted since the analysis cannot be updated
    update public.analysis_proposals
       set status = case when hit > 0 then 'accepted' else 'rejected' end
     where id = p.id;
    updated := updated + hit;
  end loop;

  select coalesce(max(sort_order), 0) into base from public.requirements where tender_id = v_tender;
  for p in select * from public.analysis_proposals
            where run_id = p_run and status = 'pending' and target_id is null and item_type = 'requirement'
              and id = any (p_accept) order by sort_order loop
    base := base + 1;
    insert into public.requirements (tender_id, text, sort_order)
      values (v_tender, p.payload ->> 'text', base);
    added := added + 1;
  end loop;

  for p in select * from public.analysis_proposals
            where run_id = p_run and status = 'pending' and target_id is null and item_type = 'deadline'
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
            where run_id = p_run and status = 'pending' and target_id is null and item_type = 'task'
              and id = any (p_accept) order by sort_order loop
    d := p.payload;
    base := base + 1;
    if ids ? (d ->> 'deadline_key') and not used ? (d ->> 'deadline_key') then
      select * into dl from public.deadlines where id = (ids ->> (d ->> 'deadline_key'))::uuid;
      insert into public.tasks (tender_id, deadline_id, title, details, type, due_at, has_time, sort_order)
        values (v_tender, dl.id, d ->> 'title', nullif(btrim(d ->> 'details'), ''),
                dl.type, dl.due_at, dl.has_time, base);
      used := used || jsonb_build_object(d ->> 'deadline_key', true);
    else
      insert into public.tasks (tender_id, title, details, type, due_at, has_time, sort_order)
        values (
          v_tender, d ->> 'title', nullif(btrim(d ->> 'details'), ''), 'regular',
          case when d ->> 'date' is not null
            then public.israel_ts((d ->> 'date')::date, (d ->> 'time')::time) end,
          d ->> 'time' is not null, base
        );
    end if;
    added := added + 1;
  end loop;

  -- Approved deadlines without an approved task get one named after the deadline
  for k in select key, value from jsonb_each_text(ids) loop
    if not used ? k.key then
      base := base + 1;
      select * into dl from public.deadlines where id = k.value::uuid;
      insert into public.tasks (tender_id, deadline_id, title, type, due_at, has_time, sort_order)
        values (v_tender, dl.id, dl.title, dl.type, dl.due_at, dl.has_time, base);
    end if;
  end loop;

  select coalesce(max(sort_order), 0) into base from public.issues where tender_id = v_tender;
  for p in select * from public.analysis_proposals
            where run_id = p_run and status = 'pending' and target_id is null and item_type = 'issue'
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
  return jsonb_build_object('added', added, 'updated', updated);
end;
$$;

-- A recreated function needs its rights again (ADR-26); accept runs from the browser
revoke execute on function public.accept_proposals(uuid, uuid[]) from public, anon;
grant execute on function public.accept_proposals(uuid, uuid[]) to authenticated, service_role;

insert into public.app_migrations (name) values ('20261110120000_m10_item_updates')
  on conflict (name) do nothing;
