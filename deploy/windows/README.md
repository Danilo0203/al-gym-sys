# Instalador nativo de AlGym para Windows

El instalador instala la web, el backend, sync, Node.js x64 y PostgreSQL 17.
No requiere Docker, WSL, Node ni PostgreSQL preinstalados en la computadora destino.
Se compila en Windows; no se deben copiar dependencias compiladas en macOS/Linux.
Destino: Windows 10 22H2 x64 (compilación 19045 o posterior) y Windows 11.
Windows 11 ARM puede ejecutar el paquete mediante emulación x64; la prueba en
ARM no sustituye la validación en Windows 10 x64 ni en el hardware del gimnasio.

## Construir el ejecutable

Preparar los dos repositorios hermanos en sus ramas `codex/windows-native-installer`.
También se puede exportar el código actual desde macOS, incluyendo cambios sin commit:

```sh
python3 deploy/windows/Export-WindowsSource.py \
  --backend ../algym-local-backend --output /ruta/AlGym-Windows-Source.zip
```

El ZIP excluye `.env`, datos, respaldos, dependencias y salidas de compilación.
Los manifiestos `.windows-source.json` permiten compilar el ZIP extraído sin Git.
No contiene los registros del gimnasio ni imágenes privadas.

En Windows, instalar [Inno Setup 6](https://jrsoftware.org/isdl.php) (6.4 o posterior).
Desde PowerShell de 64 bits ejecutar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\Build-WindowsInstaller.ps1 `
  -BackendPath ..\algym-local-backend -Version 0.3.5
```

La construcción necesita internet para dependencias y herramientas. Descarga los
componentes fijados en `vendors.json`, verifica SHA-256, instala los paquetes con
sus lockfiles, compila la aplicación y produce:

`build\windows\AlGym-Setup-0.3.5-win-x64.exe`

El ejecutable resultante incluye todos los componentes de ejecución y puede
instalarse sin internet. El build no modifica el código de entrada: copia las
fuentes a una carpeta `build-<id>`, que conserva para diagnóstico. El manifiesto
del paquete registra los commits y hashes. No subir instaladores ni dependencias a Git.

## Instalación y uso

1. Ejecutar el instalador con doble clic y aceptar la elevación de Windows.
2. Mantener seleccionados el acceso directo y la apertura al iniciar sesión.
3. Crear el propietario inicial con nombre, correo y contraseña propia.
4. Esperar a que termine la preparación de PostgreSQL y los servicios.
5. Abrir AlGym e iniciar sesión con esa cuenta.

Los servicios arrancan al encender Windows. El navegador se abre al iniciar sesión,
después de comprobar las tres rutas de salud. No se configura el inicio de sesión
automático de Windows ni se guarda la contraseña del propietario en texto plano.
La apertura automática usa un acceso directo en Inicio para todos los usuarios
de esa computadora; se puede desactivar desde las aplicaciones de inicio.
Windows inicia los servicios de aplicación de forma diferida: en la VM de prueba,
el navegador abrió aproximadamente dos minutos después de entrar a Windows.

Es una instalación nueva: roles, permisos, propietario y una caja inicial.
Clientes, planes, ejercicios y operaciones existentes requieren una importación
controlada por separado. No se toma una copia de la base en uso en este proyecto.

## Servicios, archivos y permisos

| Componente | Ubicación o puerto | Cuenta de Windows |
| --- | --- | --- |
| Programa y runtimes | `C:\Program Files\AlGym` | Escritura solo administrativa |
| PostgreSQL / AlGymPostgres | `127.0.0.1:55432`, base `algym_windows` | NetworkService |
| AlGymBackend | `127.0.0.1:4000` | LocalService |
| AlGymSync | `127.0.0.1:8080` | LocalService |
| AlGymWeb | `127.0.0.1:3000` | LocalService |
| Base, media, configuración, logs y backups | `C:\ProgramData\AlGym` | ACL por subcarpeta |

La aplicación usa `algym_app`; sync usa `algym_sync`. Ninguno es superusuario.
La contraseña administrativa está en `private\installation.json`, accesible solo
por administradores y SYSTEM. Los servicios de aplicación leen su configuración
y escriben media/logs; no acceden al archivo administrativo ni a PostgreSQL en disco.
No se abre el puerto de PostgreSQL a la red. Si algún puerto ya está ocupado, la
instalación nueva se detiene antes de preparar la base: no reemplaza otros servicios.

La migración se realiza exclusivamente contra un clúster con el identificador
de esta instalación. La base tiene su propia marca de propiedad. Cada migración
y su checksum se registran en la misma transacción; las adiciones de enum previas
a una transacción conservan su separación. No se aceptan migraciones aplicadas
alteradas ni versiones que omitan migraciones ya aplicadas.

## Reloj biométrico

Abrir **Inicio → AlGym → Configurar reloj biométrico**. Introducir IP privada y
serie. Configurar en el reloj ADMS la IP de esta PC y puerto 8080, y reservar la IP
de la PC en el router. Se crea una regla de firewall solo para la IP del reloj,
en perfil de red privada. La web y la base siguen accesibles únicamente en la PC.

La entrega de comandos comienza pausada. Activarla solamente después de revisar
la cola y probar el dispositivo físico. Configurar la IP no demuestra que el reloj
reciba órdenes: probar un marcaje, un alta y la confirmación de un comando.

## Respaldos, reparación y desinstalación

La tarea **AlGym Backup** se ejecuta a las 21:00 y, si la PC estaba apagada, cuando
vuelve a estar disponible. Detiene brevemente web/backend/sync para copiar una
base y media coherentes y vuelve a arrancar los servicios que estaban funcionando.
El respaldo contiene `database.dump`, `media` y hashes; no se eliminan copias
automáticamente. Copiarlas periódicamente a otro disco. Un backup en el mismo
disco no protege frente a una avería física del equipo.

Al volver a ejecutar el instalador, se respalda la instalación inicializada antes
de reemplazar archivos, se detienen los servicios y se aplican solo migraciones
nuevas. Se conservan cuentas, contraseñas, media y configuración del reloj.
Una falla se informa como instalación incompleta; no se hace un rollback automático
de los datos. La recuperación utiliza el respaldo y la versión anterior del paquete.
Las actualizaciones mayores de PostgreSQL no están automatizadas.

La desinstalación retira servicios, tarea, regla de firewall y accesos directos,
y **conserva `C:\ProgramData\AlGym`**. La instalación posterior en la misma ruta
puede reutilizarla. No moverla ni borrarla sin un respaldo verificado.

## Verificación

Backend, en un clúster temporal creado y eliminado por la prueba:

```sh
pnpm build
node --test windows/bootstrap.test.mjs
ALGYM_INSTALLER_PG_BIN=/ruta/postgresql/bin node --test windows/integration.test.mjs
```

No utilizar `pnpm test` ni el preparador de base general para verificar el instalador.

Después de instalar en Windows, desde PowerShell como administrador:

```powershell
& 'C:\Program Files\AlGym\tools\Test-InstalledAlGym.ps1'
```

Comprobar además con la interfaz: instalación limpia, credenciales, acceso directo,
reinicio e inicio de sesión, apertura del navegador, reparación, fallo por puerto
ocupado, desinstalación conservando datos y reinstalación. Verificar una restauración
de respaldo en un entorno separado antes de usar datos reales.

El ejecutable de desarrollo no está firmado con un certificado comercial del
distribuidor. Windows puede mostrar el editor desconocido hasta firmar una versión
de distribución con un certificado propio.

## Resultados de esta entrega — 2026-10-19

Artefacto: `AlGym-Setup-0.1.0-win-x64.exe`, 86 333 435 bytes.

SHA-256: `b36e6e6d8520fe4ba7da1db298cb6c8d0d3eaa0c9d415508c0fa23f130db3800`.

Fuentes del ejecutable: frontend `1b6104f7757702523d8fb53a2c8382bef25b0b7f`
y backend `baa3b3b28be8b86e0e704f94806ba2d74069ccb1`. Ambos repositorios están
en `codex/windows-native-installer`; incluyen una copia de los cambios pendientes
que había al comenzar. Los checkouts originales conservaron rama, HEAD, diff y
contenido de sus archivos.

Comprobaciones realizadas:

- Compilación de producción de frontend y backend en macOS y Windows; sync
  empaquetado con sus dependencias de Windows.
- Tres pruebas unitarias del bootstrap y una prueba de integración en PostgreSQL
  temporal: 38 migraciones, login, repetición idempotente, rechazo de clúster ajeno,
  rechazo de una migración alterada y restauración real de un dump en otra base.
- Creación de cuenta mediante el configurador en Windows. El usuario confirmó
  el acceso directo y el inicio de sesión. Los scripts finales se validaron
  mediante preparación y reparación, conservando la instalación.
- Cuatro servicios con inicio automático y cuentas limitadas; las tres rutas de
  salud, la base `algym_windows`, el usuario `algym_app`, la tarea diaria de
  respaldo y los hashes del respaldo pasaron `Test-InstalledAlGym.ps1`.
- Reinicio real de Windows: servicios recuperados sin iniciarlos manualmente.
  El registro de PowerShell muestra `Open-AlGym.ps1` a las 13:58:42 y Chrome se
  abrió con la URL local a las 14:00:49; se observó el panel con la sesión conservada.

La VM usa Windows 11 ARM64 con emulación x64. Quedan por probar el equipo físico
de destino, el reloj biométrico y el ciclo completo de desinstalación/reinstalación.
El paquete crea una base nueva; no contiene los datos de la instalación de desarrollo.

## Migración de Hostinger (0.2.0)

El menú Inicio incluye **AlGym → Importar datos de Hostinger**. La ventana se
abre sin elevación para aceptar arrastrar desde el Explorador; al confirmar,
el trabajador pide permisos de administrador. También se puede abrir al
terminar el instalador con la casilla «Importar un respaldo de Hostinger».

El formato `.algym` contiene solamente datos estructurados e imágenes con hash.
No ejecuta SQL ni scripts del archivo. Comprueba versión y migraciones, cuenta
propietaria, instancia privada y destino recién instalado. Guarda un respaldo
previo y realiza la carga en una transacción, verifica llaves foráneas y las
huellas de todas las filas, ajusta secuencias y registra el hash importado.
El mismo archivo puede reintentarse sin duplicar filas; otro archivo o un destino
con operaciones se rechaza. No es un mecanismo para fusionar dos bases activas.
La cuenta del instalador se sustituye por las cuentas del paquete; no se copian
sesiones de Supabase. El envío de comandos del reloj queda pausado.

Preparación por el operador (en una copia privada, fuera del repositorio):

```sh
python3 windows/extract-hostinger-dump.py origen.dump origen.json \
  --pg-restore /ruta/postgresql/bin/pg_restore \
  --captured-at FECHA_UTC_ISO --archive-clock-commands
node windows/prepare-transfer.mjs origen.json destino.algym /ruta/postgresql/bin
```

Estos comandos pertenecen al backend. El extractor lee COPY sin ejecutar el SQL
del dump. El preparador crea un clúster temporal nuevo, aplica las migraciones
locales y compara las columnas originales antes de generar el paquete. Conserva
la copia temporal detenida para diagnóstico. Si hay imágenes externas, tablas
o columnas operativas sin correspondencia, o falta una cuenta propietaria local,
la preparación se detiene; no omite esos registros silenciosamente.

La opción de archivar órdenes requiere una decisión explícita del operador.
El dump original conserva las órdenes y los datos internos de Supabase; no debe
borrarse después de crear el paquete. La versión actual contempla el caso
confirmado para esta entrega: Storage sin archivos y referencias externas de
imágenes ausentes. La importación de archivos de imagen desde Supabase debe
prepararse antes de generar un paquete que los necesite.

Prueba aislada, sin la base operativa:

```sh
ALGYM_INSTALLER_PG_BIN=/ruta/postgresql/bin node --test windows/transfer.integration.test.mjs
```

Comprueba rollback, referencias inválidas, precisión de bigint/importes, ajuste
de secuencias, destino vacío, versión/instancia, repetición sin duplicados y
compatibilidad con una actualización posterior del instalador.


### Resultado del ensayo de importación — 2026-10-19

El usuario completó la actualización 0.2.0 y la importación desde la ventana
nativa, inició sesión con su cuenta de Hostinger y confirmó clientes y pagos.
Se verificaron las 29 tablas públicas y `auth.identities` fila por fila contra
el paquete. En `auth.users`, únicamente cambió `last_sign_in_at` de una cuenta
tras ese inicio de sesión; los demás valores, incluidos hashes de contraseña,
coinciden. Son 178 clientes, 9 planes, 524 membresías, 551 pagos, 15 904 asistencias,
598 movimientos de caja y 133 rutinas. La cola local está vacía y pausada.

Las 38 migraciones, referencias, identidad del paquete, cuatro servicios,
tres rutas de salud, respaldo previo y tarea diaria pasaron las comprobaciones.
La prueba aislada incluye reversión ante datos inválidos, FK inválida, versión
incompatible, precisión de IDs/importes y reintento sin duplicados.

Instalador: `AlGym-Setup-0.2.0-win-x64.exe`, 86 341 675 bytes.
SHA-256: `d94590f777dbdd07f9b39cbf413a9a16f13f49297e92a29e793a9c5ff4c41726`.
Fuentes del binario: frontend `08b49cb431c89629f8a2e56fff361f50ed57ad0a`,
backend `8d9d81358f02a26ac412c35f1b81c037a15f3c06`. Los runtimes de aplicación
ya compilados para 0.1.0 se reutilizaron: los cambios 0.2.0 son exclusivamente
las herramientas del instalador y la migración, sin cambios en el runtime web.

El respaldo completo y el paquete permanecen privados en la carpeta ignorada
`build/windows/migracion-hostinger-20261019`. El dump conserva 4 987 220 órdenes.
No se ejecutaron escrituras SQL en el VPS. Un intento adicional de exportación
JSON provocó falta de memoria y recuperación automática de PostgreSQL; se
informó al usuario y se continuó exclusivamente desde el dump ya descargado.
La incidencia y el procedimiento de corte están documentados en el informe
privado `LEEME-TRASLADO.txt`. La copia no reemplaza un respaldo final cuando
llegue el traslado definitivo al cliente.


## Importación dentro del sistema (0.3.0)

El flujo vigente es **Administración → Importar datos**, solo para propietarios.
El instalador configura la infraestructura; ya no presenta la casilla de
importación ni crea el acceso directo al formulario externo.

El navegador envía el archivo en streaming al backend local, muestra el resumen
validado y exige confirmación explícita. Las rutas exigen sesión propietaria y
origen permitido; la vista previa se liga a esa cuenta, al hash y a una caducidad.
El progreso usa una capacidad aleatoria temporal que sobrevive al reemplazo de
las sesiones, permite únicamente leer el estado y no aparece en URLs o registros.

`AlGymMigration` es un servicio de mantenimiento sin puerto de escucha. Es el
único proceso nuevo que corre como LocalSystem; los servicios web/backend/sync
conservan LocalService y no reciben la clave administrativa de PostgreSQL.
Consume solamente solicitudes de importación con identificadores y rutas fijas,
revalida la sesión propietaria antes de ejecutar, copia a una carpeta privada,
comprueba el hash y llama al importador instalado. No ejecuta código, SQL ni
rutas proporcionadas por un paquete. El resultado se escribe en un directorio
que LocalService solo puede leer. El archivo cargado se elimina al terminar;
los metadatos y capacidades caducan en 24 horas.

Las escrituras de importación siguen siendo transaccionales, con respaldo
previo y comparación de todas las filas. El envío al reloj queda pausado.
El mutex de mantenimiento evita que un respaldo independiente coincida con
una importación. La instalación y desinstalación administran el nuevo servicio.

Pruebas que no usan la base operativa:

```sh
node --test windows/migration-worker.test.mjs
node --import tsx --test src/modules/migration/migration.routes.test.ts
ALGYM_INSTALLER_PG_BIN=/ruta/postgresql/bin node --test windows/transfer.integration.test.mjs
```

La API de carga tiene su propia validación de origen y sesión, y está excluida
del Proxy de Next para no duplicar en memoria el cuerpo de hasta 256 MB.


### Ensayo web verificado — 2026-10-19

Se compiló 0.3.0 en Windows y se actualizó la VM conservando los datos de 0.2.0.
El usuario seleccionó y confirmó el mismo paquete desde Administración →
Importar datos. El servicio registró `succeeded`; el reintento no duplicó datos
ni dejó el archivo temporal del trabajo completado. Las 29 tablas públicas y
`auth.identities` siguen coincidiendo con el paquete; en `auth.users` solo
difiere `last_sign_in_at` de una cuenta tras el acceso del usuario.

Los cinco servicios y tres rutas de salud respondieron correctamente. Se
verificaron las cuentas de servicio, heartbeat, tarea diaria, hashes del
respaldo y accesos directos del escritorio/inicio automático. El acceso al
importador externo ya no existe en el menú. También se ejecutó un respaldo
bajo el mismo mutex adquirido por el importador, comprobando su reentrada y
la recuperación de servicios. El reinicio real se probó en 0.1.0; no se repitió
en 0.3.0. Esta prueba web fue idempotente; la importación inicial completa se
había validado en 0.2.0, cuyo motor transaccional se conserva.

La compilación nativa, lint/tipos/frontend y pruebas de rutas y del trabajador
pasaron. No se ejecutaron pruebas destructivas sobre la base operativa ni se
accedió a la VPS durante este cambio. Las ramas/HEAD, diffs, estado Git y hashes
de los archivos originales permanecen iguales a la captura inicial.

Ejecutable: `AlGym-Setup-0.3.0-win-x64.exe`, 86 370 265 bytes.
SHA-256: `62e03e9c57c4a706fb6a6d6245afe0650fb4b08394db9ccf02c20eacefdd5c1f`.
Fuentes del binario: frontend `d816993e464bc83bb6b67b67d7cda759d18811d2`,
backend `a4b9f2945ecbadcc9f06a14b79d09279267f5f63`.


## Compatibilidad de la versión 0.3.1 con Windows 10

La versión 0.3.0 fijaba `MinVersion=10.0.22000` en `AlGym.iss`; por eso
Inno Setup rechazaba Windows 10 22H2 (19045) antes de copiar archivos, incluso
con permisos administrativos. La versión 0.3.1 fija `MinVersion=10.0.19045`,
conserva `ArchitecturesAllowed=x64compatible` y no establece `OnlyBelowVersion`.
También admite Windows 11, incluido ARM64 con emulación x64. Windows de 32 bits
sigue excluido. No se modificaron servicios, importación, copias de seguridad,
protecciones de datos ni el valor inicial `SYNC_COMMAND_DELIVERY_PAUSED=true`.

Se mantienen los componentes fijados y sus hashes en `vendors.json`:

- Node.js 24.16.0 x64: su [matriz de plataformas de esa versión](https://github.com/nodejs/node/blob/v24.16.0/BUILDING.md#platform-list)
  incluye Windows 10/Server 2016 o posterior. La política de Node excluye sistemas
  cuyo fabricante haya terminado su soporte; compatibilidad binaria no equivale
  a una garantía de soporte del sistema operativo.
- PostgreSQL 17.11-3 x64, binarios EDB: el [puerto nativo de PostgreSQL 17](https://www.postgresql.org/docs/17/installation-platform-notes.html#PLATFORM-WIN32)
  requiere Windows 10 o posterior. La [matriz de pruebas del distribuidor](https://www.postgresql.org/download/windows/)
  lista Windows Server; la comprobación en Windows 10 x64 sigue siendo necesaria.
- Los scripts usan Windows PowerShell 5.1, WinForms/.NET Framework, servicios,
  CIM, ScheduledTasks y NetSecurity, disponibles en Windows 10. [Referencia de Microsoft](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_windows_powershell_5.1?view=powershell-5.1).
- WinSW 2.12.0 y el redistribuible Visual C++ x64 permanecen sin cambios.
  [Plataformas de WinSW](https://github.com/winsw/winsw/blob/v2.12.0/README.md#supported-platforms)
  y [requisitos del runtime de Microsoft](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist).

La única VM disponible para esta entrega es Windows 11 Pro ARM64. Las pruebas
realizadas y el SHA-256 del ejecutable se entregan por separado con la versión.
Una prueba allí no certifica instalación ni ejecución en Windows 10 x64.


## Exportación desde Windows (0.3.2)

Administración → Exportar para Windows permite conectar una cuenta propietaria
de Hostinger y descargar un `.algym` o el respaldo completo. La autorización
local y la de Hostinger se comprueban por separado. La contraseña no se conserva;
el token remoto permanece solo en memoria durante un máximo de 30 minutos, ligado
a la sesión propietaria local. El navegador recibe una cookie HttpOnly opaca,
SameSite=Strict y limitada a `/api/windows-export`. Reiniciar la web elimina
estas conexiones. Se vuelve a comprobar el propietario activo y la sesión remota
al crear, consultar o descargar una copia.

El instalador incluye únicamente la URL del exportador y su certificado público
en `src/lib/migration/hostinger-config.json`. No incluye claves privadas,
contraseñas de base de datos, claves Supabase ni tokens de usuarios. El cliente
verifica TLS, hostname y caducidad. Pueden reemplazarse juntos mediante
`ALGYM_EXPORT_URL` y `ALGYM_EXPORT_CA_BASE64` en el entorno del servicio web.

Requiere el servicio de exportación con `nativeLogin: true` en `/health` y
`POST /session` habilitado sobre el listener HTTPS existente. El cambio de ese
servicio se prepara en la rama `codex/hostinger-windows-export` del backend y
no forma parte del despliegue del instalador. No ejecutar cambios en la VPS
como efecto de compilar Windows. Las tablas del negocio siguen siendo de lectura
para el exportador; GoTrue gestiona la sesión normal de inicio de sesión.

Se conserva el mínimo Windows 10 22H2 x64, build 19045, y la actualización sobre
0.3.1 usa el respaldo y las protecciones existentes. Instalar una actualización
no requiere volver a importar datos ni cambia la configuración del reloj.


## Ejercicios con MP4 (0.3.3)

El paquete incluye carga y edición de videos MP4 de hasta 20 MB, vista previa
en el catálogo y reproducción con controles en la rutina del cliente. Los GIF
conservan sus bytes y animación; JPG, PNG, WEBP y GIF mantienen el límite de 5 MB.
El servidor y el proxy web soportan peticiones por fragmentos para avanzar en el video.

Los archivos quedan en `C:\ProgramData\AlGym\media\exercises`, con los mismos
permisos y respaldos que las imágenes. La importación `.algym` admite MP4 locales
de ejercicios, verifica su formato, tamaño y hash, y sigue aceptando paquetes
con GIF. No se añaden migraciones ni dependencias de video al instalador.

Al actualizar una instalación existente se utiliza el respaldo y la conservación
de datos del instalador. La versión anterior del EXE no incorpora estos cambios;
se debe usar `AlGym-Setup-0.3.3-win-x64.exe`.

## Carga de ejercicios por lote — 0.3.4

En Ejercicios, el botón **Subir varios archivos** abre una lista previa. Permite
seleccionar varios archivos, seleccionar una carpeta o arrastrarla, incluidas sus
subcarpetas. Cada archivo crea un ejercicio con su nombre sin la extensión; el
nombre se puede corregir antes de subir. Los archivos inválidos y los nombres ya
existentes en el catálogo o repetidos en el lote se señalan y se omiten.

Se procesan uno por uno para conservar los límites individuales (5 MB por imagen
y 20 MB por MP4). Se informa el resultado por archivo y se puede detener la cola
después del archivo actual. No se alteran los GIF/MP4 existentes ni las migraciones.
Las cinco pruebas de la cola se ejecutan como requisito de compilación de Windows.


## Actualizacion incremental y auxiliar SSH — 0.3.5

Administracion > Importar datos > Actualizar este equipo compara el respaldo
original, la base local y la copia nueva. Conserva registros y cambios locales,
reconoce datos ya aplicados y bloquea conflictos para revision. La primera vez
exige el archivo original cuyo SHA-256 coincide con la importacion; luego guarda
la referencia siguiente dentro de la base. La vista previa no aplica cambios.
La aplicacion crea un respaldo, revalida el plan y usa una transaccion. El envio
de comandos al reloj permanece pausado.

El auxiliar independiente esta en `hostinger-download/DESCARGAR-DATOS-HOSTINGER.cmd`.
Lee sus instrucciones y conserva la subcarpeta `Herramientas-Hostinger` a su lado.
Usa OpenSSH de Windows; la contrasena la recibe el cliente SSH directamente.
Reutiliza el exportador ya configurado, crea una copia mediante lectura y solo
publica el archivo descargado tras verificar hashes. No importa automaticamente.

Para clonar los dos repositorios y compilar en la PC del cliente, lee
[CONTINUAR-DESDE-WINDOWS.txt](../../CONTINUAR-DESDE-WINDOWS.txt).
El trabajo debe permanecer separado de los datos instalados. No ejecutar el
preparador general de pruebas sobre bases operativas. Las ramas del exportador
son independientes y no deben desplegarse en la VPS al compilar Windows.

Esta publicacion agrega proteccion de finales de linea para SQL y shell, evitando
que Git para Windows cambie los hashes de migraciones ya instaladas. No modifica
el ejecutable 0.3.5 entregado ni los respaldos privados de la USB. Las pruebas de
Windows disponibles fueron en Windows 11 ARM; Windows 10 x64 sigue pendiente.
