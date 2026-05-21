# api-local

Backend local minimo de All Gym para Fase 3.

## Stack

- `Express`
- `TypeScript`
- `Zod`
- `pg`
- `argon2`

## Requisitos

- PostgreSQL 16 local
- Base `algym`
- Migraciones de `api-local/sql/migrations/` ya aplicadas

## Variables de entorno

Usa `.env.local` o `.env`.

Variables minimas:

- `DATABASE_URL`
- `PORT`
- `WEB_LOCAL_ORIGIN`
- `WEB_PUBLIC_ORIGIN`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_HOURS`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_NAME`

No guardar secretos reales en el repositorio. Usa `.env.local` o `.env` ignorados por git.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run start
npm run typecheck
npm run build:windows:api
```

## Bootstrap de usuario owner

Para crear o actualizar el usuario owner inicial sin guardar su password en el repo:

```bash
BOOTSTRAP_ADMIN_PASSWORD='cambia-esto' npm run bootstrap:admin
```

Defaults:

- email: `owner@allgym.local`
- nombre: `All Gym Owner`

El backend trata este usuario bootstrap como `owner` mientras no exista un sistema completo de roles locales.

## Endpoints incluidos

- `GET /health`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /admin/users`
- `GET /admin/users/roles`
- `GET /admin/users/:id`
- `POST /admin/users`
- `PATCH /admin/users/:id`
- `PATCH /admin/users/:id/status`
- `PATCH /admin/users/:id/role`
- `DELETE /admin/users/:id`
- `GET /admin/roles`
- `GET /admin/roles/permissions`
- `GET /admin/roles/:id/permissions`
- `POST /admin/roles`
- `PATCH /admin/roles/:id`
- `DELETE /admin/roles/:id`

## Notas

- No hay dependencia de Supabase en `api-local`.
- Las sesiones se persisten en `public.user_sessions`.
- Los eventos de auth se registran en `public.audit_log`.
- `npm run build:windows:api` genera un staging Windows temprano en `installer/windows/staging/`.
