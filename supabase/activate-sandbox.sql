-- DEVELOPMENT BRANCH ONLY. Apply after migration and live-schema review.
-- Keeps the original RPC for server-side wrapper calls while closing browser bypasses.
begin;
revoke insert, update, delete on public.course_tests from public, anon, authenticated;
revoke all on public.course_test_keys from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'start_or_resume_course_generation','claim_course_generation_job','resume_course_generation_job',
      'claim_course_plan','claim_next_course_module','complete_course_plan','complete_course_module',
      'finalize_course_generation_job','fail_course_generation_step') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
create function public.billing_check_new_job() returns trigger
language plpgsql security definer set search_path = '' as $$ begin
  if (select enforced from public.billing_settings where singleton) and not exists (
    select 1 from public.billing_generation_usage where job_id=new.id and user_id=new.user_id
  ) then raise exception 'BILLING_PAYMENT_REQUIRED'; end if;
  return new;
end $$;
revoke all on function public.billing_check_new_job() from public, anon, authenticated;
create constraint trigger billing_new_job_guard after insert on public.course_generation_jobs
  deferrable initially deferred for each row execute function public.billing_check_new_job();
update public.billing_settings set enforced=true where singleton;
commit;
