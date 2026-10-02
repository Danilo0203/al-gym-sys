#!/usr/bin/env bash
set -Eeuo pipefail

images=(al-gym-sys-web:latest al-gym-sys-backend:latest al-gym-sys-sync:latest postgres:17-alpine)
bundle=${1:-}

if [[ $# -ne 1 || ! -d "$bundle" ]]; then
  echo "Uso: $0 /ruta/paquete-con-images.txt-images.tar.gz-SHA256SUMS" >&2
  exit 2
fi
for file in images.txt images.tar.gz SHA256SUMS; do
  if [[ ! -f "$bundle/$file" ]]; then
    echo "Falta $file en $bundle" >&2
    exit 2
  fi
done

if command -v shasum >/dev/null 2>&1; then
  (cd "$bundle" && shasum -a 256 -c SHA256SUMS)
else
  (cd "$bundle" && sha256sum -c SHA256SUMS)
fi

if [[ $(awk '$1 == "FORMAT" { print $2 }' "$bundle/images.txt") != algym-docker-images-v1 ]]; then
  echo "Formato del paquete no reconocido" >&2
  exit 1
fi
platform=$(docker version --format '{{.Server.Os}}/{{.Server.Arch}}')
if [[ $(awk '$1 == "PLATFORM" { print $2 }' "$bundle/images.txt") != "$platform" ]]; then
  echo "El paquete no corresponde a la plataforma Docker $platform" >&2
  exit 1
fi

for name in "${images[@]}"; do
  if [[ $(awk -v name="$name" '$1 == "IMAGE" && $2 == name { count++ } END { print count+0 }' "$bundle/images.txt") -ne 1 ]]; then
    echo "Falta o está duplicada la imagen $name en el manifiesto" >&2
    exit 1
  fi
  expected_id=$(awk -v name="$name" '$1 == "IMAGE" && $2 == name { print $3 }' "$bundle/images.txt")
  expected_platform=$(awk -v name="$name" '$1 == "IMAGE" && $2 == name { print $4 }' "$bundle/images.txt")
  if [[ "$expected_platform" != "$platform" || ! "$expected_id" =~ ^sha256:[a-f0-9]{64}$ ]]; then
    echo "Manifiesto inválido para $name" >&2
    exit 1
  fi
  current_id=$(docker image inspect --format '{{.Id}}' "$name" 2>/dev/null || true)
  if [[ -n "$current_id" && "$current_id" != "$expected_id" ]]; then
    echo "$name ya existe con otra versión; no se sobrescribió" >&2
    exit 1
  fi
done

gzip -dc "$bundle/images.tar.gz" | docker load

for name in "${images[@]}"; do
  expected_id=$(awk -v name="$name" '$1 == "IMAGE" && $2 == name { print $3 }' "$bundle/images.txt")
  current_id=$(docker image inspect --format '{{.Id}}' "$name")
  if [[ "$current_id" != "$expected_id" ]]; then
    echo "La imagen importada no coincide con el manifiesto: $name" >&2
    exit 1
  fi
done
echo "Imágenes locales importadas y verificadas para $platform"
