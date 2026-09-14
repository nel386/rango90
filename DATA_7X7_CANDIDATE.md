# Candidato de matriz 7×7

Fecha de verificación: 14 de septiembre de 2026 (UTC)

## Resultado actual

La matriz elegida para el producto es la de [DATA_7X7_OPTIONS.md](/home/ubuntu/rango90/DATA_7X7_OPTIONS.md): cinco categorías de jugadores y dos de equipos. Esta ficha conserva la evidencia local de esa matriz y distingue los avances provisionales de los requisitos todavía pendientes de publicación.

| Categoría | Snapshot | 200 entradas | Datos completos | Conflictos | Estado | Derechos de fuente |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `club-career-yellow-cards` | `rs_d4763396b3eecd9d94a49831` | Sí | No | 0 | draft | no aprobados |
| `club-career-red-cards` | `rs_1ff5a575c51e9641ac0ba0d8` | Sí | No | 0 | draft | no aprobados |
| `club-career-titles` | `rs_9db3675a17b09bda84327786` | Sí | No | 0 | draft | no aprobados |
| `world-cup-goals` | `rs_7cc0d9cf795a275b93106c43` | Sí | Sí | 0 | draft | no aprobados |
| `player-career-goals` | `rs_c2c4a7942b4f8d2bd156306c` | Sí | No | 0 | draft | no aprobados |
| `national-league-club-titles` | `rs_5943de063ce56ca0b02a48ab` | No (69) | No | 0 | draft | no aprobados |
| `european-cup-champions-league-club-titles` | `rs_a5608e2d2d543e7e8a25e045` | Universo cerrado (24) | Sí | 0 | draft | no aprobados |

## Auditoría de combinaciones

En la verificación del 14 de septiembre de 2026 no existe todavía una combinación válida para la matriz elegida. `world-cup-goals` ya tiene 200 entradas completas y la Champions de clubes representa su universo cerrado de 24 clubes; las demás categorías siguen siendo parciales o no tienen todavía derechos aprobados. Por ello, la auditoría devuelve `ready=false` y no se ha publicado ningún reto.

Esta conclusión se puede reproducir con `cd backend && npm run audit:7x7`. El comando agrupa por tipo de entidad, deduplica por identidad canónica y comprueba la combinación objetivo de cinco categorías de jugadores y dos de equipos, con entidades comunes en la banda top 90 utilizada por el reto diario. Devuelve código distinto de cero si no existe ninguna combinación válida.

## Bloqueos para convertirlo en reto real

1. Conseguir y registrar para las siete fuentes una licencia abierta o un permiso gratuito que cubra el uso previsto; no se contratará una licencia comercial de proveedor.
2. Completar el histórico mundial de tarjetas, títulos de club y goles globales de carrera.
3. Ampliar `national-league-club-titles` hasta el universo mundial definido; los 69 clubes actuales solo cubren seis ligas.
4. Auditar identidades, valores, empates, posiciones y evidencias de las cinco respuestas de jugadores y dos de equipos.
5. Verificar derechos de retratos o usar el fallback visual propio donde el contrato lo permita.
6. Crear el `game_challenge` draft, cargar la matriz 7×7 tipada, aprobar snapshots y publicar solo después de que todos los guards pasen.

Este documento identifica una ruta de datos; no autoriza publicar el candidato actual.

## Avance posterior de datos

El 14 de septiembre de 2026 se generó el snapshot provisional `rs_c2c4a7942b4f8d2bd156306c` para `player-career-goals`. Contiene 200 jugadores jugables y suma, por jugador, los goles de clubes actualmente importados y los goles internacionales del snapshot `rs_cd4577ed2865998477c96769`. Permanece en `draft` y `coverage_complete=false`: el histórico de clubes no es mundial/completo y la fuente de clubes no tiene derechos aprobados. Por tanto, este avance permite probar el pipeline de la categoría, pero no satisface todavía el contrato de publicación.

La categoría `national-league-club-titles` ya tiene el snapshot provisional `rs_5943de063ce56ca0b02a48ab`, con 69 clubes reales de las seis ligas domésticas actualmente importadas. Tiene `coverage_complete=false` y queda bloqueado por el mínimo de 200 del universo abierto. No se ha creado un ranking con padding.
