ALGYM: MIGRACIÓN DE HOSTINGER A WINDOWS

La instalación 0.2.0 incluye Inicio > AlGym > Importar datos de Hostinger.
Abre ese importador sin usar «Ejecutar como administrador»: así Windows permite
arrastrar archivos desde el Explorador. La importación pide elevación al confirmar.

1. Instala AlGym y crea la cuenta inicial del equipo.
2. Abre «Importar datos de Hostinger» y arrastra el archivo .algym.
3. Revisa la fecha de los datos y los conteos. Confirma que es una instalación nueva.
4. Acepta el permiso de Windows y espera a que termine.
5. Inicia sesión con una cuenta de Hostinger. La cuenta temporal del instalador
   se reemplaza con las cuentas del respaldo; sus contraseñas cifradas se conservan.

El archivo .algym es un paquete preparado para una versión concreta del sistema.
No acepta archivos SQL, ZIP arbitrarios ni un dump crudo de Supabase.
Antes de importar, comprueba la versión, las imágenes, la cuenta propietaria,
la instalación de destino y que no existan operaciones. Hace un respaldo local.
La carga de datos es transaccional y verifica referencias y valores de cada fila.
Un segundo intento con el mismo archivo no duplica los registros.

La cola del reloj empieza vacía en este paquete. Las 4.987.220 órdenes originales
se conservan en el dump completo de Hostinger. El envío de comandos permanece
pausado. Configura y prueba el reloj después, en la red del cliente.

Esta copia corresponde al ensayo del 19 de octubre de 2026. Los cambios nuevos
en Hostinger no se sincronizan automáticamente: antes del traslado definitivo
hay que obtener y validar un respaldo final durante la ventana de corte acordada.
El ensayo no ejecuta cambios en los datos del VPS.

Los paquetes y el dump contienen información privada del gimnasio. Consérvalos
fuera del repositorio y comparte únicamente con quien opera esa instalación.
