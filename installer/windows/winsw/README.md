# WinSW binary

Ademas de los archivos XML versionados en esta carpeta, coloca aqui el binario:

- `allgym-api-local.exe`
- `allgym-web.exe`

Origen esperado:

- `WinSW-x64.exe` renombrado a `allgym-api-local.exe`
- `WinSW-x64.exe` renombrado a `allgym-web.exe`

Reglas:

- no versionar el binario
- usar el binario Windows real
- mantener los XML en esta misma carpeta

El `.gitignore` ya excluye `winsw/*.exe`.
