Pruebas aisladas del auxiliar. No conectar estos ensayos a Hostinger.

node --test tests/remote-node.test.mjs

En Windows, sin abrir la interfaz interactiva:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/Test-Download.ps1

La prueba nativa utiliza tests/ssh-fixture-server.py (paramiko 4.0.0 en un venv
desechable). Escucha solamente en la interfaz privada de Parallels
10.211.55.2:18737 y acepta una clave efímera de prueba. No ejecuta shell ni
SQL: comprueba los bytes del script y genera paquetes ficticios.
Copiar native-fixtures/test_identity, known_hosts y wrong_hosts a tests/fixtures
en la VM. Test-NativeTransport.ps1 se ejecutó como SYSTEM mediante Parallels;
su ajuste de ACL solo pertenece a esa clave de prueba. No usar claves reales.

El simulador implementa SFTP y SCP clásico de solo lectura y rechaza todo
comando diferente al previsto. Detenerlo al acabar y eliminar las claves
de prueba. No copiar fixtures, venv ni archivos de prueba a la entrega USB.
