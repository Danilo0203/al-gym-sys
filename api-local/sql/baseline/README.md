# Baseline PostgreSQL 16 local

## Fuente de esquema actual

El baseline funcional actual sale de estas migraciones remotas:

1. `all-gym-vf/supabase/migrations/20251223000000_initial_remote_schema.sql`
2. `all-gym-vf/supabase/migrations/20260512_void_product_sale_from_cash_session.sql`
3. `all-gym-vf/supabase/migrations/20260513005245_cash_close_authorization.sql`

## Regla de corte para baseline local

Conservar:

- tablas de dominio
- vistas de lectura
- funciones SQL transaccionales de caja e inventario

Reescribir o eliminar:

- dependencias de `auth.uid()`
- funciones pensadas para contexto Supabase Auth implicito
- politicas RLS de `anon` y `authenticated`
- grants para `service_role`
- convenciones de Storage y Edge Functions de Supabase

## SQL que debe quedarse en DB

Se recomienda conservar en SQL, con ajustes de actor explicito:

- `attach_payment_to_cash`
- `open_cash_session`
- `close_cash_session`
- `create_subscription_payment_for_existing_customer`
- `renew_subscription_with_payment`
- `reverse_and_recreate_payment`
- `sell_products_from_cash_session`
- `void_product_sale_from_cash_session`
- `record_product_inventory_movement`
- `adjust_product_stock`

## SQL que debe salir del modelo Supabase

- `get_current_permissions()` debe reemplazarse por `get_user_permissions(p_user_id uuid)`
- toda autorizacion basada en `auth.uid()` debe resolverse con `userId` explicito desde backend
- cualquier grant/policy para roles Supabase debe eliminarse del baseline local

## Orden recomendado de adopcion

1. Cargar el esquema remoto como base estructural.
2. Aplicar el parche de `close_cash_session` mas reciente.
3. Aplicar la funcion `void_product_sale_from_cash_session`.
4. Aplicar las migraciones locales de `api-local/sql/migrations/`.
5. En la siguiente fase, reescribir las funciones que aun dependan de `auth.uid()`.

## Objetos locales introducidos en esta fase

- `schema_migrations`
- `users`
- `user_sessions`
- `password_reset_tokens`
- `audit_log`
- `get_user_permissions(p_user_id uuid)`
- `get_user_role_scope(p_user_id uuid)`
