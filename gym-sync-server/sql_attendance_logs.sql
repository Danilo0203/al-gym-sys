create table if not exists public.attendance_logs (
  id bigserial primary key,
  device_id text not null,
  biometric_id integer not null,
  punch_time timestamptz not null,
  status1 integer,
  status2 integer,
  status3 integer,
  status4 integer,
  status5 integer,
  raw_line text,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_attendance_logs_dedupe
  on public.attendance_logs (device_id, biometric_id, punch_time, status1, status2);

create index if not exists idx_attendance_logs_punch_time
  on public.attendance_logs (punch_time desc);

create index if not exists idx_attendance_logs_device_id
  on public.attendance_logs (device_id);

create index if not exists idx_attendance_logs_biometric_id
  on public.attendance_logs (biometric_id);
