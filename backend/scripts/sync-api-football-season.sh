#!/usr/bin/env bash
set -euo pipefail

season=""
dry_run=false
skip_media=false
while (($# > 0)); do
  case "$1" in
    --season)
      [[ $# -ge 2 ]] || { echo "Falta el valor de --season" >&2; exit 2; }
      season="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    --skip-media)
      skip_media=true
      shift
      ;;
    *)
      echo "Uso: $0 --season YYYY [--dry-run] [--skip-media]" >&2
      exit 2
      ;;
  esac
done

if [[ ! "$season" =~ ^[0-9]{4}$ ]] || ((season < 1900 || season > 2100)); then
  echo "--season debe ser un año entre 1900 y 2100" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backend_dir="$(cd "$script_dir/.." && pwd)"
cd "$backend_dir"

lock_file="${RANGO90_API_SYNC_LOCK_FILE:-/tmp/rango90-api-football-sync.lock}"
exec 9>"$lock_file"
if ! flock -n 9; then
  echo "Ya hay una sincronización API-Football en curso: $lock_file" >&2
  exit 3
fi

declare -a leagues=(
  "premier-league:premier"
  "la-liga:140"
  "bundesliga:78"
  "serie-a:135"
  "ligue-1:61"
  "primeira-liga:94"
)

declare -a import_media_args=()
if [[ "$skip_media" == true ]]; then
  import_media_args+=(--skip-media)
fi

if [[ "$dry_run" == true ]]; then
  printf 'Sincronizaría temporada %s para: ' "$season"
  printf '%s ' "${leagues[@]}"
  printf '\n'
  exit 0
fi

for item in "${leagues[@]}"; do
  competition="${item%%:*}"
  league="${item##*:}"
  if [[ "$league" == "premier" ]]; then
    npm run import:api-football:premier-league -- --season "$season" --full "${import_media_args[@]}"
  else
    npm run import:api-football:league -- --league-id "$league" --competition "$competition" --season "$season" --full "${import_media_args[@]}"
  fi
done

if [[ "$skip_media" != true ]]; then
  # Logos are staged locally for review only. This never approves or publishes
  # them, and the command does not consume API-Football quota because it fetches
  # the already-recorded media URLs.
  npm run media:stage:api-football -- --kind badge --limit 100 --delay-ms 0
  npm run media:stage:api-football -- --kind portrait --limit 100 --delay-ms 0
fi
