# BLOQUE 5 — Rankings futbolísticos y medios

Estado: superficies separadas y auditoría no destructiva preparada.

## Separación de superficies

- `Clasificación diaria` conserva únicamente los resultados competitivos de jugadores (`/v1/challenges/:challengeId/leaderboard`).
- `Rankings por categoría` usa `/v1/rankings/:categorySlug` y muestra puesto, valor bruto, puntuación del ranking, empate, snapshot y detalle de media.
- La respuesta se declara `rankingScope=historical_snapshot`: conserva las filas del snapshot aunque la entidad no sea jugable y añade `playable` como dato independiente. No es una clasificación competitiva.
- En `official`, el endpoint solo selecciona snapshots publicados.
- En `lab`, también puede mostrar el snapshot `draft` más reciente como `provisional`; nunca se etiqueta como oficial.
- Las filas usan el nombre canónico devuelto por el backend.
- La media distingue `imageStatus`, `reviewStatus`, `rightsStatus` e `isPublishable`. Una imagen pendiente puede producir `imageStatus=fallback`, pero conserva `reviewStatus=pending` y `rightsStatus=review_required`.
- `GET /v1/categories` alimenta el selector con todas las categorías con snapshot disponible en el modo actual, no solo las siete del reto diario. Los borradores aparecen como `provisional` en laboratorio.
- Una categoría no disponible devuelve `ranking_not_available`; en laboratorio un borrador válido devuelve `status=provisional`.

## Auditoría de medios

`npm run audit:playable-media` ejecuta únicamente consultas `SELECT` sobre el pool jugable presente en rankings no `superseded`, limitado al top 200. Escribe los artefactos de auditoría en `backend/audits/media/` y prioriza las filas sin retrato aprobado del top 20 de `world-cup-goals`.

El informe separa apariciones totales, entidades canónicas únicas, apariciones con imagen licenciada/fallback/no disponible y entidades únicas por representación. El estado vigente es: 9.787 apariciones, 5.022 entidades canónicas, 3.144 apariciones licenciadas, 6.643 con fallback y 0 sin representación. Las 17 prioridades del Mundial siguen sin retrato aprobado y se muestran mediante fallback; no están resueltas ni aprobadas visualmente.

El informe no modifica entidades, imágenes, derechos, snapshots ni valores estadísticos. Los candidatos siguen requiriendo revisión y aprobación explícita; esta tarea no descarga ni registra medios.

## Verificación aislada

```bash
cd backend
npm run test:playable-media-audit
npm run build
# Solo contra una base efímera o aislada preparada con el esquema:
RANGO90_ISOLATED_DATABASE_URL='postgres://...' npm run test:rankings:isolated
```

La integración aislada verifica la ruta real y exige una URL distinta de `DATABASE_URL`; sin esa variable se marca como omitida. No se ejecuta contra la base real ni modifica snapshots, fuentes, derechos o valores.
