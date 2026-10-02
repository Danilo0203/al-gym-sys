# Stack local y copia aislada de PostgreSQL

## Estado del arranque

`docker-compose.yml` levanta `web`, `backend` y `sync`. Por defecto, `backend` y `sync` conectan con el PostgreSQL instalado en esta computadora mediante `host.docker.internal`. `web` usa `http://backend:4000` dentro de Docker. El backend se publica para diagnóstico en `127.0.0.1:4001`, sin interferir con un backend del host en el puerto 4000. Su carpeta de archivos persistentes es `../algym-local-backend/data/media`.

Si la web se ejecuta con `pnpm dev` en el host y el backend permanece en Compose, configurar `ALGYM_BACKEND_URL=http://127.0.0.1:4001` en `all-gym-vf/.env.local`. La configuración privada de desarrollo de esta computadora ya usa ese puerto. El puerto 4000 solo corresponde al backend ejecutado directamente en el host.

Ambos repositorios deben estar en carpetas hermanas. Antes de iniciar el stack, configurar los archivos privados `../algym-local-backend/.env`, `deploy/env/web.env` y `deploy/env/sync.env`. El código web actual ya no exige variables ni SDK de Supabase. El 1 de octubre se reconstruyeron y desplegaron web y backend; los tres servicios quedaron saludables, `/api/health` y `/health/ready` respondieron 200. Este modo **aún no es la aceptación sin internet**: faltan ejercicios e imágenes reales, probar la propuesta completa desde Caja con sesión real y la prueba integral con red externa bloqueada.

La web solo acepta `ALGYM_BACKEND_URL` en loopback, `backend` o `host.docker.internal`; `GYM_SYNC_SERVER_URL` solo admite loopback o `sync`. Ambos usan HTTP local. Una URL externa configurada se rechaza antes de hacer la petición. Los avatares con URL histórica externa se muestran como iniciales hasta importar sus archivos a una ruta local.

Para recibir marcajes ADMS desde el reloj físico, `sync` debe publicar el puerto 8080 en una dirección LAN de esta computadora a la que el reloj pueda llegar. El valor por defecto `SYNC_BIND_HOST=127.0.0.1` solo sirve para desarrollo en la misma computadora y no recibe pushes del reloj por la red. Durante la prueba con hardware, establecer `SYNC_BIND_HOST` en la IPv4 de la interfaz local autorizada (y configurar esa dirección y el puerto 8080 como servidor ADMS del reloj), recrear `sync` y comprobar `docker compose port sync 8080`. Mantener el puerto fuera de internet y el perfil `remote-access` desactivado. Para el registro directo, `ZK_DEVICE_IP` y `device_ip` de la API solo aceptan IPv4 locales; los comandos ADMS en cola siguen siendo la alternativa si esa conexión directa no funciona. Verificar primero conectividad host↔reloj y luego un marcaje nuevo, la descarga/confirmación de un comando y su lectura en el panel; el healthcheck de sync solo prueba PostgreSQL. El 1 de octubre la apertura TCP al reloj expiró tanto desde el host como desde el contenedor, así que la prueba física aún no es posible en la red actual.

En producción, Next envía una política de contenido con `connect-src 'self'`, imágenes de origen local/datos/blob y fuentes locales. Esto impide solicitudes externas iniciadas por el navegador; no sustituye la auditoría de llamadas del servidor ni la prueba final con la red externa bloqueada. El entorno `next dev` no aplica esa política para conservar la recarga de desarrollo.

```bash
mkdir -p ../algym-local-backend/data/media
docker compose --env-file deploy/env/web.env up -d --build
docker compose ps
curl -fsS http://127.0.0.1:4001/health/ready
```

### Arranque sin descargas

Una instalación nueva no puede ejecutar `--build` sin internet si todavía no tiene en caché las imágenes base y los paquetes npm/pnpm. En una computadora donde las cuatro imágenes ya estén construidas, crear un paquete transportable:

```bash
deploy/scripts/export_offline_images.sh /ruta/absoluta/algym-imagenes
```

El paquete incluye `al-gym-sys-web`, `al-gym-sys-backend`, `al-gym-sys-sync` y `postgres:17-alpine`, con manifiesto de IDs, plataforma Docker y hashes SHA-256. Se excluye `cloudflared`, que solo corresponde al perfil remoto opcional. Construir el paquete en la misma arquitectura que tendrá Docker en la computadora de destino (por ejemplo `linux/arm64` o `linux/amd64`). Transportar el paquete y los dos repositorios juntos; el paquete **no** contiene la base, las imágenes de ejercicios, archivos de media ni las variables privadas. Restaurar esos datos por separado a partir de un respaldo verificado y crear los archivos privados de entorno antes del arranque.

El paquete validado de esta computadora quedó en `deploy/offline-images/linux-arm64-20261001-v6`. Esa carpeta se ignora en Git por su tamaño; si se instala en otra computadora, copiarla por separado o generar allí otro paquete con las imágenes apropiadas para su arquitectura. El paquete debe regenerarse después de reconstruir cualquiera de las imágenes. La importación y el arranque desde ese paquete no necesitan descargar imágenes. Una compilación nueva desde código fuente todavía necesita una caché local completa de paquetes npm/pnpm o acceso temporal al registro: el paquete v6 contiene imágenes de ejecución, no una copia de esas dependencias de desarrollo.

En el destino, con Docker ya instalado, importar y verificar las imágenes sin red:

```bash
deploy/scripts/import_offline_images.sh /ruta/absoluta/algym-imagenes
docker compose --env-file deploy/env/web.env up -d --no-build --pull never web backend sync
```

Ese último comando usa el PostgreSQL **del host** configurado por el Compose habitual; requiere que ya esté restaurado y accesible. No cambia automáticamente a la base del contenedor. Para un corte aprobado hacia PostgreSQL de Compose, levantar primero `postgres` con `--profile container-db --no-build --pull never`, restaurar y reconciliar su base, y luego iniciar `web backend sync` con **ambos** archivos Compose y las mismas opciones `--no-build --pull never`; arrancar `backup` después de verificar la restauración. El modo sin descarga evita reconstrucciones accidentales, pero todavía se debe probar el corte final completo con red externa bloqueada y datos vigentes.

El servicio `postgres` está bajo el perfil `container-db`; no participa en el arranque habitual. No publica puerto al host. Se mantiene separado para preparar y verificar un corte de datos sin sustituir la base operativa por accidente.

`docker-compose.container-db.yml` es la configuración preparada para el **corte posterior a la reconciliación**: hace que `backend` y `sync` usen el servicio `postgres` y esperen su healthcheck. La configuración habitual, sin ese archivo, sigue usando PostgreSQL del host. Validar la combinación sin cambiar servicios:

```bash
docker compose -f docker-compose.yml -f docker-compose.container-db.yml \
  --profile container-db --env-file deploy/env/web.env config --quiet
```

Durante el corte, después de restaurar `algym` en `postgres`, reconciliarla con el origen y verificar los permisos de `algym_app` y `algym_sync`, usar **ambos archivos Compose** al levantar `backend`, `sync` y `web`. Indicar esos tres servicios explícitamente para que `backup` permanezca detenido hasta verificar la instancia definitiva; luego arrancar `backup` por separado. Registrar el comando exacto y la imagen desplegada en el acta de `CORTE_Y_REVERSA.md`. No usar el override sobre una base de ensayo antigua: backend y sync dejarían de escribir en la base del host.

El mismo perfil incluye `backup`, que usa la imagen PostgreSQL local y respalda la base del servicio `postgres` junto con `../algym-local-backend/data/media`. **No iniciar `backup` hasta restaurar y validar `algym` en ese servicio.** Una vez hecho el corte, configurar `ALGYM_BACKUP_DIR` con una ruta persistente preferentemente en otro disco y arrancar `docker compose --profile container-db up -d backup`. El primer respaldo ocurre al iniciar y los siguientes cada 24 horas por defecto (`ALGYM_BACKUP_INTERVAL_SECONDS`). Conserva las 30 copias automáticas más recientes por defecto (`ALGYM_BACKUP_KEEP_COUNT`); las copias manuales no se podan. Consultar `docker compose ps backup` y sus logs; un healthcheck vencido indica que falta un respaldo reciente. La copia en el mismo equipo no reemplaza una ubicación externa ni una restauración periódica.

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

**Ensayo sin salida externa del 1 de octubre de 2026:** se inició un proyecto Compose desechable con las imágenes ya construidas, PostgreSQL propio y una red `internal: true`. Se restauró el respaldo `algym-20261001T071222Z`, se aplicó `0030_custom_panel_roles.sql` porque el respaldo precedía esa migración y se montó media restaurada en un directorio temporal. Los cuatro contenedores quedaron saludables. Las pruebas de salida a `https://example.com` fallaron desde web, backend y sync; la web alcanzó los tres healthchecks locales con HTTP 200. Un usuario sintético inició sesión a través de la web y recibió HTTP 200 en `/api/auth/me`, Resumen, Clientes, Pagos, Caja, Rutinas, Asistencias, Ejercicios e Inventario. En Docker Desktop, los puertos publicados de esa red interna no fueron accesibles desde el host, así que la comprobación autenticada se hizo mediante HTTP dentro del contenedor web. Se eliminó el proyecto desechable con su volumen y su red; los servicios operativos continuaron saludables. La prueba no equivale a aceptación visual con los datos vigentes, imágenes reales y reloj físico.

Un segundo proyecto desechable con la misma red interna probó escritura de Planes: petición anónima 401, socio sin permiso 403, propietario autorizado creó, editó y desactivó un plan; el listado del backend y `/panel/planes` lo mostraron. PostgreSQL del ensayo confirmó el precio, duración y estado final, mientras que `algym` del host no contenía ese plan. Esta prueba cubre el contrato de Planes sin salida externa, pero no reemplaza la aceptación integral del corte.

Otros ensayos aislados ejercitaron una venta de producto y su anulación, y un cobro de membresía: el inventario, Caja y Resumen cambiaron en la misma base PostgreSQL interna según las operaciones, y un usuario socio pudo leer su nueva membresía por la API web. El backend devolvió 401/403 a llamadas no autorizadas y 409 a cobros sin caja o ventas sin existencias. Se retiraron los proyectos desechables después de verificar que la base operativa del host no recibió sus registros.
