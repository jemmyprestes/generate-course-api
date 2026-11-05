-- Apply to a Supabase DEVELOPMENT BRANCH only, after inspecting the existing schema.
-- Does not enable billing or alter existing course data. All writes are service-role only.
begin;
create table public.billing_settings (
  singleton boolean primary key default true check(singleton),
  plus_courses_per_period integer default 5 check(plus_courses_per_period > 0),
  plus_certificates boolean default true, enforced boolean not null default false
);
insert into public.billing_settings(singleton) values(true);
create table public.billing_orders (
  id uuid primary key, user_id uuid not null references auth.users(id), request_id uuid not null,
  product text not null check(product in ('course','certificate','plus')),
  course_id uuid, session_id text unique, payment_intent text unique,
  paid boolean not null default false, created_at timestamptz not null default now(),
  unique(user_id,request_id), check ((product = 'certificate') = (course_id is not null))
);
create table public.billing_events (id text primary key, created_at timestamptz not null default now());
create table public.billing_subscriptions (
  id text primary key, order_id uuid not null unique references public.billing_orders(id),
  user_id uuid not null references auth.users(id), status text not null,
  paid_until timestamptz, event_created bigint not null, revoked boolean not null default false
);
create table public.billing_generation_usage (
  job_id uuid primary key, user_id uuid not null references auth.users(id),
  order_id uuid unique references public.billing_orders(id), subscription_id text references public.billing_subscriptions(id),
  period_end timestamptz, created_at timestamptz not null default now(),
  check ((order_id is not null) <> (subscription_id is not null))
);
create table public.billing_test_bindings (
  test_id text primary key, user_id uuid not null references auth.users(id), course_id uuid not null
);
create table public.billing_ai_attempts (
  job_id uuid primary key, attempts integer not null default 0
);
create table public.billing_test_attempts (
  course_id uuid primary key, attempts integer not null default 0
);

-- No direct browser access, including reads; authenticated APIs expose only the caller's rights.
do $$ declare t text; begin
  foreach t in array array['billing_settings','billing_orders','billing_events','billing_subscriptions','billing_generation_usage','billing_test_bindings','billing_ai_attempts','billing_test_attempts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

create function public.billing_reserve_generation_attempt(p_job_id uuid,p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare module_count integer; budget integer; begin
  select total_modules into module_count from public.course_generation_jobs where id=p_job_id and user_id=p_user_id;
  if not found then raise exception 'Unknown generation job'; end if;
  budget := 2 * (least(12,greatest(4,coalesce(module_count,12))) + 1);
  insert into public.billing_ai_attempts(job_id,attempts) values(p_job_id,1)
  on conflict(job_id) do update set attempts=billing_ai_attempts.attempts+1
    where billing_ai_attempts.attempts < budget;
  if not found then raise exception 'Generation attempt limit exceeded'; end if;
end $$;

create function public.billing_reserve_test_attempt(p_user_id uuid,p_course_id uuid) returns void
language plpgsql security definer set search_path = '' as $$ begin
  if not exists(select 1 from public.courses where id=p_course_id and user_id=p_user_id) then raise exception 'Unknown course'; end if;
  insert into public.billing_test_attempts(course_id,attempts) values(p_course_id,1)
  on conflict(course_id) do update set attempts=billing_test_attempts.attempts+1 where billing_test_attempts.attempts<3;
  if not found then raise exception 'Test generation attempt limit exceeded'; end if;
end $$;

create function public.billing_create_order(p_id uuid,p_user_id uuid,p_request_id uuid,p_product text,p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.billing_orders; begin
  if p_product = 'certificate' and not exists(select 1 from public.courses where id=p_course_id and user_id=p_user_id) then
    raise exception 'Course ownership required';
  end if;
  if p_product = 'plus' and exists(select 1 from public.billing_settings where plus_courses_per_period is null or plus_certificates is null) then
    raise exception 'Plus benefits are not configured';
  end if;
  insert into public.billing_orders(id,user_id,request_id,product,course_id) values(p_id,p_user_id,p_request_id,p_product,p_course_id)
    on conflict(user_id,request_id) do nothing;
  select * into strict o from public.billing_orders where user_id=p_user_id and request_id=p_request_id;
  if o.product <> p_product or o.course_id is distinct from p_course_id then raise exception 'Idempotency conflict'; end if;
  return to_jsonb(o);
end $$;

create function public.billing_attach_session(p_order_id uuid,p_session_id text) returns void
language plpgsql security definer set search_path = '' as $$ begin
  update public.billing_orders set session_id=p_session_id where id=p_order_id and (session_id is null or session_id=p_session_id);
  if not found then raise exception 'Session conflict'; end if;
end $$;

create function public.billing_fulfill_order(p_order_id uuid,p_session_id text,p_event_id text,p_payment_intent text) returns void
language plpgsql security definer set search_path = '' as $$ begin
  -- Event record and grant commit atomically. Unique order = one credit even across different event IDs.
  perform 1 from public.billing_orders where id=p_order_id for update;
  if not found then raise exception 'Unknown order'; end if;
  update public.billing_orders set paid=true,session_id=p_session_id,payment_intent=p_payment_intent
    where id=p_order_id and product in ('course','certificate') and (session_id is null or session_id=p_session_id);
  if not found then raise exception 'Invalid fulfillment'; end if;
  insert into public.billing_events(id) values(p_event_id) on conflict do nothing;
end $$;

create function public.billing_sync_subscription(p_order_id uuid,p_subscription_id text,p_status text,p_paid_until timestamptz,p_event_id text,p_event_created bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.billing_orders; begin
  select * into strict o from public.billing_orders where id=p_order_id and product='plus' for update;
  insert into public.billing_subscriptions(id,order_id,user_id,status,paid_until,event_created,revoked)
    values(p_subscription_id,o.id,o.user_id,p_status,p_paid_until,p_event_created,p_status in ('canceled','unpaid','incomplete_expired'))
  on conflict(id) do update set
    status=case when billing_subscriptions.revoked then billing_subscriptions.status else excluded.status end,
    paid_until=greatest(billing_subscriptions.paid_until,excluded.paid_until),
    revoked=billing_subscriptions.revoked or excluded.revoked,
    event_created=greatest(billing_subscriptions.event_created,excluded.event_created)
  where excluded.event_created >= billing_subscriptions.event_created;
  insert into public.billing_events(id) values(p_event_id) on conflict do nothing;
end $$;

create function public.billing_entitlements(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
select jsonb_build_object(
  'courseCredits',(select count(*) from public.billing_orders o where user_id=p_user_id and product='course' and paid
    and not exists(select 1 from public.billing_generation_usage u where u.order_id=o.id)),
  'certificates',coalesce((select jsonb_agg(distinct course_id) from public.billing_orders where user_id=p_user_id and product='certificate' and paid),'[]'::jsonb),
  'plus',coalesce((select jsonb_agg(jsonb_build_object('paidUntil',s.paid_until,'limit',c.plus_courses_per_period,'certificatesIncluded',c.plus_certificates,
    'used',(select count(*) from public.billing_generation_usage u where u.subscription_id=s.id and u.period_end=s.paid_until)))
    from public.billing_subscriptions s cross join public.billing_settings c where s.user_id=p_user_id
      and s.status='active' and not s.revoked and s.paid_until>now()),'[]'::jsonb)
);
$$;

-- Wrap the EXISTING routine in the same transaction: a denied credit rolls back the new job.
-- All old browser-callable generation routines must be revoked before activating this feature.
create function public.billing_start_generation(p_user_id uuid,p_request_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; credit uuid; sub public.billing_subscriptions; quota integer; begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  if not (select enforced from public.billing_settings where singleton) then raise exception 'Billing not enabled'; end if;
  result := public.start_or_resume_course_generation(p_user_id,p_request_data);
  -- Existing jobs can resume without being charged again.
  if coalesce((result->>'created')::boolean,false) then
    select * into sub from public.billing_subscriptions where user_id=p_user_id and status='active'
      and not revoked and paid_until>now() order by paid_until desc limit 1 for update;
    select plus_courses_per_period into quota from public.billing_settings where singleton;
    if sub.id is not null and quota is not null and
       (select count(*) from public.billing_generation_usage where subscription_id=sub.id and period_end=sub.paid_until)<quota then
      insert into public.billing_generation_usage(job_id,user_id,subscription_id,period_end)
        values((result->>'jobId')::uuid,p_user_id,sub.id,sub.paid_until);
    else
      select o.id into credit from public.billing_orders o where o.user_id=p_user_id and o.product='course' and o.paid
        and not exists(select 1 from public.billing_generation_usage u where u.order_id=o.id) order by o.created_at limit 1 for update;
      if credit is null then raise exception using errcode='P0001',message='BILLING_PAYMENT_REQUIRED'; end if;
      insert into public.billing_generation_usage(job_id,user_id,order_id) values((result->>'jobId')::uuid,p_user_id,credit);
    end if;
  end if;
  return result;
end $$;

create function public.billing_certificate_access(p_user_id uuid,p_course_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
select exists(select 1 from public.courses where id=p_course_id and user_id=p_user_id)
 and exists(select 1 from public.course_tests t join public.billing_test_bindings b on b.test_id=t.test_id
   and b.course_id=t.course_id and b.user_id=t.user_id
   where t.user_id=p_user_id and t.course_id=p_course_id and t.passed)
 and (exists(select 1 from public.billing_orders where user_id=p_user_id and course_id=p_course_id and product='certificate' and paid)
  or exists(select 1 from public.billing_subscriptions s cross join public.billing_settings c
    where s.user_id=p_user_id and s.status='active' and not s.revoked and s.paid_until>now() and c.plus_certificates));
$$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'billing\_%' escape '\' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
