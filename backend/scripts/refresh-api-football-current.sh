#!/usr/bin/env bash
set -euo pipefail

# Career aggregates must not silently include an unfinished season. The
# operator can still opt into a specific season with RANGO90_SEASON=YYYY;
# without it, refresh the last calendar season, which is the latest normally
# completed season at the time of the scheduled run.
season="${RANGO90_SEASON:-$(date -u -d '1 year ago' +%Y)}"

if (($# > 0)); then
  echo "Este comando no acepta argumentos; usa RANGO90_SEASON=YYYY para fijar la temporada" >&2
  exit 2
fi

if [[ ! "$season" =~ ^[0-9]{4}$ ]] || ((season < 1900 || season > 2100)); then
  echo "RANGO90_SEASON debe ser un año entre 1900 y 2100" >&2
  exit 2
fi

# The season importer owns locking, validation, and source snapshots. Keep
# media out of the scheduled data refresh: provider photos/logos never become
# publishable without a separate rights review.
npm run --silent sync:api-football:season -- --season "$season" --skip-media

# Rebuild the global club-career aggregates from the refreshed snapshots. The
# snapshots remain draft when historical coverage or source rights are not
# complete, which is intentional.
npm run --silent build:rankings:api-football:career -- \
  --from-season 2000 \
  --to-season "$season" \
  --metric goals,assists,yellow_cards,red_cards

npm run --silent audit:data-readiness | jq '.summary'
