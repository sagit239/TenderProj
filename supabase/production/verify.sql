-- Production check, read-only: paste into the SQL Editor after the migrations.
-- Expected: migrations 12, tables with app access 14, tables without RLS 0.
-- The cron rows appear only after cron-reminders.sql has run; until then they show "not set up".
with counts as (
  select 1 as sort_order, 'migrations' as check_name, count(*)::text as result
    from public.app_migrations
  union all
  select 2, 'tables with app access', count(distinct table_name)::text
    from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated' and privilege_type = 'SELECT'
  union all
  select 3, 'tables with anon access', count(distinct table_name)::text
    from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'
  union all
  select 4, 'tables without RLS', count(*)::text
    from pg_tables
   where schemaname = 'public' and not rowsecurity
  union all
  select 5, 'roles', count(*)::text from public.roles
  union all
  select 6, 'holidays', count(*)::text from public.holidays
  union all
  select 7, 'cron extension', coalesce(
    (select 'enabled' from pg_extension where extname = 'pg_cron'), 'not set up')
)
select check_name, result from counts order by sort_order;

-- Run this part alone, after cron-reminders.sql: job, recent runs, and the endpoint's answers
-- select jobname, schedule, active from cron.job;
-- select status, start_time, return_message from cron.job_run_details order by start_time desc limit 5;
-- select created, status_code, left(content::text, 80) as body, error_msg from net._http_response order by created desc limit 5;
