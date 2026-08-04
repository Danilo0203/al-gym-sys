begin;

-- Estas funciones se ejecutan como postgres.
-- postgres tiene BYPASSRLS en ambos entornos, por lo que las consultas
-- internas no vuelven a activar las políticas recursivas.

create or replace function public.current_user_has_panel_scope()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.profiles p
    join public.roles r
      on r.slug = p.role::text
    where p.id = auth.uid()
      and r.scope = 'panel'
  );
$function$;

create or replace function public.current_user_has_permission(
  p_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role::text = 'owner'
        or exists (
          select 1
          from public.roles r
          join public.role_permissions rp
            on rp.role_id = r.id
          join public.permissions perm
            on perm.id = rp.permission_id
          where r.slug = p.role::text
            and perm.key = p_permission_key
        )
      )
  );
$function$;

revoke all
on function public.current_user_has_panel_scope()
from public;

revoke all
on function public.current_user_has_permission(text)
from public;

grant execute
on function public.current_user_has_panel_scope()
to authenticated, service_role;

grant execute
on function public.current_user_has_permission(text)
to authenticated, service_role;

-- Corregir políticas recursivas de roles.

drop policy if exists roles_view_all
on public.roles;

create policy roles_view_all
on public.roles
for select
to authenticated
using (
  public.current_user_has_panel_scope()
);

drop policy if exists roles_insert_admin
on public.roles;

create policy roles_insert_admin
on public.roles
for insert
to authenticated
with check (
  public.current_user_has_permission('roles.create')
);

drop policy if exists roles_update_admin
on public.roles;

create policy roles_update_admin
on public.roles
for update
to authenticated
using (
  public.current_user_has_permission('roles.update')
)
with check (
  public.current_user_has_permission('roles.update')
);

drop policy if exists roles_delete_admin
on public.roles;

create policy roles_delete_admin
on public.roles
for delete
to authenticated
using (
  public.current_user_has_permission('roles.delete')
);

-- Estas dos políticas también eran recursivas porque consultaban
-- role_permissions desde políticas aplicadas a role_permissions.

drop policy if exists role_permissions_insert_admin
on public.role_permissions;

create policy role_permissions_insert_admin
on public.role_permissions
for insert
to authenticated
with check (
  public.current_user_has_permission('roles.update')
);

drop policy if exists role_permissions_delete_admin
on public.role_permissions;

create policy role_permissions_delete_admin
on public.role_permissions
for delete
to authenticated
using (
  public.current_user_has_permission('roles.update')
);

commit;
