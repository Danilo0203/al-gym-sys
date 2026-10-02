#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

images=(al-gym-sys-web:latest al-gym-sys-backend:latest al-gym-sys-sync:latest postgres:17-alpine)
target=${1:-}

if [[ $# -ne 1 || "$target" != /* ]]; then
  echo "Uso: $0 /ruta/absoluta/paquete-nuevo" >&2
  exit 2
fi
if [[ -e "$target" ]]; then
  echo "El destino ya existe: $target" >&2
  exit 2
fi

parent=$(dirname "$target")
if [[ ! -d "$parent" ]]; then
  echo "No existe el directorio padre: $parent" >&2
  exit 2
fi

tmp=$(mktemp -d "$parent/.algym-images.XXXXXXXX")
trap 'rm -rf -- "$tmp"' EXIT
platform=$(docker version --format '{{.Server.Os}}/{{.Server.Arch}}')

{
  printf 'FORMAT algym-docker-images-v1\n'
  printf 'CREATED_UTC %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'PLATFORM %s\n' "$platform"
  for name in "${images[@]}"; do
    id=$(docker image inspect --format '{{.Id}}' "$name")
    image_platform=$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$name")
    if [[ "$image_platform" != "$platform" ]]; then
      echo "La plataforma de $name ($image_platform) no coincide con Docker ($platform)" >&2
      exit 1
    fi
    printf 'IMAGE %s %s %s\n' "$name" "$id" "$image_platform"
  done
} > "$tmp/images.txt"

docker save "${images[@]}" | gzip -1 > "$tmp/images.tar.gz"

if command -v shasum >/dev/null 2>&1; then
  (cd "$tmp" && shasum -a 256 images.txt images.tar.gz > SHA256SUMS)
else
  (cd "$tmp" && sha256sum images.txt images.tar.gz > SHA256SUMS)
fi

mv -- "$tmp" "$target"
trap - EXIT
echo "Paquete creado: $target"
echo "Plataforma: $platform"
echo "Archivos: images.txt, images.tar.gz, SHA256SUMS"
