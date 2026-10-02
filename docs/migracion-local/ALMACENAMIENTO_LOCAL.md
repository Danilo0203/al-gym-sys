# Archivos e imágenes en la instalación local

## Inventario comprobado el 29 de septiembre de 2026

- La base PostgreSQL local `algym` contiene 0 filas en `public.exercises` y 0 en `public.products`.
- La base local no contiene `storage.objects`: un respaldo de PostgreSQL por sí solo no recupera los objetos de Supabase Storage.
- `all-gym-vf/public` contiene cuatro iconos PWA y ninguna imagen de ejercicio o producto.
- El alta manual de ejercicios y las imágenes nuevas de productos ya usan disco local. Las rutinas y productos antiguos pueden contener URL externas en la base, pero la interfaz deja de solicitarlas hasta que se importen sus archivos. **Falta inventariar y copiar los objetos históricos**; el usuario aún no tiene archivos de imágenes de ejercicios para importar.

## Contrato de destino

1. Guardar los binarios fuera del repositorio y de PostgreSQL en un directorio persistente `LOCAL_MEDIA_ROOT`, con subdirectorios `exercises/` y `products/`. Montar ese directorio como volumen si la API corre en contenedor. El proceso de la API debe tener escritura exclusiva; la web solo accede mediante HTTP local.
2. La API debe aceptar únicamente PNG, JPEG, WebP y GIF; verificar el tipo por firma de archivo, limitar tamaño y dimensiones, generar un nombre aleatorio o derivado de hash y escribir atómicamente. Nunca usar nombres enviados por el navegador como rutas. Rechazar rutas con `..` y enlaces simbólicos.
3. La URL persistida en la base será relativa al sitio, `/api/media/{tipo}/{archivo}`, para que un navegador de la red local no intente leer `127.0.0.1` de su propia computadora. Next.js la enviará a la API mediante la URL de backend configurada del lado servidor. La lectura de archivos requerirá una sesión local; los socios podrán leer las imágenes incluidas en sus rutinas y el personal los catálogos de su módulo.
4. La subida y el vínculo con la entidad deben completarse de forma coordinada. Si una escritura de base falla, retirar el archivo recién creado; si se reemplaza un archivo, conservar el anterior hasta confirmar que ya no está referenciado. La baja lógica de planes o productos no debe borrar archivos históricos sin revisión de referencias.
5. El respaldo diario debe incluir **ambas** piezas: volcado de PostgreSQL y copia verificable de `LOCAL_MEDIA_ROOT`, con un manifiesto SHA-256 de archivos y fecha común. Probar restauración en otro directorio y otra base, no sobre la instalación en uso.

## Base implementada

- La API local acepta `POST /media/exercises` y `POST /media/products` con sesión y permiso de alta o edición, limita el cuerpo a 5 MB, verifica la firma de PNG/JPEG/WebP/GIF y guarda el archivo por SHA-256 bajo `LOCAL_MEDIA_ROOT` (valor por defecto `./data/media`).
- `GET /media/{tipo}/{archivo}` requiere sesión y comprueba que el archivo esté referenciado por un ejercicio o producto local. El personal necesita un permiso de catálogo, inventario o rutina correspondiente; un socio solo puede leer la imagen de un ejercicio incluido en su rutina activa. Después verifica el hash y sirve el archivo. Next.js expone la URL relativa `/api/media/{tipo}/{archivo}` y reenvía la sesión a la API, de modo que el navegador no necesita conocer el puerto del backend.
- Una subida todavía ocurre antes de la escritura de la entidad. Si esa segunda operación falla, el archivo queda huérfano en disco y responde 404 a la lectura. `audit_local_media.py` permite detectar ese archivo sin borrarlo; falta una limpieza coordinada para completar el contrato del punto 4.
- La prueba sintética subió y leyó una imagen PNG desde un directorio temporal, confirmó rechazo sin sesión o permiso y rechazo de datos que no son imagen.
- La creación manual de ejercicios ya sube la imagen comprimida a esta API y guarda su URL relativa en `public.exercises` de PostgreSQL local. La búsqueda y selección de ejercicios para rutinas consultan el catálogo local; sus demás escrituras siguen pendientes. Los productos nuevos también guardan imágenes locales mediante `/media/products`. El directorio `../algym-local-backend/data/media` está montado como volumen del backend en Compose. Existe un respaldo manual de DB y media con hashes (`backend/database/scripts/backup_local_database.sh`), pero aún no hay programación ni prueba con archivos reales del usuario.

## Importación pendiente

### Auditoría local sin escritura

`algym-local-backend/database/scripts/audit_local_media.py` compara `image_url` y `animation_url` de ejercicios y `image_url` de productos con los archivos de `LOCAL_MEDIA_ROOT`. Comprueba nombre, tamaño, firma y SHA-256, informa archivos sin vínculo, referencias locales sin archivo válido y referencias externas. Rechaza un destino PostgreSQL remoto y los enlaces simbólicos en la raíz o subdirectorios de media. **No borra ni cambia archivos o filas.** Un resultado es una fotografía del instante de lectura; repetirlo con las escrituras detenidas antes de planificar cualquier limpieza.

```bash
cd algym-local-backend
python3 database/scripts/audit_local_media.py --db-name algym \
  --media-root /ruta/absoluta/algym-local-backend/data/media
```

Tras el corte a PostgreSQL de Compose, añadir `--db-mode compose --project-name NOMBRE_DEL_PROYECTO` y conservar `--db-name algym`. Usar siempre el directorio de media montado por el backend de ese mismo proyecto.

La prueba en `algym_test` detectó un archivo sin vínculo, una URL sin archivo, un hash incorrecto y un enlace simbólico; confirmó que archivos y filas conservaron sus valores. La lectura de `algym` operativa del 1 de octubre informó 0 archivos y 0 referencias de media local. Estos conteos corresponden a la copia desactualizada: repetir la auditoría después de importar datos e imágenes vigentes. No automatizar el borrado mientras una petición pueda estar entre la subida y el vínculo de su imagen.

`algym-local-backend/database/scripts/export_media_inventory.py` genera desde una copia local un manifiesto privado con los IDs y URLs actuales que aún no son media local. Deja `file` vacío para completar manualmente con la ruta absoluta de cada imagen; `--all` incluye también filas sin URL o ya locales. No consulta Supabase ni descarga binarios, no cambia la base, crea el JSON con permisos `0600` y se niega a sobrescribirlo. Por ejemplo, tras restaurar el origen en un PostgreSQL aislado de Compose:

```bash
python3 database/scripts/export_media_inventory.py --db-mode compose --db-name algym \
  --project-name NOMBRE_DEL_PROYECTO --output /ruta/absoluta/manifiesto-privado.json
```

`algym-local-backend/database/scripts/import_local_media.py` prepara la sustitución **sin descargar archivos**. Recibe ese manifiesto JSON o uno creado desde `media-manifest.example.json` con el tipo, ID y ruta absoluta del archivo de cada entidad; `expected_image_url` y, para ejercicios, `expected_animation_url` deben coincidir exactamente con la copia local de PostgreSQL (pueden ser `null`). Nunca adivinar qué archivo corresponde a un ID. `sha256` es opcional en cada elemento para contrastar los binarios antes de importar. Las URLs históricas pueden ser privadas: conservar el manifiesto fuera de Git.

Por defecto el script solo valida el manifiesto, la firma y el límite de 5 MB de cada imagen, el hash opcional y los valores actuales de la base. No modifica PostgreSQL ni copia archivos. Con `--apply`, almacena cada imagen por hash en el volumen local, actualiza `image_url` (y `animation_url` de ejercicios) en **una transacción** con guardas contra cambios concurrentes y confirma los valores finales. Si una actualización falla, la transacción se revierte; los archivos ya copiados podrían quedar sin vínculo y deben revisarse antes de limpiarlos. Para `algym` exige `--backup` de base y media con hashes válidos; `algym_test` permite ensayos sin esa puerta.

Ejemplo de ensayo con una copia local y archivos de prueba (desde `algym-local-backend`):

```bash
python3 database/scripts/import_local_media.py /ruta/absoluta/manifiesto.json \
  --media-root /ruta/absoluta/media-de-ensayo --db-name algym_test
python3 database/scripts/import_local_media.py /ruta/absoluta/manifiesto.json \
  --media-root /ruta/absoluta/media-de-ensayo --db-name algym_test --apply
```

Para la futura instancia `algym` de Compose, el modo será `--db-mode compose --db-name algym --media-root /ruta/absoluta/media-del-backend --backup /ruta/absoluta/respaldo --apply`. La carpeta de media indicada debe ser el volumen que monta el backend. **No ejecutar el modo de aplicación sobre la copia desactualizada actual:** todavía no hay imágenes reales ni datos vigentes para mapear. Una prueba en `algym_test` verificó que el modo seco no escribe, que ejercicio/producto reciben rutas locales y bytes íntegros, y que un manifiesto con URLs ya cambiadas es rechazado.

El modo Compose se verificó en el proyecto desechable `algymmediaimport`: se restauró un respaldo aislado con 140 perfiles, 263 pagos y 6080 marcajes; el modo seco leyó dos filas sintéticas sin escribir y `--apply` aceptó el respaldo, copió dos PNG por hash y cambió `image_url`/`animation_url` a rutas locales. Los hashes y las filas se comprobaron directamente; `algym` operativa no recibió las filas. Se eliminaron el proyecto, volumen, red y archivos de ensayo. Esta prueba no reemplaza el inventario ni la importación de imágenes reales del origen.

1. Inventariar en el origen los buckets `exercises` y `products`, claves, tamaños y conteos sin publicar tokens. Exportar los objetos y validar hash/cantidad.
2. Recibir la ruta absoluta de la carpeta de ejercicios del usuario. Mapear archivos a ejercicios por una tabla manifiesto; no inventar correspondencias por similitud de nombres cuando haya ambigüedad.
3. Importar metadatos preservando IDs y relaciones; copiar binarios al directorio persistente; sustituir URL externas por rutas locales solo después de verificar cada archivo.
4. Con la red externa bloqueada, abrir el catálogo, una rutina de socio y un producto con imagen. Confirmar que Network no muestra solicitudes a Supabase, Hostinger, ExerciseDB o RapidAPI.

Este documento define el diseño de `P0-03`; su casilla continúa pendiente hasta completar el inventario del origen y validar una subida, lectura y restauración local.
