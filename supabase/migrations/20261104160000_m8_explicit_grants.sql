-- Milestone 8: explicit access rights. New Supabase projects no longer grant them by default.
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Server-only functions stay closed to the signed-in browser user (ADR-17, ADR-19, ADR-20)
revoke execute on function public.save_analysis(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_analysis(uuid, text) from public, anon, authenticated;
revoke execute on function public.save_reanalysis(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.claim_due_reminders() from public, anon, authenticated;

-- Nothing in the app reads data without signing in, so the anonymous role gets no table access
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

insert into public.app_migrations (name) values ('20261104160000_m8_explicit_grants')
  on conflict (name) do nothing;
