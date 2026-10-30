# Cajón y recibos en Windows

Los cobros confirmados en efectivo abren el cajón sin imprimir: altas con pago,
renovaciones, membresías pendientes, inscripción anual y venta de productos. No se abre por pagos
con tarjeta o transferencia, anulaciones, consultas ni transacciones revertidas.
La orden se envía después del COMMIT, una vez por cobro. Mensualidad e inscripción
pagadas juntas comparten una apertura, aunque tengan dos conceptos. Un fallo
del dispositivo no cambia el pago guardado. Las órdenes antiguas no se reenvían
cuando se reinicia el servicio.

En Caja → Historial de ventas y recibos se puede buscar por cliente o referencia,
filtrar por fechas, ver el detalle e imprimir voluntariamente. También hay detalle
en movimientos del turno y en el detalle de pagos. Los precios de productos se
obtienen de las líneas históricas de la venta; los recibos anulados se identifican.
La impresión usa texto de 32 columnas para papel de 58 mm y no envía apertura.
El recibo conjunto detalla mensualidad e inscripción y suma ambos importes.
Si se corrige el método de una de las partes, se muestran por separado según
el método; los movimientos reversados conservan su detalle individual.

## Equipo validado

3nStar RPT001, cola Windows POS-58, USB001. El cajón se conecta a la impresora.
La impresora debe permanecer encendida y conectada aunque no se impriman recibos.
El pulso probado es ESC p 0 50 250 (100 ms encendido, 500 ms apagado).
No se conoce el modelo del cajón; su apertura física con este pulso ya fue
confirmada por el usuario. Otros modelos requieren validar su compatibilidad.

## Activación

Después de instalar la actualización, ejecutar como administrador durante la
pausa coordinada:

```powershell
& 'C:\Program Files\AlGym\tools\Configure-CashDevice.ps1' `
  -AppRoot 'C:\Program Files\AlGym' -DataRoot 'C:\ProgramData\AlGym' `
  -PrinterName 'POS-58' -EnableDrawer
```

Se conserva el resto de backend.env y se guarda una copia privada del original.
El script consulta la cola sin mandar datos y reinicia solamente el backend.
Sin EnableDrawer se conserva la impresión voluntaria y se desactiva la apertura.
El instalador deja el dispositivo desactivado en equipos nuevos y preserva la
configuración existente al actualizar. El servicio LocalService necesita permiso
de impresión en la cola y escritura en ProgramData\AlGym\cash-device.

## Fallos y comprobación

Caja muestra el resultado de la última apertura. Si falla, comprobar alimentación,
USB, conexión del cajón y llave; no registrar otra venta para intentar abrirlo.
Una apertura manual exige un turno propio abierto y motivo, y deja auditoría.
Consultar o imprimir requiere los permisos de caja existentes.

La retirada del trabajo de la cola confirma envío, no una lectura del estado físico
del cajón o del papel. Las órdenes con demora se cancelan por su identificador; no
se vacía la cola de otros programas. No se reintentan automáticamente.

Pruebas: receipt.test.ts valida importes y ausencia de comandos de apertura o
controles inyectados; cash-devices.integration.test.mjs usa un PostgreSQL temporal
y transporte simulado para permisos, COMMIT/rollback, idempotencia y fallos.
Nunca ejecutar el preparador general de tests contra el clúster operativo.
