begin;

create table if not exists public.schema_migrations (
  id bigserial primary key,
  version text not null unique,
  name text not null,
  checksum text,
  result text not null default 'applied',
  applied_at timestamptz not null default now()
);

commit;
