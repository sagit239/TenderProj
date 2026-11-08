-- Reminder rules, as the user decided on 2026-11-08:
-- * A reminder time chosen in the "מועד" dialog replaces the automatic reminders of any type
--   (it used to apply to "מועד אחר" only).
-- * Tender submission gets one reminder, 3 hours before (it used to also send one a day before).
--   A submission without a time gets it at 08:00 that day. Neither is moved off a weekend or holiday.
create or replace function public.reminder_slots(
  p_type text, p_due timestamptz, p_has_time boolean, p_remind_at timestamptz
) returns table (send_at timestamptz, kind text)
language plpgsql stable as $$
declare
  local timestamp;
  d date;
  t time;
begin
  if p_remind_at is not null then
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
      if p_has_time then
        return query select p_due - interval '3 hours', 'scheduled'::text;
      else
        return query select public.israel_ts(d, time '08:00'), 'scheduled'::text;
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

-- Recreate the pending reminders under the new rules
select public.rebuild_task_reminders(id) from public.tasks;

insert into public.app_migrations (name) values ('20261108120000_reminder_override')
  on conflict (name) do nothing;
