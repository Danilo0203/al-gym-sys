#!/usr/bin/env bash
# Ejecutado por el auxiliar de Windows dentro de SSH; nunca en la PC local.
# Usa el exportador ya instalado; no instala, actualiza ni reinicia servicios.
set -Eeuo pipefail
umask 077

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ "$(uname -s)" == Linux ]] || fail 'Este archivo se ejecuta dentro de la sesión SSH de la VPS Linux.'
[[ "$EUID" -eq 0 ]] || fail 'Conecta por SSH como root.'
for tool in docker flock sha256sum mktemp stat df awk date chown chmod mv ln; do
  command -v "$tool" >/dev/null || fail "Falta la herramienta $tool. No se ha instalado nada."
done

[[ "$#" -eq 1 && "$1" =~ ^[a-f0-9]{32}$ ]] || fail 'Identificador de exportación inválido.'
ALGYM_JOB=$1
ALGYM_CONFIG=/opt/algym-export/config/export.json
ALGYM_BASE=/root/algym-exportaciones
ALGYM_NETWORK=supabase_network_all-gym-vf
[[ -f "$ALGYM_CONFIG" && ! -L "$ALGYM_CONFIG" ]] || fail 'No existe la configuración original del exportador. No continúes con otras credenciales.'
[[ ! -L "$ALGYM_BASE" ]] || fail 'La carpeta de exportaciones no puede ser un enlace.'
mkdir -p "$ALGYM_BASE"
[[ "$(stat -c %u "$ALGYM_BASE")" == 0 && "$(stat -c %a "$ALGYM_BASE")" == 700 ]] || fail 'La carpeta de exportaciones debe pertenecer a root y tener permisos 700.'
[[ ! -L "$ALGYM_BASE/.export.lock" ]] || fail 'Archivo de bloqueo inválido.'
exec 9>"$ALGYM_BASE/.export.lock"
flock -n 9 || fail 'Ya hay otra exportación SSH en curso. Espera a que termine.'

ALGYM_IMAGE=$(docker inspect --type container --format '{{.Image}}' algym-hostinger-export)
[[ "$ALGYM_IMAGE" =~ ^sha256:[a-f0-9]{64}$ ]] || fail 'No se encontró la imagen instalada del exportador.'
docker network inspect "$ALGYM_NETWORK" >/dev/null
ALGYM_USER=$(docker run --rm --pull=never --network none --read-only --cap-drop ALL --security-opt no-new-privileges:true --entrypoint id "$ALGYM_IMAGE" -u)
ALGYM_GROUP=$(docker run --rm --pull=never --network none --read-only --cap-drop ALL --security-opt no-new-privileges:true --entrypoint id "$ALGYM_IMAGE" -g)
[[ "$ALGYM_USER" =~ ^[0-9]+$ && "$ALGYM_GROUP" =~ ^[0-9]+$ && "$ALGYM_USER" != 0 ]] || fail 'La imagen debe usar una cuenta sin privilegios de root.'
ALGYM_FREE=$(df -Pk "$ALGYM_BASE" | awk 'END {print $4}')
[[ "$ALGYM_FREE" =~ ^[0-9]+$ && "$ALGYM_FREE" -ge 4194304 ]] || fail 'Se requieren al menos 4 GiB libres. No borres respaldos para continuar sin revisarlos.'

ALGYM_STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
ALGYM_DIR="$ALGYM_BASE/windows-$ALGYM_JOB"
mkdir "$ALGYM_DIR"
ALGYM_COMPLETE=0
on_exit() {
  if [[ "$ALGYM_COMPLETE" != 1 ]]; then
    printf '\nLa exportación NO terminó. No importes archivos de: %s\n' "$ALGYM_DIR" >&2
    printf 'No se descargará una copia anterior como si fuera nueva.\n' >&2
  fi
}
trap on_exit EXIT
chown "$ALGYM_USER:$ALGYM_GROUP" "$ALGYM_DIR"
printf 'Preparando una copia nueva. Puede tardar varios minutos.\n'

docker run --rm --pull=never --init -i \
  --name algym-exportacion-ssh \
  --env "ALGYM_EXPORT_JOB=$ALGYM_JOB" \
  --network "$ALGYM_NETWORK" \
  --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  --memory 1g --cpus 1 --pids-limit 128 \
  --mount "type=bind,src=$ALGYM_CONFIG,dst=/run/algym/export.json,readonly" \
  --mount "type=bind,src=$ALGYM_DIR,dst=/data/export" \
  --tmpfs /tmp:size=64m,mode=1777 \
  --tmpfs /var/run/postgresql:size=1m,mode=1777 \
  --entrypoint node "$ALGYM_IMAGE" --input-type=module <<'ALGYM_NODE'
import { readFile, writeFile } from 'node:fs/promises';
import { buildExport } from '/app/hostinger/pipeline.mjs';
import { readPackage, summary, migrationHashes } from '/app/windows/transfer.mjs';
process.umask(0o077);
try {
  const jobId = process.env.ALGYM_EXPORT_JOB;
  if (!/^[a-f0-9]{32}$/.test(jobId ?? '')) throw new Error('Identificador de exportación inválido.');
  const config = JSON.parse(await readFile('/run/algym/export.json', 'utf8'));
  if (config.source?.user !== 'algym_export_reader' || config.pgBin !== '/usr/lib/postgresql/17/bin')
    throw new Error('La configuración no coincide con el exportador de lectura esperado.');
  const report = await buildExport({folder: '/data/export', source: config.source, pgBin: config.pgBin, stage: console.log});
  const {data, sha256} = await readPackage('/data/export/data.algym');
  if (sha256 !== report.sha256 || JSON.stringify(data.migrations) !== JSON.stringify(await migrationHashes()))
    throw new Error('No coincide la verificación del paquete.');
  const commands = data.tables.find(t => t.schema === 'public' && t.name === 'device_commands');
  if (!commands || commands.rows.length !== 0)
    throw new Error('La cola de comandos del reloj no está vacía.');
  const result = summary(data, sha256);
  await writeFile('/data/export/RESUMEN.json', JSON.stringify({
    ...result, jobId, source: data.source, clockCommandQueue: 0,
    notice: 'Para un equipo con operaciones, usar Actualizar este equipo en AlGym 0.3.5; revisar la comparación antes de aplicar.'
  }, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  console.log(`Copia de ${result.snapshotAt}: ${result.customers} clientes, ${result.plans} planes, ${result.payments} pagos y ${result.attendance} asistencias.`);
} catch (error) {
  const safe = [
    'La configuración no coincide con el exportador de lectura esperado.',
    'No coincide la verificación del paquete.',
    'La cola de comandos del reloj no está vacía.',
    'El origen contiene archivos en Storage. Hay que preparar también esas imágenes antes de exportar.',
    'El respaldo completo supera el tamaño permitido. Requiere una exportación asistida.',
    'La conexión de origen debe ser de solo lectura.',
    'El paquete requiere una cuenta propietaria activa con contraseña local.'
  ];
  console.error(safe.includes(error.message) ? error.message : 'No se pudo preparar y verificar la copia. Conserva esta carpeta para revisar la conexión, los recursos y la compatibilidad. No se muestran credenciales ni datos personales.');
  process.exitCode = 1;
}
ALGYM_NODE

# Retain the full dump (including historical clock commands) on the VPS.
# Only these four fixed files are exposed to the download step of this job.
mkdir "$ALGYM_DIR/para-windows"
ln "$ALGYM_DIR/data.algym" "$ALGYM_DIR/para-windows/Hostinger-AlGym.algym.partial"
ln "$ALGYM_DIR/RESUMEN.json" "$ALGYM_DIR/para-windows/RESUMEN.json"
ln "$ALGYM_DIR/data.algym.report.json" "$ALGYM_DIR/para-windows/VERIFICACION.json"
(
  cd "$ALGYM_DIR/para-windows"
  sha256sum Hostinger-AlGym.algym.partial RESUMEN.json VERIFICACION.json > SHA256SUMS.txt
  sha256sum -c SHA256SUMS.txt
)
(
  cd "$ALGYM_DIR"
  sha256sum source.dump > RESPALDO-COMPLETO-SHA256.txt
)
printf '%s\n' "$ALGYM_IMAGE" > "$ALGYM_DIR/IMAGEN-EXPORTADOR.txt"
chown -R root:root "$ALGYM_DIR"
chmod 700 "$ALGYM_DIR" "$ALGYM_DIR/para-windows"
chmod 600 "$ALGYM_DIR"/*.* "$ALGYM_DIR/para-windows"/*
ALGYM_COMPLETE=1
printf '\nCOPIA LISTA Y VERIFICADA: %s\n' "$ALGYM_DIR"
printf 'Windows descargará y comprobará el archivo de esta ejecución.\n'
