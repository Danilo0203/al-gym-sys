#!/usr/bin/env python3
"""Comprueba la topología Compose del ensayo offline sin iniciar contenedores."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]
FILES = [ROOT / "docker-compose.yml", ROOT / "docker-compose.container-db.yml",
         ROOT / "docker-compose.offline-acceptance.yml"]


def check() -> None:
    env = os.environ.copy()
    env.setdefault("ALGYM_OFFLINE_MEDIA_ROOT", "/tmp/algym-offline-check-media")
    env.setdefault("ALGYM_OFFLINE_BACKUP_DIR", "/tmp/algym-offline-check-backup")
    operational_media = (ROOT.parent / "algym-local-backend/data/media").resolve()
    operational_backups = (ROOT.parent / "algym-local-backend/backups/local").resolve()
    media = Path(env["ALGYM_OFFLINE_MEDIA_ROOT"])
    backups = Path(env["ALGYM_OFFLINE_BACKUP_DIR"])
    if not media.is_absolute() or not backups.is_absolute():
        raise ValueError("Las carpetas de ensayo deben ser rutas absolutas")
    if media.resolve() == operational_media or backups.resolve() == operational_backups:
        raise ValueError("Las carpetas de ensayo deben ser distintas de las operativas")
    command = ["docker", "compose"]
    for file in FILES:
        command += ["-f", str(file)]
    command += ["-p", "algymofflinecheck", "--profile", "container-db", "config", "--format", "json"]
    result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("Docker Compose rechazó el perfil de ensayo offline")
    config = json.loads(result.stdout)
    services = config["services"]
    if config["networks"]["gym-local"].get("internal") is not True:
        raise ValueError("La red de aplicación debe ser interna")
    if "backup" in services or "cloudflared" in services:
        raise ValueError("El respaldo o túnel remoto no debe arrancar en este ensayo")
    for name in ("web", "backend", "sync", "postgres"):
        service = services[name]
        if service.get("ports") or set(service.get("networks", {})) != {"gym-local"}:
            raise ValueError(f"{name} expone un puerto o usa una red de salida")
        if any("host.docker.internal" in value for value in (service.get("extra_hosts") or [])):
            raise ValueError(f"{name} conserva acceso al host Docker")
    for name in ("backend", "sync"):
        if services[name].get("environment", {}).get("DB_HOST") != "postgres":
            raise ValueError(f"{name} no usa el PostgreSQL interno del ensayo")
    web_env = services["web"].get("environment", {})
    if web_env.get("ALGYM_BACKEND_URL") != "http://backend:4000":
        raise ValueError("La web no usa el backend interno del ensayo")
    if web_env.get("GYM_SYNC_SERVER_URL") != "http://sync:8080":
        raise ValueError("La web no usa el sync interno del ensayo")
    gateway = services["gateway"]
    if set(gateway.get("networks", {})) != {"gym-local", "gym-access"}:
        raise ValueError("El gateway necesita solo la red interna y la de acceso")
    ports = gateway.get("ports", [])
    if len(ports) != 1 or ports[0].get("host_ip") != "127.0.0.1" or ports[0].get("target") != 3000:
        raise ValueError("El gateway debe publicar únicamente el puerto web en loopback")
    print("Topología offline verificada: aplicación interna y un gateway en loopback")


if __name__ == "__main__":
    try:
        check()
    except (KeyError, OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(f"Ensayo offline rechazado: {error}", file=sys.stderr)
        raise SystemExit(1) from None
