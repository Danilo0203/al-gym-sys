# Plan de migración completa a operación local

**Estado:** en curso · **Rama de integración:** `codex/local-unified-test` en ambos repositorios · **Alcance:** `al-gym-sys` (web y sincronización ZKTeco) y `algym-local-backend` (API y PostgreSQL).

**Rutas en las tareas:** `src/features` y `src/app` son relativos a `al-gym-sys/all-gym-vf`; `src/modules` y `database` son relativos al repositorio hermano `algym-local-backend`; `gym-sync-server` y `docker-compose.yml` son relativos a `al-gym-sys`.

## Objetivo y criterio de cierre

La aplicación debe poder arrancar y ejecutar **todos los flujos usados por el gimnasio** con PostgreSQL, API, web, archivos y sincronización biométrica locales, **sin internet**, Hostinger ni los servicios de Supabase. La base local será la única fuente de verdad. El cierre exige probarlo con la red externa bloqueada; que la página cargue o que compile no demuestra independencia.

`auth.users` y otras tablas heredadas pueden permanecer **dentro de PostgreSQL local** mientras sean necesarias para compatibilidad. Eliminar la dependencia significa retirar las llamadas a Supabase Auth, Data API, Storage y Edge Functions, no necesariamente renombrar el esquema SQL.

ExerciseDB/RapidAPI y Cloudflare Tunnel son dependencias externas distintas de Hostinger/Supabase. Como el requisito final es operar **sin internet**, `P3-05` y `P5-05` son obligatorias antes de cerrar `P6-04`. Las imágenes de ejercicios deben proceder de archivos locales de la computadora, con rutas persistentes y respaldo.

## Cómo usar este documento con varios agentes

1. Cada casilla tiene un ID estable. Un agente toma un paquete de trabajo y declara en su entrega: **ID, repositorio, rama/commit o PR, archivos, pruebas y bloqueos**. No marque una casilla solo porque escribió código.
2. Trabajar en ramas o worktrees separados a partir de `codex/local-unified-test`. Un agente integra los cambios y actualiza **este checklist** después de revisar el merge. Así se evitan ediciones simultáneas del mismo documento.
3. La casilla se marca `[x]` solo cuando el cambio está incorporado a `codex/local-unified-test` en los repositorios afectados, las pruebas del paquete pasan y existe evidencia reproducible. Registrar esa evidencia en la tabla de seguimiento. Si falta una comprobación, dejar `[ ]` y anotar el bloqueo.
4. Antes de empezar, leer el `AGENTS.md` aplicable y verificar rama, árbol de trabajo, migraciones y base de datos. Los trabajos de API + web acuerdan primero contrato HTTP, permisos y formato de errores.
5. Las migraciones SQL, `src/app.ts`, `docker-compose.yml` y este archivo tienen **integrador único**. Asignar el siguiente número de migración al integrar para evitar colisiones. Las pruebas del backend usan `algym_test` y la recrean; nunca apuntarlas a `algym` ni al VPS.
6. Ningún agente ejecuta restauraciones destructivas, importaciones finales, cambio de fuente de verdad o apagado del VPS como parte de una tarea de implementación. Son puertas separadas de `P6`.

### Estado inicial comprobado en la rama de integración

- [x] `B-01` Ambas ramas `codex/local-unified-test` existen y apuntan a los repositorios correctos.
- [x] `B-02` El backend ofrece autenticación/sesiones, perfil y Resumen local (`src/modules/auth`, `profile`, `dashboard`).
- [x] `B-03` El backend ofrece clientes, historial, salud, membresías y operaciones de rutinas (`src/modules/customers`, `memberships`, `customer-routines`). **Esto no afirma que todas las pantallas de esos dominios hayan dejado Supabase.**
- [x] `B-04` El repositorio backend versiona migraciones hasta `database/migrations/0015_client_portal_plan_history.sql`; `0012` a `0015` están aplicadas en `algym` local, con respaldos previos a `0013` y `0015`.
- [ ] `B-05` Prueba integral sin conexión al VPS/Supabase. Pendiente; es la puerta final de este plan.

## Paquetes paralelos y dependencias

| Carril | Agente / área | Puede empezar | Dependencia para integrar |
| --- | --- | --- | --- |
| A | Finanzas: planes, pagos y caja | `P0-01` | Contratos y transacciones de pagos/caja; integrar planes primero |
| B | Identidad, permisos, clientes y portal del socio | `P0-01` | Contratos de usuarios/roles antes de adaptar pantallas |
| C | Catálogo, rutinas, imágenes y mensajes | `P0-01` | Estrategia de archivos `P0-03` antes de migrar Storage |
| D | ZKTeco, comandos y asistencias | `P0-01` | Contrato local de dispositivo/asistencia y membresías |
| E | Entorno, respaldos y observabilidad | Inmediato | Integrar Compose definitivo tras fijar API y almacenamiento |

Un paquete dentro de un carril puede avanzar en paralelo con otros carriles. Dentro de **caja/pagos** y **usuarios/permisos** hay dependencias de datos: integrar el backend antes de cambiar las escrituras de la web. Evitar dos agentes modificando la misma función SQL o tabla sin coordinar el contrato.

## Fase 0 — Inventario, contratos y línea base

**Puerta:** existe una matriz verificable de cada operación y un entorno de pruebas que no pueda escribir en el VPS.

- [x] `P0-01` Inventariar por pantalla y operación (lectura, alta, edición, borrado) el origen actual y el destino local. Incluye caja, pagos, planes, inventario, clientes, socio, usuarios, roles, mensajes, ejercicios, rutinas y asistencias. **Entregable:** `docs/migracion-local/INVENTARIO.md`; actualizarlo al descubrir nuevos caminos.
- [ ] `P0-02` Definir contratos HTTP, permisos/RLS, errores y transacciones para los módulos faltantes; documentar qué tablas y funciones SQL heredadas se conservan. **Entregable:** especificación corta por carril revisada por quien integra.
- [ ] `P0-03` Definir almacenamiento local de imágenes/archivos, ruta persistente, límites, autorización, URL y respaldo; inventariar objetos existentes en Supabase Storage. **Diseño y API base:** `docs/migracion-local/ALMACENAMIENTO_LOCAL.md`, backend `/media`, web `/api/media`. **Pendiente:** conectar entidades, volumen/respaldo, conteos de objetos del origen y carpeta de imágenes del usuario.
- [x] `P0-04` Preparar datos de prueba y verificación aislada: PostgreSQL de pruebas, usuario por rol y comprobaciones de que ningún test apunta al VPS. `src/test/prepare-db.ts` exige `algym_test`, restringe `DB_HOST`, `PGHOST` y `PGHOSTADDR` a loopback, limpia configuraciones PG heredadas y siembra roles sintéticos. `pnpm test` recrea exclusivamente esa base.
- [ ] `P0-05` Definir cómo se hará el corte: respaldo inicial, ventana sin escrituras, importación incremental/final, reconciliación y reversión. **Entregable:** runbook revisable; no ejecutarlo aún.

## Fase 1 — Una sola fuente para finanzas y existencias

**Puerta:** una operación de venta o membresía cambia la base local y el Resumen refleja ese mismo cambio, sin escribir en Supabase.

- [ ] `P1-01` **Planes:** `POST`, `PUT` y `DELETE` lógico en el backend, con validación, permisos y pruebas; web conectada. `0012_plans_local_writes.sql` fue aplicada a `algym` local después de crear un respaldo. **Pendiente para cerrar:** prueba de lectura y escritura con red externa bloqueada.
- [ ] `P1-02` **Pagos:** migrar listado, detalle, alta, correcciones y reversión a API/transacciones locales. Preservar importes, estados, referencias e historial; adaptar `src/features/payments/actions/get-payments.ts`. **Avance:** API atómica de alta/renovación de pago de membresía con RLS `0020`, formularios de alta y renovación de Caja conectados a esa transacción con ficha, y corrección/reversión de pagos de membresía visibles en caja con RLS `0021`; faltan detalle/correcciones fuera de caja y prueba autenticada de la interfaz.
- [ ] `P1-03` **Caja:** migrar apertura/cierre, movimientos, cobros de membresía, venta de productos y anulaciones de `src/features/cash/actions/cash-actions.ts`. **Avance:** panel, historial/detalle, configuración de caja principal, apertura/cierre, ingresos/retiros manuales, corrección de pagos de membresía, validación de caja abierta y búsqueda/ficha compacta del cliente conectados al backend local con permisos/RLS. Los formularios de alta y renovación de Caja escriben cliente, membresía, pago, movimiento, ficha y snapshot nutricional calculado en una transacción local. **Pendiente:** generación local de rutinas, sincronización del reloj, prueba autenticada desde la UI, ventas, anulaciones de productos y reconciliación.
- [ ] `P1-04` **Inventario:** migrar productos, imágenes, entradas/salidas, ajustes y stock de `src/features/inventory/actions/inventory-actions.ts`; coordinar ventas con `P1-03` para no descontar existencias dos veces.
- [ ] `P1-05` **Reconciliación:** comprobar que pagos, caja, stock, membresías y cifras de `src/modules/dashboard/dashboard.service.ts` coinciden en la misma base después de operaciones reales de prueba.

## Fase 2 — Personas, permisos y autoservicio

**Puerta:** crear y administrar un usuario o cliente, iniciar sesión y usar `/mi` funciona sin Supabase Auth/Data API.

- [x] `P2-01` La administración de usuarios internos usa `/users` del backend local: listado, alta, nombre/rol/contraseña, activar/desactivar y baja lógica. Cambiar contraseña/rol o desactivar revoca sesiones; la baja conserva historial. La migración `0018` permite perfiles internos sin datos biométricos y protege el último propietario. La prueba integral sin red sigue en `P6-03`.
- [ ] `P2-02` Migrar CRUD de roles, asignaciones y permisos de `src/features/roles/actions/role-actions.ts`; verificar que el backend aplica la autorización y no confía solo en la interfaz. **Avance:** catálogo y permisos ya usan `/roles` local con transacciones, RLS y protección de roles del sistema. **Pendiente:** asignar roles personalizados a usuarios. `profiles.role` aún es `public.user_role` fijo; requiere ajustar el modelo y las políticas heredadas antes de habilitar la asignación.
- [ ] `P2-03` Auditar y retirar los caminos Supabase restantes en `src/features/customers/actions/customer-actions.ts` sin perder altas, edición de cuenta, salud, membresía ni baja. Conservar sincronización biométrica donde aplique.
- [ ] `P2-04` Migrar perfil, membresía e historial del portal `/mi` desde `src/features/client/server/client-data.ts` a endpoints locales con autorización del propio socio. Las tres lecturas ya usan `/me/*` local; la prueba de acceso cruzado pasó. Faltan prueba de la UI sin red externa y tratamiento local de avatares históricos.
- [x] `P2-05` OAuth y recuperación por correo quedaron deshabilitados explícitamente. El formulario ya no conserva el cliente OAuth, sus banderas de build se retiraron, las rutas antiguas muestran desactivación y el login con contraseña local sigue pasando en la suite del backend.

## Fase 3 — Ejercicios, rutinas, archivos y mensajes

**Puerta:** catálogo, imágenes y rutinas se leen y modifican localmente; ninguna acción activa requiere Storage o Edge Functions de Supabase.

- [ ] `P3-01` Migrar catálogo de ejercicios, preferencias, búsqueda y plantillas desde `src/features/exercises/actions`, `src/features/routines/actions` y `src/app/panel/ejercicios/page.tsx`. La pantalla de catálogo, el alta manual con imagen y la búsqueda/selección para rutinas ya usan API/archivos locales; faltan generación, asignación, vista del socio y plantillas que aún consultan Supabase.
- [ ] `P3-02` Completar los caminos de generación/importación de `src/features/customers/actions/customer-routine-actions.ts`; sustituir `functions.invoke("exercise-catalog-provider")` por un servicio local o un catálogo local.
- [ ] `P3-03` Migrar imágenes de productos y ejercicios desde Supabase Storage al almacenamiento decidido en `P0-03`; copiar archivos, reescribir URL y comprobar integridad y permisos.
- [x] `P3-04` Plantillas de mensajes migradas a `/messages` y PostgreSQL local con permisos, RLS y CRUD probado. La preparación de mensajes copia texto sin abrir enlaces de WhatsApp.
- [ ] `P3-05` Guardar un catálogo suficiente y eliminar la necesidad de ExerciseDB/RapidAPI en tiempo de uso. La búsqueda visible de rutinas usa el catálogo local y ya no consulta el proveedor; faltan volumen/respaldo y prueba de búsqueda y generación sin red. No hay ejercicios en `algym` local todavía. El usuario confirmó el 30 de septiembre que aún no dispone de imágenes para importar; la importación real queda pendiente de esos archivos.

## Fase 4 — Reloj biométrico y asistencias

**Puerta:** el reloj registra marcajes y recibe comandos con el VPS/Supabase inaccesibles.

- [x] `P4-01` Sync usa PostgreSQL local con el rol limitado `algym_sync`; ya no carga el SDK de Supabase. El protocolo iClock y la deduplicación (también con estados nulos) pasaron las pruebas de integración. La prueba con el dispositivo real sigue en `P4-04`.
- [x] `P4-02` Cola, confirmaciones por SN y reintentos de `device_commands` usan PostgreSQL local. Registro, desactivación, consulta y reconciliación pasaron en `algym_test`.
- [x] `P4-03` `/panel/asistencias` consulta el sync local; los historiales de clientes consultan el backend local. Fechas y filtros se interpretan en `America/Guatemala`; las pruebas cubren ID biométrico y vencimiento de membresía. Falta aceptación visual sin red en `P6-03`.
- [ ] `P4-04` Probar con reloj real o, si no está disponible, dejar identificada la prueba de hardware como pendiente; un simulador no cierra esta casilla.

## Fase 5 — Operación local reproducible

**Puerta:** una instalación limpia arranca, se respalda y se recupera sin credenciales de Hostinger/Supabase.

- [ ] `P5-01` Incluir PostgreSQL y `algym-local-backend` en `docker-compose.yml` junto con web y sync, con volúmenes persistentes, healthchecks y orden de arranque. **Avance:** backend en Compose, saludable con PostgreSQL del host y media persistente; PostgreSQL adicional en perfil `container-db` con volumen aislado y restauración probada. **Pendiente:** corte a una única instancia, conectar backend/sync al servicio `postgres` y verificar el stack completo sin internet.
- [ ] `P5-02` Retirar de runtime y ejemplos las variables `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` y URL del VPS una vez migrados sus consumidores; revisar Dockerfile y dependencias del paquete.
- [ ] `P5-03` Implementar respaldos automáticos de PostgreSQL **y archivos**, prueba de restauración en instancia separada y procedimiento de actualización de esquema sin borrar datos. `database/scripts/backup_local_database.sh` crea un paquete manual verificado de DB + media; `restore_snapshot_to_container.py` lo restaura en un PostgreSQL Docker vacío, incluidos roles globales y archivos. La prueba de otra instancia recuperó 140 perfiles, 263 pagos, 6080 asistencias y un archivo de prueba. **Pendiente:** programación, retención, destino externo, imágenes reales y procedimiento de actualización de esquema.
- [ ] `P5-04` Verificar permisos de DB, RLS/roles heredados, secretos, cookies, acceso a archivos y red local; probar al menos dueño, administrador, empleado y socio.
- [ ] `P5-05` Retirar o hacer opcional `cloudflared` y cualquier descarga o llamada externa necesaria para arrancar o usar funciones esenciales sin internet. `cloudflared` solo se inicia con el perfil `remote-access`; los botones de mensajes ahora copian texto sin abrir `wa.me`. Falta auditar el resto del runtime y probar arranque sin red.

## Fase 6 — Corte y aceptación

**Puerta final:** datos reconciliados, flujos completos probados y ningún servicio necesario depende del VPS/Supabase.

- [ ] `P6-01` Con respaldo verificado y ventana de corte acordada, detener escrituras al origen, importar el delta final de PostgreSQL, usuarios y archivos; conservar IDs y relaciones. Registrar fecha/hora y conteos antes/después.
- [ ] `P6-02` Reconciliar por entidad: usuarios, clientes, planes, membresías, pagos, sesiones de caja, productos, existencias, rutinas, asistencias, comandos y archivos. Resolver diferencias antes del cierre.
- [ ] `P6-03` Ejecutar prueba de aceptación con la red externa bloqueada: login, creación de cliente/usuario, plan, membresía, cobro/cierre/reversión, venta/stock, rutina/imagen **desde archivo local**, portal del socio, marcaje ZKTeco, Resumen y restauración de respaldo. Registrar resultados y logs sin secretos.
- [ ] `P6-04` Eliminar configuración y claves ya innecesarias; rotar credenciales expuestas, incluida la antigua clave de WorkoutX que estuvo embebida en código; apagar Hostinger/Supabase **solo después** de confirmar `P6-01` a `P6-03` y mantener un respaldo recuperable.

## Validación mínima por entrega

- **Backend:** `pnpm typecheck`, pruebas enfocadas y `pnpm test` cuando se cambien rutas, SQL o permisos; `pnpm build`. `pnpm test` recrea `algym_test`.
- **Web:** seguir `all-gym-vf/AGENTS.md`; lint de archivos tocados, `npx tsc --noEmit`, `npm run build`; ejecutar además pruebas de auth cuando se toque ese flujo.
- **Sync:** pruebas del parser/protocolo y prueba de integración con DB local; hardware real para cerrar `P4-04`.
- **Cada módulo migrado:** registrar una prueba de lectura y escritura con Supabase/VPS bloqueados, además de un caso 401/403 y una comprobación de que no dejó escrituras en el origen remoto.

## Registro de avance

Agregar una fila por paquete al integrarlo. Esta tabla complementa las casillas; no sustituye sus pruebas.

| ID | Estado | Responsable | Repo / commit o PR | Evidencia (comando, resultado, escenario) | Fecha / bloqueo |
| --- | --- | --- | --- | --- | --- |
| B-01 a B-04 | Base verificada por código y rama | — | `codex/local-unified-test` en ambos repos | Rutas y migraciones indicadas arriba; no equivale a aceptación integral | Estado inicial |
| P0-01 | Hecho | Codex | `al-gym-sys` `ecae278` | Inventario por módulo y operación en `docs/migracion-local/INVENTARIO.md` | 2026-09-29 |
| P1-01 | Implementado; falta puerta offline | Codex | Backend `e4cbfda`; web `ecae278` | Backend: `pnpm typecheck`, `pnpm test` 128/128, `pnpm build`; web: lint enfocado, `npx tsc --noEmit`, `npm run build`. Respaldo local en `/private/tmp/algym-before-plans-0012.dump`; migración aplicada a `algym`; `POST /plans` sin sesión respondió 401. | Falta lectura/escritura con red externa bloqueada |
| P0-03 | Diseño, API y alta manual de ejercicios | Codex | Backend `457db7e`, `0c846e5`; web `src/app/api/media`, `src/features/exercises` y `docs/migracion-local/ALMACENAMIENTO_LOCAL.md` | DB local: 0 ejercicios, 0 productos, sin `storage.objects`; web pública: 4 iconos PWA. API de subida/lectura local; alta manual conecta imagen en disco y fila local. | Faltan inventario remoto, ruta de archivos, productos, volumen y respaldo |
| P0-04 | Hecho | Codex | Backend `6f2a793` | `pnpm test` 130/130 en `algym_test`; `DB_HOST` y `PGHOST` remotos rechazados antes de recrear DB; roles sintéticos `admin`, `employee`, `owner`, `trainer`, `client`. | 2026-09-29 |
| P1-02 | Listado local implementado; resto pendiente | Codex | Backend `6f2a793`; web `src/features/payments/actions/get-payments.ts` | GET `/payments`: filtros, orden, paginación, 401/403; suite backend 130/130; lint, typecheck y build web. | Faltan alta, detalle, corrección, reversión y puerta offline |
| P1-03 | Panel de turno, historial/detalle, caja principal y apertura/cierre locales; entrega parcial | Codex | Backend `b7e951a`, `8726673` (`/cash`, migración `0019`); web `cash-actions.ts`; contrato `CAJA_LOCAL.md` | Backend `pnpm test` 138/138, typecheck/build; web lint/typecheck/build. Prueba de historial/detalle con filtros, owner y aislamiento entre empleados. Respaldo `/private/tmp/algym-before-cash-0019.dump` verificado; migración aplicada a `algym` sin cambiar 3 sesiones ni 301 movimientos. Lectura real: 3 sesiones, detalle accesible. Contenedor backend: `/health/ready` 200, historial/detalle sin sesión 401. | Movimientos, cobros, ventas y anulaciones aún dependen de Supabase; falta prueba de UI y sin red |
| P3-01 | Catálogo web y alta manual locales; resto pendiente | Codex | Backend `0c846e5` y migraciones `0013`/`0014`; web `src/features/exercises` | Suite backend 132/132, incluyendo imagen en disco, edición y nombre histórico en rutina; web lint, typecheck y build. Respaldo `/private/tmp/algym-before-exercises-0013.dump`, políticas aplicadas a `algym`, GET sin sesión 401. | Catálogo local real vacío; faltan datos, rutinas, portal y prueba sin red |
| P3-01/P3-05 | Búsqueda y selección de ejercicios locales; entrega parcial | Codex | Backend `c214543`; web `src/features/routines/actions/exercise-search-actions.ts` y selector | GET accesible con permiso de rutinas; 132/132 pruebas backend, lint/typecheck/build web. Eliminada la búsqueda remota visible y el fallback de imágenes remotas en rutinas. | Falta catálogo e imágenes reales; generación y plantillas conservan escrituras/lecturas Supabase |
| P3-05/P5-05 | Sin consulta automática de WorkoutX; túnel opcional | Codex | Web `routine-workspace-shared.tsx`; `docker-compose.yml` | Búsqueda de la API externa y clave embebida eliminada; Compose muestra `sync`/`web` por defecto y añade `cloudflared` solo con `--profile remote-access`. | Web y sync aún usan Supabase; no existe prueba integral sin internet |
| P5-03 | Respaldo manual DB + media; entrega parcial | Codex | Backend `a9832ed` | `pg_dump` y tar con hashes verificados; restauración de prueba en otra base local (0 ejercicios, 0 productos, 140 perfiles) y comparación de un archivo de prueba recuperado. Host remoto rechazado. | Falta automatización, ubicación y retención finales, imágenes reales y restauración en otra instancia |
| P2-04 | Lecturas del portal local; puerta offline pendiente | Codex | Backend `3c765b1` y migración `0015`; web `src/features/client/server/client-data.ts` | `pnpm test` 133/133 con 401, aislamiento entre dos socios y plan histórico inactivo; backend typecheck/build, web lint/typecheck/build. Respaldo `/private/tmp/algym-before-client-portal-0015.dump` verificado; política aplicada en `algym` local; endpoint vivo sin sesión respondió 401. | Faltan prueba visual y con red externa bloqueada; avatares remotos se ocultan hasta importarlos |
| P2-05 | Hecho: OAuth y recuperación opcional deshabilitados | Codex | Web formulario de login, rutas `/auth/*`, Dockerfile y Compose | `pnpm test` 134/134 incluye login local; lint/typecheck/build web. GET de recuperación respondió 200 con aviso; callback OAuth respondió 307 a `oauth_disabled`; pantalla de login solo ofrece correo/contraseña. | Recuperación por correo no disponible; el cambio de contraseña autenticado permanece |
| P3-04 | Hecho: plantillas locales | Codex | Backend `131fad6`, migración `0016`; web `message-actions.ts` | `pnpm test` 134/134 incluye sesión, permisos, RLS y CRUD; backend typecheck/build, web lint/typecheck/build. Respaldo `/private/tmp/algym-before-messages-0016.dump` verificado; migración aplicada a `algym` local con una plantilla existente preservada; endpoint vivo sin sesión respondió 401. | Falta prueba integral de interfaz sin red externa |
| P5-05 | Enlaces de WhatsApp reemplazados por copia local | Codex | Diálogo de clientes y tablero de vencimientos | No quedan referencias a `wa.me` ni a la apertura de WhatsApp en `all-gym-vf/src`; lint, typecheck y build web. | Pendientes otros caminos remotos y prueba integral sin red |
| P4-01 a P4-03 | Sync local integrado; reloj físico pendiente | Codex | Backend migración `0017`; web `gym-sync-server`, panel de asistencias | `npm test` 4/4 con PostgreSQL `algym_test`, backend `pnpm test` 134/134, web lint/typecheck/build. Respaldo `/private/tmp/algym-before-sync-0017.dump` verificado; `0017` aplicada a `algym`. Contenedor sync saludable en `127.0.0.1:8080`, lectura autenticada de asistencia local 200 y sin token 401. | `P4-04` requiere reloj real; `P5-01` aún no incluye PostgreSQL/backend en Compose |
| P2-01 | Usuarios internos locales | Codex | Backend `/users` y migración `0018`; web `user-actions.ts` y formulario | Prueba de sesión, permisos, alta, duplicado, contraseña, cambio de rol, activación, baja, RLS y último owner. Backend `pnpm test` 135/135, typecheck/build; web lint/typecheck/build. Respaldo `/private/tmp/algym-before-users-0018.dump` verificado y migración aplicada a `algym`; `/users` vivo sin sesión devolvió 401. | Aceptación integral sin internet en `P6-03` |
| P2-02 | Catálogo y permisos locales; asignación pendiente | Codex | Backend `/roles`; web `role-actions.ts` | Backend `pnpm test` 136/136, typecheck/build; web lint enfocado, typecheck/build. La prueba de roles verifica 401/403, RLS, CRUD, permisos y roles protegidos. | `profiles.role` enum fijo impide asignar slugs nuevos; falta modelo y revisión de RLS heredada |
| P5-01/P5-03 | Backend en Compose y restauración en otra instancia; entrega parcial | Codex | Backend `Dockerfile` y `restore_snapshot_to_container.py`; web `docker-compose.yml`, `STACK_LOCAL.md` | Imagen backend construida; backend saludable en `127.0.0.1:4001` con `algym` del host y media escribible. Ensayo Docker aislado: 140 perfiles, 263 pagos, 6080 asistencias; backend de la copia `/health/ready` 200 y `/payments` sin sesión 401. Restauración automatizada con un archivo de prueba y rechazo al sobrescribir una base existente. | Falta corte a un único PostgreSQL, respaldos programados y aceptación integral sin internet |
| P1-02/P1-03 | API de cobro de membresía local; interfaz pendiente | Codex | Backend `0d8d1e7`, migración `0020`; web `CAJA_LOCAL.md` | Alta y renovación atómicas en `algym_test`: membresía, pago y movimiento de caja; 401/403, sesión obligatoria, duplicado, owner y método tarjeta. `pnpm test` 139/139, typecheck/build. Respaldo `/private/tmp/algym-before-membership-0020.dump` verificado; `0020` aplicada a `algym` con 263 pagos, 249 membresías y 301 movimientos preservados. Contenedor backend saludable en `:4001`; POST sin sesión 401. | Formulario de caja aún usa Supabase; faltan integración UI, venta/stock y prueba sin internet |
| P1-03 | Ingresos y retiros manuales locales | Codex | Backend `23a06da`; web `cash-dashboard-client.tsx`, `cash-actions.ts` | `pnpm test` 139/139 cubre 401, validación, caja ajena/cerrada, efectivo esperado y cierre; backend typecheck/build. Web lint enfocado, TypeScript y build. Backend reconstruido en `:4001`, `/health/ready` 200 y POST sin sesión 401. | Falta aceptación visual y sin red; cobros y ventas siguen pendientes |
| P1-02/P1-03 | Corrección y reversión local de pagos de membresía visibles en caja | Codex | Backend `3c7273b`, migración `0021`; web `cash-actions.ts` y botones de caja | Transacción de reverso, pago reemplazado y dos movimientos; `pnpm test` 139/139 incluye owner, admin, 401/403 y doble reverso; backend typecheck/build. Respaldo `/private/tmp/algym-before-reversal-0021.dump` verificado; `0021` aplicada a `algym` sin alterar 263 pagos ni 301 movimientos. Contenedor backend saludable en `:4001`, POST sin sesión 401. Web lint enfocado, TypeScript y build; lint global aún falla por 5 errores existentes en archivos ajenos a este cambio. | Falta aceptación visual y sin red; alta/renovación desde UI, venta/anulación de productos y correcciones fuera de caja aún usan caminos remotos |
| P1-03 | Lectura local de clientes durante el cobro | Codex | Web `cash-actions.ts`; backend existente `/cash/dashboard`, `/customers`, `/customers/:id/history` y `/customers/:id/routine` | La validación de caja abierta, la búsqueda y la ficha compacta de cliente ya consultan PostgreSQL local. Web lint enfocado, TypeScript y build. La evaluación corporal y el perfil de entrenamiento solo se incluyen cuando los permisos locales permiten su lectura. | Aún falta prueba visual/autenticada y sin internet; el envío del formulario de cobro/renovación todavía escribe por Supabase |
| P1-02/P1-03 | Alta local de cliente con cobro atómico; interfaz pendiente | Codex | Backend `8d4e74f`; contrato `CAJA_LOCAL.md` | `POST /customers` acepta `paid_membership`; la prueba cubre cliente, membresía, pago y movimiento en una transacción, además de reversión completa sin caja o con importe inválido. Backend `pnpm test` 139/139, typecheck y build. | El formulario web sigue sin conectar; faltan efectos de rutina y nutrición, prueba desde la UI y sin internet |
| P1-03/P2-03 | Ficha inicial local en alta con cobro; interfaz pendiente | Codex | Backend `624cbc2`, migración `0022`; contrato `CAJA_LOCAL.md` | `POST /customers` guarda evaluación, perfil de salud y entrenamiento en la transacción de alta. `pnpm test` 139/139, prueba RLS directa, typecheck y build. Respaldo `/private/tmp/algym-before-intake-0022-20260930T193138Z.dump` verificado; `0022` aplicada a `algym` con 140 perfiles, 263 pagos y 301 movimientos preservados. | Faltan generación de rutina, conexión del formulario y aceptación sin internet |
| P1-03/P2-03 | Cálculo y snapshot nutricional local durante el alta | Codex | Backend `78d29fa`, migración `0023`; contrato `CAJA_LOCAL.md` | Evaluación y snapshot vinculado a la membresía se guardan en la misma transacción si hay datos completos. `pnpm test` 139/139, typecheck y build. Respaldo `/private/tmp/algym-before-nutrition-0023-20260930T194026Z.dump` verificado; política aplicada a `algym` sin cambiar 140 perfiles, 263 pagos, 0 snapshots ni 301 movimientos. | Falta generación local de rutinas, integración UI y aceptación sin internet |
| P1-03/P2-03 | Renovación local con ficha y snapshot | Codex | Backend `4ad0590`, migración `0024`; contrato `CAJA_LOCAL.md` | `POST /payments/membership` guarda pago, cambios de perfil, salud, evaluación, entrenamiento y snapshot en una transacción. La prueba verifica el aislamiento RLS fuera de ella. `pnpm test` 139/139, typecheck y build. Respaldo `/private/tmp/algym-before-renewal-intake-0024-20260930T194943Z.dump` verificado; `0024` aplicada a `algym` sin cambiar 140 perfiles, 263 pagos, 0 snapshots ni 301 movimientos. | Faltan generación local de rutinas y aceptación sin internet |
| P1-02/P1-03 | Formularios de alta y renovación de Caja conectados al backend local | Codex | Web `cash-customer-actions.ts`, `local-customer-intake.ts`, formularios; backend existente `4ad0590` | Cargas de alta mínima, alta con evaluación y renovación verificadas contra los esquemas Zod del backend; lint enfocado, `npx tsc --noEmit` y `npm run build` completados. Las acciones reenvían la cookie local y usan las transacciones de `/customers` y `/payments/membership`. | Falta prueba autenticada desde la UI y sin internet; la rutina automática y el reloj biométrico aún no se sincronizan |

**Para un agente que retoma:** escoger el primer ID `[ ]` cuyo prerrequisito esté resuelto, comprobar que el archivo y el estado del repo siguen vigentes, ejecutar solo ese alcance, entregar evidencia y solicitar integración. No inferir que una casilla pendiente está hecha porque existe una función con nombre parecido.
