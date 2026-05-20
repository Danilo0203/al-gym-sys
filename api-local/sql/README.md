# SQL local

Target fijo de esta migracion:

- `PostgreSQL 16`

## Estructura

```text
api-local/sql/
  README.md
  baseline/
    README.md
  migrations/
    20260520_000001_schema_migrations.sql
    20260520_000002_identity_tables.sql
    20260520_000003_access_and_audit.sql
```

## Orden de uso

1. Tomar como fuente de esquema las migraciones actuales en `all-gym-vf/supabase/migrations/`.
2. Aplicar el corte local descrito en `baseline/README.md`.
3. Aplicar las migraciones locales de `migrations/` en orden lexicografico.

## Runner local

Se creo un runner simple y documentado:

- `api-local/sql/run-migrations.js`

Regla de implementacion:

- usa `const { Client } = require("pg")`
- no usa rutas absolutas
- no depende de paquetes globales
- debe funcionar con `api-local/node_modules`

Uso:

```bash
node api-local/sql/run-migrations.js
```

Configuracion por entorno opcional:

- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`

Default:

- `PGDATABASE=algym`

Comportamiento:

- descubre archivos `*.sql` en `api-local/sql/migrations/`
- los aplica en orden
- registra migraciones aplicadas en `public.schema_migrations`
- omite versiones ya registradas

Validacion real confirmada:

- funciona en macOS y en Windows VM
- validado contra `PostgreSQL 16.14`
- validado contra la base `algym`
- migraciones ejecutadas correctamente en Windows:
  - `20260520_000001_schema_migrations.sql`
  - `20260520_000002_identity_tables.sql`
  - `20260520_000003_access_and_audit.sql`

## Objetivo de Fase 2

Esta carpeta deja listo el baseline local para:

- controlar migraciones sin Supabase
- introducir identidad local
- introducir sesiones locales
- introducir auditoria
- reemplazar `get_current_permissions()` por una funcion local con `userId` explicito
