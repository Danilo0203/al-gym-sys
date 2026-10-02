# Archivos e imágenes en la instalación local

## Inventario comprobado el 29 de septiembre de 2026

- La base PostgreSQL local `algym` contiene 0 filas en `public.exercises` y 0 en `public.products`.
- La base local no contiene `storage.objects`: un respaldo de PostgreSQL por sí solo no recupera los objetos de Supabase Storage.
- `all-gym-vf/public` contiene cuatro iconos PWA y ninguna imagen de ejercicio o producto.
- El alta manual de ejercicios y las imágenes nuevas de productos ya usan disco local. Las rutinas y productos antiguos pueden contener URL externas en la base, pero la interfaz deja de solicitarlas hasta que se importen sus archivos. **Falta inventariar y copiar los objetos históricos**; el usuario aún no tiene archivos de imágenes de ejercicios para importar.

## Contrato de destino

1. Guardar los binarios fuera del repositorio y de PostgreSQL en un directorio persistente `LOCAL_MEDIA_ROOT`, con subdirectorios `exercises/`, `products/` y `avatars/`. Montar ese directorio como volumen si la API corre en contenedor. El proceso de la API debe tener escritura exclusiva; la web solo accede mediante HTTP local.
2. La API debe aceptar únicamente PNG, JPEG, WebP y GIF; verificar el tipo por firma de archivo, limitar tamaño y dimensiones, generar un nombre aleatorio o derivado de hash y escribir atómicamente. Nunca usar nombres enviados por el navegador como rutas. Rechazar rutas con `..` y enlaces simbólicos.
3. La URL persistida en la base será relativa al sitio, `/api/media/{tipo}/{archivo}`, para que un navegador de la red local no intente leer `127.0.0.1` de su propia computadora. Next.js la enviará a la API mediante la URL de backend configurada del lado servidor. La lectura de archivos requerirá una sesión local; los socios podrán leer las imágenes incluidas en sus rutinas y el personal los catálogos de su módulo.
4. La subida y el vínculo con la entidad deben completarse de forma coordinada. Si una escritura de base falla, retirar el archivo recién creado; si se reemplaza un archivo, conservar el anterior hasta confirmar que ya no está referenciado. La baja lógica de planes o productos no debe borrar archivos históricos sin revisión de referencias.
5. El respaldo diario debe incluir **ambas** piezas: volcado de PostgreSQL y copia verificable de `LOCAL_MEDIA_ROOT`, con un manifiesto SHA-256 de archivos y fecha común. Probar restauración en otro directorio y otra base, no sobre la instalación en uso.

## Base implementada

- La API local acepta imágenes de hasta 5 MB únicamente junto con el alta o edición de su ejercicio o producto. Verifica la firma PNG/JPEG/WebP/GIF y guarda el archivo por SHA-256 bajo `LOCAL_MEDIA_ROOT` (valor por defecto `./data/media`). `POST /media/{tipo}` se retiró; `/media/{tipo}/{archivo}` sirve únicamente lecturas autorizadas.
- `GET /media/{tipo}/{archivo}` requiere sesión y comprueba que el archivo esté referenciado por `image_url` o, para ejercicios, `animation_url`; los productos usan `image_url` y los avatares `profiles.avatar_url`. El personal necesita un permiso de catálogo, inventario o rutina correspondiente; un socio solo puede leer la imagen o animación de un ejercicio incluido en su rutina activa y su propio avatar. Después verifica el hash y sirve el archivo. Next.js expone la URL relativa `/api/media/{tipo}/{archivo}` y reenvía la sesión a la API, de modo que el navegador no necesita conocer el puerto del backend.
- El alta visible de ejercicios con imagen usa `POST /exercises/with-image` y el adjunto posterior usa `POST /exercises/image-attachment`. El formulario de productos usa `POST /inventory/products/with-image` y `PUT /inventory/products/{id}/with-image`. Cada petición valida sesión y permiso, bloquea el hash durante la transacción, guarda el archivo y confirma la fila. Si la escritura SQL falla, retira el archivo solo cuando esa petición lo creó; un archivo idéntico ya compartido permanece. Una caída del proceso entre la escritura del archivo y el commit todavía puede dejarlo sin vínculo; `audit_local_media.py` lo detecta y `quarantine_local_media.py` puede moverlo reversiblemente con los escritores detenidos.
- La prueba sintética subió y leyó una imagen PNG desde un directorio temporal, confirmó rechazo sin sesión o permiso y rechazo de datos que no son imagen.
- La creación manual de ejercicios comprime la imagen a WebP y envía sus bytes en base64 junto con los metadatos en una sola solicitud local; el backend guarda la URL relativa en `public.exercises`. La búsqueda y selección de ejercicios para rutinas consultan el catálogo local. El formulario de productos envía la imagen original aceptada, de hasta 5 MB, junto con el alta o la edición; el backend guarda su URL relativa en `public.products`. El directorio `../algym-local-backend/data/media` está montado como volumen del backend en Compose. Existe un respaldo manual de DB y media con hashes (`backend/database/scripts/backup_local_database.sh`), pero aún no hay prueba con archivos reales del usuario.

## Importación pendiente

### Auditoría local sin escritura

`algym-local-backend/database/scripts/audit_local_media.py` compara `image_url` y `animation_url` de ejercicios y `image_url` de productos y `avatar_url` de perfiles con los archivos de `LOCAL_MEDIA_ROOT`. Comprueba nombre, tamaño, firma y SHA-256, informa archivos sin vínculo, referencias locales sin archivo válido y referencias externas. Rechaza un destino PostgreSQL remoto y los enlaces simbólicos en la raíz o subdirectorios de media. **No borra ni cambia archivos o filas.** Un resultado es una fotografía del instante de lectura; repetirlo con las escrituras detenidas antes de planificar cualquier limpieza.

```bash
cd algym-local-backend
python3 database/scripts/audit_local_media.py --db-name algym \
  --media-root /ruta/absoluta/algym-local-backend/data/media
```

Tras el corte a PostgreSQL de Compose, añadir `--db-mode compose --project-name NOMBRE_DEL_PROYECTO` y conservar `--db-name algym`. Usar siempre el directorio de media montado por el backend de ese mismo proyecto.

La prueba en `algym_test` detectó un archivo sin vínculo, una URL sin archivo, un hash incorrecto y un enlace simbólico; confirmó que archivos y filas conservaron sus valores. La lectura de `algym` operativa del 1 de octubre informó 0 archivos y 0 referencias de media local. Estos conteos corresponden a la copia desactualizada: repetir la auditoría después de importar datos e imágenes vigentes. No automatizar el borrado mientras una petición pueda estar entre la subida y el vínculo de su imagen.

### Cuarentena reversible de archivos sin vínculo

`quarantine_local_media.py` considera solo imágenes con nombre, firma y SHA-256 válidos, sin referencia en ejercicios, productos ni perfiles y con al menos 24 horas de antigüedad. Rechaza una auditoría con archivos corruptos o referencias locales ausentes. La vista previa no escribe y entrega un `snapshot_sha256`; la aplicación exige ese valor para detectar cambios desde la vista previa. Nunca borra archivos ni cambia PostgreSQL: mueve cada candidato a una carpeta nueva en el mismo disco, fuera de `LOCAL_MEDIA_ROOT`, y guarda un `manifest.json` privado para poder devolverlo. Comprueba referencias antes y después de mover y revierte los movimientos si detecta un cambio durante la ejecución.

Orden de operación sobre `algym` cuando existan datos vigentes: detener todas las escrituras del backend y cualquier importador de media; verificar que ya no haya solicitudes pendientes; generar y verificar un respaldo nuevo de PostgreSQL **y** media; ejecutar la vista previa; revisar cada candidato; aplicar con el hash de esa vista previa y una carpeta de cuarentena nueva. `--writers-stopped` es una declaración del operador, no una detección automática. No ejecutar el modo de aplicación mientras la API pueda recibir subidas. La cuarentena y su manifiesto deben quedar fuera de Git y conservarse junto con el respaldo.

```bash
cd algym-local-backend
python3 database/scripts/quarantine_local_media.py --db-name algym \
  --media-root /ruta/absoluta/algym-local-backend/data/media
python3 database/scripts/quarantine_local_media.py --db-name algym \
  --media-root /ruta/absoluta/algym-local-backend/data/media \
  --apply --expect HASH_DE_LA_VISTA_PREVIA --writers-stopped \
  --backup /ruta/absoluta/respaldo-verificado \
  --quarantine-dir /ruta/absoluta/cuarentena-nueva
```

Para restaurar un archivo, mantener las escrituras detenidas, comprobar su entrada en `manifest.json`, que la ruta original no exista y que el hash y la firma coincidan; moverlo desde la cuarentena a su subdirectorio original y repetir `audit_local_media.py`. No sobrescribir un archivo existente. Tras el corte a PostgreSQL en Compose se agregan `--db-mode compose --project-name NOMBRE_DEL_PROYECTO` en ambas llamadas y se usa el volumen de media de ese proyecto.

Se ensayaron 6 casos unitarios: archivo referenciado, candidato, vista previa obsoleta, reversión al aparecer una referencia, respaldo obligatorio y antigüedad mínima. Un ensayo completo con `algym_test` movió 1 PNG sintético a cuarentena y verificó bytes, hash y manifiesto. Las vistas previas de `algym` y `algym_test` operativos no encontraron candidatos; no se movió ningún archivo real.

`algym-local-backend/database/scripts/export_media_inventory.py` genera desde una copia local un manifiesto privado con los IDs y URLs actuales que aún no son media local. Deja `file` vacío para completar manualmente con la ruta absoluta de cada imagen; `--all` incluye también filas sin URL o ya locales. No consulta Supabase ni descarga binarios, no cambia la base, crea el JSON con permisos `0600` y se niega a sobrescribirlo. Por ejemplo, tras restaurar el origen en un PostgreSQL aislado de Compose:

```bash
python3 database/scripts/export_media_inventory.py --db-mode compose --db-name algym \
  --project-name NOMBRE_DEL_PROYECTO --output /ruta/absoluta/manifiesto-privado.json
```

Cuando los archivos históricos estén copiados en una carpeta local, `match_local_media.py` puede preparar otro manifiesto sin consultar la red ni PostgreSQL. Compara sufijos exactos de la ruta de cada URL histórica con las rutas bajo `--files-root`, exige al menos dos segmentos y acepta solo una coincidencia única. Verifica que el archivo sea PNG/JPEG/WebP/GIF de hasta 5 MB y escribe su SHA-256. Las rutas ambiguas, archivos inválidos, URLs sin correspondencia y campos ya decididos manualmente quedan sin alterar. Nunca adivina por nombre parecido ni sobrescribe el manifiesto de entrada. La salida contiene URLs históricas y rutas privadas: se crea con permisos `0600` fuera de Git.

```bash
cd algym-local-backend
python3 database/scripts/match_local_media.py /ruta/absoluta/manifiesto-privado.json \
  --files-root /ruta/absoluta/objetos-descargados \
  --output /ruta/absoluta/manifiesto-emparejado.json
```

Revisar a mano las rutas propuestas, los campos vacíos y las animaciones distintas antes del modo seco de `import_local_media.py`. Esta herramienta no sirve para crear los archivos que aún faltan ni cambia la base local.

`algym-local-backend/database/scripts/import_local_media.py` prepara la sustitución **sin descargar archivos**. Recibe ese manifiesto JSON o uno creado desde `media-manifest.example.json` con el tipo, ID y ruta absoluta del archivo de cada entidad; `expected_image_url` y, para ejercicios, `expected_animation_url` deben coincidir exactamente con la copia local de PostgreSQL (pueden ser `null`). Los avatares de perfiles usan `kind: "avatars"`, ID UUID y `expected_avatar_url`. Nunca adivinar qué archivo corresponde a un ID. `sha256` es opcional en cada elemento para contrastar los binarios antes de importar. Las URLs históricas pueden ser privadas: conservar el manifiesto fuera de Git.

Si la animación histórica de un ejercicio es distinta de su imagen, el exportador deja `animation_file` vacío para exigir una decisión explícita: poner la ruta absoluta de un GIF/WebP/PNG/JPEG local, con `animation_sha256` opcional, o `null` para dejar `animation_url` vacía. También puede indicarse el mismo archivo de `file` si se quiere reutilizar la imagen deliberadamente. Si la URL histórica de animación era igual a la imagen, el importador reutiliza `file`; si era `null`, la deja en `null`. No sustituye silenciosamente una animación distinta por la imagen estática.

Por defecto el script solo valida el manifiesto, la firma y el límite de 5 MB de cada imagen, el hash opcional y los valores actuales de la base. No modifica PostgreSQL ni copia archivos. Con `--apply`, almacena cada imagen y animación por hash en el volumen local, actualiza `image_url` y `animation_url` en **una transacción** con guardas contra cambios concurrentes y confirma los valores finales. Si una actualización falla, la transacción se revierte; los archivos ya copiados podrían quedar sin vínculo y deben revisarse antes de limpiarlos. Para `algym` exige `--backup` de base y media con hashes válidos; `algym_test` permite ensayos sin esa puerta.

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
