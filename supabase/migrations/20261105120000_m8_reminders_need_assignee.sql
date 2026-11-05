-- The user can be chosen as an assignee: a role for her in the team list
insert into public.roles (key, label) values ('tender_manager', 'אחראי/ת מכרזים')
  on conflict do nothing;

-- A reminder goes out only to assignees; without an assignee nothing is sent
create or replace function public.rebuild_task_reminders(p_task uuid) returns void
language plpgsql as $$
declare
  t record;
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

  insert into public.reminders (task_id, team_member_id, send_at, kind)
    select p_task, a.team_member_id, s.send_at, s.kind
      from public.reminder_slots(t.type, t.due_at, t.has_time, t.remind_at) s
      cross join public.task_assignees a
     where a.task_id = p_task and s.send_at > now();
end;
$$;

select public.rebuild_task_reminders(id) from public.tasks;

insert into public.app_migrations (name) values ('20261105120000_m8_reminders_need_assignee')
  on conflict (name) do nothing;
