# Corte a la instalación local: secuencia y reversión

Este procedimiento corresponde a `P0-05` y prepara `P6-01` a `P6-04`. No autoriza por sí mismo un corte. La base local `algym` ya contiene datos y recibe escrituras: **nunca** ejecutar `restore_local_database.sh`, `dropdb`, `pg_restore --clean` ni un volcado remoto directamente sobre ella. La copia del VPS y la base local pueden haber divergido.

## Estado que se debe comprobar al iniciar la ventana

1. Registrar el commit y la rama de `al-gym-sys` y `algym-local-backend`, la imagen de cada contenedor y el conjunto de migraciones efectivamente aplicadas. El código local no equivale a la imagen que todavía atiende un puerto.
2. Preparar como destino definitivo el servicio `postgres` de Compose previsto en `P5-01`, con volumen persistente. El PostgreSQL del host sigue siendo la instalación operativa temporal; `backend`, `web` y `sync` deben apuntar a **la misma** instancia después del corte. El servicio de contenedor es hoy solo una copia aislada de ensayo.
3. Confirmar que existen y se probaron respaldos recuperables de la base y de `LOCAL_MEDIA_ROOT`; `database/scripts/backup_local_database.sh` produce ambos con hashes. Registrar ruta, fecha UTC, tamaño y resultado de una restauración de ensayo.
4. Confirmar que el catálogo y las imágenes de ejercicios se importaron desde archivos locales, las imágenes históricas necesarias de productos y avatares tienen correspondencia verificada, y el reloj puede comunicarse con `gym-sync-server` en la red local.
5. Tener una ventana de mantenimiento, acceso al origen y a sus respaldos, y una persona que pueda impedir escrituras en el VPS y en la instalación local mientras se compara. Sin estas condiciones, no iniciar el corte.

## Ensayo antes de congelar escrituras

1. Exportar el origen a una ubicación privada sin imprimir contraseñas ni tokens en comandos o logs compartidos. Incluir datos operativos, `auth.users` e identidades, metadatos y binarios de Storage, y registrar hashes de cada archivo. El método exacto depende del acceso real al VPS/Supabase y debe anotarse en el acta del ensayo.
2. Restaurar el origen en una **base de ensayo nueva** y aplicar las migraciones locales faltantes allí. Registrar los errores antes de reintentar; un proceso que terminó sin error no demuestra que la aplicación tenga permisos RLS suficientes.
3. Comparar la copia de origen y `algym` por IDs y valores críticos. Como mínimo: usuarios y perfiles, planes, membresías, pagos y reversos, sesiones y movimientos de caja, productos y existencias, rutinas y detalles, asistencias y comandos del reloj, y archivos. Comparar tanto los conteos como los conjuntos de IDs y sumas monetarias por estado; un mismo conteo puede ocultar filas diferentes.
   Usar `../algym-local-backend/database/scripts/RECONCILIACION_DE_COPIAS.md`: exportar manifiestos privados de ambas copias con los escritores detenidos, comparar todas las entidades y media, y ejecutar `reconcile_local.sql` en cada copia para contrastar importes y controles internos. Guardar los IDs divergentes fuera de Git y registrar en el acta solo los conteos y decisiones.
4. Resolver en un script de importación **revisado por entidad** las filas nuevas, cambios y conflictos. Preservar claves, referencias, precios e historial. No volver a ejecutar la restauración destructiva inicial sobre la base activa. Ensayar el script sobre otra copia y volver a comparar.
5. Levantar web, backend y sync contra la copia de ensayo. Probar permisos de dueño, administrador, empleado y socio, más venta, cobro, rutina, imagen, portal, Resumen y respaldo/restauración. Registrar qué parte requiere todavía el reloj físico.

## Ventana de corte

1. Registrar hora UTC y hora de Guatemala. Poner la aplicación en mantenimiento y detener **todos** los escritores de origen: web/API del VPS, tareas programadas, integraciones y el destino anterior del reloj. Detener también las escrituras locales hasta decidir qué base contiene el último cambio válido. Una pausa de la interfaz sola no bloquea procesos de fondo.
2. Crear y verificar un respaldo final del origen y otro de `algym` + media local. Conservar ambos inmutables. Registrar los últimos IDs y marcas de tiempo visibles de pagos, caja, asistencias y comandos.
3. Restaurar el respaldo final remoto en una base nueva, comparar contra el ensayo y la base local, y ejecutar el script de delta revisado **solo sobre una copia** de la futura base definitiva. Si aparecen conflictos nuevos o faltan archivos, mantener el sistema en mantenimiento y resolverlos antes de continuar.
4. Verificar integridad referencial, permisos/RLS, conteos, IDs y sumas por entidad; comprobar los hashes de media. Solo entonces seleccionar la copia validada como base definitiva y levantar backend y sync con `docker-compose.yml` **más** `docker-compose.container-db.yml`; este segundo archivo dirige ambos al servicio `postgres` y espera su estado saludable. Las credenciales del runtime deben pertenecer a roles limitados (`algym_app`, `algym_sync`), no al propietario migrador. Comprobar dentro del contenedor que ambos leen de la copia validada antes de reabrir escrituras.
5. Arrancar los servicios locales y comprobar `/health/ready`, login y una lectura y escritura de prueba controlada. Ejecutar `P6-03` con la red externa bloqueada, incluido el reloj real y una imagen importada de un archivo local. Verificar en Network y logs que no hay solicitudes a Hostinger, Supabase, ExerciseDB, RapidAPI ni Cloudflare.
6. Abrir nuevamente las escrituras **solo en la instalación local**. Registrar el instante y los primeros IDs creados. Mantener el origen congelado mientras se observa la operación y se crea el primer respaldo local posterior al corte.

## Reversión

- Antes de reabrir escrituras locales: detener los servicios locales y restaurar la configuración de acceso anterior. Mantener los dos respaldos finales y el acta de diferencias; no borrar la base preparada.
- Después de reabrir escrituras locales: **no** apuntar simplemente los usuarios al VPS. Identificar primero cada escritura local posterior al corte (pagos, caja, membresías, stock, asistencias y comandos), decidir cómo trasladarla o compensarla y verificar que no se duplique. Congelar ambos lados durante esa conciliación.
- Un fallo de conectividad del reloj exige revisar la cola y los comandos pendientes antes de repetirlos; no borrar `device_commands` para “desatascar” el servicio.
- No apagar Hostinger/Supabase ni revocar el último acceso recuperable hasta que `P6-01` a `P6-03` estén verificados, exista un respaldo restaurado de la instalación local y termine el período de observación acordado.

## Evidencia de cierre

Guardar un acta sin secretos con: versiones desplegadas, hora de congelación y apertura, rutas y hashes de respaldos, conteos e IDs comparados, importaciones y conflictos resueltos, resultados de pruebas por rol, prueba del reloj, prueba sin internet, responsable de la decisión y ruta de reversión. Si falta una de estas evidencias, el corte sigue pendiente.
