# Notas de migracion de base de datos

Fecha de corte: `2026-05-20`

## Baseline actual identificado

El esquema fuente vive en:

- `all-gym-vf/supabase/migrations/20251223000000_initial_remote_schema.sql`
- `all-gym-vf/supabase/migrations/20260512_void_product_sale_from_cash_session.sql`
- `all-gym-vf/supabase/migrations/20260513005245_cash_close_authorization.sql`

Estos archivos contienen:

- tablas de dominio
- vistas de lectura
- funciones SQL para caja e inventario
- grants/RLS orientados a Supabase
- referencias directas a `auth.uid()`

## Decision de migracion

Reusar el SQL existente como base estructural, pero separar claramente:

- SQL que si debe conservarse
- SQL acoplado a Supabase Auth/RLS que debe reescribirse

## Objetos SQL a conservar con cambios minimos

- tablas de dominio existentes: `profiles`, `roles`, `permissions`, `role_permissions`, `plans`, `subscriptions`, `payments`, `cash_sessions`, `cash_movements`, `products`, `inventory_movements`, `routines`, `routine_details`, `training_profiles`, `body_assessments`, `attendance_logs`, `device_commands`
- vistas utiles de lectura:
  - `customer_overview`
  - `payments_overview`
  - `product_inventory_overview`

## Objetos SQL que hoy dependen de Supabase Auth

El inventario detecto referencias a `auth.uid()` en:

- `adjust_product_stock`
- `attach_payment_to_cash`
- `close_cash_session`
- `create_subscription_payment_for_existing_customer`
- `get_current_permissions`
- `open_cash_session`
- `record_product_inventory_movement`
- `renew_subscription_with_payment`
- `reverse_and_recreate_payment`
- `sell_products_from_cash_session`
- `void_product_sale_from_cash_session`
- varias politicas/consultas de `profiles` dentro del baseline

## Regla de reescritura

Todo objeto que hoy dependa de `auth.uid()` debe migrarse a una de estas dos opciones:

1. Aceptar explicitamente `p_actor_user_id uuid`
2. Salir de SQL y moverse a servicio transaccional en `Express`

Para este proyecto, la recomendacion es:

- mantener en SQL la logica transaccional compleja de caja e inventario
- pasar `userId` explicito desde backend
- mover autorizacion y resolucion de permisos a `Express`

## Reemplazo de `get_current_permissions()`

Estado actual:

- RPC sin parametros
- infiere usuario con `auth.uid()`

Reemplazo local propuesto:

```sql
create or replace function public.get_user_permissions(p_user_id uuid)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(distinct p.key order by p.key), '{}')
  from profiles prof
  join roles r on r.slug = prof.role
  join role_permissions rp on rp.role_id = r.id
  join permissions p on p.id = rp.permission_id
  where prof.id = p_user_id;
$$;
```

## Modelo local de identidad recomendado

Para minimizar cambios en el resto del sistema:

- conservar `profiles.id` como identificador funcional de usuario
- crear tabla `users` como reemplazo local de `auth.users`
- usar el mismo UUID en `users.id` y `profiles.id`

Tabla sugerida:

```sql
create table if not exists users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  status text not null default 'active',
  must_change_password boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Relacion:

- `profiles.id` referencia `users.id`
- `users.email` reemplaza la necesidad de consultar `auth.users`

## Sesiones locales

Tabla sugerida:

```sql
create table if not exists user_sessions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  session_token_hash text not null unique,
  csrf_token text not null,
  ip_address inet,
  user_agent text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
```

## Reset de contrasena local

Tabla sugerida:

```sql
create table if not exists password_reset_tokens (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
```

## Auditoria recomendada

Muchos flujos criticos ya existen en caja/pagos/inventario. Conviene agregar:

```sql
create table if not exists audit_log (
  id bigserial primary key,
  actor_user_id uuid references users(id),
  module text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);
```

## Control de migraciones SQL

Esto debe existir desde el primer baseline local.

```sql
create table if not exists schema_migrations (
  id bigserial primary key,
  version text not null unique,
  name text not null,
  checksum text,
  result text not null default 'applied',
  applied_at timestamptz not null default now()
);
```

Artefacto creado en esta fase:

- `api-local/sql/migrations/20260520_000001_schema_migrations.sql`

Notas operativas:

- cada archivo SQL se registra una sola vez
- si falla una migracion, debe quedar traza en `migration.log`
- no debe depender de la tabla de migraciones de Supabase

## Que NO debe migrarse tal cual

- politicas RLS orientadas a `anon`/`authenticated`
- grants especificos para `service_role`
- cualquier dependencia de `auth.uid()`
- convenciones de Storage de Supabase
- `Edge Functions`

## Estrategia de baseline para Fase 2

1. Crear una copia de trabajo del baseline SQL.
2. Eliminar grants/policies exclusivas de Supabase.
3. Introducir tablas nuevas:
   - `users`
   - `user_sessions`
   - `password_reset_tokens`
   - `schema_migrations`
   - `audit_log`
4. Reescribir funciones con `auth.uid()` para aceptar `p_actor_user_id`.
5. Mantener nombres de tablas y vistas de dominio para reducir cambios en la app.
6. Verificar que `gym-sync-server` pueda apuntar a las mismas tablas locales.

## Riesgos ya identificados

- `close_cash_session` y otros RPCs tienen logica sensible y no deben degradarse a multiples queries sueltas sin transaccion.
- `customer-actions.ts` y `user-actions.ts` asumen que crear usuario auth tambien materializa perfil; ese comportamiento debe replicarse explicitamente.
- `gym-sync-server` hoy usa permisos totales por service role; al pasar a Postgres local habra que decidir entre acceso DB directo o API interna autenticada.
- Storage publico actual devuelve URLs Supabase; habra que normalizar URLs locales para no romper la UI.

## Decision recomendada para la siguiente fase

- Fase 2 debe producir un `baseline local SQL` ya libre de Supabase Auth.
- Fase 3 debe montar `login/logout/me` contra `users` + `user_sessions`.

## Estado operativo actual

Completado en repositorio:

- baseline local versionado en `api-local/sql/migrations/`
- runner `api-local/sql/run-migrations.js`
- tablas locales de identidad, sesion y auditoria definidas
- funcion `get_user_permissions(p_user_id uuid)` definida

Validacion operativa completada el `2026-05-20`:

- base validada: `algym`
- motor validado: `PostgreSQL 16.14`
- conexion valida usada para la prueba: usuario `postgres`
- runner ejecutado: `api-local/sql/run-migrations.js`

Migraciones aplicadas:

- `20260520_000001_schema_migrations.sql`
- `20260520_000002_identity_tables.sql`
- `20260520_000003_access_and_audit.sql`

Tablas validadas:

- `schema_migrations`
- `users`
- `user_sessions`
- `password_reset_tokens`
- `audit_log`

Funcion validada:

- `get_user_permissions(p_user_id uuid)`

## Validacion operativa Fase 3

Validacion completada el `2026-05-20` sobre el backend `api-local` conectado a `algym` en `PostgreSQL 16.14`.

Resultados validados:

- `GET /health` con respuesta `200 OK`
- `POST /auth/login` con credenciales validas contra `public.users`
- `GET /auth/me` con sesion autenticada por cookie local
- `POST /auth/logout` con revocacion en `public.user_sessions`
- registro de eventos `login_success`, `login_failed` y `logout` en `public.audit_log`

Usuario de validacion creado para esta fase:

- email: `owner@allgym.local`
- rol operativo temporal: `owner`
- mecanismo: `bootstrap:admin`

Notas de cierre:

- no se uso runtime de Supabase
- no se guardaron contrasenas reales en el repositorio
- se corrigio la persistencia de `login_failed` para que el evento no se pierda por `rollback`

Registro de migraciones validado:

- las tres migraciones quedaron registradas en `public.schema_migrations`
- el campo `result` quedo en `applied`
