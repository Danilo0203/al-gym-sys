# AlGym 0.3.9

Esta versión reúne la inscripción anual, la eliminación de ejercicios y Caja
(historial de ventas, recibos opcionales y control del cajón). Conserva los
cambios anteriores de rutinas, acceso por teléfono, usuarios, roles, WhatsApp,
reloj y configuración del instalador.

Un cobro de Q150 de mensualidad y Q50 de inscripción produce un recibo de Q200
con dos líneas y una sola apertura del cajón en efectivo. La inscripción se
mantiene por año calendario aunque el cliente se ausente. Puede cobrarse por
separado y los pagos anteriores pueden reconocerse sin generar otro ingreso.
Eliminar un ejercicio lo retira del catálogo y de nuevas rutinas; conserva el
historial y los archivos utilizados por las rutinas existentes.

## Compatibilidad

Las dos entregas previas utilizaban el número 0.3.8 para contenidos distintos.
La 0.3.9 conserva los nombres y bytes de todas sus migraciones. Se incluyen
`0041_annual_enrollment.sql` y `0041_cash_devices.sql`: el instalador identifica
migraciones por su nombre completo y SHA-256, no solo por el prefijo numérico.
`0042_exercise_catalog_delete.sql` también permanece intacta. La nueva
`0043_cash_collection_group.sql` evita duplicar la apertura de un mismo cobro.
El conjunto contiene 44 archivos de migración.

Las pruebas de actualización cubren ambos esquemas 0.3.8 y la repetición de
la actualización sin cambios. Las pruebas de Caja usan transporte simulado:
no imprimen ni abren el cajón físico. La configuración existente se conserva;
para activar un dispositivo nuevo, consultar `caja-recibos-windows.md`.

## Preparación

Compilar ambos repositorios de la rama `codex/integracion-caja-inscripcion-20261029`
con `deploy/windows/Build-WindowsInstaller.ps1 -Version 0.3.9`. La preparación
del ejecutable no aplica la actualización a los servicios en uso.
