# Runbook Windows: estado de la instalacion local

La instalacion completa sin internet sigue en migracion. PostgreSQL se ejecuta hoy en la PC anfitriona; Docker Compose levanta web, backend y sync. El perfil `container-db` sirve para ensayar una copia separada y no cambia la base operativa. Antes de instalar en otra PC, completar y validar `P5-01` a `P6-03` de `PLAN_MIGRACION_LOCAL.md`.

## Preparar la PC

- Instalar PostgreSQL, Node.js 24 y Docker Desktop con WSL2.
- Dar a la PC una IP fija o reserva DHCP si el reloj biometrico le enviara marcajes.
- Restaurar una copia verificada de `algym` local y aplicar las migraciones del backend, incluida `0017_sync_local_role.sql`.
- Configurar `algym_app` para el backend y `algym_sync` para el servicio biometrico con claves locales distintas.

## Variables

- Copiar `al-gym-sys` y `algym-local-backend` como carpetas hermanas. Configurar `algym-local-backend/.env` desde su ejemplo y crear `algym-local-backend/data/media`; Compose construye el backend. Para ejecutarlo fuera de Docker, usar `pnpm build && pnpm start`.
- Configurar `deploy/env/web.env` con `ALGYM_BACKEND_URL` apuntando al backend local y el token `GYM_SYNC_API_TOKEN`. Algunos modulos web aun necesitan variables de Supabase; consultar el plan antes de operar sin internet.
- Configurar `deploy/env/sync.env` desde `deploy/env/sync.env.example`: `DB_NAME=algym`, `DB_USER=algym_sync`, clave local, `SYNC_API_TOKEN` y datos del reloj. Los tokens de web y sync deben coincidir.
- El puerto 8080 escucha solo en localhost por defecto. Si el reloj envia marcajes desde otra maquina, establecer `SYNC_BIND_HOST` en la IP de esta PC y permitir el puerto en el firewall de la red privada.

## Arranque y comprobacion

Desde la raiz de `al-gym-sys`:

```powershell
docker compose --env-file deploy/env/web.env up -d --build
docker compose ps
```

Comprobar `http://127.0.0.1:4001/health/ready`, `http://127.0.0.1:8080/health/ready` y `http://127.0.0.1:3000`. Revisar `docker compose logs -f backend`, `sync` o `web` si falla alguna comprobacion. El reloj real y los flujos pendientes deben probarse antes de considerar completa la instalacion.

`cloudflared` es opcional y requiere `docker compose --profile remote-access up -d cloudflared`; no forma parte de la operacion sin internet.
