-- Milestone 5: email reminders — schedule rules, triggers that keep reminders in sync, claiming for sending

-- "בלי תזכורת": no reminders for this task, even with assignees
alter table public.tasks
  add column reminders_off boolean not null default false;

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  -- Null: a reminder to the user herself (NOTIFY_EMAIL)
  team_member_id uuid references public.team_members (id) on delete cascade,
  send_at timestamptz not null,
  kind text not null check (kind in ('scheduled', 'followup', 'self')),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'cancelled', 'failed')),
  -- Set while a send is in progress, so two runs do not send the same reminder
  claimed_at timestamptz,
  sent_at timestamptz,
  -- The address used when sending (looked up at send time), and the failure reason in Hebrew
  recipient_email text,
  error text,
  -- "סימון כטופל" on a failed reminder
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index reminders_status_send_at_idx on public.reminders (status, send_at);
create index reminders_task_id_idx on public.reminders (task_id);
create index reminders_member_idx on public.reminders (team_member_id);
alter table public.reminders enable row level security;
create policy "authenticated full access" on public.reminders
  for all to authenticated using (true) with check (true);

-- A reminder on a Friday, Saturday or holiday moves to the previous workday, same time (ADR-20)
create function public.shift_to_workday(ts timestamptz) returns timestamptz
language plpgsql stable as $$
declare
  local timestamp := ts at time zone 'Asia/Jerusalem';
begin
  if public.is_workday(local::date) then
    return ts;
  end if;
  return public.israel_ts(public.workdays_before(local::date, 1), local::time);
end;
$$;

-- When reminders go out for a task, by type (ARCHITECTURE: reminder rules).
-- Day-based reminders use the deadline's time, or 08:00 when it has none.
create function public.reminder_slots(
  p_type text, p_due timestamptz, p_has_time boolean, p_remind_at timestamptz
) returns table (send_at timestamptz, kind text)
language plpgsql stable as $$
declare
  local timestamp;
  d date;
  t time;
begin
  if p_type in ('other', 'regular') then
    if p_remind_at is not null then
      return query select public.shift_to_workday(p_remind_at), 'scheduled'::text;
    end if;
    return;
  end if;

  if p_due is null then
    return;
  end if;
  local := p_due at time zone 'Asia/Jerusalem';
  d := local::date;
  t := case when p_has_time then local::time else time '08:00' end;

  case p_type
    when 'submission' then
      return query select public.shift_to_workday(public.israel_ts(d - 1, t)), 'scheduled'::text;
      if p_has_time then
        -- "3 hours before" is never moved
        return query select p_due - interval '3 hours', 'scheduled'::text;
      end if;
    when 'bidders_meeting' then
      return query select public.shift_to_workday(public.israel_ts(d - 3, t)), 'scheduled'::text;
      return query select public.shift_to_workday(public.israel_ts(d - 1, t)), 'followup'::text;
    when 'clarification_questions' then
      return query select public.shift_to_workday(public.israel_ts(d - 1, t)), 'scheduled'::text;
    when 'closing_meeting' then
      return query select public.shift_to_workday(public.israel_ts(d, time '08:00')), 'scheduled'::text;
    else
      return;
  end case;
end;
$$;

-- Cancels the task's pending reminders and creates them again from its current state (ADR-20).
-- Called on every change: dates, assignees, done, reminder time, "no reminder", tender status.
create function public.rebuild_task_reminders(p_task uuid) returns void
language plpgsql as $$
declare
  t record;
  has_assignees boolean;
begin
  update public.reminders set status = 'cancelled'
   where task_id = p_task and status = 'pending';

  select tk.type, tk.due_at, tk.has_time, tk.remind_at, tk.is_done, tk.reminders_off,
         tn.status as tender_status
    into t
    from public.tasks tk
    join public.tenders tn on tn.id = tk.tender_id
   where tk.id = p_task;

  if not found or t.is_done or t.reminders_off
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
  elsif t.type in ('other', 'regular') then
    -- A regular task with a reminder time and no assignee reminds the user herself
    insert into public.reminders (task_id, team_member_id, send_at, kind)
      select p_task, null, s.send_at, 'self'
        from public.reminder_slots(t.type, t.due_at, t.has_time, t.remind_at) s
       where s.send_at > now();
  end if;
end;
$$;

create function public.tasks_reminders_trigger() returns trigger
language plpgsql as $$
begin
  perform public.rebuild_task_reminders(new.id);
  return null;
end;
$$;

create trigger tasks_reminders_insert
  after insert on public.tasks
  for each row execute function public.tasks_reminders_trigger();

create trigger tasks_reminders_update
  after update of due_at, has_time, type, is_done, remind_at, reminders_off on public.tasks
  for each row execute function public.tasks_reminders_trigger();

create function public.task_assignees_reminders_trigger() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.rebuild_task_reminders(old.task_id);
  else
    perform public.rebuild_task_reminders(new.task_id);
  end if;
  return null;
end;
$$;

create trigger task_assignees_reminders
  after insert or delete on public.task_assignees
  for each row execute function public.task_assignees_reminders_trigger();

-- Leaving the active list cancels the tender's reminders; coming back schedules them again
create function public.tenders_reminders_trigger() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    perform public.rebuild_task_reminders(id) from public.tasks where tender_id = new.id;
  end if;
  return null;
end;
$$;

create trigger tenders_reminders
  after update of status on public.tenders
  for each row execute function public.tenders_reminders_trigger();

-- Reminders whose time has come, claimed for sending (server only, ADR-20).
-- First cancels what should no longer go out: a done task, "no reminder", a tender that is no
-- longer active, or a reminder that is late (the system was not running) for a deadline that
-- has already passed. A claim older than 10 minutes (a run that stopped midway) can be retried.
create function public.claim_due_reminders()
returns table (reminder_id uuid, reminder_kind text, member_id uuid, reminder_task_id uuid)
language plpgsql as $$
begin
  update public.reminders r
     set status = 'cancelled'
    from public.tasks tk
    join public.tenders tn on tn.id = tk.tender_id
   where r.task_id = tk.id
     and r.status = 'pending'
     and r.send_at <= now()
     and (tk.is_done or tk.reminders_off
          or tn.status not in ('reviewing', 'preparing')
          or (tk.due_at < now() and r.send_at < now() - interval '30 minutes'));

  return query
    update public.reminders r
       set claimed_at = now()
     where r.status = 'pending'
       and r.send_at <= now()
       and (r.claimed_at is null or r.claimed_at < now() - interval '10 minutes')
    returning r.id, r.kind, r.team_member_id, r.task_id;
end;
$$;

revoke execute on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;

-- Tasks assigned before this milestone get their reminders now
select public.rebuild_task_reminders(id) from public.tasks;

insert into public.app_migrations (name) values ('20261102200000_m5_reminders')
  on conflict (name) do nothing;
