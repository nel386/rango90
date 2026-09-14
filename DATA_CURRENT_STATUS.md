# Estado operativo actual de datos

Última verificación: 14 de septiembre de 2026 (UTC), mediante `audit-data-readiness`, `verify-game-catalog` y `cleanup-data-catalog` en modo `dry-run`.

## Regla del circuito jugable

Solo se consideran jugables los jugadores con al menos una entrada en un snapshot activo y no superseded con `rank <= 200`. Las cinco categorías de jugadores de la matriz diaria elegida tienen además una admisión histórica explícita y acotada: sus entidades canónicas del top 200 pueden jugar aunque la política de audiencia moderna las excluiría por edad o fecha ausente. Las entidades restantes se conservan como raw/histórico para auditoría, pero no generan retos, selecciones aleatorias, rankings visibles ni trabajo de imágenes.

Un jugador canónico cuenta una sola vez aunque aparezca en varias categorías.

## Matriz elegida: auditoría exacta

La auditoría `npm run audit:7x7` valida ahora exclusivamente las siete categorías fijadas en `DATA_7X7_OPTIONS.md`; no puede sustituirlas por una combinación técnicamente más cómoda del catálogo.

| Categoría | Snapshot seleccionado | Estado | Entradas | Jugables top 200 | Jugables top 90 | Bloqueo actual |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `club-career-yellow-cards` | `rs_d4763396b3eecd9d94a49831` | draft | 200 | 200 | 91 | cobertura incompleta |
| `club-career-red-cards` | `rs_1ff5a575c51e9641ac0ba0d8` | draft | 200 | 200 | 120 | cobertura incompleta |
| `club-career-titles` | `rs_9db3675a17b09bda84327786` | draft | 200 | 200 | 109 | cobertura incompleta |
| `world-cup-goals` | `rs_7cc0d9cf795a275b93106c43` | draft | 200 | 200 | 111 | ninguno de audiencia; faltan cobertura legal/publicación |
| `player-career-goals` | `rs_c2c4a7942b4f8d2bd156306c` | draft | 200 | 200 | 92 | cobertura incompleta |
| `national-league-club-titles` | `rs_03cd0c83381d9bf58472f846` | draft | 200 | 200 | 99 | cobertura mundial incompleta |
| `european-cup-champions-league-club-titles` | `rs_a5608e2d2d543e7e8a25e045` | draft | 24 | 24 | 24 | ninguno estadístico; faltan derechos/publicación |

Resultado verificado el 14 de septiembre de 2026 tras aplicar la migración `078_admit_selected_historical_daily_matrix_players.sql`: `ready=false`, sin combinación común válida de cinco jugadores y dos equipos para esta matriz. La intersección de los snapshots seleccionados sí contiene 1 jugador común (Cristiano Ronaldo) y 6 equipos comunes; los seis equipos quedan dentro del top 90, pero la matriz exige cinco jugadores. El manifiesto versionado `backend/data/manifests/openfootball-national-league-titles-2026-09-14.json` amplió el snapshot nacional a 200 equipos procedentes de 296 temporadas y 73 competiciones, pero sigue sin demostrar cobertura mundial. Después se ejecutaron las consolidaciones locales de identidades: API-Football enlazó 7 jugadores y football-data enlazó 68 clubes; quedaron 3 conflictos de ranking de API-Football conservados sin enlace automático por posible duplicación o ambigüedad. Las consolidaciones DFB y BDFutbol no añadieron enlaces. Los números de esta tabla son una fotografía de la auditoría; deben regenerarse tras cada nueva carga o consolidación.

Como evidencia auxiliar, `enrich:wikidata:birth-dates --category world-cup-goals --limit 70 --apply` registró el snapshot `src_2f76a3d3829f0f05b4d422e9`: 34 fechas exactas aplicadas, 28 coincidencias no únicas y 8 errores. Wikidata se usa aquí solo para enriquecer identidad/fecha; no aporta los goles ni aprueba la fuente estadística.

## Contadores verificados

| Métrica | Valor |
| --- | ---: |
| Límite por categoría | 200 |
| Categorías activas | 115 |
| Categorías con cobertura completa | 75 / 115 = 65,2% |
| Snapshots publicados | 0 |
| Fuentes con derechos aprobados | 0 |
| Jugadores canónicos | 72.809 |
| Jugadores canónicos fuera del corte | 62.614 |
| Jugadores jugables | 6.793 |
| Jugadores jugables fuera del top 200 | 0 |
| Retratos legales aprobados | 1.795 assets / 1.659 personas |
| Jugadores jugables con retrato | 1.032 |
| Jugadores jugables sin retrato | 5.761 |
| Cobertura legal de retratos | 1.032 / 6.793 = 15,19% |
| Disponibilidad visual del juego (licenciado o fallback) | 6.793 / 6.793 = 100% |
| Retratos pendientes | 4.087 |
| Retratos pendientes fuera del top 200 | 0 |
| Personas con múltiples retratos locales | 0 |
| Cadenas de identidad de más de un salto | 0 |
| Clubes jugables | 232 |
| Escudos de clubes publicables | 0 |

La cobertura legal cuenta personas jugables únicas, no posiciones repetidas, candidatos pendientes, assets rechazados ni jugadores raw fuera de corte. La disponibilidad visual incluye el fallback propio, que permite jugar pero no sustituye la cobertura legal.

## Fallback visual

El backend expone `/v1/media/:entityId/fallback` para jugadores jugables y equipos activos sin media aprobada. Genera un avatar propio determinista de iniciales en WebP 512×512. Rankings públicos y retos lo devuelven como `image_status: "fallback"` cuando no existe un asset aprobado. No se guarda en `image_assets`, no concede derechos sobre la persona o el club y no se cuenta como retrato legal en las métricas anteriores.

## Fuente de verdad

Los informes anteriores con cifras distintas son históricos y no deben utilizarse para medir el progreso actual. El estado se debe regenerar con:

```bash
cd backend
./node_modules/.bin/tsx src/cli.ts audit-data-readiness
./node_modules/.bin/tsx src/cli.ts cleanup-data-catalog
./node_modules/.bin/tsx src/cli.ts verify-game-catalog
```

`cleanup-data-catalog` debe permanecer en `dry-run` salvo que exista una orden explícita de purga. El raw/histórico se conserva; la exclusión del juego se controla mediante el perfil jugable y los filtros top-200.

`verify-game-catalog` es el guard de publicación: falla si hay perfiles jugables, retratos pendientes o decisiones de retos publicados fuera del top-200, o si hay más de un retrato primario por persona canónica.
