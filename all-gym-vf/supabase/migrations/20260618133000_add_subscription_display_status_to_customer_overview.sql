create or replace view public.customer_overview
with (security_invoker = true)
as
with latest_subscription as (
  select distinct on (subscriptions.user_id)
    subscriptions.user_id,
    subscriptions.status,
    subscriptions.start_date,
    subscriptions.end_date,
    subscriptions.grace_days,
    public.subscription_access_until(subscriptions.end_date, subscriptions.grace_days) as access_until,
    subscriptions.plan_id
  from public.subscriptions
  order by subscriptions.user_id,
    case when subscriptions.status = 'active'::public.sub_status then 0 else 1 end,
    subscriptions.created_at desc
), latest_access as (
  select distinct on (access_logs.user_id)
    access_logs.user_id,
    access_logs.check_in_time
  from public.access_logs
  order by access_logs.user_id, access_logs.check_in_time desc
), subscription_state as (
  select
    p.id as user_id,
    case
      when ls.status is null then 'none'::text
      when ls.status = 'cancelled'::public.sub_status then 'cancelled'::text
      when ls.access_until < current_date then 'expired'::text
      when ls.end_date < current_date and ls.access_until >= current_date then 'grace'::text
      when ls.end_date >= current_date and (ls.end_date - current_date) <= 3 then 'expiring'::text
      when ls.status = 'active'::public.sub_status then 'active'::text
      else lower(ls.status::text)
    end as subscription_display_status
  from public.profiles p
  left join latest_subscription ls on p.id = ls.user_id
)
select
  p.id,
  p.full_name,
  p.phone,
  p.avatar_url,
  p.role,
  p.birth_date,
  p.gender,
  p.is_active,
  case
    when ls.status = 'active'::public.sub_status and ls.access_until < current_date then 'expired'::public.sub_status
    else ls.status
  end as subscription_status,
  ls.start_date as subscription_start_date,
  ls.end_date as subscription_end_date,
  ls.grace_days as subscription_grace_days,
  ls.access_until as subscription_access_until,
  ls.plan_id,
  pl.name as plan_name,
  la.check_in_time as last_check_in,
  lower(public.unaccent(coalesce(p.full_name, ''::text))) as full_name_search,
  ss.subscription_display_status
from public.profiles p
left join latest_subscription ls on p.id = ls.user_id
left join subscription_state ss on p.id = ss.user_id
left join public.plans pl on ls.plan_id = pl.id
left join latest_access la on la.user_id = p.id
where p.role = 'client'::public.user_role;

alter view public.customer_overview owner to postgres;
grant all on table public.customer_overview to anon, authenticated, service_role;

notify pgrst, 'reload schema';
