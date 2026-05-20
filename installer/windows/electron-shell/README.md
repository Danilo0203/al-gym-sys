# AllGym NSIS builder

Este paquete genera el instalador minimo `NSIS` para `api-local` y `allgym-web`.

## Salida esperada

- `installer/windows/dist/electron-shell/AllGym-Setup.exe`

## Prerequisitos locales

Antes de correr `dist:win`, deben existir estos archivos no versionados:

- `installer/windows/runtime/node/node.exe`
- `installer/windows/winsw/allgym-api-local.exe`
- `installer/windows/winsw/allgym-web.exe`

## Flujo

1. `prepare:dist` ejecuta:
   - `npm --prefix ../../../api-local run build:windows:api`
   - `npm --prefix ../../../all-gym-vf run build:windows:web`
2. valida que el staging incluya:
   - `api-local/dist/server.js`
   - `allgym-web/server.js`
   - `winsw/allgym-api-local.exe`
   - `winsw/allgym-web.exe`
   - `runtime/node/node.exe`
   - `templates/api-local.env.example`
   - `templates/allgym-web.env.example`
3. `electron-builder` empaqueta el shell `Electron` con `NSIS`
4. el hook `customInstall`:
   - crea `C:\ProgramData\AllGym\...`
   - copia `api-local.env.example` a `C:\ProgramData\AllGym\config\api-local.env` si no existe
   - copia `allgym-web.env.example` a `C:\ProgramData\AllGym\config\allgym-web.env` si no existe
   - ejecuta `install-allgym-api-local.ps1`
   - ejecuta `install-allgym-web.ps1`
5. el hook `customUnInstall`:
   - ejecuta `uninstall-allgym-web.ps1`
   - ejecuta `uninstall-allgym-api-local.ps1`
   - conserva `C:\ProgramData\AllGym\` por defecto

## Comandos

```bash
npm install
npm run dist:win
```
