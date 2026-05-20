# AllGym NSIS builder

Este paquete genera el instalador minimo `NSIS` para `api-local`.

## Salida esperada

- `installer/windows/dist/electron-shell/AllGym-Setup.exe`

## Prerequisitos locales

Antes de correr `dist:win`, deben existir estos archivos no versionados:

- `installer/windows/runtime/node/node.exe`
- `installer/windows/winsw/allgym-api-local.exe`

## Flujo

1. `prepare:dist` ejecuta `npm --prefix ../../../api-local run build:windows:api`
2. valida que el staging incluya:
   - `api-local/dist/server.js`
   - `winsw/allgym-api-local.exe`
   - `runtime/node/node.exe`
   - `templates/api-local.env.example`
3. `electron-builder` empaqueta el shell `Electron` con `NSIS`
4. el hook `customInstall`:
   - crea `C:\ProgramData\AllGym\...`
   - copia `api-local.env.example` a `C:\ProgramData\AllGym\config\api-local.env` si no existe
   - ejecuta `install-allgym-api-local.ps1`
5. el hook `customUnInstall`:
   - ejecuta `uninstall-allgym-api-local.ps1`
   - conserva `C:\ProgramData\AllGym\` por defecto

## Comandos

```bash
npm install
npm run dist:win
```
