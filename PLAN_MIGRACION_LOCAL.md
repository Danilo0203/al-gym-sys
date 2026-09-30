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
- [x] `B-04` El repositorio backend versiona migraciones hasta `database/migrations/0014_exercise_editor_routine_visibility.sql`; `0012` a `0014` están aplicadas en `algym` local, con respaldo previo a `0013`.
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
- [ ] `P1-02` **Pagos:** migrar listado, detalle, alta, correcciones y reversión a API/transacciones locales. Preservar importes, estados, referencias e historial; adaptar `src/features/payments/actions/get-payments.ts`.
- [ ] `P1-03` **Caja:** migrar apertura/cierre, movimientos, cobros de membresía, venta de productos y anulaciones de `src/features/cash/actions/cash-actions.ts`. Reproducir la atomicidad de las funciones SQL usadas hoy (`open_cash_session`, `attach_payment_to_cash`, `renew_subscription_with_payment`, etc.).
- [ ] `P1-04` **Inventario:** migrar productos, imágenes, entradas/salidas, ajustes y stock de `src/features/inventory/actions/inventory-actions.ts`; coordinar ventas con `P1-03` para no descontar existencias dos veces.
- [ ] `P1-05` **Reconciliación:** comprobar que pagos, caja, stock, membresías y cifras de `src/modules/dashboard/dashboard.service.ts` coinciden en la misma base después de operaciones reales de prueba.

## Fase 2 — Personas, permisos y autoservicio

**Puerta:** crear y administrar un usuario o cliente, iniciar sesión y usar `/mi` funciona sin Supabase Auth/Data API.

- [ ] `P2-01` Implementar administración local de usuarios: crear, cambiar credenciales/estado y desactivar; adaptar `src/features/users/actions/user-actions.ts`. Mantener consistentes `auth.users`, `profiles`, roles y sesiones locales.
- [ ] `P2-02` Migrar CRUD de roles, asignaciones y permisos de `src/features/roles/actions/role-actions.ts`; verificar que el backend aplica la autorización y no confía solo en la interfaz.
- [ ] `P2-03` Auditar y retirar los caminos Supabase restantes en `src/features/customers/actions/customer-actions.ts` sin perder altas, edición de cuenta, salud, membresía ni baja. Conservar sincronización biométrica donde aplique.
- [ ] `P2-04` Migrar perfil, membresía e historial del portal `/mi` desde `src/features/client/server/client-data.ts` a endpoints locales con autorización del propio socio. Validar acceso cruzado entre clientes.
- [ ] `P2-05` Resolver los flujos opcionales de OAuth y recuperación de contraseña: equivalentes locales o desactivación explícita y comprobada. El login con contraseña local existente debe seguir pasando.

## Fase 3 — Ejercicios, rutinas, archivos y mensajes

**Puerta:** catálogo, imágenes y rutinas se leen y modifican localmente; ninguna acción activa requiere Storage o Edge Functions de Supabase.

- [ ] `P3-01` Migrar catálogo de ejercicios, preferencias, búsqueda y plantillas desde `src/features/exercises/actions`, `src/features/routines/actions` y `src/app/panel/ejercicios/page.tsx`. La pantalla de catálogo, el alta manual con imagen y la búsqueda/selección para rutinas ya usan API/archivos locales; faltan generación, asignación, vista del socio y plantillas que aún consultan Supabase.
- [ ] `P3-02` Completar los caminos de generación/importación de `src/features/customers/actions/customer-routine-actions.ts`; sustituir `functions.invoke("exercise-catalog-provider")` por un servicio local o un catálogo local.
- [ ] `P3-03` Migrar imágenes de productos y ejercicios desde Supabase Storage al almacenamiento decidido en `P0-03`; copiar archivos, reescribir URL y comprobar integridad y permisos.
- [ ] `P3-04` Migrar plantillas de mensajes y cualquier consulta/escritura restante de `src/features/messages/actions/message-actions.ts`.
- [ ] `P3-05` Guardar un catálogo suficiente y eliminar la necesidad de ExerciseDB/RapidAPI en tiempo de uso. La búsqueda visible de rutinas usa el catálogo local y ya no consulta el proveedor; faltan imágenes reales de la computadora, volumen/respaldo y prueba de búsqueda y generación sin red. No hay ejercicios en `algym` local todavía.

## Fase 4 — Reloj biométrico y asistencias

**Puerta:** el reloj registra marcajes y recibe comandos con el VPS/Supabase inaccesibles.

- [ ] `P4-01` Sustituir el cliente Supabase de `gym-sync-server/index.js` por API o conexión local con permisos mínimos. Mantener el protocolo ZKTeco y deduplicación de eventos.
- [ ] `P4-02` Migrar cola, confirmaciones y reintentos de `device_commands`; probar registro, desactivación, consulta y reconciliación de usuarios del reloj.
- [ ] `P4-03` Conectar `/panel/asistencias` y los historiales de clientes a los marcajes locales; comprobar zona horaria, identificador biométrico y reglas de acceso por membresía.
- [ ] `P4-04` Probar con reloj real o, si no está disponible, dejar identificada la prueba de hardware como pendiente; un simulador no cierra esta casilla.

## Fase 5 — Operación local reproducible

**Puerta:** una instalación limpia arranca, se respalda y se recupera sin credenciales de Hostinger/Supabase.

- [ ] `P5-01` Incluir PostgreSQL y `algym-local-backend` en `docker-compose.yml` junto con web y sync, con volúmenes persistentes, healthchecks y orden de arranque. Mantener alternativa documentada si el backend corre en el host.
- [ ] `P5-02` Retirar de runtime y ejemplos las variables `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` y URL del VPS una vez migrados sus consumidores; revisar Dockerfile y dependencias del paquete.
- [ ] `P5-03` Implementar respaldos automáticos de PostgreSQL **y archivos**, prueba de restauración en instancia separada y procedimiento de actualización de esquema sin borrar datos. El script actual `database/scripts/restore_local_database.sh` recrea la base y no sirve como respaldo diario.
- [ ] `P5-04` Verificar permisos de DB, RLS/roles heredados, secretos, cookies, acceso a archivos y red local; probar al menos dueño, administrador, empleado y socio.
- [ ] `P5-05` Retirar o hacer opcional `cloudflared` y cualquier descarga o llamada externa necesaria para arrancar o usar funciones esenciales sin internet. `cloudflared` solo se inicia con el perfil `remote-access`; falta auditar el resto del runtime y probar arranque sin red.

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
| P3-01 | Catálogo web y alta manual locales; resto pendiente | Codex | Backend `0c846e5` y migraciones `0013`/`0014`; web `src/features/exercises` | Suite backend 132/132, incluyendo imagen en disco, edición y nombre histórico en rutina; web lint, typecheck y build. Respaldo `/private/tmp/algym-before-exercises-0013.dump`, políticas aplicadas a `algym`, GET sin sesión 401. | Catálogo local real vacío; faltan datos, rutinas, portal y prueba sin red |
| P3-01/P3-05 | Búsqueda y selección de ejercicios locales; entrega parcial | Codex | Backend `c214543`; web `src/features/routines/actions/exercise-search-actions.ts` y selector | GET accesible con permiso de rutinas; 132/132 pruebas backend, lint/typecheck/build web. Eliminada la búsqueda remota visible y el fallback de imágenes remotas en rutinas. | Falta catálogo e imágenes reales; generación y plantillas conservan escrituras/lecturas Supabase |
| P3-05/P5-05 | Sin consulta automática de WorkoutX; túnel opcional | Codex | Web `routine-workspace-shared.tsx`; `docker-compose.yml` | Búsqueda de la API externa y clave embebida eliminada; Compose muestra `sync`/`web` por defecto y añade `cloudflared` solo con `--profile remote-access`. | Web y sync aún usan Supabase; no existe prueba integral sin internet |

**Para un agente que retoma:** escoger el primer ID `[ ]` cuyo prerrequisito esté resuelto, comprobar que el archivo y el estado del repo siguen vigentes, ejecutar solo ese alcance, entregar evidencia y solicitar integración. No inferir que una casilla pendiente está hecha porque existe una función con nombre parecido.
