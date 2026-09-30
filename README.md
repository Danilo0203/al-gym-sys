# All Gym Sys

Sistema de gestion para gimnasio compuesto por una aplicacion web, un backend local, un servicio de sincronizacion biometrica y PostgreSQL local. Algunos modulos de la web todavia usan Supabase durante la migracion.

Este README describe el estado actual del proyecto para desarrolladores: arquitectura, carpetas, variables de entorno, ejecucion local, despliegue con Docker Compose y consideraciones para instalarlo en una PC Windows dentro de una red local.

## Arquitectura

El sistema esta dividido en tres piezas principales:

| Pieza | Ruta | Descripcion |
| --- | --- | --- |
| App web | `all-gym-vf` | Aplicacion Next.js 16 con React 19 para administrar clientes, pagos, caja, planes, rutinas, inventario, roles, usuarios y asistencias. |
| Sync biometrico | `gym-sync-server` | Servidor Express que integra relojes biometricos ZKTeco con PostgreSQL local mediante el rol `algym_sync`. |
| Orquestacion local | `docker-compose.yml` | Levanta `web` y `sync` en una red Docker local; `cloudflared` requiere el perfil opcional `remote-access`. |

La autenticacion y las sesiones de la app web usan el backend local mediante un proxy server-side de Next.js. Supabase sigue atendiendo los modulos operativos que aun no han sido migrados; la `SUPABASE_SERVICE_ROLE_KEY` se mantiene solo en codigo de servidor.

## Estructura de Carpetas

```text
.
├── all-gym-vf/              # Aplicacion web Next.js
│   ├── src/app/             # Rutas App Router, API routes y paginas del panel
│   ├── src/features/        # Dominios de negocio: clientes, pagos, caja, planes, etc.
│   ├── src/lib/supabase/    # Clientes Supabase de browser, server y admin
│   └── supabase/            # Migraciones y Edge Functions del proyecto
├── gym-sync-server/         # Servicio Express para ZKTeco y asistencia
├── deploy/env/              # Ejemplos y archivos reales de variables de entorno
├── ops/windows-runbook.md   # Guia operativa para instalacion en Windows
└── docker-compose.yml       # Stack local de produccion/despliegue
```

## Stack Tecnico

- Node.js 20+
- Next.js 16, React 19 y TypeScript
- Tailwind CSS 4, Shadcn UI/Radix UI, Zustand y TanStack Query/Table
- Supabase JS/SSR para Auth y datos
- Express 5 para el servicio de sincronizacion
- `zk-attendance-sdk` para operaciones directas contra dispositivos ZKTeco
- Docker Desktop y Docker Compose para despliegue local
- Cloudflare Tunnel opcional mediante el servicio `cloudflared`

## Requisitos

Para desarrollo:

- Node.js 20 o superior
- npm
- Proyecto Supabase configurado
- Variables de entorno locales

Para instalacion en Windows:

- Windows 10/11
- Docker Desktop con WSL2 habilitado
- Docker Desktop configurado para iniciar con Windows
- IP fija o reserva DHCP para la PC si el reloj biometrico apunta a esa maquina
- Acceso de red local entre la PC, las terminales del gimnasio y el reloj ZKTeco

## Variables de Entorno

No guardar llaves reales en documentacion ni en commits. Antes de vender o instalar el sistema a un cliente, rotar la `SUPABASE_SERVICE_ROLE_KEY` y cualquier token que haya sido usado durante desarrollo.

### `.env` en la raiz

Docker Compose lee variables de este archivo para argumentos de build de la app web.

```env
COMPOSE_PROJECT_NAME=all-gym-local
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=TU_PUBLISHABLE_KEY
```

Referencia: `deploy/.env.example`.

### `deploy/env/web.env`

Variables usadas por el contenedor `web`.

```env
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
ALGYM_BACKEND_URL=http://host.docker.internal:4000
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=TU_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
GYM_SYNC_SERVER_URL=http://sync:8080
GYM_SYNC_API_TOKEN=TOKEN_INTERNO_COMPARTIDO_CON_SYNC
DEFAULT_ZK_DEVICE_SN=SERIAL_DEL_RELOJ
EXERCISEDB_RAPIDAPI_KEY=TU_RAPIDAPI_KEY
```

Referencia: `deploy/env/web.env.example`.

`ALGYM_BACKEND_URL` es exclusivamente server-side. No debe renombrarse con el prefijo `NEXT_PUBLIC_`. En Docker debe apuntar a un nombre o direccion alcanzable desde el contenedor `web`; el Compose local publica `host.docker.internal` para un backend ejecutado en el host.

### `deploy/env/sync.env`

Variables usadas por el contenedor `sync`.

```env
PORT=8080
SYNC_API_TOKEN=TOKEN_INTERNO_COMPARTIDO_CON_WEB
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=algym
DB_USER=algym_sync
DB_PASSWORD=CLAVE_LOCAL_ALEATORIA
ZK_DEVICE_IP=IP_DEL_RELOJ_ZKTECO
ZK_DEVICE_PORT=4370
ZK_DEVICE_TIMEOUT=5000
ZK_DEVICE_INPORT=5200
ZK_REGISTRY_CODE=1
ZK_SUCCESS_RETURNS=0
ZK_TIME_UTC_OFFSET=-06:00
COMMAND_LOCK_MS=25000
DEVICE_RECONCILE_COOLDOWN_MS=120000
```

Referencia: `deploy/env/sync.env.example`.

## Desarrollo Local

### App web

```bash
cd all-gym-vf
npm install
npm run dev
```

La app queda disponible normalmente en `http://localhost:3000`.
Para autenticacion local, configura `ALGYM_BACKEND_URL=http://127.0.0.1:4000` en `all-gym-vf/.env.local`.

Comandos utiles:

```bash
npm run build
npm run start
npm run lint
```

### Servidor de sincronizacion

```bash
cd gym-sync-server
npm install
node --env-file=../deploy/env/sync.env index.js
```

Antes de arrancar, aplicar `database/migrations/0017_sync_local_role.sql` del repositorio hermano `algym-local-backend`, configurar una clave para `algym_sync` en PostgreSQL local y poner la misma clave en `deploy/env/sync.env`. El token `SYNC_API_TOKEN` debe coincidir con `GYM_SYNC_API_TOKEN` de la web. El servicio expone `GET /health/ready` en el puerto `8080`; responde 200 solo si PostgreSQL esta disponible. `npm test` usa exclusivamente `algym_test`.

## Ejecucion con Docker Compose

Desde la raiz del proyecto:

```bash
docker compose up -d --build
docker compose ps
```

El contenedor `sync` conecta con PostgreSQL instalado en la computadora mediante `host.docker.internal` y publica `8080` solo en `127.0.0.1` por defecto. Para un reloj de la red local, configurar `SYNC_BIND_HOST` con la IP de la computadora y comprobar la conectividad del dispositivo. PostgreSQL y el backend aun se ejecutan en el host: incorporarlos a Compose sigue pendiente en `P5-01` de `PLAN_MIGRACION_LOCAL.md`.

Ver logs:

```bash
docker compose logs -f web
docker compose logs -f sync
```

Reiniciar servicios:

```bash
docker compose restart
```

Apagar el stack:

```bash
docker compose down
```

### Estado actual de puertos

El `docker-compose.yml` actual publica la app web asi:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

Eso permite entrar solo desde la misma PC con `http://127.0.0.1:3000` o `http://localhost:3000`.

Para que otras computadoras o tablets de la red local del gimnasio entren a la app, cambiarlo a:

```yaml
ports:
  - "3000:3000"
```

El servicio `sync` publica `8080` solo en `127.0.0.1` de forma predeterminada. Si el reloj ZKTeco envia eventos desde la red local, definir `SYNC_BIND_HOST` con la IP de la PC antes de iniciar Compose.

Tambien se debe permitir el trafico en Firewall de Windows solo para red privada.

## Instalacion Recomendada en Windows

La guia operativa esta en `ops/windows-runbook.md`.

Flujo recomendado para una PC del gimnasio:

1. Instalar Docker Desktop y habilitar WSL2.
2. Configurar Docker Desktop para iniciar con Windows.
3. Copiar el proyecto a una ruta estable, por ejemplo `C:\all-gym-sys`.
4. Configurar `.env`, `deploy\env\web.env` y `deploy\env\sync.env`.
5. Ajustar puertos para red local si otras maquinas usaran el sistema.
6. Dar IP fija o reserva DHCP a la PC.
7. Preparar PostgreSQL y el backend local en la PC, aplicar las migraciones y levantar web/sync:

```powershell
cd C:\all-gym-sys
docker compose up -d --build
docker compose ps
```

8. Probar en la misma PC: `http://localhost:3000`.
9. Probar desde otra maquina de la red: `http://IP_DE_LA_PC:3000`.
10. Crear una tarea en el Programador de tareas para ejecutar el stack al iniciar Windows:

```powershell
powershell.exe -ExecutionPolicy Bypass -Command "cd 'C:\all-gym-sys'; docker compose up -d"
```

## Integracion con ZKTeco

El servidor `gym-sync-server` maneja endpoints compatibles con el flujo ADMS/iClock:

- `GET /iclock/cdata`
- `POST /iclock/cdata`
- `ALL /iclock/registry`
- `GET /iclock/getrequest`
- `POST /iclock/devicecmd`
- `POST /iclock/querydata`

Tambien expone endpoints internos para operaciones desde la app web:

- `GET /api/device-commands`
- `GET /api/device-query-results`
- `POST /api/device-users/register`
- `POST /api/device-users/query`
- `POST /api/device-users/disable`
- `POST /api/device-users/delete`
- `POST /api/device-users/reconcile`

El token `GYM_SYNC_API_TOKEN` de la app web debe coincidir con `SYNC_API_TOKEN` del servicio `sync`.

Para una instalacion local con reloj fisico:

- `ZK_DEVICE_IP` debe ser la IP del reloj.
- `DEFAULT_ZK_DEVICE_SN` debe ser el serial usado por la app para registrar clientes en el dispositivo.
- Si el reloj envia datos hacia la PC, la PC debe publicar el puerto `8080` y permitirlo en Firewall.
- Si la app solo ejecuta comandos directos hacia el reloj, la PC debe poder alcanzar `ZK_DEVICE_IP:4370`.

## Supabase y Migraciones

Las migraciones versionadas estan en `all-gym-vf/supabase/migrations`.

Archivos actuales:

- `20251223000000_initial_remote_schema.sql`
- `20260512_void_product_sale_from_cash_session.sql`
- `20260513005245_cash_close_authorization.sql`

La app depende del backend local para autenticacion, sesiones, autorizacion y perfil actual. Supabase permanece temporalmente para:

- Algunos flujos de clientes, usuarios y roles que aun no se migran.
- Alta/correccion de pagos, caja e inventario.
- Generacion/asignacion de rutinas y otras acciones pendientes.
- Operaciones pendientes de la web que todavia usan `SUPABASE_SERVICE_ROLE_KEY` en servidor.

El sync, las asistencias y los historiales de clientes ya leen PostgreSQL local. El avance y los pendientes por flujo estan en `PLAN_MIGRACION_LOCAL.md`.

Reglas de seguridad:

- Nunca usar `SUPABASE_SERVICE_ROLE_KEY` en codigo cliente.
- Toda variable `NEXT_PUBLIC_*` queda disponible para el navegador.
- Mantener RLS y politicas revisadas en tablas expuestas.
- Rotar llaves antes de entregar una instalacion a cliente.

## Comandos de Operacion

```bash
# Ver estado de contenedores
docker compose ps

# Reconstruir despues de cambios
docker compose up -d --build

# Ver logs de la app web
docker compose logs -f web

# Ver logs del sync biometrico
docker compose logs -f sync

# Ver ultimos logs del tunel
docker compose logs cloudflared --tail 50

# Reiniciar todo
docker compose restart

# Detener todo
docker compose down
```

## Troubleshooting

### La app no abre en otra PC de la red

- Confirmar que `web` publique `3000:3000`, no solo `127.0.0.1:3000:3000`.
- Confirmar la IP de la PC servidor con `ipconfig`.
- Abrir `http://IP_DE_LA_PC:3000` desde otra maquina.
- Revisar Firewall de Windows para red privada.

### Docker build falla por variables de Supabase

- Confirmar que existe `.env` en la raiz.
- Confirmar que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` tienen valor.
- Ejecutar `docker compose up -d --build` desde la raiz del proyecto.

### El servicio sync no esta saludable

- Revisar `docker compose logs -f sync`.
- Confirmar `DB_NAME=algym`, `DB_USER=algym_sync`, su clave local y la migracion `0017` en PostgreSQL de la PC.
- Confirmar que `PORT=8080`.
- Probar `GET /health/ready` en `http://127.0.0.1:8080`.

### No llegan asistencias del reloj

- Confirmar `ZK_DEVICE_IP`, `ZK_DEVICE_PORT` y conectividad hacia el reloj.
- Si el reloj hace push hacia la PC, configurar `SYNC_BIND_HOST` con la IP de la PC y permitir el puerto `8080` en el firewall de la red privada.
- Revisar que el reloj apunte a la IP fija de la PC.
- Confirmar que `public.attendance_logs` exista en `algym` local y que `/health/ready` responda 200.

### La app no sincroniza clientes con el reloj

- Confirmar que `GYM_SYNC_SERVER_URL=http://sync:8080` dentro de Docker.
- Confirmar que `GYM_SYNC_API_TOKEN` y `SYNC_API_TOKEN` coincidan.
- Confirmar que `DEFAULT_ZK_DEVICE_SN` este configurado.
- Revisar logs de `web` y `sync`.

## Estado Actual y Pendientes Tecnicos

- El README interno de `all-gym-vf` describe la app web, pero no representa todo el sistema ni la instalacion Windows.
- El stack Docker actual esta preparado para uso local en la misma PC; para red local requiere publicar `3000:3000`.
- El servicio `sync` requiere configurar `SYNC_BIND_HOST` si el reloj ZKTeco envia datos desde otra maquina de la red.
- PostgreSQL y el backend siguen ejecutandose fuera de Compose; `P5-01` documenta su integracion pendiente.
- Antes de instalar a un cliente, revisar y rotar secretos reales.
- Conviene mantener `ops/windows-runbook.md` alineado con cualquier cambio futuro de Docker o puertos.
