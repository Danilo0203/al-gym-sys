# Stack local y copia aislada de PostgreSQL

## Estado del arranque

`docker-compose.yml` levanta `web`, `backend` y `sync`. Por defecto, `backend` y `sync` conectan con el PostgreSQL instalado en esta computadora mediante `host.docker.internal`. `web` usa `http://backend:4000` dentro de Docker. El backend se publica para diagnóstico en `127.0.0.1:4001`, sin interferir con un backend del host en el puerto 4000. Su carpeta de archivos persistentes es `../algym-local-backend/data/media`.

Si la web se ejecuta con `pnpm dev` en el host y el backend permanece en Compose, configurar `ALGYM_BACKEND_URL=http://127.0.0.1:4001` en `all-gym-vf/.env.local`. La configuración privada de desarrollo de esta computadora ya usa ese puerto. El puerto 4000 solo corresponde al backend ejecutado directamente en el host.

Ambos repositorios deben estar en carpetas hermanas. Antes de iniciar el stack, configurar los archivos privados `../algym-local-backend/.env`, `deploy/env/web.env` y `deploy/env/sync.env`. Los servicios web pendientes todavía pueden consultar Supabase; este modo **aún no es la aceptación sin internet**.

```bash
mkdir -p ../algym-local-backend/data/media
docker compose --env-file deploy/env/web.env up -d --build
docker compose ps
curl -fsS http://127.0.0.1:4001/health/ready
```

El servicio `postgres` está bajo el perfil `container-db`; no participa en el arranque habitual. No publica puerto al host. Se mantiene separado para preparar y verificar un corte de datos sin sustituir la base operativa por accidente.

## Respaldo y restauración de ensayo

En `algym-local-backend`, `database/scripts/backup_local_database.sh` crea un paquete con `database.dump`, `media.tar`, manifiesto y hashes. Requiere PostgreSQL local y una carpeta de media existente. El restaurador comprueba hashes, cuenta los archivos y rechaza una base `algym` ya existente en el contenedor.

Para preparar una instancia **nueva y aislada**:

1. Copiar `deploy/env/postgres.env.example` a `deploy/env/postgres.env` y establecer una contraseña aleatoria; proteger el archivo con permisos privados.
2. Ejecutar `docker compose --profile container-db up -d postgres` desde `al-gym-sys`.
3. Desde `algym-local-backend`, ejecutar:

```bash
python3 database/scripts/restore_snapshot_to_container.py \
  backups/local/algym-FECHA \
  --media-target /ruta/nueva/media-restaurada
```

El restaurador usa las contraseñas locales de `algym_app` y `algym_sync` de los archivos privados existentes. Crea los roles globales requeridos, incluida la pertenencia de `algym_app` a `authenticated`, que no viaja en `pg_dump`. La carpeta `--media-target` debe estar vacía y ser distinta de la carpeta operativa. Un fallo deja la instancia de ensayo para inspección; el script no borra bases ni sobrescribe archivos.

**Ensayo del 30 de septiembre de 2026:** se restauró en un proyecto Docker independiente una copia de `algym` con 140 perfiles, 263 pagos y 6080 asistencias. El backend arrancó contra la copia, `/health/ready` indicó `ready` y `/payments` sin sesión respondió 401. Otro ensayo restauró además un archivo de media de prueba. Las instancias desechables se eliminaron tras verificar los resultados.

La copia en contenedor representa el instante del respaldo; no recibe escrituras posteriores del PostgreSQL del host. El corte definitivo requiere detener escrituras, importar el delta final, reconciliar entidades, configurar `backend` y `sync` para `DB_HOST=postgres`, apuntar el volumen de media al directorio restaurado y ejecutar la aceptación integral sin internet. No cambiar la base activa solo por haber pasado este ensayo.
