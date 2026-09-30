# Archivos e imágenes en la instalación local

## Inventario comprobado el 29 de septiembre de 2026

- La base PostgreSQL local `algym` contiene 0 filas en `public.exercises` y 0 en `public.products`.
- La base local no contiene `storage.objects`: un respaldo de PostgreSQL por sí solo no recupera los objetos de Supabase Storage.
- `all-gym-vf/public` contiene cuatro iconos PWA y ninguna imagen de ejercicio o producto.
- El alta manual de ejercicios ya usa disco local; productos y otras rutas heredadas aún escriben en Supabase Storage. Las rutinas antiguas pueden contener URL externas en la base, pero la interfaz deja de solicitarlas hasta que se importen sus archivos. **Falta el inventario de objetos del origen y la carpeta de imágenes que aportará el usuario**; no se puede considerar migrado ningún archivo con estos conteos locales.

## Contrato de destino

1. Guardar los binarios fuera del repositorio y de PostgreSQL en un directorio persistente `LOCAL_MEDIA_ROOT`, con subdirectorios `exercises/` y `products/`. Montar ese directorio como volumen si la API corre en contenedor. El proceso de la API debe tener escritura exclusiva; la web solo accede mediante HTTP local.
2. La API debe aceptar únicamente PNG, JPEG, WebP y GIF; verificar el tipo por firma de archivo, limitar tamaño y dimensiones, generar un nombre aleatorio o derivado de hash y escribir atómicamente. Nunca usar nombres enviados por el navegador como rutas. Rechazar rutas con `..` y enlaces simbólicos.
3. La URL persistida en la base será relativa al sitio, `/api/media/{tipo}/{archivo}`, para que un navegador de la red local no intente leer `127.0.0.1` de su propia computadora. Next.js la enviará a la API mediante la URL de backend configurada del lado servidor. La lectura de archivos requerirá una sesión local; los socios podrán leer las imágenes incluidas en sus rutinas y el personal los catálogos de su módulo.
4. La subida y el vínculo con la entidad deben completarse de forma coordinada. Si una escritura de base falla, retirar el archivo recién creado; si se reemplaza un archivo, conservar el anterior hasta confirmar que ya no está referenciado. La baja lógica de planes o productos no debe borrar archivos históricos sin revisión de referencias.
5. El respaldo diario debe incluir **ambas** piezas: volcado de PostgreSQL y copia verificable de `LOCAL_MEDIA_ROOT`, con un manifiesto SHA-256 de archivos y fecha común. Probar restauración en otro directorio y otra base, no sobre la instalación en uso.

## Base implementada

- La API local acepta `POST /media/exercises` y `POST /media/products` con sesión y permiso de alta o edición, limita el cuerpo a 5 MB, verifica la firma de PNG/JPEG/WebP/GIF y guarda el archivo por SHA-256 bajo `LOCAL_MEDIA_ROOT` (valor por defecto `./data/media`).
- `GET /media/{tipo}/{archivo}` requiere sesión, verifica el hash y sirve el archivo. Next.js expone la URL relativa `/api/media/{tipo}/{archivo}` y reenvía la sesión a la API, de modo que el navegador no necesita conocer el puerto del backend.
- La prueba sintética subió y leyó una imagen PNG desde un directorio temporal, confirmó rechazo sin sesión o permiso y rechazo de datos que no son imagen.
- La creación manual de ejercicios ya sube la imagen comprimida a esta API y guarda su URL relativa en `public.exercises` de PostgreSQL local. La búsqueda y selección de ejercicios para rutinas ya consultan el catálogo local; sus demás escrituras siguen pendientes. Los productos y las imágenes de ejercicios existentes aún no están conectados. El directorio aún no figura como volumen en Compose. Existe un respaldo manual de DB y media con hashes (`backend/database/scripts/backup_local_database.sh`), pero aún no hay programación ni prueba con archivos reales.

## Importación pendiente

1. Inventariar en el origen los buckets `exercises` y `products`, claves, tamaños y conteos sin publicar tokens. Exportar los objetos y validar hash/cantidad.
2. Recibir la ruta absoluta de la carpeta de ejercicios del usuario. Mapear archivos a ejercicios por una tabla manifiesto; no inventar correspondencias por similitud de nombres cuando haya ambigüedad.
3. Importar metadatos preservando IDs y relaciones; copiar binarios al directorio persistente; sustituir URL externas por rutas locales solo después de verificar cada archivo.
4. Con la red externa bloqueada, abrir el catálogo, una rutina de socio y un producto con imagen. Confirmar que Network no muestra solicitudes a Supabase, Hostinger, ExerciseDB o RapidAPI.

Este documento define el diseño de `P0-03`; su casilla continúa pendiente hasta completar el inventario del origen y validar una subida, lectura y restauración local.
