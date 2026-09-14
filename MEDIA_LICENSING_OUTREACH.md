# Solicitud de licencia visual — Rango 90

## Estado de enriquecimiento TheSportsDB — 13/09/2026

El roster jugable se corrigió después de detectar excepciones demasiado amplias para porteros históricos, perfiles sin fecha verificable y una identidad incorrecta de Pelé. El expediente vigente ya está recalculado sobre **6.675 jugadores canónicos jugables** y contiene **5.645 jugadores** sin retrato legal principal; no incluye jugadores históricos conservados fuera del juego ni duplicados por ranking.

Se han refrescado 302 assets de retrato mediante `lookupplayer.php`, validando identidad y deporte y conservando la respuesta del proveedor en `image_assets.metadata`. El resultado actual es:

- 49 assets aprobados y publicables con evidencia individual `CC BY-SA 4.0`, identidad/deporte verificados, atribución, ShareAlike aceptado, hash y archivo WebP 512×512.
- 571 assets rechazados por derechos, identidad, calidad o redundancia; 2 retratos permanecen en `pending` por ausencia de etiqueta y requieren revisión individual.
- Los escudos de TheSportsDB permanecen pendientes porque el plan/API no concede por sí solo licencia comercial de marcas.

El expediente exacto de los faltantes del juego se genera con `npm run media:player-license-requests` y actualmente contiene **5.645 jugadores canónicos** sin retrato legal. No son posiciones ni copias por ranking: cada persona aparece una sola vez. Está en `backend/storage/media-candidates/playable-player-portrait-license-requests-2026-09-13.csv` y debe adjuntarse a cualquier solicitud de cotización.

Para una primera cotización de bajo coste puede usarse el tramo prioritario de **500 jugadores** —ordenado por número de categorías reutilizadas y después por mejor posición— mediante:

```bash
npm run media:player-license-requests -- --limit 500 --priority reuse \
  --output-base playable-player-portrait-license-requests-priority500-2026-09-13
```

El lote prioritario actual está en `backend/storage/media-candidates/playable-player-portrait-license-requests-priority500-current.csv` (y sus versiones JSON/Markdown); contiene 500 IDs canónicos únicos y no modifica PostgreSQL.

Las colas automáticas de descubrimiento aplican la misma lógica: primero personas presentes en más categorías activas y, en empate, la mejor posición. Así cada retrato aprobado reutiliza su ID canónico en el mayor número posible de rankings.

El descubridor de jugadores admite `--offset` para continuar por bloques sin repetir jugadores ya procesados; el backfill de licencias conserva la URL de la ficha individual como evidencia.

## Asunto

`Commercial licence enquiry — football player headshots and official club logos for Rango 90`

## Texto para enviar

Hello,

We are building Rango 90, a public commercial football knowledge game. Players receive points by identifying the position of a randomly selected player or club in historical statistical rankings.

We are looking for a licensed media solution for:

- player headshots, including current players and selected historical players;
- official club logos/crests and national-team identifiers;
- football coverage for the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Primeira Liga, UEFA club competitions, CONMEBOL competitions and major national teams;
- backend ingestion, local storage, normalization to 512×512 WebP and delivery through our own web/PWA/Android application and CDN;
- historical retention of assets used by immutable ranking snapshots.

Please confirm in writing:

1. the exact competitions, clubs, teams and players covered;
2. whether the licence expressly covers commercial games, web, PWA, Android, local storage and CDN/cache delivery;
3. whether official logos/crests and player likeness/headshots are included in the licence or require separate permissions;
4. whether assets may be resized/cropped/reformatted and retained after a ranking snapshot is archived;
5. attribution, trademark notices, takedown/revocation and replacement obligations;
6. territory, term, minimum commitment, rate limits, update mechanism and total price;
7. the relevant licence, order form or addendum that grants these rights.

Please quote an MVP package for the 5,645 playable players currently missing a legal primary portrait (one direct request per player in the attached manifest), plus the clubs required by the active rankings, and provide an option for full historical expansion.

### Current manifest checkpoint — 13 September 2026

The manifest was regenerated after a rights and identity reconciliation and contains **5,645 canonical playable players** without an approved legal primary portrait. The current player portrait coverage is **1,030/6,675 (15.43%)**. Earlier references to 75, 277, 278 or 260 missing players are historical checkpoints and must not be used for a quote.

Regards,

`[Nombre / empresa / dominio / país]`

## Destinatarios prioritarios

- **Sportradar:** su [Images API](https://developer.sportradar.com/images-and-editorials/reference/images-overview) ofrece la cobertura técnica más cercana a lo que necesitamos y dispone de manifiestos de actualización. No se debe contratar sin resolver por escrito la limitación de sus [términos](https://developer.sportradar.com/sportradar-updates/page/terms-and-conditions), que indican que los derechos de logos y headshots de terceros no se conceden automáticamente.
- **badges.football:** solicitar una propuesta comercial para identificadores visuales de todos los clubes de las categorías iniciales. Debe quedar claro que son identificadores propios y no escudos oficiales; pedir cobertura, precio, CDN, caché/local storage, límites, atribución y permiso de uso en el juego. Solo sirve como solución si aceptamos esa diferencia; no debe presentarse al usuario como escudo oficial.
- **TheSportsDB:** pedir confirmación específica sobre artwork, escudos de terceros, publicación comercial, histórico, caché/CDN y Android. El plan de pago no se interpreta como licencia global.
- **SportsDataIO y Genius Sports:** solicitar una propuesta específica para juego comercial. SportsDataIO debe confirmar que el alcance supera el uso editorial que describe públicamente; Genius Sports debe confirmar que su servicio de licensing incluye las marcas y fotografías concretas, no solo que la API tenga campos `logo`/`photo`.
- **Titulares de competiciones y clubes prioritarios:** solicitar autorización directa de escudos oficiales y, cuando sea necesario, imágenes de jugadores.

## Criterio interno

La respuesta comercial, la oferta y el contrato se guardarán como evidencia antes de cambiar una fuente a `approved`. Una demo, una respuesta informal o la disponibilidad de una URL no son suficientes.
