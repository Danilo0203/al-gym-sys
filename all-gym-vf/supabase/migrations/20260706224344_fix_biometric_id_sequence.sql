create sequence if not exists public.biometric_id_seq;

select setval(
  'public.biometric_id_seq',
  coalesce((select max(biometric_id) from public.profiles), 0),
  true
);

create or replace function public.next_biometric_id()
returns integer
language sql
security definer
set search_path = public
as $$
  select nextval('public.biometric_id_seq')::integer;
$$;

revoke all on function public.next_biometric_id() from public;
grant execute on function public.next_biometric_id() to authenticated;
grant execute on function public.next_biometric_id() to service_role;

alter table only public.profiles
  alter column biometric_id set default public.next_biometric_id();

create unique index if not exists profiles_biometric_id_unique
on public.profiles (biometric_id)
where biometric_id is not null;
