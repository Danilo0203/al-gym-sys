# Runbook Windows: Docker Compose local + Cloudflare Tunnel

## 1. Preparar la PC del gimnasio
- Instalar Docker Desktop y habilitar WSL2.
- Activar inicio automático de Docker Desktop al encender Windows.
- Confirmar que la PC tenga IP fija o reserva DHCP si el reloj biométrico apunta a esta máquina.

## 2. Configurar variables
- Editar [`deploy/env/web.env`](/Users/danilo0203/Desarrollo/all-gym-sys/deploy/env/web.env) con las credenciales de Supabase y el token del sync.
- Editar [`deploy/env/sync.env`](/Users/danilo0203/Desarrollo/all-gym-sys/deploy/env/sync.env) con `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SYNC_API_TOKEN` y la IP del reloj en `ZK_DEVICE_IP`.
- Dejar [`deploy/env/cloudflared.env`](/Users/danilo0203/Desarrollo/all-gym-sys/deploy/env/cloudflared.env) con `TUNNEL_URL=http://web:3000` para Quick Tunnel.
- Rotar la `SUPABASE_SERVICE_ROLE_KEY` antes de usar este despliegue.

## 3. Levantar el stack
- Abrir PowerShell en `/Users/danilo0203/Desarrollo/all-gym-sys`.
- Ejecutar `docker compose up -d --build`.
- Revisar `docker compose ps`.
- Validar la app local en `http://127.0.0.1:3000`.
- Leer la URL pública del túnel con `docker compose logs cloudflared --tail 50`.

## 4. Operación diaria
- Reiniciar servicios: `docker compose restart`.
- Ver logs web: `docker compose logs -f web`.
- Ver logs sync: `docker compose logs -f sync`.
- Ver logs túnel: `docker compose logs -f cloudflared`.
- Apagar el stack: `docker compose down`.
- Actualizar imágenes y app: `docker compose up -d --build`.

## 5. Reinicio automático en Windows
- Confirmar que Docker Desktop abra al iniciar sesión.
- Crear una tarea en Programador de tareas que ejecute:
  `powershell.exe -ExecutionPolicy Bypass -Command "cd 'C:\ruta\all-gym-sys'; docker compose up -d"`
- Configurar la tarea para correr al iniciar sesión del operador o al arrancar la máquina.

## 6. Cambio de URL temporal del túnel
- Si Quick Tunnel genera una URL nueva, ejecutar `docker compose logs cloudflared --tail 50`.
- Compartir la nueva URL al cliente final.
- Si el cambio de URL afecta callbacks o enlaces externos, mantener `NEXT_PUBLIC_ENABLE_OAUTH_LOGIN=false` y `NEXT_PUBLIC_ENABLE_PASSWORD_RECOVERY=false` hasta migrar a dominio fijo.
