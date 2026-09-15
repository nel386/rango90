#!/usr/bin/env bash
set -euo pipefail

frequency="daily"
dry_run=false
season_override=""
only_competitions=""

if [[ "${1:-}" == daily || "${1:-}" == weekly ]]; then
  frequency="$1"
  shift
fi

while (($# > 0)); do
  case "$1" in
    daily|weekly)
      frequency="$1"
      shift
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    --season)
      [[ $# -ge 2 ]] || { echo "Falta el valor de --season" >&2; exit 2; }
      season_override="$2"
      shift 2
      ;;
    --only)
      [[ $# -ge 2 ]] || { echo "Falta el valor de --only" >&2; exit 2; }
      only_competitions="$2"
      shift 2
      ;;
    *)
      echo "Uso: $0 daily|weekly [--dry-run] [--season YYYY] [--only id1,id2,...]" >&2
      exit 2
      ;;
  esac
done

if [[ "$frequency" != daily && "$frequency" != weekly ]]; then
  echo "La frecuencia debe ser daily o weekly" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backend_dir="$(cd "$script_dir/.." && pwd)"
cd "$backend_dir"

plan="$(npm run --silent data:plan:api-football -- "$frequency")"
competition_list="$(printf '%s' "$plan" | jq -r '.competitions | map(.id) | join(",")')"
if [[ -z "$competition_list" ]]; then
  echo "La política no tiene competiciones para $frequency" >&2
  exit 3
fi

if [[ -n "$season_override" ]]; then
  season="$season_override"
else
  season="$(printf '%s' "$plan" | jq -r '.season')"
fi
if [[ ! "$season" =~ ^[0-9]{4}$ ]] || ((season < 1900 || season > 2100)); then
  echo "La temporada debe ser un año entre 1900 y 2100" >&2
  exit 2
fi

if [[ "$dry_run" == true ]]; then
  printf '%s\n' "$plan"
  dry_run_args=(--season "$season" --skip-media --only "$competition_list" --dry-run)
  if [[ -n "$only_competitions" ]]; then
    dry_run_args=(--season "$season" --skip-media --only "$only_competitions" --dry-run)
  fi
  npm run --silent sync:api-football:season -- "${dry_run_args[@]}"
  if [[ "$frequency" == weekly ]]; then
    echo "También reconstruiría los agregados de carrera de la última temporada cerrada."
  fi
  exit 0
fi

if [[ "$frequency" == daily ]]; then
  # Daily keeps active-season provider snapshots fresh. It does not rebuild
  # career totals from an unfinished season.
  sync_args=(--season "$season" --skip-media --only "$competition_list")
  if [[ -n "$only_competitions" ]]; then
    sync_args=(--season "$season" --skip-media --only "$only_competitions")
  fi
  npm run --silent sync:api-football:season -- "${sync_args[@]}"
else
  # Weekly first archives the less frequent tournament feeds, then refreshes
  # the closed domestic season and rebuilds career aggregates.
  sync_args=(--season "$season" --skip-media --only "$competition_list")
  if [[ -n "$only_competitions" ]]; then
    sync_args=(--season "$season" --skip-media --only "$only_competitions")
  fi
  npm run --silent sync:api-football:season -- "${sync_args[@]}"
  if [[ -n "$only_competitions" ]]; then
    # A manually selected competition must remain scoped to that competition.
    # The full current-season refresh would otherwise re-import all six
    # domestic leagues and make incremental historical backfill needlessly
    # expensive on the free Render database.
    npm run --silent build:rankings:api-football:career -- \
      --from-season 2000 \
      --to-season "$season" \
      --metric goals,assists,yellow_cards,red_cards \
      --allow-partial
    npm run --silent build:rankings:player-career-goals
  else
    RANGO90_SEASON="$season" npm run --silent refresh:api-football:current
  fi

  # /trophies is intentionally batched to control quota. --missing-only makes
  # successive weekly runs advance through the playable API-Football cohort;
  # the resulting club-career-titles snapshot remains provisional.
  trophy_limit="${RANGO90_API_FOOTBALL_TROPHIES_BATCH_SIZE:-100}"
  npm run --silent import:api-football:player-trophies -- \
    --limit "$trophy_limit" \
    --missing-only \
    --delay-ms "${RANGO90_API_FOOTBALL_TROPHIES_DELAY_MS:-300}"
  npm run --silent build:rankings:club-career-titles
fi

printf '%s\n' "$plan" | jq --arg status completed '. + {execution: $status}'
