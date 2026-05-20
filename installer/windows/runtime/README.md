# Windows runtime assets

Coloca aqui los binarios no versionados necesarios para construir el instalador:

- `runtime/node/node.exe`

Reglas:

- no versionar `node.exe`
- usar un runtime Windows real
- no usar binarios de macOS renombrados

Este archivo solo documenta la ubicacion esperada. El `.gitignore` ya excluye `runtime/node/node.exe`.
