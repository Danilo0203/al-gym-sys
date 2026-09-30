# Caja local: contrato y límites actuales

La pantalla `/panel/caja` usa la API del backend local para el turno actual. La cookie de sesión local se reenvía desde las acciones de Next.js; el navegador no recibe la contraseña de PostgreSQL. El backend establece `app.current_user_id` dentro de una transacción con la identidad de la sesión validada.

| Método | Ruta | Permiso | Resultado |
| --- | --- | --- | --- |
| GET | `/cash/dashboard` | `cash.operate` u owner | Caja activa, turno propio, sesiones supervisadas para owner, movimientos y totales del turno y movimientos propios fuera de turno del día en Guatemala |
| POST | `/cash/registers/default` | owner o admin con `cash.operate` | Devuelve la caja activa o reactiva/crea `Caja principal` |
| POST | `/cash/sessions` | `cash.operate` u owner | Abre un turno con `registerId`, `openingAmount` y `notes` opcional |
| POST | `/cash/sessions/:id/movements` | `cash.operate` u owner | Registra ingreso o retiro manual de efectivo en una caja abierta, con motivo obligatorio |
| GET | `/cash/sessions` | `cash.operate` u owner | Historial filtrable por número, fecha, estado, responsable (owner), orden y paginación |
| GET | `/cash/sessions/:id` | `cash.operate` u owner | Detalle del turno propio; owner puede consultar cualquier turno |
| POST | `/cash/sessions/:id/close` | `cash.operate` u owner | Cierra con `countedAmount`, `notes` y `adminPassword` cuando corresponda |
| POST | `/payments/membership` | `cash.operate` y `customers.manage_membership`, u owner | Crea o renueva una membresía, registra el pago y vincula el movimiento de caja en una transacción |
| GET | `/payments/:id/reversal-context` | `cash.operate` u owner | Muestra el importe, estado, cliente y plan de un pago local |
| POST | `/payments/:id/reverse` | `cash.operate`, `cash.reverse_payment` y `customers.manage_membership`, u owner | Reversa un pago de membresía y registra el reemplazo y ambos movimientos en una transacción |

Los importes de entrada son no negativos y admiten dos decimales. El cierre devuelve error cuando hay diferencia sin observación. Un empleado necesita la contraseña de un admin u owner activo; admin, owner o quien tenga `cash.close_without_admin_password` pueden autorizarse a sí mismos. La ruta de cierre limita intentos. La API devuelve 401 sin sesión, 403 sin permiso y 400 en validaciones o reglas de caja.

`0019_cash_local_access.sql` habilita lectura RLS de cajas, sesiones propias y movimientos propios; owner puede supervisar. También da lectura del estado de pagos vinculados a usuarios con permiso financiero. La escritura de apertura y cierre conserva las funciones SQL `open_cash_session` y `close_cash_session` (cinco argumentos), ejecutadas en una transacción local. El backend valida los actores antes de llamar al cierre.

`POST /payments/membership` recibe `customerId`, `planId`, `operation` (`create` o `renew`) y opcionalmente `startDate`, `endDate`, `amountOriginal`, `discountAmount`, `amountPaid`, `graceDays`, `paymentMethod` y `requireSession`. Con `requireSession: true` exige una caja abierta del cajero y rechaza el cobro si no queda asociado a ella. La renovación vence la membresía activa anterior; si ya venció por fecha, el inicio sugerido no retrocede antes del día actual de Guatemala. La migración `0020_membership_payments_local.sql` autoriza la inserción de pagos bajo RLS. La API devuelve los identificadores de membresía, pago y movimiento para conciliación.

`POST /cash/sessions/:id/movements` acepta `movementType` (`manual_income` o `withdrawal`), `amount` positivo y `note` de 3 a 500 caracteres. Fija la categoría en `other` y el método en efectivo; usa `record_manual_cash_movement` para comprobar que la caja siga abierta y pertenezca al cajero (owner puede supervisar). La pantalla registra estos movimientos en la caja local y actualiza el efectivo esperado. Son movimientos operativos, no pagos de membresía ni ventas.

La corrección de un pago de membresía visible en caja usa `/payments/:id/reversal-context` y `/payments/:id/reverse`. La migración `0021_local_payment_reversal.sql` añade la política RLS necesaria para actualizar el estado del pago original. El backend exige un motivo, bloquea dos correcciones del mismo pago y conserva los importes originales en el historial. El movimiento de reverso incluye siempre el ID del pago en su nota para identificar la cadena desde el detalle de caja.

**Pendiente:** conectar los formularios de cobro/renovación con la API local y migrar los demás efectos que esos formularios aún escriben por Supabase; venta y anulación de productos. La interfaz de cobro todavía usa su ruta antigua: abrir una caja local no habilita esos cobros. La aceptación financiera requiere una operación completa desde la interfaz y conciliación de pagos, caja, stock y Resumen en la misma base.
