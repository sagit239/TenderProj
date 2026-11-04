-- The task list holds every task; only what is on the timeline gets reminders (ADR-24).
-- Timeline = a deadline row linked to its task. A task off the timeline may keep a date from
-- the tender (due_at), shown read-only.

-- Where the date came from, kept for when the task is added to the timeline
alter table public.tasks
  add column source_refs jsonb not null default '[]';

-- An analysed "מועד אחר" is not placed on the timeline: its task stays in the list, with the date
create function public.detach_other_deadline(p_deadline uuid) returns void
language plpgsql as $$
declare
  d public.deadlines%rowtype;
begin
  select * into d from public.deadlines where id = p_deadline;
  if not found then
    return;
  end if;
  update public.tasks
     set deadline_id = null, type = 'regular', source_refs = d.source_refs
   where deadline_id = d.id;
  delete from public.deadlines where id = d.id;
end;
$$;

-- Runs at commit, after the analysis has also added the linked task.
-- A deadline added from the task list is marked is_manual before commit, so it stays.
create function public.deadlines_detach_other_trigger() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.deadlines where id = new.id and type = 'other' and not is_manual) then
    perform public.detach_other_deadline(new.id);
  end if;
  return null;
end;
$$;

create constraint trigger deadlines_detach_other
  after insert on public.deadlines
  deferrable initially deferred
  for each row when (new.type = 'other' and not new.is_manual)
  execute function public.deadlines_detach_other_trigger();

-- "הוספה ללוח הזמנים": the task stays in the list and is now linked to a new deadline
create function public.add_task_to_timeline(
  p_task uuid, p_title text, p_type text, p_due timestamptz, p_has_time boolean
) returns uuid
language plpgsql as $$
declare
  t public.tasks%rowtype;
  new_id uuid;
begin
  select * into t from public.tasks where id = p_task;
  if not found then
    raise exception 'task % not found', p_task;
  end if;
  if t.deadline_id is not null then
    return t.deadline_id;
  end if;

  -- is_manual is set only after linking, or the insert trigger would add a second task
  insert into public.deadlines (tender_id, type, title, due_at, has_time, source_refs)
    values (t.tender_id, p_type, p_title, p_due, p_has_time, t.source_refs)
    returning id into new_id;
  update public.tasks
     set deadline_id = new_id, type = p_type, due_at = p_due, has_time = p_has_time
   where id = p_task;
  update public.deadlines set is_manual = true where id = new_id;
  return new_id;
end;
$$;

-- Removing from the timeline keeps the task in the list, with its date and without reminders
create function public.remove_from_timeline(p_deadline uuid) returns void
language plpgsql as $$
begin
  update public.tasks
     set deadline_id = null, type = 'regular', remind_at = null, reminders_off = false
   where deadline_id = p_deadline;
  delete from public.deadlines where id = p_deadline;
end;
$$;

-- Reminders go out only for what is on the timeline
create or replace function public.rebuild_task_reminders(p_task uuid) returns void
language plpgsql as $$
declare
  t record;
  has_assignees boolean;
begin
  update public.reminders set status = 'cancelled'
   where task_id = p_task and status = 'pending';

  select tk.type, tk.deadline_id, tk.due_at, tk.has_time, tk.remind_at, tk.is_done, tk.reminders_off,
         tn.status as tender_status
    into t
    from public.tasks tk
    join public.tenders tn on tn.id = tk.tender_id
   where tk.id = p_task;

  if not found or t.deadline_id is null or t.is_done or t.reminders_off
     or t.tender_status not in ('reviewing', 'preparing') then
    return;
  end if;

  select exists (select 1 from public.task_assignees where task_id = p_task) into has_assignees;

  if has_assignees then
    insert into public.reminders (task_id, team_member_id, send_at, kind)
      select p_task, a.team_member_id, s.send_at, s.kind
        from public.reminder_slots(t.type, t.due_at, t.has_time, t.remind_at) s
        cross join public.task_assignees a
       where a.task_id = p_task and s.send_at > now();
  elsif t.type = 'other' and t.remind_at is not null then
    -- A reminder time chosen by hand, with no assignee, reminds the user herself
    insert into public.reminders (task_id, team_member_id, send_at, kind)
      select p_task, null, s.send_at, 'self'
        from public.reminder_slots(t.type, t.due_at, t.has_time, t.remind_at) s
       where s.send_at > now();
  end if;
end;
$$;

drop trigger tasks_reminders_update on public.tasks;
create trigger tasks_reminders_update
  after update of deadline_id, due_at, has_time, type, is_done, remind_at, reminders_off on public.tasks
  for each row execute function public.tasks_reminders_trigger();

-- Existing data: analysed "מועד אחר" rows nobody worked on leave the timeline
select public.detach_other_deadline(d.id)
  from public.deadlines d
  join public.tasks t on t.deadline_id = d.id
 where d.type = 'other' and not d.is_manual and not d.is_auto
   and t.remind_at is null
   and not exists (select 1 from public.task_assignees a where a.task_id = t.id);

-- A task with a reminder time joins the timeline, so the reminder is not lost
select public.add_task_to_timeline(
         t.id, t.title, 'other', coalesce(t.due_at, t.remind_at), t.due_at is not null and t.has_time
       )
  from public.tasks t
 where t.deadline_id is null and t.remind_at is not null;

select public.rebuild_task_reminders(id) from public.tasks;

insert into public.app_migrations (name) values ('20261104140000_m6_timeline_model')
  on conflict (name) do nothing;
