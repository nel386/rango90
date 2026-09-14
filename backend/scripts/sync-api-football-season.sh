#!/usr/bin/env bash
set -euo pipefail

season=""
dry_run=false
skip_media=false
only_competitions=""
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
    --only)
      [[ $# -ge 2 ]] || { echo "Falta el valor de --only" >&2; exit 2; }
      only_competitions="$2"
      shift 2
      ;;
    *)
      echo "Uso: $0 --season YYYY [--dry-run] [--skip-media] [--only id1,id2,...]" >&2
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

declare -a default_leagues=(
  "premier-league:premier"
  "la-liga:140"
  "bundesliga:78"
  "serie-a:135"
  "ligue-1:61"
  "primeira-liga:94"
)
declare -a supported_leagues=(
  "${default_leagues[@]}"
  "european-cup-champions-league:2"
  "world-cup:1"
)
leagues=("${default_leagues[@]}")

declare -a requested_competitions=()
if [[ -n "$only_competitions" ]]; then
  IFS=',' read -r -a requested_competitions <<< "$only_competitions"
  declare -A allowed_competitions=()
  for item in "${supported_leagues[@]}"; do
    allowed_competitions["${item%%:*}"]=1
  done
  for competition in "${requested_competitions[@]}"; do
    if [[ -z "${allowed_competitions[$competition]:-}" ]]; then
      echo "Competición no soportada por este sincronizador: $competition" >&2
      exit 2
    fi
  done
  selected_leagues=()
  for item in "${supported_leagues[@]}"; do
    competition="${item%%:*}"
    for requested in "${requested_competitions[@]}"; do
      if [[ "$competition" == "$requested" ]]; then
        selected_leagues+=("$item")
      fi
    done
  done
  leagues=("${selected_leagues[@]}")
fi

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
