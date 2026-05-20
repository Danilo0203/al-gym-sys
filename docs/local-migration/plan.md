# All Gym Local para Windows con Desarrollo en Mac

## Resumen

Arquitectura final aprobada para implementación:

- `macOS` para desarrollo.
- `Windows` para entrega final.
- `Electron` solo como shell y diagnóstico.
- `Next.js standalone` como UI web accesible en LAN.
- `Express + TypeScript + Zod` como backend/API y lógica de negocio.
- `PostgreSQL 16` local, solo en `localhost`.
- `gym-sync-server` como servicio separado.
- `Supabase` se elimina del runtime final.
- Instalador: `electron-builder + NSIS`.
- Servicios Windows: `WinSW`.
- Migraciones DB: `SQL versionado`.
- Auth: `argon2` + cookies `httpOnly` + sesiones en PostgreSQL.

Arquitectura objetivo:

```text
PC Windows servidor
│
├── PostgreSQL 16
│   └── localhost:5432
│
├── Express API
│   └── localhost:4000
│
├── Next.js standalone server
│   ├── LAN: http://IP_SERVIDOR:3000
│   └── Proxy interno hacia Express
│
├── gym-sync-server
│   └── servicio separado
│
└── Electron
    ├── abre http://127.0.0.1:3000
    └── diagnóstico operativo
```

## Decisiones técnicas cerradas

### Comunicación UI/API

- La UI pública sale por `Next.js`.
- El navegador usa rutas relativas `/api/...`.
- `Next.js` proxyea internamente hacia `Express`.
- Variables base:
  - `WEB_PUBLIC_ORIGIN=http://IP_SERVIDOR:3000`
  - `WEB_LOCAL_ORIGIN=http://127.0.0.1:3000`
  - `API_INTERNAL_URL=http://127.0.0.1:4000`

### Puertos y exposición

- `Next.js`: `3000`, abierto a LAN.
- `Express`: `4000`, interno por defecto.
- `PostgreSQL`: `5432`, solo `localhost`.
- `gym-sync-server`: puerto fijo a definir en su fase.
- `PostgreSQL` no se abre al firewall.
- `Express` no se publica a la LAN por defecto.

### Runtime y seguridad

- El cliente no instala `Node.js` manualmente.
- El runtime se distribuye con el producto.
- Auth local con:
  - `argon2`
  - cookies `httpOnly`
  - `sameSite=lax`
  - `secure=false` en instalación LAN con HTTP
  - `secure=true` solo si se configura HTTPS
  - sesiones persistidas en PostgreSQL
  - `express-rate-limit`
  - autorización por rol/permiso en backend
  - auditoría en operaciones críticas
  - protección CSRF en `POST`, `PUT`, `PATCH`, `DELETE`
- Las operaciones `GET` no deben modificar datos.

### Usuario inicial

- El sistema debe crear un usuario `owner/admin` inicial en instalación, primer arranque o seed controlado.
- La contraseña se guarda con `argon2`.
- Si se usa seed temporal, debe forzarse cambio de contraseña en el primer login.

### Persistencia y rutas Windows

- `C:\Program Files\AllGym\` -> binarios
- `C:\ProgramData\AllGym\data\` -> datos persistentes
- `C:\ProgramData\AllGym\uploads\` -> archivos
- `C:\ProgramData\AllGym\backups\` -> respaldos
- `C:\ProgramData\AllGym\logs\` -> logs
- `C:\ProgramData\AllGym\config\` -> configuración

## Estructura inicial a crear

```text
docs/
  local-migration/
    plan.md
    supabase-inventory.md
    api-contracts.md
    db-migration-notes.md
    windows-installer-notes.md

api-local/
  src/
```

## Fase 1: entregables concretos

### Objetivo

Producir un inventario completo de dependencias actuales de Supabase y dejar listo el diseño del backend local.

### Checklist de cierre

- [x] Inventario completo de dependencias actuales de Supabase.
- [x] Clasificacion por `AUTH`, `USERS_ADMIN`, `STORAGE`, `RPC`, `EDGE_FUNCTION`, `QUERY_DIRECTA`, `REALTIME`, `OTRO`.
- [x] Contratos iniciales del backend local para auth, sesiones, storage y operaciones criticas.
- [x] Notas iniciales de migracion de DB local.
- [x] Notas base del instalador Windows.
- [x] Estructura inicial de `api-local/`.

### Entregables

- Rama: `migration/local-windows-runtime`
- `docs/local-migration/supabase-inventory.md`
- `docs/local-migration/api-contracts.md`
- `docs/local-migration/db-migration-notes.md`
- `docs/local-migration/windows-installer-notes.md`

### Clasificación obligatoria

- `AUTH`
- `USERS_ADMIN`
- `STORAGE`
- `RPC`
- `EDGE_FUNCTION`
- `QUERY_DIRECTA`
- `REALTIME`
- `OTRO`

### Campos mínimos por entrada

- archivo y símbolo
- categoría
- qué hace hoy
- inputs
- outputs
- módulo funcional
- si requiere permisos
- si toca caja/pagos/inventario
- reemplazo propuesto en backend local

### Primera meta técnica

Primera funcionalidad a reemplazar:

- `login local sin Supabase`

Flujo objetivo:

```text
Next.js UI
  -> /api/auth/login
  -> Express
  -> PostgreSQL local
  -> cookie de sesión
  -> Next.js reconoce usuario autenticado
```

## Fases de implementación

### Fase 1. Inventario Supabase y contratos locales

- [x] Buscar y clasificar todos los usos de:
  - `@supabase/*`
  - `auth.*`
  - `auth.admin.*`
  - `storage.*`
  - `functions.invoke`
  - `.rpc(...)`
- [x] Diseñar contratos locales iniciales para auth, sesiones, storage y operaciones criticas.

### Fase 2. PostgreSQL local y baseline SQL

- [x] Fijar `PostgreSQL 16`.
- [x] Reusar migraciones SQL existentes como base.
- [x] Separar logica SQL que se mantiene en DB de la que depende de Supabase auth/RLS.

### Checklist de cierre Fase 2

- [x] Baseline local definido en `api-local/sql/`.
- [x] Orden base de migraciones documentado.
- [x] Tabla `schema_migrations` definida.
- [x] Tablas locales de identidad y sesion definidas.
- [x] Funcion local `get_user_permissions(p_user_id)` definida para reemplazar `get_current_permissions()`.
- [x] Separacion documentada entre SQL que se conserva en DB y SQL que se reescribe por dependencias de Supabase Auth/RLS.
- [x] Runner simple de migraciones creado y documentado.
- [x] Migraciones ejecutadas contra `algym` en PostgreSQL 16 local.
- [x] Tablas y funciones validadas en la base local real.

Validacion operativa completada el `2026-05-20` sobre:

- base local: `algym`
- motor: `PostgreSQL 16.14`
- usuario de validacion: `postgres`

Migraciones aplicadas y registradas:

- `20260520_000001_schema_migrations.sql`
- `20260520_000002_identity_tables.sql`
- `20260520_000003_access_and_audit.sql`

Objetos validados:

- tablas:
  - `schema_migrations`
  - `users`
  - `user_sessions`
  - `password_reset_tokens`
  - `audit_log`
- funcion:
  - `get_user_permissions(p_user_id uuid)`

### Control de migraciones SQL

- Toda migración SQL debe tener nombre versionado.
- El sistema mantendrá una tabla interna `schema_migrations`.
- Cada migración aplicada se registrará con:
  - versión
  - nombre del archivo
  - fecha de ejecución
  - checksum opcional
  - resultado
- Las migraciones no deben ejecutarse dos veces.
- Si una migración falla, debe quedar registrado en `migration.log`.

Ejemplo de tabla:

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

### Fase 3. Backend local mínimo

- [x] Crear `api-local/` con `Express + TypeScript + Zod`.
- [x] Implementar:
  - `login`
  - `logout`
  - `me`
  - sesiones
  - middleware auth
  - middleware permisos

### Checklist de cierre Fase 3

- [x] Estructura inicial de `api-local/` creada con `package.json`, `tsconfig.json`, `src/server.ts`, `src/config/env.ts`, `src/db/client.ts`, `src/modules/auth/`, `src/middleware/` y `src/utils/`.
- [x] `Express` configurado con `express.json()`, `cookie-parser`, `cors` restringido, health check y manejo centralizado de errores.
- [x] Conexion a PostgreSQL local implementada con `pg` y `DATABASE_URL`.
- [x] Validacion de entorno y payloads implementada con `zod`.
- [x] Endpoints `POST /auth/login`, `POST /auth/logout` y `GET /auth/me` funcionando contra `algym`.
- [x] Verificacion de password con `argon2`.
- [x] Sesiones persistidas en `public.user_sessions`.
- [x] Cookie de sesion enviada como `httpOnly`, `sameSite=lax`, `secure=false`.
- [x] Middleware base de autenticacion y permisos implementado.
- [x] Eventos `login_success`, `login_failed` y `logout` registrados en `public.audit_log`.
- [x] Scripts `dev`, `build`, `start`, `typecheck` y `bootstrap:admin` definidos.
- [x] `api-local/README.md` documentado para ejecucion local.
- [x] Usuario owner inicial creado para validacion controlada sin guardar secretos en el repositorio.

Validacion operativa Fase 3 completada el `2026-05-20` sobre:

- base local: `algym`
- motor: `PostgreSQL 16.14`
- backend validado: `api-local` en `http://127.0.0.1:4000`

Flujos validados:

- `GET /health` responde `200 OK`
- `POST /auth/login` rechaza credenciales invalidas y registra `login_failed`
- `POST /auth/login` acepta credenciales validas y crea sesion persistida
- `GET /auth/me` devuelve usuario autenticado con cookie valida
- `POST /auth/logout` revoca sesion y registra `logout`

### Fase 4. Instalador Windows mínimo temprano

- [x] Montar base temprana con `electron-builder + NSIS`.
- [x] Preparar configuracion de servicios con `WinSW`.
- [x] Validar instalación base en Windows limpio/VM para `api-local`.

### Checklist de avance Fase 4

- [x] Documentacion de instalacion Windows actualizada en `docs/local-migration/windows-installer-notes.md`.
- [x] Layout objetivo definido para `Program Files` y `ProgramData`.
- [x] Plantilla de configuracion para `api-local` creada sin secretos reales.
- [x] Wrapper `WinSW` real creado para `allgym-api-local`.
- [x] Placeholders `WinSW` creados para `allgym-web` y `allgym-sync`.
- [x] Scripts PowerShell creados para arrancar, instalar y probar `allgym-api-local`.
- [x] Script de staging temprano creado para preparar el bundle Windows de `api-local`.
- [x] Base minima de `electron-builder + NSIS` creada con shell placeholder.
- [x] Hooks `NSIS` creados para instalar y desinstalar `allgym-api-local`.
- [x] Servicio `allgym-api-local` validado en Windows real/VM con `WinSW`.
- [x] Instalador `NSIS` minimo ejecutado en Windows VM.

Validacion tecnica completada el `2026-05-20`:

- `api-local` compila
- `npm run build:windows:api` genera staging temprano
- el staging contiene backend, scripts PowerShell, XML de `WinSW` y plantilla de config
- el backend arranca desde el bundle staged
- `GET /health` responde `200 OK` desde el bundle staged usando el puerto oficial `4000`
- el runner `api-local/sql/run-migrations.js` corregido para usar `require("pg")` sin rutas absolutas ni dependencias globales
- el build `NSIS` queda preparado para generar `AllGym-Setup.exe` cuando existan `installer/windows/runtime/node/node.exe` y `installer/windows/winsw/allgym-api-local.exe`

Validacion real confirmada en Windows VM:

- `PostgreSQL 16.14` instalado
- base `algym` creada
- migraciones ejecutadas correctamente:
  - `20260520_000001_schema_migrations.sql`
  - `20260520_000002_identity_tables.sql`
  - `20260520_000003_access_and_audit.sql`
- tablas validadas:
  - `schema_migrations`
  - `users`
  - `user_sessions`
  - `password_reset_tokens`
  - `audit_log`
- funcion validada:
  - `get_user_permissions(p_user_id uuid)`
- `allgym-api-local` instalado con `WinSW`
- servicio visible en `services.msc` como `All Gym API Local`
- tipo de inicio: `Automatic`
- estado: `Running`
- `.\allgym-api-local.exe restart` funciona
- `.\allgym-api-local.exe status` responde `Active (running)`
- se genero `AllGym-Setup.exe`
- se ejecuto el instalador `NSIS`
- se instalo en `C:\Program Files\AllGym`
- Electron placeholder abrio como `All Gym Local`
- `GET http://127.0.0.1:4000/health` responde `200 OK`

Fase 4 queda validada para este checkpoint:

- `api-local`
- `WinSW`
- instalador `NSIS` minimo
- `health check` en Windows VM

Pendientes que siguen fuera del cierre total:

- validar `allgym-web`
- validar `allgym-sync`
- instalador final completo
- seguir sin avanzar a Fase 5 hasta confirmacion explicita

### Fase 5. Migración feature por feature

- Reemplazar `src/lib/supabase/*`.
- Reapuntar frontend a `/api/...`.
- Migrar primero:
  - auth
  - usuarios/roles
  - clientes
  - pagos/caja
  - inventario

### Bloque 1 de Fase 5. Auth local en frontend

- [x] Crear capa local inicial para reemplazo progresivo de `src/lib/supabase/*` solo en auth.
- [x] Crear gateway `Next.js` para:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- [x] Conectar el flujo actual de login del frontend al backend local `api-local`.
- [x] Conectar el flujo actual de logout del frontend al backend local `api-local`.
- [x] Migrar resolucion server-side de sesion en `proxy.ts` y `lib/auth/authorization.ts` a la ruta local.
- [x] Mantener cookies `httpOnly` del backend usando solo rutas relativas `/api/...`.
- [x] Evitar llamadas del navegador directo a `127.0.0.1:4000`.
- [x] Documentar variables de entorno:
  - `API_INTERNAL_URL`
  - `WEB_LOCAL_ORIGIN`
  - `WEB_PUBLIC_ORIGIN`
- [x] Validar login local extremo a extremo via `Next.js /api/auth/login`.
- [x] Validar logout local extremo a extremo via `Next.js /api/auth/logout`.
- [x] Validar `GET /api/auth/me` via `Next.js /api/auth/me`.

Notas:

- esta migracion sigue siendo gradual
- no se tocaron todavia `clientes`, `caja`, `pagos`, `inventario` ni `storage`
- no avanzar al siguiente bloque de Fase 5 sin validar `login/logout/me`
- validacion real del bloque 1 realizada el `2026-05-20`
- `POST /api/auth/login` respondio `200 OK` y emitio cookie `httpOnly`
- `GET /api/auth/me` respondio `200 OK` con usuario autenticado
- `POST /api/auth/logout` respondio `204 No Content` y limpio la cookie
- `GET /api/auth/me` posterior al logout respondio `401 Unauthorized`

### Fase 6. Storage local

- Implementar filesystem storage.
- Servir imágenes/archivos desde backend.
- Validar persistencia tras actualización.

### Fase 7. Migración de datos reales desde Supabase

- Exportar datos actuales.
- Importar a PostgreSQL local.
- Descargar archivos de Storage.
- Reubicar referencias a storage local.
- Validar conteos e integridad funcional por módulo.

### Fase 8. Integración gym-sync-server

- Conectar `gym-sync-server` a DB local.
- Validar flujo ZKTeco real y operación en LAN.

### Fase 9. Electron y diagnóstico

- Añadir shell `Electron`.
- Mostrar estado de backend, DB, web, sync e internet.
- Permitir reintentos y acceso a logs.

### Fase 10. Backups, restore y actualizaciones

- Backup automático antes de upgrades.
- Aplicar migraciones automáticas.
- Validar restore y rollback básico.

### Fase 11. QA en Windows limpio y LAN real

- Validar instalación completa.
- Probar red local, reinicios, pérdida de internet y recuperación.

## Orden de arranque y salud de servicios

- `PostgreSQL` debe arrancar antes que `Express`.
- `Express` debe validar conexión a DB antes de quedar saludable.
- `Next.js` depende de `Express` para operaciones autenticadas.
- `gym-sync-server` debe validar conectividad a DB antes de operar.
- `Electron` debe mostrar diagnóstico si `Next.js` o cualquier servicio falla.

Orden esperado:

1. `PostgreSQL`
2. `Express API`
3. `Next.js standalone`
4. `gym-sync-server`
5. `Electron` lo abre el usuario

## Logs y diagnóstico

Logs mínimos:

- `C:\ProgramData\AllGym\logs\backend.log`
- `C:\ProgramData\AllGym\logs\web.log`
- `C:\ProgramData\AllGym\logs\sync.log`
- `C:\ProgramData\AllGym\logs\installer.log`
- `C:\ProgramData\AllGym\logs\migration.log`

`Electron` debe mostrar:

- backend activo/inactivo
- DB conectada/no conectada
- web server activo/inactivo
- sync activo/inactivo
- internet disponible/no disponible
- último backup
- último error
- acceso a carpeta de logs

## Pruebas y aceptación

- Inventario Supabase completo.
- Contratos iniciales de auth local documentados.
- DB local definida con baseline SQL.
- `login/logout/me` funcionando sin Supabase.
- `Next.js` consumiendo `/api/...` vía proxy interno.
- Instalador Windows mínimo funcional.
- Usuario admin inicial creado correctamente.
- Orden de arranque validado.
- Export/import de datos reales planificado y verificable.

## Supuestos y defaults fijados

- `api-local/` será el nuevo servicio raíz.
- `docs/local-migration/` será la carpeta oficial de transición.
- `PostgreSQL 16` queda fijo para producción.
- `SQL versionado` es la estrategia oficial de migración.
- `WinSW` gestiona servicios Windows.
- `electron-builder + NSIS` empaqueta el producto.
- `argon2 + sesiones en PostgreSQL` es la base de auth local.
- El cliente final no usa Docker ni instala Node.js manualmente.
- La instalación inicial operará sobre HTTP en LAN salvo que luego se añada HTTPS.
