# Mantenimiento de datos con API-Football

API-Football es la fuente operativa para mantener los datos estadísticos de temporada y los agregados de carrera que se construyen a partir de ellos. La política está versionada en `backend/src/apiFootballRefreshPolicy.ts` y se consulta con:

```bash
cd backend
npm run data:plan:api-football -- daily
npm run data:plan:api-football -- weekly
```

La cadencia prevista es:

| Frecuencia | Competiciones | Trabajo |
| --- | --- | --- |
| Diaria | Premier League, LaLiga, Bundesliga, Serie A, Ligue 1 y Primeira Liga | Archivar la temporada activa y validar las filas de jugadores |
| Semanal | European Cup / Champions League y FIFA World Cup | Revisar y archivar sus temporadas episódicas |
| Semanal | Agregados de carrera y títulos de jugadores | Reimportar la última temporada cerrada y reconstruir goles, asistencias, amarillas y rojas; regenerar `player-career-goals` sumando clubes y selección absoluta; procesar `/trophies` por lotes y regenerar `club-career-titles` |

Para ejecutarlo:

```bash
cd backend
npm run refresh:api-football:scheduled -- daily
npm run refresh:api-football:scheduled -- weekly
```

Antes de automatizarlo se puede revisar el alcance sin hacer peticiones:

```bash
npm run refresh:api-football:scheduled -- daily --dry-run
npm run refresh:api-football:scheduled -- weekly --dry-run
```

El año diario es el año UTC actual; el semanal es el último año cerrado. Se puede fijar explícitamente con `--season YYYY`. La clave se configura únicamente como secreto de entorno `API_FOOTBALL_KEY`; nunca se guarda en el repositorio.

Ejemplo de `cron` en UTC, desde el directorio `backend`:

```cron
15 3 * * * cd /ruta/rango90/backend && npm run --silent refresh:api-football:scheduled -- daily >> /var/log/rango90-api-football-daily.log 2>&1
45 4 * * 1 cd /ruta/rango90/backend && npm run --silent refresh:api-football:scheduled -- weekly >> /var/log/rango90-api-football-weekly.log 2>&1
```

Cada ejecución conserva snapshots y anomalías. `skipMedia=true`, `rightsStatus=review_required`, `autoApprove=false` y `autoPublish=false`: API-Football mantiene los datos, pero no convierte automáticamente una actualización en publicación legal. La categoría de goles globales sigue necesitando además el bloque de goles de selección absoluta; no se debe confundir con goles de club.

La categoría `european-cup-champions-league-club-titles` y la ampliación histórica mundial de `national-league-club-titles` siguen teniendo un flujo histórico específico: el sincronizador de API-Football no inventa palmarés a partir de una estadística de jugadores. Esos rankings solo se sustituyen cuando su propia fuente y cobertura pasan la revisión.
