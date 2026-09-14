# Estado operativo actual de datos

Última verificación: 14 de septiembre de 2026 (UTC), mediante `audit-data-readiness`, `verify-game-catalog` y `cleanup-data-catalog` en modo `dry-run`.

## Regla del circuito jugable

Solo se consideran jugables los jugadores con al menos una entrada en un snapshot activo y no superseded con `rank <= 200`. Las entidades restantes se conservan como raw/histórico para auditoría, pero no generan retos, selecciones aleatorias, rankings visibles ni trabajo de imágenes.

Un jugador canónico cuenta una sola vez aunque aparezca en varias categorías.

## Contadores verificados

| Métrica | Valor |
| --- | ---: |
| Límite por categoría | 200 |
| Categorías activas | 113 |
| Categorías con cobertura completa | 75 / 113 = 66,4% |
| Snapshots publicados | 0 |
| Fuentes con derechos aprobados | 0 |
| Jugadores canónicos | 72.809 |
| Jugadores canónicos fuera del corte | 62.614 |
| Jugadores jugables | 6.675 |
| Jugadores jugables fuera del top 200 | 0 |
| Retratos legales aprobados | 1.795 assets / 1.659 personas |
| Jugadores jugables con retrato | 1.030 |
| Jugadores jugables sin retrato | 5.645 |
| Cobertura legal de retratos | 1.030 / 6.675 = 15,43% |
| Disponibilidad visual del juego (licenciado o fallback) | 6.675 / 6.675 = 100% |
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
