# All Gym Sys

Sistema de gestion para gimnasio compuesto por una aplicacion web, un servicio de sincronizacion biometrica y una base de datos Supabase externa.

Este README describe el estado actual del proyecto para desarrolladores: arquitectura, carpetas, variables de entorno, ejecucion local, despliegue con Docker Compose y consideraciones para instalarlo en una PC Windows dentro de una red local.

## Arquitectura

El sistema esta dividido en tres piezas principales:

| Pieza | Ruta | Descripcion |
| --- | --- | --- |
| App web | `all-gym-vf` | Aplicacion Next.js 16 con React 19 para administrar clientes, pagos, caja, planes, rutinas, inventario, roles, usuarios y asistencias. |
| Sync biometrico | `gym-sync-server` | Servidor Express que integra el sistema con relojes biometricos ZKTeco y guarda eventos de asistencia en Supabase. |
| Orquestacion local | `docker-compose.yml` | Levanta los servicios `web`, `sync` y `cloudflared` en una red Docker local. |

Supabase funciona como backend externo para Auth, PostgreSQL y datos operativos del gimnasio. La app web usa claves publicas de Supabase en cliente/SSR y la `SUPABASE_SERVICE_ROLE_KEY` solo en codigo de servidor.

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
NEXT_PUBLIC_ENABLE_OAUTH_LOGIN=false
NEXT_PUBLIC_ENABLE_PASSWORD_RECOVERY=false
```

Referencia: `deploy/.env.example`.

### `deploy/env/web.env`

Variables usadas por el contenedor `web`.

```env
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=TU_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
GYM_SYNC_SERVER_URL=http://sync:8080
GYM_SYNC_API_TOKEN=TOKEN_INTERNO_COMPARTIDO_CON_SYNC
DEFAULT_ZK_DEVICE_SN=SERIAL_DEL_RELOJ
EXERCISEDB_RAPIDAPI_KEY=TU_RAPIDAPI_KEY
NEXT_PUBLIC_ENABLE_OAUTH_LOGIN=false
NEXT_PUBLIC_ENABLE_PASSWORD_RECOVERY=false
```

Referencia: `deploy/env/web.env.example`.

### `deploy/env/sync.env`

Variables usadas por el contenedor `sync`.

```env
PORT=8080
SYNC_API_TOKEN=TOKEN_INTERNO_COMPARTIDO_CON_WEB
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
ZK_DEVICE_IP=IP_DEL_RELOJ_ZKTECO
ZK_DEVICE_PORT=4370
ZK_DEVICE_TIMEOUT=5000
ZK_DEVICE_INPORT=5200
ZK_REGISTRY_CODE=1
ZK_SUCCESS_RETURNS=0
COMMAND_LOCK_MS=25000
DEVICE_RECONCILE_COOLDOWN_MS=120000
ATTENDANCE_TABLE=attendance_logs
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
node index.js
```

El servicio expone `GET /health` en el puerto configurado por `PORT`, por defecto `8080`.

## Ejecucion con Docker Compose

Desde la raiz del proyecto:

```bash
docker compose up -d --build
docker compose ps
```

Ver logs:

```bash
docker compose logs -f web
docker compose logs -f sync
docker compose logs -f cloudflared
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

El servicio `sync` actualmente no publica puerto hacia el host. Si el reloj ZKTeco envia eventos a la PC por red local, agregar:

```yaml
ports:
  - "8080:8080"
```

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
7. Levantar el stack:

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

La app depende de Supabase para:

- Autenticacion y sesiones.
- Datos de clientes, usuarios, roles y membresias.
- Pagos, caja e inventario.
- Rutinas y ejercicios.
- Registros de asistencia en `attendance_logs`.
- Operaciones administrativas mediante `SUPABASE_SERVICE_ROLE_KEY` en servidor.

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
- Confirmar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `deploy/env/sync.env`.
- Confirmar que `PORT=8080`.
- Probar `GET /health` dentro de la red donde este publicado el servicio.

### No llegan asistencias del reloj

- Confirmar `ZK_DEVICE_IP`, `ZK_DEVICE_PORT` y conectividad hacia el reloj.
- Si el reloj hace push hacia la PC, publicar `8080:8080`.
- Revisar que el reloj apunte a la IP fija de la PC.
- Confirmar que la tabla `attendance_logs` exista y que el valor `ATTENDANCE_TABLE` coincida.

### La app no sincroniza clientes con el reloj

- Confirmar que `GYM_SYNC_SERVER_URL=http://sync:8080` dentro de Docker.
- Confirmar que `GYM_SYNC_API_TOKEN` y `SYNC_API_TOKEN` coincidan.
- Confirmar que `DEFAULT_ZK_DEVICE_SN` este configurado.
- Revisar logs de `web` y `sync`.

## Estado Actual y Pendientes Tecnicos

- El README interno de `all-gym-vf` describe la app web, pero no representa todo el sistema ni la instalacion Windows.
- El stack Docker actual esta preparado para uso local en la misma PC; para red local requiere publicar `3000:3000`.
- El servicio `sync` requiere publicar `8080:8080` si el reloj ZKTeco envia datos hacia la PC.
- Antes de instalar a un cliente, revisar y rotar secretos reales.
- Conviene mantener `ops/windows-runbook.md` alineado con cualquier cambio futuro de Docker o puertos.
