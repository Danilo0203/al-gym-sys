# Inventario Supabase para migracion local

Fecha de corte: `2026-05-20`

## Alcance revisado

Inventario levantado sobre:

- `all-gym-vf`
- `gym-sync-server`
- `all-gym-vf/supabase/migrations`
- `all-gym-vf/supabase/functions`

## Hallazgos principales

- La autenticacion actual depende de `@supabase/ssr` tanto en cliente como en servidor.
- El control de acceso de backend depende de `supabase.auth.getUser()` y del RPC `get_current_permissions()`.
- La administracion de usuarios depende de `auth.admin.*` y de `auth.users`.
- Hay dos usos reales de Storage: bucket `products` y bucket `exercises`.
- Hay un `Edge Function` real: `exercise-catalog-provider`.
- Hay un uso real de Realtime: suscripcion a `attendance_logs`.
- Caja e inventario dependen de RPC SQL que hoy asumen contexto Supabase/Auth.
- `gym-sync-server` usa `SUPABASE_SERVICE_ROLE_KEY` como acceso total a datos operativos.

## Inventario detallado

| Archivo y simbolo | Categoria | Que hace hoy | Inputs | Outputs | Modulo funcional | Requiere permisos | Toca caja/pagos/inventario | Reemplazo propuesto en backend local |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `all-gym-vf/package.json` `dependencies.@supabase/*` | OTRO | Declara `@supabase/ssr` y `@supabase/supabase-js` como base del runtime web actual. | Variables de entorno Supabase | Clientes SSR/browser/admin | Infraestructura web | No directo | No | Eliminar del runtime final y sustituir por cliente HTTP hacia `Express`. |
| `all-gym-vf/src/lib/supabase/server.ts#createClient` | AUTH | Crea cliente SSR con cookies para server actions, rutas y middleware. | Cookies, `NEXT_PUBLIC_SUPABASE_URL`, publishable key | Cliente autenticado | Infraestructura auth | Implicito por sesion | No | Reemplazar por helper `getSessionFromRequest()` que lea cookie `allgym.sid` y cargue usuario desde PostgreSQL. |
| `all-gym-vf/src/lib/supabase/client.ts#createClient` | AUTH | Crea cliente browser para login, logout y realtime. | URL/key publica | Cliente browser Supabase | Infraestructura auth/UI | No | No | Reemplazar por cliente HTTP interno (`fetch`) y, para realtime, SSE/WebSocket propio o polling. |
| `all-gym-vf/src/lib/supabase/admin.ts#createAdminClient`, `getUserEmail` | USERS_ADMIN | Usa service role para bypass de RLS y lectura de `auth.users`. | `SUPABASE_SERVICE_ROLE_KEY`, `userId` | Cliente admin, email del usuario | Infraestructura admin | Si, acceso total | No | Sustituir por repositorios locales con `pg`/ORM y tabla `users`. |
| `all-gym-vf/src/proxy.ts#proxy` | AUTH | Protege `/panel` y `/mi`, resuelve rol/scope con `profiles` y `roles`, redirige segun sesion Supabase. | Cookies, path, tablas `profiles`/`roles` | Redirect o paso al request | Navegacion/autorizacion | Si, sesion valida | No | Mantener proxy/middleware, pero consultando `Express` o leyendo sesion local firmada. |
| `all-gym-vf/src/components/iniciar-sesion-form.tsx#handleSubmit`, `#handleGoogleLogin` | AUTH | Login con password y OAuth Google; ademas consulta `profiles` y `roles` para ruta post-login. | Email/password u OAuth | Sesion Supabase + redirect | Login UI | No | No | Reemplazar por `POST /api/auth/login`; retirar OAuth del runtime local salvo decision posterior explicita. |
| `all-gym-vf/src/features/auth/hooks/use-hook-form-auth.ts#onSubmit` | AUTH | Variante legacy del login con password y consulta de rol/scope. | Email/password | Redirect post-login | Login UI legacy | No | No | Reapuntar a `POST /api/auth/login`; unificar con `LoginForm`. |
| `all-gym-vf/src/app/auth/callback/route.ts#GET` | AUTH | Intercambia codigo OAuth por sesion y resuelve ruta por rol. | `code`, `next` | Redirect autenticado | Login OAuth | No | No | Dejar fuera de Fase 1 local; si OAuth se conserva, moverlo al backend local. |
| `all-gym-vf/src/app/auth/forgot-password/page.tsx#ForgotPasswordPage` | AUTH | Inicia recuperacion con `signInWithOtp`. | Email | OTP por correo | Recuperacion de cuenta | No | No | Sustituir por `POST /api/auth/forgot-password`; para LAN, permitir modo admin-reset y correo opcional. |
| `all-gym-vf/src/app/auth/verify-code/page.tsx#VerifyCodePage` | AUTH | Verifica OTP de Supabase. | Email, token | Sesion temporal de recuperacion | Recuperacion de cuenta | No | No | Sustituir por `POST /api/auth/verify-reset-code` o flujo local de token temporal. |
| `all-gym-vf/src/app/auth/reset-password/page.tsx#ResetPasswordPage` | AUTH | Actualiza contrasena del usuario autenticado via `auth.updateUser`. | Nueva contrasena | Cambio de credencial | Recuperacion de cuenta | No | No | Sustituir por `POST /api/auth/reset-password` y hash `argon2`. |
| `all-gym-vf/src/lib/auth/client-sign-out.ts#signOutCurrentUser` | AUTH | Cierra sesion local de Supabase y limpia cache PWA. | Cookie/sesion actual | Logout | Auth cliente | No | No | Reemplazar por `POST /api/auth/logout`; mantener limpieza PWA. |
| `all-gym-vf/src/lib/auth/authorization.ts#getUserAccessContext` | AUTH | Obtiene usuario autenticado, rol y permisos por `profiles`, `roles` y RPC `get_current_permissions()`. | Sesion actual | `UserAccessContext` | Autorizacion transversal | Si | No | Reemplazar por middleware `requireSession` + `loadAccessContext(userId)` usando SQL local. |
| `all-gym-vf/src/features/profile/actions/profile-actions.ts#getCurrentUser`, `updateProfile`, `updatePassword` | AUTH | Lee perfil actual, resuelve permisos y cambia password validando contra `auth.signInWithPassword`. | Sesion, datos de perfil, password actual/nueva | Perfil y mutaciones | Perfil del usuario | Si, usuario autenticado | No | Reemplazar por `/api/auth/me`, `/api/me/profile`, `/api/me/password`. |
| `all-gym-vf/src/features/client/server/client-data.ts#requireAuthenticatedUser`, `getCurrentClientProfileData`, `getCurrentClientMembershipData`, `getCurrentClientRoutineData` | QUERY_DIRECTA | Lee perfil del cliente autenticado y arma payloads de `/api/me/*`. | Sesion actual | JSON para app cliente | Portal cliente | Si, sesion `client` | No | Mantener contratos `/api/me/*`, pero resolver todo desde `Express` con SQL local. |
| `all-gym-vf/src/app/api/panel/clientes/route.ts#GET` | QUERY_DIRECTA | Busca clientes activos para UI administrativa. | `query`, `offset`, `limit`, sesion | JSON paginado | Clientes admin | Si, admin/panel | No | Mover a `GET /api/panel/clientes`. |
| `all-gym-vf/src/features/users/actions/user-actions.ts#listAllAuthUsers`, `getUsers`, `createUser`, `updateUser`, `deleteUser` | USERS_ADMIN | Lista usuarios combinando `auth.users` + `profiles`; crea, actualiza y borra usuarios con Admin API. | Datos de usuario, password, rol | CRUD usuarios | Usuarios admin | Si, `users.*` | No | Sustituir por tabla local `users`, sincronizada con `profiles`, sin `auth.users`. |
| `all-gym-vf/src/features/roles/actions/role-actions.ts#getRoles`, `getPermissions`, `getRolePermissions`, `createRole`, `updateRole`, `deleteRole` | USERS_ADMIN | Gestiona roles, permisos y conteos de usuarios mezclando `profiles` y `auth.users`. | Datos de rol/permisos | CRUD roles | Roles y permisos | Si, `roles.*` | No | Mantener tablas `roles`, `permissions`, `role_permissions`; contar usuarios desde tabla local `users/profiles`. |
| `all-gym-vf/src/features/customers/actions/customer-actions.ts#createCustomer`, `getCustomerById`, `updateCustomer`, `renewSubscription`, `deleteCustomer`, `reactivateCustomer`, `permanentlyDeleteCustomer` | USERS_ADMIN | Crea usuario auth + perfil + suscripciones + pagos; sincroniza reloj biometrico; borra/reactiva clientes. | Payload cliente, plan, pagos, biometria | Perfil cliente y efectos colaterales | Clientes | Si, `customers.*`, `payments.*` | Si, pagos | Repartir en servicios locales `customers`, `subscriptions`, `payments`, `device-sync`; sustituir `auth.admin` por `users`. |
| `all-gym-vf/src/features/customers/actions/customer-history-actions.ts#getCustomerProfile`, `getCustomerKPIs`, `getAccessHistory`, `getPaymentHistory`, `getSubscriptionHistory`, `getBodyAssessmentHistory`, `getAccessHeatmapData` | QUERY_DIRECTA | Lee historial consolidado del cliente y usa email desde `auth.users`. | `customerId` | KPIs e historiales | Historial cliente | Si, `customers.view` | Si, pagos | Mantener consultas SQL, leer email desde tabla local `users`. |
| `all-gym-vf/src/features/customers/actions/customer-routine-actions.ts#callExerciseCatalogFunction`, `upsertTrainingProfile`, `generateRoutineProposal` | EDGE_FUNCTION | Invoca `exercise-catalog-provider`; ademas hace CRUD local de rutinas/perfiles con Supabase admin/server clients. | Query de ejercicio, perfil entrenamiento | Busqueda/importacion y rutinas | Rutinas/entrenamiento | Si, `routines.*`, `exercises.view` | No | Mover proveedor externo a servicio backend `exercise-provider`; dejar CRUD de rutinas sobre PostgreSQL local. |
| `all-gym-vf/src/features/routines/actions/exercise-search-actions.ts#searchExerciseProvider`, `importExerciseFromProvider` | EDGE_FUNCTION | Invoca el `Edge Function` para buscar/importar ejercicios externos. | Query o ejercicio externo | Lista/registro de ejercicios | Catalogo ejercicios | Si, `routines.view` | No | Reemplazar por `POST /api/exercises/provider/search` y `POST /api/exercises/provider/import`. |
| `all-gym-vf/src/features/customers/components/customer-tables/customer-table.tsx#CustomerTable` | REALTIME | Escucha cambios `postgres_changes` en `attendance_logs` para refrescar ultimo ingreso. | Biometric IDs visibles | UI reactiva | Clientes/asistencia | No | No | Reemplazar por SSE/WebSocket propio o polling corto al backend local. |
| `all-gym-vf/src/features/inventory/actions/inventory-actions.ts#uploadProductImage`, `getProductsListing`, `saveProduct`, `recordInventoryMovement`, `adjustProductStock`, `getInventoryMovements` | STORAGE | Sube imagenes al bucket `products`; lee vista `product_inventory_overview`; usa RPC de inventario. | FormData, producto, movimiento | URLs publicas y mutaciones | Inventario | Si, `products.*`, `inventory.*` | Si, inventario | Reemplazar Storage por filesystem local y RPC por SQL/servicio interno. |
| `all-gym-vf/src/features/exercises/actions/exercise-actions.ts#ensureExerciseMediaBucket`, `updateExerciseCatalogItem`, `saveExerciseMediaToLocal`, `createExerciseCatalogItem` | STORAGE | Crea bucket `exercises`, guarda media publica y actualiza catalogo. | Archivos, metadatos ejercicio | URLs y mutaciones | Ejercicios | Si, `exercises.*` | No | Reemplazar por storage local `uploads/exercises` y tabla `exercises.image_url` local. |
| `all-gym-vf/src/features/cash/actions/cash-actions.ts#resolveCashCloseAuthorizer`, `openCashSession`, `closeCashSession`, `runCreateSubscriptionPaymentForExistingCustomer`, `runRenewSubscriptionWithPayment`, `reverseAndRecreatePayment`, `sellProductsFromCashSession`, `voidProductSaleFromCashSession` | RPC | Valida password de admins con `auth.signInWithPassword`; mezcla lecturas directas con RPC SQL para caja/pagos. | Sesion, montos, IDs, notas | Sesiones caja, pagos, ventas, reversos | Caja y pagos | Si, `cash.*`, `payments.*`, `inventory.sell` | Si, caja/pagos/inventario | Mantener logica transaccional en PostgreSQL o moverla a servicio local, pero sin depender de `auth.uid()` ni `auth.admin`. |
| `all-gym-vf/src/features/payments/actions/get-payments.ts#getPayments` | QUERY_DIRECTA | Lee vista `payments_overview` con filtros y ordenamiento. | Pagina, filtros, sort | Lista paginada | Pagos | Si, `payments.view` | Si, pagos | Mantener misma consulta desde `GET /api/payments`. |
| `all-gym-vf/src/features/plans/actions/plan-actions.ts#getPlans`, `getPlanById`, `createPlan`, `updatePlan`, `deletePlan` | QUERY_DIRECTA | CRUD directo de `plans`. | ID y payload plan | Planes | Planes | Si, `plans.*` | No | Mover a `Express` sin Supabase client. |
| `all-gym-vf/src/features/plans/components/plan-listing.tsx#PlanListing` | QUERY_DIRECTA | Lee `plans` directo en server component. | Filtros pagina | Listado UI | Planes | Si, `plans.view` | No | Consumir `GET /api/plans`. |
| `all-gym-vf/src/features/overview/actions/panel-actions.ts#getDashboardKPIs`, `getRevenueByMonth`, `getPlanDistribution`, `getRecentPayments`, `getExpiringSubscriptions`, `getInactiveCustomers`, `getSubscriptionsFlow`, `getPaymentMethodDistribution` | QUERY_DIRECTA | Arma dashboard con consultas directas a `payments`, `subscriptions` y vistas relacionadas. | Rango de fechas y limites | KPIs y series | Resumen/dashboard | Si, `dashboard.view` implicito | Si, pagos | Reapuntar a servicios read-only en `Express`. |
| `all-gym-vf/src/features/customers/components/customer-listing.tsx#CustomerListing`, `customer-view-page.tsx#CustomerViewPage` | QUERY_DIRECTA | Carga listados, planes, overview y ultimos accesos directamente desde tablas/vistas. | Filtros y `customerId` | UI de clientes | Clientes | Si | No | Reapuntar a endpoints de clientes. |
| `all-gym-vf/src/lib/fitness/routine-generator.ts#generateRoutineFromTemplates` | QUERY_DIRECTA | Lee templates, rutinas y ejercicios para generar una rutina. | Perfil/plantillas | Rutina + inserts | Rutinas | Si, flujo interno | No | Mantener logica pero usando repositorios locales. |
| `all-gym-vf/supabase/functions/exercise-catalog-provider/index.ts` | EDGE_FUNCTION | Proxy autenticado a ExerciseDB; exige usuario admin via Supabase y service role. | Authorization header, operacion, query/exerciseId | Respuesta JSON de busqueda/importacion | Ejercicios externos | Si, admin | No | Migrar a modulo interno de `Express` o worker local; ya no usar Edge Functions. |
| `all-gym-vf/supabase/migrations/20251223000000_initial_remote_schema.sql`, `20260512_void_product_sale_from_cash_session.sql`, `20260513005245_cash_close_authorization.sql` | RPC | Definen esquema, vistas, RLS y RPCs que hoy viven bajo convenciones Supabase. | SQL versionado actual | DB remota funcional | Base de datos | Si, por grants/RLS | Si, caja/pagos/inventario | Reusar como baseline, eliminar acoplamientos a Supabase Auth/RLS y administrar migraciones localmente. |
| `gym-sync-server/index.js` | QUERY_DIRECTA | Servicio biometrico usa service role para `profiles`, `subscriptions`, `device_commands`, `attendance_logs`; expone API token interna. | HTTP ADMS, token interno, payloads del reloj | Cola de comandos, logs, asistencia | Sync biometrico | Si, token interno | No | Conectar directo a PostgreSQL local o a `Express` interno; eliminar `SUPABASE_SERVICE_ROLE_KEY`. |
| `gym-sync-server/package.json` `dependencies.@supabase/supabase-js` | OTRO | Declara dependencia del servicio biometrico al cliente JS de Supabase. | Variables Supabase | Cliente total DB | Infraestructura sync | No directo | No | Sustituir por driver Postgres o cliente HTTP interno. |

## RPC actuales en uso

| RPC | Call sites actuales | Dependencia problematica | Reemplazo local sugerido |
| --- | --- | --- | --- |
| `get_current_permissions()` | `lib/auth/authorization.ts`, `features/profile/actions/profile-actions.ts` | Depende de `auth.uid()` implicito | Cambiar a `get_user_permissions(p_user_id uuid)` o resolver permisos en backend. |
| `open_cash_session(...)` | `features/cash/actions/cash-actions.ts` | Hoy vive en Supabase y usa contexto auth SQL | Mantener como SQL local o mover a servicio transaccional. |
| `close_cash_session(...)` | `features/cash/actions/cash-actions.ts` | Ya tiene version con `p_requested_by_user_id` y `p_closed_by_user_id`, pero sigue atada a runtime Supabase | Mantener y ejecutar desde backend local con auditoria. |
| `attach_payment_to_cash(...)` | `features/cash/actions/cash-actions.ts` | Usa actores y cash session en DB | Mantener como SQL local o integrar en servicio `cash`. |
| `create_subscription_payment_for_existing_customer(...)` | `features/cash/actions/cash-actions.ts` | Orquesta suscripcion + pago + caja; grants Supabase | Mantener en SQL local o partir en servicio transaccional. |
| `renew_subscription_with_payment(...)` | `features/cash/actions/cash-actions.ts` | Igual que anterior | Igual que anterior. |
| `reverse_and_recreate_payment(...)` | `features/cash/actions/cash-actions.ts` | Operacion critica con auditoria | Mantener transaccional en backend local. |
| `sell_products_from_cash_session(...)` | `features/cash/actions/cash-actions.ts` | Afecta pagos, caja e inventario | Mantener transaccional y sin `auth.uid()`. |
| `void_product_sale_from_cash_session(...)` | `features/cash/actions/cash-actions.ts` | Reversa inventario y caja | Mantener transaccional y sin `auth.uid()`. |
| `record_product_inventory_movement(...)` | `features/inventory/actions/inventory-actions.ts` | Usa contexto auth SQL | Cambiar a `p_actor_user_id` explicito o mover a servicio inventory. |
| `adjust_product_stock(...)` | `features/inventory/actions/inventory-actions.ts` | Usa contexto auth SQL | Igual que arriba. |

## Buckets y features nativas de Supabase

### Storage

- Bucket `products`
  - usado por `features/inventory/actions/inventory-actions.ts`
  - publico
  - debe migrarse a `C:\ProgramData\AllGym\uploads\products\`

- Bucket `exercises`
  - usado por `features/exercises/actions/exercise-actions.ts`
  - publico
  - debe migrarse a `C:\ProgramData\AllGym\uploads\exercises\`

### Realtime

- Canal `customers-last-check-in`
  - usado por `features/customers/components/customer-tables/customer-table.tsx`
  - escucha `postgres_changes` en `attendance_logs`
  - reemplazo sugerido: SSE local desde `Express` o polling cada 10-15 s

### Edge Functions

- `exercise-catalog-provider`
  - invocado desde `customer-routine-actions.ts` y `exercise-search-actions.ts`
  - reemplazo sugerido: modulo `exercise-provider` dentro de `api-local`

## Acoplamientos que bloquean retirar Supabase del runtime

1. `auth.users` como fuente de email y lifecycle de usuarios.
2. `auth.uid()` dentro de SQL/RPC.
3. `@supabase/ssr` como sesion principal de la app.
4. `storage` publico para imagenes de productos y ejercicios.
5. `realtime` para asistencias en vivo.
6. `SUPABASE_SERVICE_ROLE_KEY` en `all-gym-vf` y `gym-sync-server`.

## Prioridad de reemplazo recomendada

1. `AUTH`
   - `login`, `logout`, `me`, middleware y `getUserAccessContext`
2. `USERS_ADMIN`
   - tabla local `users`, gestion de roles y emails
3. `RPC`
   - `get_current_permissions`, caja e inventario
4. `STORAGE`
   - buckets `products` y `exercises`
5. `EDGE_FUNCTION`
   - proveedor externo de ejercicios
6. `REALTIME`
   - ultimo ingreso de clientes
7. `gym-sync-server`
   - conexion directa a PostgreSQL local
