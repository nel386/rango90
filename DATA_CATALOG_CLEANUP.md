# Auditoría y limpieza del catálogo de Rango 90

## Resultado aplicado

### Simplificación posterior del catálogo

El catálogo de jugadores se ha simplificado con la migración `054_simplify_player_category_catalog.sql`. El estado actual es:

- 253 definiciones en total: 113 activas y 140 retiradas.
- 80 categorías activas de jugadores, 29 de clubes y 4 de selecciones.
- Las 100 retiradas son categorías de jugador por copa/supercopa/Recopa y títulos de jugador por competición; sus datos no se borran.
- Se han añadido `player-career-titles`, `club-career-titles` (títulos de jugadores ganados en clubes), `club-global-titles` (palmarés global de clubes), `club-career-yellow-cards`, `club-career-red-cards` y `goalkeeper-career-clean-sheets`.
- Se mantienen las ligas principales, Champions, UEFA Cup/Europa League unificada, Conference, Libertadores/Sudamericana y grandes torneos de selecciones.
- `recopa-sudamericana-club-titles` también queda retirada; los demás palmarés de clubes se conservan como universos separados.

Ejecutado el comando idempotente:

```bash
cd backend
npm run cleanup:data-catalog
```

La operación es aditiva y conserva snapshots, payloads, estadísticas, evidencias y media. El único snapshot activo que superaba el límite era `premier-league-clean_sheets` (327 entradas); se creó el snapshot derivado `rs_52c5bebc6fe3bf56c9e31991` con 200 entradas y el original quedó `superseded` con metadatos de trazabilidad.

Estado posterior:

- 113 categorías activas tienen snapshot no superseded; todas contienen 200 entradas o son universos cerrados, aunque algunas todavía requieren ampliar la cobertura histórica o validar la participación.
- Los snapshots anteriores y superseded se conservan para auditoría.
- La auditoría vigente registra 72.809 jugadores canónicos únicos de todas las fuentes. Tras admitir los jugadores modernos con fecha verificada y aplicar la exclusión de históricos nacidos antes de 1930, el corte operativo vigente registra **6.675 personas jugables únicas** en rankings activos: **1.030** tienen retrato legal principal y **5.645** no lo tienen (**15,43%** de cobertura visual). Las cifras anteriores de esta sección corresponden a checkpoints ya superados.
- La base conserva 2.476 entidades fuente con `catalog_status='superseded'` y 36.342 con `excluded_from_game`; no se consumen como jugadores separados en el juego. Los payloads y snapshots brutos se mantienen para auditoría. En particular, ninguna entidad de jugador nacida antes de 1930 es actualmente jugable.
- Los perfiles jugables fuera del catálogo activo pasan a `playable_default=false`.
- La media de jugadores fuera del corte pasa a `media_not_required`; no se borra ni se rechaza.
- La media solo queda `required` para jugadores jugables del top-200 activo. Los jugadores históricos que siguen en rankings técnicos, pero no son jugables, también pasan a `media_not_required`; se conservan sus archivos y trazabilidad.
- No hay desafíos multicategoría publicados ni decisiones que limpiar; el desafío histórico no tiene items fuera del catálogo.

## Contratos de datos

Cada entrada conserva o expone `source_rank`, `ranking_position` y `entry_order`. `rank` es la posición competitiva con empates; `score_value` es la puntuación del juego, limitada por el `score_cap` de la categoría. Un importador que supere 200 entradas debe incluir explícitamente `allowExtendedRanking=true` y una `extendedRankingReason`; de lo contrario falla la validación.

Las entidades, media y desafíos tienen guardarraíles para impedir que un jugador excluido, retirado o una entidad fuente de identidad vuelva a entrar accidentalmente en el juego. Las correcciones de identidad no se hacen por nombre: las ocho incidencias solicitadas quedan en `identity_review_cases` con decisión y evidencia.

## Comprobaciones

```bash
npm run audit:data-catalog
npm test
npx tsc --noEmit
```

El endpoint público solo sirve categorías/snapshots publicados y perfiles de jugador activos y jugables, con media aprobada y con derechos verificados. Los snapshots `draft` son material de trabajo del backend y no deben aparecer en la UI pública.
