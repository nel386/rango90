# BLOQUE 26 — carga histórica estructurada de asistencias

El workflow acepta un JSON mediante `BLOCK26_HISTORICAL_FACTS_FILE` con esta forma:

```json
{
  "facts": [
    {
      "id": "historical-assist-...",
      "edition": {
        "id": "champions:1955/56",
        "seasonStart": 1955,
        "seasonEnd": 1956,
        "seasonLabel": "1955/56",
        "era": "european_cup",
        "competitionName": "Copa de Europa",
        "isCurrentSeason": false
      },
      "player": {
        "canonicalId": "player:...",
        "displayName": "Nombre canónico",
        "normalizedName": "nombre canonico",
        "sourceKey": "rsssf",
        "sourcePlayerId": "...",
        "resolution": "explicit"
      },
      "match": { "id": "source-match-...", "date": "1955-09-...", "homeTeam": "...", "awayTeam": "..." },
      "eventId": "source-event-...",
      "phase": "semi_final",
      "assists": 1,
      "sourceKey": "rsssf",
      "sourceCaptureId": "rsssf-capture-...",
      "sourceRecordId": "match-...-assist-...",
      "sourceType": "contrast",
      "verificationStatus": "confirmed",
      "evidence": { "sourceUrl": "https://...", "locator": "...", "contentSha256": "..." },
      "capturedAt": "2026-09-18T00:00:00.000Z"
    }
  ]
}
```

Cada fila debe representar un hecho de partido. No se aceptan tablas de totales como hechos individuales, no se infiere una asistencia por coincidencia de nombre y las filas sin URL, localizador o huella se rechazan. `qualifying`, `preliminary` y `unknown` no entran en el ranking. El histórico se mantiene `candidate_not_sufficient` hasta cubrir y contrastar todas las temporadas.
