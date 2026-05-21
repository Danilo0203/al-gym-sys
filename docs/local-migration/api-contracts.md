# Contratos iniciales del backend local

Fecha de corte: `2026-05-20`

## Objetivo de esta fase

Definir los contratos minimos que permiten sacar a Supabase del runtime y arrancar la migracion con la primera meta tecnica:

- `login local sin Supabase`
- `logout local sin Supabase`
- `me local sin Supabase`

La UI seguira usando rutas relativas `/api/...` y `Next.js` seguira actuando como proxy interno hacia `Express`.

## Reglas globales

- Base publica: `http://IP_SERVIDOR:3000`
- Backend interno: `http://127.0.0.1:4000`
- Todas las respuestas JSON deben incluir `requestId`.
- Todas las mutaciones `POST`, `PUT`, `PATCH`, `DELETE` deben exigir CSRF token.
- La cookie de sesion debe ser `httpOnly`, `sameSite=lax`, `path=/`.
- `secure=false` en despliegue LAN HTTP.
- `secure=true` solo si luego se habilita HTTPS.
- La UI no debe conocer credenciales de DB ni secretos internos.

## Sesion local propuesta

- Cookie: `SESSION_COOKIE_NAME`
- Valor actual en desarrollo local: `allgym_session`
- Valor: token opaco aleatorio de 32 bytes minimo
- Persistencia: tabla `user_sessions`
- TTL inicial sugerido: `7 dias`
- Renovacion: sliding session en requests autenticados
- Logout: invalidacion server-side + expiracion de cookie

## Contratos minimos de auth

## Gateway Next.js para Fase 5

La UI no debe llamar directo a `127.0.0.1:4000`.

Para el primer bloque de Fase 5, `Next.js` expone y proxyea:

- `POST /api/auth/login` -> `API_INTERNAL_URL/auth/login`
- `POST /api/auth/logout` -> `API_INTERNAL_URL/auth/logout`
- `GET /api/auth/me` -> `API_INTERNAL_URL/auth/me`

Reglas:

- el navegador solo consume rutas relativas `/api/...`
- `Next.js` reenvia cookies `httpOnly` del backend
- `Set-Cookie` vuelve al navegador desde el gateway de `Next.js`
- `API_INTERNAL_URL` debe ser `http://127.0.0.1:4000`
- `WEB_LOCAL_ORIGIN` y `WEB_PUBLIC_ORIGIN` deben seguir apuntando a la UI
- no se elimina todavia todo `Supabase` del frontend; la migracion sigue siendo gradual

Validacion de este bloque:

- `2026-05-20`: validado contra `http://127.0.0.1:3000/api/auth/login`
- `2026-05-20`: validado contra `http://127.0.0.1:3000/api/auth/logout`
- `2026-05-20`: validado contra `http://127.0.0.1:3000/api/auth/me`
- la cookie `httpOnly` se mantiene via `Next.js`
- no fue necesario exponer llamadas del navegador directo a `http://127.0.0.1:4000`

## Runtime `allgym-web` standalone para Windows

Para el siguiente corte de Fase 5, `allgym-web` se empaqueta como `Next.js standalone` y se publica como servicio Windows separado.

Variables runtime minimas:

- `PORT=3000`
- `HOSTNAME=127.0.0.1`
- `API_INTERNAL_URL=http://127.0.0.1:4000`
- `WEB_LOCAL_ORIGIN=http://127.0.0.1:3000`
- `WEB_PUBLIC_ORIGIN=http://localhost:3000`

Reglas:

- `allgym-web` expone la UI y las rutas relativas `/api/...`
- el backend `api-local` sigue siendo interno en `127.0.0.1:4000`
- `Electron` debe abrir `http://127.0.0.1:3000` cuando el servicio este disponible
- no se migra todavia ningun modulo de negocio fuera de auth
- `Supabase` permanece solo como dependencia gradual en rutas aun no migradas

Validacion tecnica del bundle standalone:

- `2026-05-20`: `npm run build:windows:web` genero `.next/standalone`
- `2026-05-20`: el staging incluyo `ProgramFiles/AllGym/allgym-web/server.js`
- `2026-05-20`: `GET http://127.0.0.1:3000/api/health` respondio `200 OK` desde el bundle staged
- `2026-05-20`: `GET http://127.0.0.1:3000/` respondio con redirect a `/iniciar-sesion`
- `2026-05-20`: `POST /api/auth/login`, `GET /api/auth/me` y `POST /api/auth/logout` funcionaron desde el bundle staged

Validacion real en Windows VM:

- `2026-05-20`: `allgym-web.exe status` respondio `Active (running)`
- `2026-05-20`: `GET http://127.0.0.1:3000/api/health` respondio `200 OK` con `{"ok":true,"service":"web"}`
- `2026-05-20`: `GET http://127.0.0.1:3000` cargo la UI real de login
- `2026-05-20`: `Electron` abrio `http://127.0.0.1:3000` como app de escritorio minima
- `2026-05-20`: `api-local` y `allgym-web` quedaron operando juntos como servicios locales
- `2026-05-20`: `AllGym-Setup.exe` quedo validado para este bloque en la VM
- `2026-05-20`: `login/logout/me` siguieron funcionando por `/api/auth/*` despues de la instalacion

Pendiente:

- prueba completamente desde cero con `PostgreSQL` y configuracion inicial en Windows limpio

### `POST /api/auth/login`

Uso inicial de Fase 3. Sustituye:

- `supabase.auth.signInWithPassword`
- lecturas posteriores a `profiles`
- lecturas posteriores a `roles`

Request:

```json
{
  "email": "admin@allgym.local",
  "password": "plain-text-password"
}
```

Response `200`:

```json
{
  "requestId": "req_123",
  "user": {
    "id": "uuid",
    "email": "admin@allgym.local",
    "full_name": "Administrador",
    "role": "admin",
    "roleScope": "panel",
    "permissions": ["users.view", "payments.view"]
  },
  "redirectTo": "/panel/resumen",
  "mustChangePassword": false
}
```

Errores:

- `401 invalid_credentials`
- `403 user_inactive`
- `423 password_change_required`

### `POST /api/auth/logout`

Request: sin body.

Response `204`: sin contenido.

Efectos:

- invalida `SESSION_COOKIE_NAME`
- limpia cookie
- mantiene limpieza de caches PWA del lado cliente

### `GET /api/auth/me`

Sustituye la resolucion de sesion hoy repartida entre:

- `proxy.ts`
- `lib/auth/authorization.ts`
- `features/profile/actions/profile-actions.ts`

En Fase 5 bloque 1, este contrato ya queda conectado al backend local via gateway `Next.js`.

Response `200`:

```json
{
  "requestId": "req_123",
  "authenticated": true,
  "user": {
    "id": "uuid",
    "email": "admin@allgym.local",
    "full_name": "Administrador",
    "role": "admin",
    "roleScope": "panel",
    "permissions": ["users.view", "roles.view"],
    "isOwner": false
  }
}
```

Response `401`:

```json
{
  "requestId": "req_123",
  "error": "unauthorized",
  "message": "Authentication required",
  "details": null
}
```

### `POST /api/auth/change-password`

Sustituye `profile-actions.updatePassword`.

Request:

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

Response `200`:

```json
{
  "requestId": "req_123",
  "success": true
}
```

### `POST /api/auth/forgot-password`

No es bloqueante para la primera meta, pero debe quedar definido.

Request:

```json
{
  "email": "user@example.com"
}
```

Response `202`:

```json
{
  "requestId": "req_123",
  "accepted": true
}
```

Notas:

- En instalacion local puede resolverse primero con tokens locales y reset asistido por admin.
- Si luego se habilita correo SMTP, este contrato no cambia.

### `POST /api/auth/verify-reset-code`

Request:

```json
{
  "email": "user@example.com",
  "code": "12345678"
}
```

Response `200`:

```json
{
  "requestId": "req_123",
  "resetToken": "opaque-temporary-token"
}
```

### `POST /api/auth/reset-password`

Request:

```json
{
  "resetToken": "opaque-temporary-token",
  "newPassword": "new-password"
}
```

Response `200`:

```json
{
  "requestId": "req_123",
  "success": true
}
```

## Contratos derivados inmediatos

Estos ya existen conceptualmente en Next.js y deben conservarse para no romper la UI.

### `GET /api/me/profile`

Sustituye `src/app/api/me/profile/route.ts`.

Response:

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Cliente",
    "phone": "55555555",
    "birth_date": "1990-01-01",
    "gender": "male",
    "avatar_url": "/files/avatars/uuid.webp",
    "role": "client",
    "created_at": "2026-05-20T00:00:00.000Z",
    "updated_at": "2026-05-20T00:00:00.000Z",
    "overview": {}
  },
  "meta": {
    "fetched_at": "2026-05-20T00:00:00.000Z"
  }
}
```

### `GET /api/me/membership`

Sustituye `src/app/api/me/membership/route.ts`.

### `GET /api/me/routine`

Sustituye `src/app/api/me/routine/route.ts`.

### `GET /api/panel/clientes`

Sustituye `src/app/api/panel/clientes/route.ts`.

Query params:

- `query`
- `offset`
- `limit`

## Contratos de storage local

### `POST /api/storage/products`

Multipart upload para imagen de producto.

Request:

- `file`
- `productId`

Response `201`:

```json
{
  "requestId": "req_123",
  "path": "products/catalog/<productId>/<file>.webp",
  "publicUrl": "/files/products/catalog/<productId>/<file>.webp"
}
```

### `POST /api/storage/exercises`

Multipart upload para media de ejercicios.

### `GET /files/*`

Servidor local de archivos para imagenes y assets publicos.

Notas:

- El backend debe guardar archivos en `C:\ProgramData\AllGym\uploads\`.
- El path publico no debe exponer rutas fisicas Windows.

## Contratos criticos de caja, pagos e inventario

Estos reemplazan los RPCs actuales y pueden implementarse como endpoints REST aunque por debajo usen SQL transaccional.

### Caja

- `POST /api/cash/sessions`
  - abre caja
- `POST /api/cash/sessions/:id/close`
  - cierra caja
- `GET /api/cash/dashboard`
  - resume caja actual

### Pagos

- `POST /api/payments/subscription-existing-customer`
  - reemplaza `create_subscription_payment_for_existing_customer`
- `POST /api/payments/subscription-renewal`
  - reemplaza `renew_subscription_with_payment`
- `POST /api/payments/:id/reverse-and-recreate`
  - reemplaza `reverse_and_recreate_payment`
- `GET /api/payments`
  - reemplaza `payments_overview`

### Inventario

- `GET /api/inventory/products`
  - reemplaza `product_inventory_overview`
- `POST /api/inventory/products`
  - crea/actualiza producto
- `POST /api/inventory/movements`
  - reemplaza `record_product_inventory_movement`
- `POST /api/inventory/stock-adjustments`
  - reemplaza `adjust_product_stock`
- `GET /api/inventory/movements`
  - listado historico

### Ventas de producto

- `POST /api/cash/product-sales`
  - reemplaza `sell_products_from_cash_session`
- `POST /api/cash/product-sales/:id/void`
  - reemplaza `void_product_sale_from_cash_session`

## Contexto de autorizacion

El backend debe construir un `AccessContext` unico por request:

```ts
type AccessContext = {
  userId: string
  email: string
  role: "owner" | "admin" | "trainer" | "employee" | "client"
  roleScope: "panel" | "client"
  permissions: string[]
  isOwner: boolean
}
```

Reglas:

- la UI no decide permisos
- el backend siempre valida permisos
- los endpoints mutantes registran auditoria

## CSRF

Contratos sugeridos:

- Cookie no `httpOnly`: `allgym.csrf`
- Header requerido: `X-CSRF-Token`
- Comparacion strict-equal en mutaciones autenticadas

Endpoints que deben exigirlo desde el inicio:

- `/api/auth/logout`
- `/api/auth/change-password`
- todos los endpoints de caja
- todos los endpoints de inventario
- todos los endpoints de usuarios/clientes/roles

## Decisiones de compatibilidad para la UI actual

- Mantener rutas relativas `/api/...`
- Mantener forma de payloads de `/api/me/*`
- Mantener redirects por `role` y `roleScope`
- Mantener `401 unauthorized` como senal de sesion expirada
- Mantener nombres de dominio funcional: `customers`, `payments`, `inventory`, `cash`, `routines`

## Primera meta tecnica cerrada

La implementacion minima que desbloquea la migracion es:

1. `POST /api/auth/login`
2. `POST /api/auth/logout`
3. `GET /api/auth/me`
4. cookie `allgym.sid`
5. middleware `Express` para sesion
6. adaptacion de `proxy.ts` y `getUserAccessContext()` para dejar de leer Supabase
