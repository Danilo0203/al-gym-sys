# Reloj local: sincronización y recepción

La inscripción o renovación se guarda en la base antes de que el reloj confirme
su autorización. Una respuesta satisfactoria de `/api/device-users/reconcile`
significa que se concilió la cola; no sustituye el `return_code` del equipo.

## Configuración

- `SYNC_COMMAND_DELIVERY_PAUSED=true` conserva la cola y recibe marcajes, pero
  no entrega cambios. Antes de habilitarla, respaldar y conciliar el estado actual.
- `ZK_DEVICE_IP` y `ZK_DEVICE_SERIAL` permiten validar un inventario TCP completo
  antes de crear usuarios ausentes. Los usuarios existentes conservan sus datos.
- `ZK_COMMAND_BATCH_SIZE` admite de 1 a 20 órdenes por respuesta, 1 por defecto.
  Una orden permanece pendiente hasta su confirmación; los lotes conservan sus
  bloqueos hasta confirmar todas las órdenes o vencer el tiempo de reintento.

La conciliación sustituye órdenes de estado obsoletas conservando sus filas con
`SUPERSEDED_RECONCILE`. No consume consultas, enrolamientos, borrado de usuarios
ni de plantillas. La autorización se envía después de crear un usuario ausente.
Un estado ya confirmado no vuelve a generarse en cada consulta del reloj.

## Recepción

Las fichas de usuario con `StartTime`/`EndTime` no son marcajes. Los eventos con
claves exactas `Time` y `Pin` se validan; un `Pin=0` con fecha y evento válidos se
confirma como evento del dispositivo y se registra en `DEVICE_EVENT_NO_PERSON`,
sin crear asistencia. Las filas malformadas siguen recibiendo una respuesta de
reintento. Los marcajes se deduplican mediante el índice existente de la base.

Las respuestas de `/iclock/querydata` usan `tabla=cantidad`, quitan el relleno
NUL observado en el firmware y no imprimen cuerpos ni plantillas en los logs.
Una consulta de tabla puede responder un número positivo de registros en
`Return`; eso es distinto de las órdenes de escritura, cuyo éxito es `Return=0`.
No interpretar un cuerpo vacío o truncado como inventario completo de permisos.

Referencia de protocolo del fabricante: [ZKTeco Security PUSH Communication
Protocol, 2020-03-25, secciones 8.1 y 12.1.4](https://www.scribd.com/document/604031919/Security-PUSH-Communication-Protocol-20200325-002).

## Pruebas sin base ni dispositivo

```text
node --test test/attendance-parser.test.js test/cdata-ingestion.test.js test/command-confirmations.test.js test/command-delivery.test.js test/local-clock-address.test.js test/reconcile-plan.test.js
```

Estas pruebas usan datos sintéticos y módulos de base simulados. El conjunto
`local-sync.test.js` requiere su base de pruebas separada; nunca apuntarlo al
clúster de una instalación operativa.

Después de aplicar cambios, comprobar salud, recepción real de marcajes,
confirmaciones de estado, inventario completo y una segunda conciliación sin
órdenes nuevas. La validación de huella y apertura requiere una prueba presencial.
