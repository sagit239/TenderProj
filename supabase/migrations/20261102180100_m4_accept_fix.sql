-- Milestone 4 fix: accept_proposals looped over a record into a jsonb variable

-- Adds the approved proposals of a run as items; the other pending ones are rejected.
-- An approved deadline gets its linked task: the first approved task pointing at it,
-- or a task named after the deadline (same rule as save_analysis, ADR-17).
create or replace function public.accept_proposals(p_run uuid, p_accept uuid[]) returns int
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


insert into public.app_migrations (name) values ('20261102180100_m4_accept_fix')
  on conflict (name) do nothing;
