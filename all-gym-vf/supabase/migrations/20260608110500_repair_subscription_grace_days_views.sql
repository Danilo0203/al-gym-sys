drop view if exists public.payments_overview;
drop view if exists public.customer_overview;
drop view if exists public.active_memberships_view;

alter table public.subscriptions
  add column if not exists grace_days integer not null default 3;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscriptions_grace_days_non_negative'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_grace_days_non_negative
      check (grace_days >= 0)
      not valid;
  end if;
end $$;

alter table public.subscriptions
  validate constraint subscriptions_grace_days_non_negative;

comment on column public.subscriptions.grace_days is 'Días de prórroga de acceso después de end_date.';

create or replace function public.subscription_access_until(p_end_date date, p_grace_days integer default 3)
returns date
language sql
immutable
set search_path = public
as $$
  with base as (
    select p_end_date + greatest(coalesce(p_grace_days, 3), 0) as access_date
  )
  select case extract(isodow from access_date)::int
    when 6 then access_date + 2
    when 7 then access_date + 1
    else access_date
  end
  from base;
$$;

drop function if exists public.create_subscription_payment_for_existing_customer(uuid, integer, date, date, numeric, numeric, text, uuid);

create or replace function public.create_subscription_payment_for_existing_customer(
  p_customer_id uuid,
  p_plan_id integer default null::integer,
  p_start_date date default null::date,
  p_end_date date default null::date,
  p_final_price numeric default null::numeric,
  p_discount_amount numeric default 0,
  p_payment_method text default 'cash'::text,
  p_created_by_user_id uuid default null::uuid,
  p_grace_days integer default 3
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_user_id uuid;
  v_role text;
  v_created_by_user_id uuid;
  v_plan public.plans%rowtype;
  v_subscription_id uuid;
  v_payment_id uuid;
  v_movement public.cash_movements%rowtype;
  v_start_date date;
  v_end_date date;
  v_amount_original numeric(12,2);
  v_amount_paid numeric(12,2);
  v_grace_days integer;
begin
  v_request_user_id := auth.uid();
  v_role := public.require_cash_operator(v_request_user_id);

  if v_role <> 'owner' and not exists (
    select 1
    from public.role_permissions rp
    join public.permissions perm on perm.id = rp.permission_id
    join public.roles r on r.id = rp.role_id
    where r.slug = v_role
      and perm.key = 'customers.manage_membership'
  ) then
    raise exception 'Solo administradores pueden registrar altas con pago';
  end if;

  v_created_by_user_id := coalesce(p_created_by_user_id, v_request_user_id);
  v_grace_days := greatest(coalesce(p_grace_days, 3), 0);

  if p_plan_id is null then
    return jsonb_build_object(
      'subscription_id', null,
      'payment_id', null,
      'cash_movement_id', null,
      'session_link_status', null
    );
  end if;

  if p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Método de pago inválido';
  end if;

  select *
  into v_plan
  from public.plans
  where id = p_plan_id;

  if not found then
    raise exception 'Plan no encontrado';
  end if;

  v_start_date := coalesce(p_start_date, timezone('America/Guatemala', now())::date);
  v_end_date := coalesce(p_end_date, (v_start_date + coalesce(v_plan.duration_days, 30)));
  v_amount_original := v_plan.price;
  v_amount_paid := coalesce(p_final_price, v_amount_original - coalesce(p_discount_amount, 0));

  insert into public.subscriptions (
    user_id,
    plan_id,
    start_date,
    end_date,
    status,
    discount_amount,
    grace_days
  )
  values (
    p_customer_id,
    p_plan_id,
    v_start_date,
    v_end_date,
    'active',
    coalesce(p_discount_amount, 0),
    v_grace_days
  )
  returning id
  into v_subscription_id;

  insert into public.payments (
    subscription_id,
    user_id,
    amount_original,
    discount_amount,
    amount_paid,
    method,
    payment_date,
    created_by_user_id,
    status
  )
  values (
    v_subscription_id,
    p_customer_id,
    v_amount_original,
    coalesce(p_discount_amount, 0),
    v_amount_paid,
    p_payment_method,
    now(),
    v_created_by_user_id,
    'posted'
  )
  returning id
  into v_payment_id;

  select *
  into v_movement
  from public.attach_payment_to_cash(
    v_payment_id,
    v_created_by_user_id,
    'membership',
    null
  );

  return jsonb_build_object(
    'subscription_id', v_subscription_id,
    'payment_id', v_payment_id,
    'cash_movement_id', v_movement.id,
    'session_link_status', v_movement.session_link_status
  );
end;
$$;

alter function public.create_subscription_payment_for_existing_customer(uuid, integer, date, date, numeric, numeric, text, uuid, integer) owner to postgres;
grant all on function public.create_subscription_payment_for_existing_customer(uuid, integer, date, date, numeric, numeric, text, uuid, integer) to anon, authenticated, service_role;

drop function if exists public.renew_subscription_with_payment(uuid, integer, date, date, numeric, numeric, numeric, text, uuid);

create or replace function public.renew_subscription_with_payment(
  p_customer_id uuid,
  p_plan_id integer,
  p_start_date date,
  p_end_date date,
  p_price numeric,
  p_discount_amount numeric,
  p_amount_paid numeric,
  p_payment_method text,
  p_created_by_user_id uuid default null::uuid,
  p_grace_days integer default 3
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_user_id uuid;
  v_role text;
  v_created_by_user_id uuid;
  v_subscription_id uuid;
  v_payment_id uuid;
  v_movement public.cash_movements%rowtype;
  v_grace_days integer;
begin
  v_request_user_id := auth.uid();
  v_role := public.require_cash_operator(v_request_user_id);
  v_created_by_user_id := coalesce(p_created_by_user_id, v_request_user_id);
  v_grace_days := greatest(coalesce(p_grace_days, 3), 0);

  if p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Método de pago inválido';
  end if;

  if not exists (
    select 1
    from public.plans
    where id = p_plan_id
  ) then
    raise exception 'Plan no encontrado';
  end if;

  update public.subscriptions
  set status = 'expired'
  where user_id = p_customer_id
    and status = 'active';

  insert into public.subscriptions (
    user_id,
    plan_id,
    start_date,
    end_date,
    status,
    discount_amount,
    grace_days
  )
  values (
    p_customer_id,
    p_plan_id,
    p_start_date,
    p_end_date,
    'active',
    coalesce(p_discount_amount, 0),
    v_grace_days
  )
  returning id
  into v_subscription_id;

  insert into public.payments (
    subscription_id,
    user_id,
    amount_original,
    discount_amount,
    amount_paid,
    method,
    payment_date,
    created_by_user_id,
    status
  )
  values (
    v_subscription_id,
    p_customer_id,
    p_price,
    coalesce(p_discount_amount, 0),
    p_amount_paid,
    p_payment_method,
    now(),
    v_created_by_user_id,
    'posted'
  )
  returning id
  into v_payment_id;

  select *
  into v_movement
  from public.attach_payment_to_cash(
    v_payment_id,
    v_created_by_user_id,
    'membership',
    null
  );

  return jsonb_build_object(
    'subscription_id', v_subscription_id,
    'payment_id', v_payment_id,
    'cash_movement_id', v_movement.id,
    'session_link_status', v_movement.session_link_status
  );
end;
$$;

alter function public.renew_subscription_with_payment(uuid, integer, date, date, numeric, numeric, numeric, text, uuid, integer) owner to postgres;
grant all on function public.renew_subscription_with_payment(uuid, integer, date, date, numeric, numeric, numeric, text, uuid, integer) to anon, authenticated, service_role;

create or replace view public.active_memberships_view
with (security_invoker = true)
as
select
  p.full_name,
  p.avatar_url,
  p.phone,
  s.user_id,
  s.end_date,
  s.grace_days,
  public.subscription_access_until(s.end_date, s.grace_days) as access_until,
  pl.name as plan_name,
  case
    when public.subscription_access_until(s.end_date, s.grace_days) < current_date then 'Vencido'::text
    when s.end_date < current_date then 'En Prórroga'::text
    when s.end_date >= current_date and s.end_date <= (current_date + 5) then 'Por Vencer'::text
    else 'Al día'::text
  end as status_label
from public.subscriptions s
join public.profiles p on s.user_id = p.id
join public.plans pl on s.plan_id = pl.id
where s.status = 'active'::public.sub_status;

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
  la.check_in_time as last_check_in
from public.profiles p
left join latest_subscription ls on p.id = ls.user_id
left join public.plans pl on ls.plan_id = pl.id
left join latest_access la on la.user_id = p.id
where p.role = 'client'::public.user_role;

create or replace view public.payments_overview
with (security_invoker = true)
as
select
  p.id,
  p.payment_date,
  p.amount_paid,
  p.method,
  p.user_id,
  p.subscription_id,
  pr.full_name as user_name,
  pr.avatar_url,
  pl.name as plan_name,
  case
    when s.status = 'active'::public.sub_status and public.subscription_access_until(s.end_date, s.grace_days) < current_date then 'expired'::public.sub_status
    else s.status
  end as subscription_status,
  s.end_date as subscription_end_date,
  s.grace_days as subscription_grace_days,
  public.subscription_access_until(s.end_date, s.grace_days) as subscription_access_until
from public.payments p
left join public.profiles pr on pr.id = p.user_id
left join public.subscriptions s on s.id = p.subscription_id
left join public.plans pl on pl.id = s.plan_id
where p.status = 'posted'::text;

grant all on function public.subscription_access_until(date, integer) to anon, authenticated, service_role;
alter view public.active_memberships_view owner to postgres;
grant all on table public.active_memberships_view to anon, authenticated, service_role;
alter view public.customer_overview owner to postgres;
grant all on table public.customer_overview to anon, authenticated, service_role;
alter view public.payments_overview owner to postgres;
grant all on table public.payments_overview to anon, authenticated, service_role;

notify pgrst, 'reload schema';
