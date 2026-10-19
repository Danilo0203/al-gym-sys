# Instalador nativo de AlGym para Windows

El instalador instala la web, el backend, sync, Node.js x64 y PostgreSQL 17.
No requiere Docker, WSL, Node ni PostgreSQL preinstalados en la computadora destino.
Se compila en Windows; no se deben copiar dependencias compiladas en macOS/Linux.
Destino: Windows 11 de 64 bits. Windows ARM puede ejecutar el paquete mediante
emulación x64; se debe probar también el hardware final del gimnasio.

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
  -BackendPath ..\algym-local-backend -Version 0.1.0
```

La construcción necesita internet para dependencias y herramientas. Descarga los
componentes fijados en `vendors.json`, verifica SHA-256, instala los paquetes con
sus lockfiles, compila la aplicación y produce:

`build\windows\AlGym-Setup-0.1.0-win-x64.exe`

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
