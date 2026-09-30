# Caja local: contrato y límites actuales

La pantalla `/panel/caja` usa la API del backend local para el turno actual. La cookie de sesión local se reenvía desde las acciones de Next.js; el navegador no recibe la contraseña de PostgreSQL. El backend establece `app.current_user_id` dentro de una transacción con la identidad de la sesión validada.

| Método | Ruta | Permiso | Resultado |
| --- | --- | --- | --- |
| GET | `/cash/dashboard` | `cash.operate` u owner | Caja activa, turno propio, sesiones supervisadas para owner, movimientos y totales del turno y movimientos propios fuera de turno del día en Guatemala |
| POST | `/cash/registers/default` | owner o admin con `cash.operate` | Devuelve la caja activa o reactiva/crea `Caja principal` |
| POST | `/cash/sessions` | `cash.operate` u owner | Abre un turno con `registerId`, `openingAmount` y `notes` opcional |
| GET | `/cash/sessions` | `cash.operate` u owner | Historial filtrable por número, fecha, estado, responsable (owner), orden y paginación |
| GET | `/cash/sessions/:id` | `cash.operate` u owner | Detalle del turno propio; owner puede consultar cualquier turno |
| POST | `/cash/sessions/:id/close` | `cash.operate` u owner | Cierra con `countedAmount`, `notes` y `adminPassword` cuando corresponda |

Los importes de entrada son no negativos y admiten dos decimales. El cierre devuelve error cuando hay diferencia sin observación. Un empleado necesita la contraseña de un admin u owner activo; admin, owner o quien tenga `cash.close_without_admin_password` pueden autorizarse a sí mismos. La ruta de cierre limita intentos. La API devuelve 401 sin sesión, 403 sin permiso y 400 en validaciones o reglas de caja.

`0019_cash_local_access.sql` habilita lectura RLS de cajas, sesiones propias y movimientos propios; owner puede supervisar. También da lectura del estado de pagos vinculados a usuarios con permiso financiero. La escritura de apertura y cierre conserva las funciones SQL `open_cash_session` y `close_cash_session` (cinco argumentos), ejecutadas en una transacción local. El backend valida los actores antes de llamar al cierre.

**Pendiente:** movimiento manual, cobros de membresía, venta/anulación de productos, correcciones y reversión de pagos. Esas acciones aún consultan Supabase y no deben usarse como prueba de que toda la caja ya es local. En particular, la comprobación de turno antes de cobrar sigue en la ruta antigua hasta que la escritura del cobro sea local; abrir una caja local no habilita esos cobros. La aceptación financiera requiere una operación completa de cobro/venta y conciliación de pagos, caja, stock y Resumen en la misma base.
