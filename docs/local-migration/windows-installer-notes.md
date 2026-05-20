# Notas para instalador Windows

Fecha de corte: `2026-05-20`

## Objetivo de Fase 4 y continuidad hacia Fase 5

Dejar una base minima para empaquetado Windows con:

- `electron-builder + NSIS`
- servicios `WinSW`
- layout fijo en `Program Files` y `ProgramData`
- backend `api-local` como primer servicio realmente preparable
- `allgym-web` como siguiente servicio `Next.js standalone`

El checkpoint de esta fase es:

- `api-local` compilado
- bundle Windows generado
- servicio `allgym-api-local` listo para registrar con `WinSW`
- `GET /health` como prueba operativa objetivo

## Layout de instalacion aprobado

Rutas persistentes objetivo:

- `C:\Program Files\AllGym\`
- `C:\ProgramData\AllGym\config\`
- `C:\ProgramData\AllGym\logs\`
- `C:\ProgramData\AllGym\data\`
- `C:\ProgramData\AllGym\uploads\`
- `C:\ProgramData\AllGym\backups\`

Layout minimo preparado en esta fase:

```text
C:\Program Files\AllGym\
├── api-local\
│   ├── dist\
│   ├── node_modules\
│   ├── package.json
│   └── package-lock.json
├── allgym-web\
│   ├── server.js
│   ├── .next\
│   │   └── static\
│   ├── public\
│   └── node_modules\
├── runtime\
│   └── node\
│       └── node.exe
├── scripts\
│   ├── start-api-local.ps1
│   ├── install-allgym-api-local.ps1
│   ├── test-allgym-api-local.ps1
│   ├── start-allgym-web.ps1
│   ├── install-allgym-web.ps1
│   ├── test-allgym-web.ps1
│   ├── uninstall-allgym-api-local.ps1
│   └── uninstall-allgym-web.ps1
├── templates\
│   ├── api-local.env.example
│   └── allgym-web.env.example
└── winsw\
    ├── allgym-api-local.exe
    ├── allgym-api-local.xml
    ├── allgym-web.exe
    ├── allgym-web.xml
    └── allgym-sync.xml

C:\ProgramData\AllGym\
├── config\
│   ├── api-local.env
│   └── allgym-web.env
├── logs\
│   ├── backend.log
│   ├── web.log
│   └── installer.log
├── data\
├── uploads\
└── backups\
```

## Artefactos creados en repositorio

Configuracion Windows versionada:

- `installer/windows/templates/api-local.env.example`
- `installer/windows/templates/allgym-web.env.example`
- `installer/windows/scripts/start-api-local.ps1`
- `installer/windows/scripts/install-allgym-api-local.ps1`
- `installer/windows/scripts/test-allgym-api-local.ps1`
- `installer/windows/scripts/uninstall-allgym-api-local.ps1`
- `installer/windows/scripts/start-allgym-web.ps1`
- `installer/windows/scripts/install-allgym-web.ps1`
- `installer/windows/scripts/test-allgym-web.ps1`
- `installer/windows/scripts/uninstall-allgym-web.ps1`
- `installer/windows/winsw/allgym-api-local.xml`
- `installer/windows/winsw/allgym-web.xml`
- `installer/windows/winsw/allgym-sync.xml`
- `installer/windows/electron-shell/package.json`
- `installer/windows/electron-shell/README.md`
- `installer/windows/electron-shell/electron-builder.yml`
- `installer/windows/electron-shell/build/installer.nsh`
- `installer/windows/electron-shell/scripts/prepare-dist.mjs`
- `installer/windows/electron-shell/src/main.js`
- `installer/windows/electron-shell/src/preload.js`
- `installer/windows/electron-shell/src/placeholder.html`

Preparacion del backend:

- `api-local/scripts/stage-windows-api-local.mjs`
- script npm: `npm run build:windows:api`

Preparacion del frontend:

- `all-gym-vf/scripts/stage-windows-web.mjs`
- script npm: `npm run build:windows:web`

## Variables minimas del backend

Plantilla preparada sin secretos reales:

```env
DATABASE_URL=postgresql://postgres:change-me@127.0.0.1:5432/algym
PORT=4000
SESSION_COOKIE_NAME=allgym_session
WEB_LOCAL_ORIGIN=http://127.0.0.1:3000
WEB_PUBLIC_ORIGIN=http://localhost:3000
```

Opcionales ya incluidos en la plantilla:

- `NODE_ENV=production`
- `SESSION_TTL_HOURS=168`
- `BOOTSTRAP_ADMIN_EMAIL=owner@allgym.local`
- `BOOTSTRAP_ADMIN_NAME=All Gym Owner`

No se versionan passwords reales.

## Variables minimas de `allgym-web`

Plantilla preparada sin secretos reales:

```env
PORT=3000
HOSTNAME=127.0.0.1
API_INTERNAL_URL=http://127.0.0.1:4000
WEB_LOCAL_ORIGIN=http://127.0.0.1:3000
WEB_PUBLIC_ORIGIN=http://localhost:3000
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

## Servicios WinSW preparados

### `allgym-api-local`

Estado:

- listo para validacion manual en Windows
- wrapper real preparado
- objetivo de logs: `C:\ProgramData\AllGym\logs\backend.log`

Estrategia:

- `WinSW` levanta `powershell.exe`
- `start-api-local.ps1` carga `api-local.env`
- el script ejecuta `node.exe dist/server.js`
- stdout/stderr se appenden a `backend.log`

### `allgym-web`

Estado:

- wrapper real preparado
- staging `standalone` generado
- pendiente validacion como servicio real `WinSW` en Windows VM

Estrategia:

- `WinSW` levanta `powershell.exe`
- `start-allgym-web.ps1` carga `allgym-web.env`
- el script ejecuta `node.exe server.js` del bundle `Next.js standalone`
- stdout/stderr se appenden a `web.log`

### `allgym-sync`

Estado:

- placeholder versionado
- no implementar ni validar todavia

## Comandos de build y staging

Desde `api-local/`:

```bash
npm run build
npm run build:windows:api
```

Desde `all-gym-vf/`:

```bash
npm run build
npm run build:windows:web
```

El staging se genera en:

```text
installer/windows/staging/
```

Ese staging no se versiona y sirve para inspeccionar el bundle esperado antes de empaquetar.

Rutas relevantes del staging:

- `installer/windows/staging/ProgramFiles/AllGym/api-local/`
- `installer/windows/staging/ProgramFiles/AllGym/allgym-web/`
- `installer/windows/staging/ProgramFiles/AllGym/scripts/`
- `installer/windows/staging/ProgramFiles/AllGym/winsw/`
- `installer/windows/staging/ProgramFiles/AllGym/templates/`

## Instalacion manual en Windows limpio

Prerequisitos esperados:

- PostgreSQL 16 ya instalado y accesible en `localhost`
- migraciones ya aplicadas
- runtime `node.exe` embebido en `C:\Program Files\AllGym\runtime\node\node.exe`
- binario `WinSW x64` renombrado como `allgym-api-local.exe`
- binario `WinSW x64` renombrado como `allgym-web.exe`

Secuencia manual:

1. Copiar el bundle de `api-local` a `C:\Program Files\AllGym\api-local\`
2. Copiar el bundle `standalone` de `allgym-web` a `C:\Program Files\AllGym\allgym-web\`
3. Copiar la carpeta completa `scripts\` a `C:\Program Files\AllGym\scripts\`
4. Copiar `allgym-api-local.xml` y `allgym-web.xml` a `C:\Program Files\AllGym\winsw\`
5. Copiar `WinSW-x64.exe` y renombrarlo a:
   - `C:\Program Files\AllGym\winsw\allgym-api-local.exe`
   - `C:\Program Files\AllGym\winsw\allgym-web.exe`
6. Copiar:
   - `api-local.env.example` a `C:\ProgramData\AllGym\config\api-local.env`
   - `allgym-web.env.example` a `C:\ProgramData\AllGym\config\allgym-web.env`
7. Editar `api-local.env` con el `DATABASE_URL` real
8. Verificar que `allgym-web.env` apunte a `API_INTERNAL_URL=http://127.0.0.1:4000`
9. Ejecutar `install-allgym-api-local.ps1` como administrador
10. Ejecutar `install-allgym-web.ps1` como administrador
11. Probar `http://127.0.0.1:4000/health`
12. Probar `http://127.0.0.1:3000/api/health`

## Comandos manuales de prueba con WinSW

Desde `C:\Program Files\AllGym\winsw\`:

```powershell
.\allgym-api-local.exe install
.\allgym-api-local.exe start
.\allgym-api-local.exe status
.\allgym-web.exe install
.\allgym-web.exe start
.\allgym-web.exe status
```

Smoke test:

```powershell
Invoke-WebRequest http://127.0.0.1:4000/health
Invoke-WebRequest http://127.0.0.1:3000/api/health
Invoke-WebRequest http://127.0.0.1:3000/
```

O usando el helper incluido:

```powershell
& "C:\Program Files\AllGym\scripts\test-allgym-api-local.ps1"
& "C:\Program Files\AllGym\scripts\test-allgym-web.ps1"
```

Logs esperados:

- `C:\ProgramData\AllGym\logs\backend.log`
- `C:\ProgramData\AllGym\logs\web.log`
- `C:\ProgramData\AllGym\logs\installer.log`

## Base minima de Electron + NSIS

Se deja un shell minimo en:

- `installer/windows/electron-shell/`

Objetivo de esta base:

- fijar `electron-builder`
- fijar target `NSIS`
- permitir empaquetar `api-local` y `allgym-web` sin meter logica core en Electron
- dejar el punto de integracion futuro para `extraResources`

Estado actual:

- configuracion creada
- hooks `NSIS` creados para install/uninstall
- Electron intenta abrir `http://127.0.0.1:3000`
- si el web local no responde, Electron cae al placeholder
- sigue sin diagnostico operativo completo

Salida esperada del build:

- `installer/windows/dist/electron-shell/AllGym-Setup.exe`

Prerequisitos no versionados para construir el instalador:

- `installer/windows/runtime/node/node.exe`
- `installer/windows/winsw/allgym-api-local.exe`
- `installer/windows/winsw/allgym-web.exe`

Comandos esperados en Windows VM para construir el instalador:

```powershell
cd installer\windows\electron-shell
npm install
npm run dist:win
```

El flujo `dist:win` hace esto:

1. corre `npm --prefix ../../../api-local run build:windows:api`
2. corre `npm --prefix ../../../all-gym-vf run build:windows:web`
3. verifica que staging ya incluya:
   - `api-local/dist/server.js`
   - `allgym-web/server.js`
   - `winsw/allgym-api-local.exe`
   - `winsw/allgym-web.exe`
   - `runtime/node/node.exe`
   - `templates/api-local.env.example`
   - `templates/allgym-web.env.example`
4. ejecuta `electron-builder --win nsis`
5. el hook `customInstall`:
   - crea `C:\ProgramData\AllGym\config\`
   - crea `C:\ProgramData\AllGym\logs\`
   - crea `C:\ProgramData\AllGym\data\`
   - crea `C:\ProgramData\AllGym\uploads\`
   - crea `C:\ProgramData\AllGym\backups\`
   - copia `api-local.env.example` a `C:\ProgramData\AllGym\config\api-local.env` si no existe
   - copia `allgym-web.env.example` a `C:\ProgramData\AllGym\config\allgym-web.env` si no existe
   - ejecuta `install-allgym-api-local.ps1`
   - ejecuta `install-allgym-web.ps1`
6. el hook `customUnInstall`:
   - ejecuta `uninstall-allgym-web.ps1`
   - ejecuta `uninstall-allgym-api-local.ps1`
   - conserva `C:\ProgramData\AllGym\` por defecto

## Validacion realizada en esta fase

Validado en macOS:

- `api-local` compila
- el script `build:windows:api` genera staging
- `all-gym-vf` compila en `standalone`
- el script `build:windows:web` genera staging
- el staging contiene `dist`, `node_modules`, scripts PowerShell, XML de `WinSW` y plantilla de config
- el staging contiene `allgym-web/server.js`, `.next/static`, `public`, scripts PowerShell, XML de `WinSW` y plantilla de config
- el backend arranca desde `installer/windows/staging/ProgramFiles/AllGym/api-local/`
- el frontend `standalone` arranca desde `installer/windows/staging/ProgramFiles/AllGym/allgym-web/`
- `GET /health` responde `200 OK` desde el bundle staged usando el puerto oficial `4000`
- `GET /api/health` responde `200 OK` desde el bundle staged usando el puerto oficial `3000`
- `GET /` responde con redirect a `/iniciar-sesion` desde el bundle staged
- `POST /api/auth/login`, `GET /api/auth/me` y `POST /api/auth/logout` funcionan desde el bundle staged
- `prepare-dist.mjs` falla con mensaje claro si faltan `node.exe`, `allgym-api-local.exe` o `allgym-web.exe`

Validacion real confirmada en Windows VM:

- `PostgreSQL 16.14` instalado
- base `algym` creada
- runner SQL corregido para usar `require("pg")` desde `api-local/node_modules`
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
- visible en `services.msc` como `All Gym API Local`
- tipo de inicio: `Automatic`
- estado: `Running`
- `.\allgym-api-local.exe restart` funciona
- `.\allgym-api-local.exe status` responde `Active (running)`
- se generó `AllGym-Setup.exe`
- se ejecutó el instalador `NSIS`
- se instaló en `C:\Program Files\AllGym`
- `GET http://127.0.0.1:4000/health` responde `200 OK`
- body validado:

```json
{"ok":true,"service":"api-local","database":"ok"}
```
- la app Electron placeholder abrió como `All Gym Local`

Pendiente de validacion en Windows:

- servicio `allgym-web` con `WinSW`
- servicio `allgym-sync`
- `AllGym-Setup.exe` instalando tambien `allgym-web`
- instalador final completo

## Riesgos abiertos

- falta integrar el runtime Node embebido real dentro del instalador final
- falta validar permisos de `Program Files` y `ProgramData` en Windows limpio
- falta verificar comportamiento de `argon2` en el runtime Windows distribuido
- falta validar `allgym-web` como servicio real `WinSW` en Windows VM
- `allgym-sync` sigue como placeholder de servicio
- todavia no existe instalador final firmado ni flujo de upgrade
- el build de `Next.js` depende de `next/font` y descargas de Google Fonts
- antes del instalador final conviene mover esas fuentes a assets locales o eliminar la dependencia de red en build

## Veredicto de Fase 4

Estado actual:

- checkpoint de Fase 4 validado

Lo que ya esta listo:

- layout de instalacion definido
- backend `api-local` preparado para staging Windows
- frontend `allgym-web` preparado como `Next.js standalone`
- servicio `allgym-api-local` validado en Windows real/VM con `WinSW`
- instalador `NSIS` minimo validado en Windows VM
- shell minimo de `electron-builder + NSIS` creado
- `NSIS` actualizado para instalar `api-local` y `allgym-web`

Lo que falta para cerrar totalmente la fase:

- validar `allgym-web`
- validar `allgym-sync`
- instalador final completo
- mantener frontend y features fuera de esta fase

## Guía manual para VM Windows

### Antes de empezar

Necesitas:

- una VM Windows con permisos de administrador
- PostgreSQL 16 ya instalado
- base `algym` ya creada y migrada
- un runtime `node.exe` copiado en `C:\Program Files\AllGym\runtime\node\node.exe`
- `WinSW-x64.exe` descargado y renombrado a `allgym-api-local.exe`
- `WinSW-x64.exe` descargado y renombrado tambien a `allgym-web.exe`

### Archivos que debes copiar a la VM

Desde el staging generado por `npm run build:windows:api` y `npm run build:windows:web`, copia:

- `installer/windows/staging/ProgramFiles/AllGym/api-local/` -> `C:\Program Files\AllGym\api-local\`
- `installer/windows/staging/ProgramFiles/AllGym/allgym-web/` -> `C:\Program Files\AllGym\allgym-web\`
- `installer/windows/staging/ProgramFiles/AllGym/scripts/` -> `C:\Program Files\AllGym\scripts\`
- `installer/windows/staging/ProgramFiles/AllGym/winsw/allgym-api-local.xml` -> `C:\Program Files\AllGym\winsw\allgym-api-local.xml`
- `installer/windows/staging/ProgramFiles/AllGym/winsw/allgym-web.xml` -> `C:\Program Files\AllGym\winsw\allgym-web.xml`
- `installer/windows/staging/ProgramData/AllGym/config/api-local.env.example` -> `C:\ProgramData\AllGym\config\api-local.env`
- `installer/windows/staging/ProgramData/AllGym/config/allgym-web.env.example` -> `C:\ProgramData\AllGym\config\allgym-web.env`

Adicionalmente copia manualmente:

- `WinSW-x64.exe` -> `C:\Program Files\AllGym\winsw\allgym-api-local.exe`
- `WinSW-x64.exe` -> `C:\Program Files\AllGym\winsw\allgym-web.exe`
- `node.exe` -> `C:\Program Files\AllGym\runtime\node\node.exe`

### Editar configuración

Abre `C:\ProgramData\AllGym\config\api-local.env` y define:

```env
DATABASE_URL=postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/algym
PORT=4000
SESSION_COOKIE_NAME=allgym_session
WEB_LOCAL_ORIGIN=http://127.0.0.1:3000
WEB_PUBLIC_ORIGIN=http://localhost:3000
NODE_ENV=production
```

Abre `C:\ProgramData\AllGym\config\allgym-web.env` y define:

```env
PORT=3000
HOSTNAME=127.0.0.1
API_INTERNAL_URL=http://127.0.0.1:4000
WEB_LOCAL_ORIGIN=http://127.0.0.1:3000
WEB_PUBLIC_ORIGIN=http://localhost:3000
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

No guardes passwords reales en el repositorio. Esta edición es solo local en la VM.

### Comandos que debes ejecutar como administrador

Abre PowerShell con `Run as Administrator` y ejecuta:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
& "C:\Program Files\AllGym\scripts\install-allgym-api-local.ps1"
& "C:\Program Files\AllGym\scripts\install-allgym-web.ps1"
```

Si quieres instalarlo manualmente sin el helper:

```powershell
cd "C:\Program Files\AllGym\winsw"
.\allgym-api-local.exe install
.\allgym-api-local.exe start
.\allgym-api-local.exe status
.\allgym-web.exe install
.\allgym-web.exe start
.\allgym-web.exe status
```

### Comandos que no requieren administrador

Para validar el endpoint de salud:

```powershell
Invoke-WebRequest http://127.0.0.1:4000/health
Invoke-WebRequest http://127.0.0.1:3000/api/health
Invoke-WebRequest http://127.0.0.1:3000/
```

O usando el helper:

```powershell
& "C:\Program Files\AllGym\scripts\test-allgym-api-local.ps1"
& "C:\Program Files\AllGym\scripts\test-allgym-web.ps1"
```

### Qué debes comprobar

Resultado esperado de `/health`:

- status `200 OK`
- body JSON con:

```json
{"ok":true,"service":"api-local","database":"ok"}
```

Logs esperados:

- log principal del backend: `C:\ProgramData\AllGym\logs\backend.log`
- log principal del frontend: `C:\ProgramData\AllGym\logs\web.log`
- logs auxiliares de `WinSW`, si aparecen, quedan en `C:\ProgramData\AllGym\logs\`

### Si falla

Revisa en este orden:

1. `C:\ProgramData\AllGym\config\api-local.env`
2. `C:\ProgramData\AllGym\logs\backend.log`
3. `C:\Program Files\AllGym\winsw\allgym-api-local.xml`
4. `C:\Program Files\AllGym\runtime\node\node.exe`
5. `.\allgym-api-local.exe status`

### Estado de la fase

Fase 4 sigue como validación parcial.

No debe marcarse como completada al `100%` hasta que confirms en Windows:

- instalador `NSIS` final probado con `allgym-web`
- `allgym-web` validado como servicio real `WinSW`
- `allgym-sync` validado
- cualquier avance hacia Fase 5 confirmado explicitamente
