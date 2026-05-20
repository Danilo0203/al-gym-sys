begin;

create table if not exists public.audit_log (
  id bigserial primary key,
  actor_user_id uuid references public.users(id),
  module text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  request_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_user_id_idx
  on public.audit_log (actor_user_id);

create index if not exists audit_log_module_action_idx
  on public.audit_log (module, action);

create or replace function public.get_user_permissions(p_user_id uuid)
returns text[]
language plpgsql
stable
as $$
declare
  v_permissions text[];
begin
  if to_regclass('public.profiles') is null
    or to_regclass('public.roles') is null
    or to_regclass('public.role_permissions') is null
    or to_regclass('public.permissions') is null then
    return array[]::text[];
  end if;

  execute $sql$
    select coalesce(array_agg(distinct p.key order by p.key), '{}')
    from public.profiles prof
    join public.roles r on r.slug = prof.role
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where prof.id = $1
  $sql$
  into v_permissions
  using p_user_id;

  return coalesce(v_permissions, array[]::text[]);
end;
$$;

create or replace function public.get_user_role_scope(p_user_id uuid)
returns text
language plpgsql
stable
as $$
declare
  v_scope text;
begin
  if to_regclass('public.profiles') is null
    or to_regclass('public.roles') is null then
    return null;
  end if;

  execute $sql$
    select r.scope::text
    from public.profiles prof
    join public.roles r on r.slug = prof.role
    where prof.id = $1
    limit 1
  $sql$
  into v_scope
  using p_user_id;

  return v_scope;
end;
$$;

commit;
