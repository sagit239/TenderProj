-- Milestone 11 (ADR-34): the text as it came from the documents ("חזרה למקור"), a source for
-- requirements and tasks, and the requirement each task belongs to.

alter table public.requirements
  add column source_refs jsonb not null default '[]',
  add column original jsonb;
alter table public.deadlines add column original jsonb;
alter table public.issues add column original jsonb;
alter table public.tasks
  add column original jsonb,
  -- Deleting a requirement keeps its tasks
  add column requirement_id uuid references public.requirements (id) on delete set null;
create index tasks_requirement_id_idx on public.tasks (requirement_id);

-- original: the last text that came from the documents, by column name.
-- null = not from the analysis (added by hand, or the automatic closing meeting);
-- {} = from the analysis, but edited before this milestone, so its text is not known.

create function public.task_original(p_title text, p_details text) returns jsonb
language sql immutable as $$
  select jsonb_build_object('title', p_title, 'details', nullif(btrim(p_details), ''));
$$;

create function public.issue_original(p_issue jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'title', p_issue ->> 'title',
    'explanation', coalesce(p_issue ->> 'explanation', ''),
    'suggested_question', coalesce(p_issue ->> 'suggested_question', '')
  );
$$;

-- An approved update replaces the fields it changed; an item added by hand keeps no original
create function public.updated_original(p_original jsonb, p_changes jsonb, p_fields text[]) returns jsonb
language sql immutable as $$
  select p_original || coalesce(
    (select jsonb_object_agg(f, p_changes -> f) from unnest(p_fields) f where p_changes ->> f is not null),
    '{}'
  );
$$;

-- A requirement from the analysis: {key, text, source_refs}, or a plain string (before M11)
create function public.requirement_item(p_value jsonb) returns jsonb
language sql immutable as $$
  select case jsonb_typeof(p_value)
    when 'string' then jsonb_build_object('text', p_value #>> '{}') else p_value end;
$$;

-- accept_proposals runs from the browser and uses these (explicit rights, ADR-26)
revoke execute on function public.task_original(text, text) from public, anon;
revoke execute on function public.issue_original(jsonb) from public, anon;
revoke execute on function public.updated_original(jsonb, jsonb, text[]) from public, anon;
revoke execute on function public.requirement_item(jsonb) from public, anon;
grant execute on function public.task_original(text, text) to authenticated, service_role;
grant execute on function public.issue_original(jsonb) to authenticated, service_role;
grant execute on function public.updated_original(jsonb, jsonb, text[]) to authenticated, service_role;
grant execute on function public.requirement_item(jsonb) to authenticated, service_role;

-- Existing items. Unedited: the current text. Edited, but created by an analysis
-- (same transaction time as its run): {}. No trigger needs to run for this.
alter table public.deadlines disable trigger user;
alter table public.tasks disable trigger user;

update public.requirements set original = jsonb_build_object('text', text) where not is_manual;
update public.deadlines set original = jsonb_build_object('title', title) where not is_manual and not is_auto;
update public.tasks set original = public.task_original(title, details)
 where not is_manual and type <> 'closing_meeting';
update public.issues
   set original = jsonb_build_object('title', title, 'explanation', explanation, 'suggested_question', suggested_question)
 where not is_manual;

update public.requirements x set original = '{}' where is_manual and exists
  (select 1 from public.analysis_runs r where r.tender_id = x.tender_id and r.finished_at = x.created_at);
update public.deadlines x set original = '{}' where is_manual and not is_auto and exists
  (select 1 from public.analysis_runs r where r.tender_id = x.tender_id and r.finished_at = x.created_at);
update public.tasks x set original = '{}' where is_manual and type <> 'closing_meeting' and exists
  (select 1 from public.analysis_runs r where r.tender_id = x.tender_id and r.finished_at = x.created_at);
update public.issues x set original = '{}' where is_manual and exists
  (select 1 from public.analysis_runs r where r.tender_id = x.tender_id and r.finished_at = x.created_at);

alter table public.deadlines enable trigger user;
alter table public.tasks enable trigger user;

-- Same as M6, but a task keeps its own source when it has one
create or replace function public.detach_other_deadline(p_deadline uuid) returns void
language plpgsql as $$
declare
  d public.deadlines%rowtype;
begin
  select * into d from public.deadlines where id = p_deadline;
  if not found then
    return;
  end if;
  update public.tasks
     set deadline_id = null, type = 'regular',
         source_refs = case when source_refs = '[]' then d.source_refs else source_refs end
   where deadline_id = d.id;
  delete from public.deadlines where id = d.id;
end;
$$;

-- Same as M10, plus sources, original texts and the requirement of each task
create or replace function public.save_analysis(p_run uuid, p_result jsonb) returns void
language plpgsql as $$
declare
  v_tender uuid;
  d jsonb;
  t jsonb;
  r jsonb;
  new_id uuid;
  req_id uuid;
  reqs jsonb := '{}';     -- requirement key -> id
  ids jsonb := '{}';      -- deadline key -> id
  used jsonb := '{}';     -- deadline keys that already have their linked task
  dl public.deadlines%rowtype;
  pos int := 0;
begin
  select ar.tender_id into v_tender
    from public.analysis_runs ar join public.tenders tn on tn.id = ar.tender_id
   where ar.id = p_run and ar.status = 'running' and tn.analysis_status = 'running'
   for update;
  if v_tender is null then
    raise exception 'analysis run % is not running', p_run;
  end if;

  for r in select public.requirement_item(value)
             from jsonb_array_elements(p_result -> 'requirements') with ordinality order by ordinality loop
    pos := pos + 1;
    insert into public.requirements (tender_id, text, source_refs, original, sort_order)
      values (v_tender, r ->> 'text', coalesce(r -> 'source_refs', '[]'),
              jsonb_build_object('text', r ->> 'text'), pos)
      returning id into new_id;
    if r ->> 'key' is not null then
      reqs := reqs || jsonb_build_object(r ->> 'key', new_id);
    end if;
  end loop;
  pos := 0;

  for d in select * from jsonb_array_elements(p_result -> 'deadlines') loop
    insert into public.deadlines (tender_id, type, title, due_at, has_time, source_refs, original)
      values (
        v_tender, d ->> 'type', d ->> 'title',
        public.israel_ts((d ->> 'date')::date, (d ->> 'time')::time),
        d ->> 'time' is not null, coalesce(d -> 'source_refs', '[]'),
        jsonb_build_object('title', d ->> 'title')
      )
      returning id into new_id;
    ids := ids || jsonb_build_object(d ->> 'key', new_id);
  end loop;

  -- AI tasks in order; the first task pointing at a deadline becomes that deadline's linked task
  for t in select * from jsonb_array_elements(p_result -> 'tasks') loop
    pos := pos + 1;
    req_id := (reqs ->> (t ->> 'requirement_key'))::uuid;
    if ids ? (t ->> 'deadline_key') and not used ? (t ->> 'deadline_key') then
      select * into dl from public.deadlines where id = (ids ->> (t ->> 'deadline_key'))::uuid;
      insert into public.tasks (tender_id, deadline_id, requirement_id, title, details, source_refs, original,
                                type, due_at, has_time, sort_order)
        values (v_tender, dl.id, req_id, t ->> 'title', nullif(btrim(t ->> 'details'), ''),
                coalesce(t -> 'source_refs', '[]'), public.task_original(t ->> 'title', t ->> 'details'),
                dl.type, dl.due_at, dl.has_time, pos);
      used := used || jsonb_build_object(t ->> 'deadline_key', true);
    else
      insert into public.tasks (tender_id, requirement_id, title, details, source_refs, original,
                                type, due_at, has_time, sort_order)
        values (
          v_tender, req_id, t ->> 'title', nullif(btrim(t ->> 'details'), ''),
          coalesce(t -> 'source_refs', '[]'), public.task_original(t ->> 'title', t ->> 'details'), 'regular',
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
      insert into public.tasks (tender_id, deadline_id, title, source_refs, original, type, due_at, has_time, sort_order)
        values (v_tender, dl.id, dl.title, dl.source_refs, public.task_original(dl.title, null),
                dl.type, dl.due_at, dl.has_time, pos);
      used := used || jsonb_build_object(d ->> 'key', true);
    end if;
  end loop;

  insert into public.issues
      (tender_id, category, title, explanation, source_refs, suggested_question, original, sort_order)
    select v_tender, value ->> 'category', value ->> 'title', coalesce(value ->> 'explanation', ''),
           coalesce(value -> 'source_refs', '[]'), coalesce(value ->> 'suggested_question', ''),
           public.issue_original(value), ordinality
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

-- Same as M10; a new requirement keeps its key and source
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
    select p_run, v_tender, 'requirement', public.requirement_item(value), ordinality
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

-- Same as M10 (updates keep assignees, "done", links and "no reminder"; returns {added, updated}),
-- plus sources, original texts and the requirement of each new task
create or replace function public.accept_proposals(p_run uuid, p_accept uuid[]) returns jsonb
language plpgsql as $$
declare
  v_tender uuid;
  p public.analysis_proposals%rowtype;
  d jsonb;
  dl public.deadlines%rowtype;
  ids jsonb := '{}';      -- deadline key -> new deadline id
  used jsonb := '{}';     -- deadline keys that already have their linked task
  linked uuid;
  req_id uuid;
  reqs jsonb := '{}';     -- requirement key -> new requirement id
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
      update public.requirements
         set text = coalesce(d ->> 'text', text),
             source_refs = coalesce(d -> 'source_refs', source_refs),
             original = public.updated_original(original, d, '{text}')
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
             source_refs = coalesce(d -> 'source_refs', source_refs),
             original = public.updated_original(original, d, '{title}')
       where id = p.target_id and tender_id = v_tender;
      get diagnostics hit = row_count;
    elsif p.item_type = 'task' then
      update public.tasks
         set title = coalesce(d ->> 'title', title),
             details = coalesce(nullif(btrim(d ->> 'details'), ''), details),
             source_refs = coalesce(d -> 'source_refs', source_refs),
             original = public.updated_original(original, d, '{title,details}'),
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
             source_refs = coalesce(d -> 'source_refs', source_refs),
             original = public.updated_original(original, d, '{title,explanation,suggested_question}')
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
    insert into public.requirements (tender_id, text, source_refs, original, sort_order)
      values (v_tender, p.payload ->> 'text', coalesce(p.payload -> 'source_refs', '[]'),
              jsonb_build_object('text', p.payload ->> 'text'), base)
      returning id into req_id;
    if p.payload ->> 'key' is not null then
      reqs := reqs || jsonb_build_object(p.payload ->> 'key', req_id);
    end if;
    added := added + 1;
  end loop;

  for p in select * from public.analysis_proposals
            where run_id = p_run and status = 'pending' and target_id is null and item_type = 'deadline'
              and id = any (p_accept) order by sort_order loop
    d := p.payload;
    insert into public.deadlines (tender_id, type, title, due_at, has_time, source_refs, original)
      values (
        v_tender, d ->> 'type', d ->> 'title',
        public.israel_ts((d ->> 'date')::date, (d ->> 'time')::time),
        d ->> 'time' is not null, coalesce(d -> 'source_refs', '[]'),
        jsonb_build_object('title', d ->> 'title')
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
    -- A new requirement approved together with the task, or an existing one that is still there
    req_id := (reqs ->> (d ->> 'requirement_key'))::uuid;
    if req_id is null then
      select id into req_id from public.requirements
       where id = (d ->> 'requirement_id')::uuid and tender_id = v_tender;
    end if;
    if ids ? (d ->> 'deadline_key') and not used ? (d ->> 'deadline_key') then
      select * into dl from public.deadlines where id = (ids ->> (d ->> 'deadline_key'))::uuid;
      insert into public.tasks (tender_id, deadline_id, requirement_id, title, details, source_refs, original,
                                type, due_at, has_time, sort_order)
        values (v_tender, dl.id, req_id, d ->> 'title', nullif(btrim(d ->> 'details'), ''),
                coalesce(d -> 'source_refs', '[]'), public.task_original(d ->> 'title', d ->> 'details'),
                dl.type, dl.due_at, dl.has_time, base);
      used := used || jsonb_build_object(d ->> 'deadline_key', true);
    else
      insert into public.tasks (tender_id, requirement_id, title, details, source_refs, original,
                                type, due_at, has_time, sort_order)
        values (
          v_tender, req_id, d ->> 'title', nullif(btrim(d ->> 'details'), ''),
          coalesce(d -> 'source_refs', '[]'), public.task_original(d ->> 'title', d ->> 'details'), 'regular',
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
      insert into public.tasks (tender_id, deadline_id, title, source_refs, original, type, due_at, has_time, sort_order)
        values (v_tender, dl.id, dl.title, dl.source_refs, public.task_original(dl.title, null),
                dl.type, dl.due_at, dl.has_time, base);
    end if;
  end loop;

  select coalesce(max(sort_order), 0) into base from public.issues where tender_id = v_tender;
  for p in select * from public.analysis_proposals
            where run_id = p_run and status = 'pending' and target_id is null and item_type = 'issue'
              and id = any (p_accept) order by sort_order loop
    base := base + 1;
    insert into public.issues
        (tender_id, category, title, explanation, source_refs, suggested_question, original, sort_order)
      values (
        v_tender, p.payload ->> 'category', p.payload ->> 'title',
        coalesce(p.payload ->> 'explanation', ''), coalesce(p.payload -> 'source_refs', '[]'),
        coalesce(p.payload ->> 'suggested_question', ''), public.issue_original(p.payload), base
      );
    added := added + 1;
  end loop;

  update public.analysis_proposals
     set status = case when id = any (p_accept) then 'accepted' else 'rejected' end
   where run_id = p_run and status = 'pending';
  return jsonb_build_object('added', added, 'updated', updated);
end;
$$;

insert into public.app_migrations (name) values ('20261123120000_m11_source_links')
  on conflict (name) do nothing;
