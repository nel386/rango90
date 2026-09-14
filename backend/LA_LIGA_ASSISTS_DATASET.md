# LaLiga — asistencias históricas

## Estado

El bloque tiene un adaptador e importador reproducibles, pero el snapshot que
genere queda en `draft`, con `coverageComplete=false` y
`rightsStatus=review_required`. No se habilita su publicación automáticamente.

## Fuente y método

- Fuente pública: [StatBunker — La Liga, All time Players Record](https://www.statbunker.com/alltimestats/AllTimePlayerStandings?comp_code=LL).
- La tabla expone las columnas de jugador, posición, apariciones, goles y `A`
  (assists), además de otras métricas. El adaptador toma únicamente esa columna
  explícita de asistencias.
- La tabla de origen está ordenada por apariciones. El importador filtra valores
  positivos, ordena por asistencias descendentes y conserva las primeras 200
  filas reales, usando el `player_id` estable del proveedor.
- No se agregan ceros, no se hace padding y no se agregan páginas de clubes ni
  datos de otra competición.

## Cobertura y licencia

StatBunker aporta más de 200 filas positivas en una tabla homogénea, suficiente
para crear un borrador técnico del top 200. Sin embargo, la página no deja
documentado de forma suficientemente precisa el inicio histórico de la captura
de asistencias ni una licencia pública de redistribución de sus datos. Por eso
el adaptador no declara cobertura histórica completa y la fuente permanece en
`review_required` hasta obtener una licencia o una validación metodológica y
jurídica específica.

## Actualización

Ejecutar desde `backend/`:

```bash
npm run import:la-liga:assists
```

La importación crea un snapshot cuyo contenido queda identificado por hash y
conserva la evidencia de la URL, el rango derivado, el rango original de la
tabla, el `player_id` y la columna utilizada. Una actualización solo sustituye
el borrador actual después de superar la validación de filas únicas, valores
no negativos y mínimo de 200 filas positivas.
