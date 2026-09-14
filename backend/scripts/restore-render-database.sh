#!/usr/bin/env bash
set -Eeuo pipefail

# Restore the local PostgreSQL catalogue into a Render PostgreSQL database.
# This is intentionally explicit because pg_restore --clean overwrites the
# target database. The target URL must never be committed or pasted into chat.

if [[ -z "${RENDER_DATABASE_URL:-}" ]]; then
  echo "Falta RENDER_DATABASE_URL: usa la External Database URL de Render en esta terminal." >&2
  exit 2
fi

if [[ "${CONFIRM_RENDER_DB_RESTORE:-}" != "YES" ]]; then
  echo "Esta operación sobrescribe la base indicada por RENDER_DATABASE_URL." >&2
  echo "Para continuar, vuelve a ejecutarla con CONFIRM_RENDER_DB_RESTORE=YES." >&2
  exit 2
fi

case "${RENDER_DATABASE_URL}" in
  *localhost*|*127.0.0.1*|*backend-postgres-1*)
    echo "RENDER_DATABASE_URL parece apuntar a la base local; se cancela por seguridad." >&2
    exit 2
    ;;
esac

command -v docker >/dev/null || { echo "Docker es obligatorio." >&2; exit 2; }
docker image inspect postgres:16 >/dev/null 2>&1 || {
  echo "Falta la imagen postgres:16; ejecuta primero: docker pull postgres:16" >&2
  exit 2
}

local_container="${LOCAL_POSTGRES_CONTAINER:-backend-postgres-1}"
local_db="${LOCAL_POSTGRES_DB:-rango90}"
local_user="${LOCAL_POSTGRES_USER:-rango90}"
if ! docker inspect "${local_container}" >/dev/null 2>&1; then
  echo "No existe el contenedor local ${local_container}. Comprueba: docker ps" >&2
  exit 2
fi

dump_file="$(mktemp "${TMPDIR:-/tmp}/rango90-render-restore.XXXXXX.dump")"
cleanup() { rm -f "${dump_file}"; }
trap cleanup EXIT

echo "Exportando ${local_db} desde ${local_container}..."
docker exec "${local_container}" pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --username="${local_user}" \
  --dbname="${local_db}" > "${dump_file}"

echo "Restaurando en Render (la URL no se muestra)..."
docker run --rm \
  -v "${dump_file}:/tmp/rango90.dump:ro" \
  postgres:16 \
  pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --exit-on-error \
    --dbname="${RENDER_DATABASE_URL}" \
    /tmp/rango90.dump

echo "Restauración completada. Render volverá a ejecutar migraciones idempotentes al arrancar."
