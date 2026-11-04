-- "מועד אחר" gets an automatic reminder one day before (ADR-23).
-- A reminder time chosen by hand still wins. Like the fixed types, the automatic reminder goes
-- only to assignees; a regular task is unchanged (manual reminder time only).

create or replace function public.reminder_slots(
  p_type text, p_due timestamptz, p_has_time boolean, p_remind_at timestamptz
) returns table (send_at timestamptz, kind text)
language plpgsql stable as $$
declare
  local timestamp;
  d date;
  t time;
begin
  if p_type in ('other', 'regular') and p_remind_at is not null then
    return query select public.shift_to_workday(p_remind_at), 'scheduled'::text;
    return;
  end if;
  if p_type = 'regular' or p_due is null then
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
    when 'clarification_questions', 'other' then
      return query select public.shift_to_workday(public.israel_ts(d - 1, t)), 'scheduled'::text;
    when 'closing_meeting' then
      return query select public.shift_to_workday(public.israel_ts(d, time '08:00')), 'scheduled'::text;
    else
      return;
  end case;
end;
$$;

create or replace function public.rebuild_task_reminders(p_task uuid) returns void
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
  elsif t.type in ('other', 'regular') and t.remind_at is not null then
    -- A reminder time chosen by hand, with no assignee, reminds the user herself
    insert into public.reminders (task_id, team_member_id, send_at, kind)
      select p_task, null, s.send_at, 'self'
        from public.reminder_slots(t.type, t.due_at, t.has_time, t.remind_at) s
       where s.send_at > now();
  end if;
end;
$$;

-- Existing "מועד אחר" tasks get their automatic reminder now
select public.rebuild_task_reminders(id) from public.tasks where type = 'other';

insert into public.app_migrations (name) values ('20261104120000_m6_other_reminders')
  on conflict (name) do nothing;
