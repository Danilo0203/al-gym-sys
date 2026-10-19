# Exportar datos actuales de Hostinger

Esta función es para el frontend local que se conecta a Supabase en Hostinger.
No requiere actualizar el instalador Windows 0.3.0. Los cambios están aislados en
la rama `codex/hostinger-windows-export` de ambos repositorios.

## Uso

1. Iniciar sesión con una cuenta propietaria activa.
2. Abrir **Administración → Exportar para Windows** y confirmar la captura.
3. Esperar **Copia lista**; revisar la fecha y las cantidades.
4. Descargar el `.algym` y guardar también el respaldo completo `.dump` en privado.
5. En una instalación Windows nueva, abrir **Administración → Importar datos** y
   seleccionar el `.algym`. No se sobreescribe una instalación que ya importó otro archivo.

La exportación conserva la información de Hostinger. Los registros añadidos
posteriormente requieren otra copia. Para el traslado definitivo, acordar el
momento de dejar de registrar operaciones en Hostinger. La cola del reloj empieza
vacía en Windows; las órdenes históricas se conservan en el respaldo completo.

## Configuración del equipo que sirve el frontend

Mantener sus variables de Supabase actuales. Agregar solo estas variables privadas
del servidor Next.js después de activar el exportador de la VPS:

```dotenv
ALGYM_EXPORT_URL=https://DIRECCION_AUTORIZADA:54433/
ALGYM_EXPORT_CA_BASE64=CERTIFICADO_PUBLICO_EN_BASE64
```

Nunca copiar contraseñas PostgreSQL ni la clave privada TLS al frontend. No usar
`NEXT_PUBLIC_` para estas variables. El backend separado documenta la creación
explícita de una cuenta técnica de lectura y tiene publicación solo en loopback
por defecto. Abrir acceso remoto requiere autorización de despliegue.

El frontend utiliza la URL y clave pública Supabase existentes. Validar esta rama
con la configuración real del cliente antes de sustituir su carpeta: el cliente
puede tener una versión distinta. Esta entrega no modifica automáticamente sus
archivos ni su proceso en ejecución.

## Pruebas

- Lint de los archivos modificados, `npx tsc --noEmit`, `npm run build`.
- `node --test tests/export-transport.test.mjs`: TLS, nombre del servidor,
  certificado incorrecto y descarga por streaming.
- Pruebas de permisos y exportación en `hostinger/service.test.mjs` del backend.
- El 19 de octubre de 2026 se probó el botón con una sesión propietaria real,
  HTTPS verificado y las dos descargas. Las huellas de los archivos descargados
  coinciden con las del servidor.
- El `.algym` descargado se restauró en PostgreSQL desechable usando el importador
  del instalador 0.3.0: 178 clientes, 9 planes, 551 pagos y 15.919 asistencias en
  esa captura. Una segunda importación del mismo archivo no duplicó registros.
- La cola del reloj y las sesiones quedan vacías en Windows. Las 4.990.498 órdenes
  históricas de esa captura permanecen en el respaldo completo.

## Entorno de prueba y actualización del cliente

El exportador de Hostinger ya está activo. Este frontend aislado usa el puerto
3100 y permite probar el módulo con una sesión propietaria. No contiene la clave
administrativa de Supabase: otras pantallas del frontend heredado, como Clientes,
requieren la configuración existente del equipo real. No sustituir su `.env.local`
por el archivo de este entorno de prueba.

Para el cliente se entrega un parche con los cambios y un archivo que contiene
únicamente `ALGYM_EXPORT_URL` y el certificado público `ALGYM_EXPORT_CA_BASE64`.
Agregar esas dos variables a su configuración existente. Aplicar el parche en
una copia o rama separada y comprobarlo con `git apply --check` antes de aplicarlo.
Si falla, adaptar a la revisión real del cliente; no forzar ni sobrescribir archivos.
