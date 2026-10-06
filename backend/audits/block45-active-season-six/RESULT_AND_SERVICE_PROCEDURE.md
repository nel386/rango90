# BLOQUE 45G — resultado de temporada activa en seis ligas

## Decisión

**GO para probar seis rankings independientes de amarillas de la temporada 2026 en entorno local. NO-GO para actualizar el servicio real, publicar snapshots o llamarlo carrera global.** La fase usa hechos del checkpoint más páginas nuevas de Primeira Liga; conserva cortes independientes por liga.

## Reconciliación y cobertura

El checkpoint `36574961077` ya tenía hechos de cinco ligas. Las **1.692 filas** del recuento previo eran Premier League (511), La Liga (573) y Serie A (608). Bundesliga (426) y Ligue 1 (468) aportan las otras **894**, para **2.586** hechos guardados. Las 131 páginas de esas cinco ligas se reutilizaron; no se repitieron.

El origen queda anclado al commit `73f2365eb84cbe23963ae882ec57a0721f149fdc`, manifiesto `b0ffddc63e0a0d71687642c743d3bb6358f912380040c58a8f9e0ee751caee16`, cobertura `1437e95cc0450e2f78556b54b71ed20dad6ba999edc8f23c7a852f99193bc17e` y hechos `119c843e9233aa74b1a34e34eb9f11cfd791b766c9831ed35a41aa3009df2`.

| Liga | ID | Páginas | Hechos | Jugadores con amarillas positivas | Hechos con cero explícito | Corte por liga |
|---|---:|---:|---:|---:|---:|---|
| Premier League | 39 | 26/26 | 511 | 150 | 361 | 2026-09-28 13:45:22 UTC |
| La Liga | 140 | 29/29 | 573 | 199 | 374 | 2026-09-28 13:48:51 UTC |
| Serie A | 135 | 30/30 | 608 | 132 | 476 | 2026-09-28 13:46:22 UTC |
| Bundesliga | 78 | 22/22 | 426 | 110 | 316 | 2026-09-28 13:46:39 UTC |
| Ligue 1 | 61 | 24/24 | 468 | 125 | 343 | 2026-09-25 08:40:00 UTC |
| Primeira Liga | 94 | 27/27 | 533 | 181 | 352 | 2026-10-06 05:42:20 UTC |
| **Total** |  | **158/158** | **3.119** | **897** | **2.222** | cortes independientes |

Las 27 páginas de Primeira Liga se descubrieron siguiendo `paging.total=27`. Hubo 27 respuestas HTTP 200 completas, 0 reintentos y 0 respuestas 429. Con la preflight válida, la tanda hizo **28 intentos**. No consultó expansión por jugador.

## Cuota observada

La preflight válida `/status` informó HTTP 200, `errors` vacío, límite diario 7.500, `x-ratelimit-requests-remaining=7.445`, y límite por minuto 300 con `X-RateLimit-Remaining=299`. La última página dejó los contadores en 7.417 diarios y 272 por minuto. Entre esas lecturas, la cuota diaria bajó 28 frente a 27 páginas; no se atribuye la unidad de diferencia. Los contadores corresponden a ventanas distintas y no se infiere una causa.

Hubo además dos runs de preparación que ejecutaron solamente `/status` (uno por run, sin páginas). El código los rechazó porque trataba la respuesta de `/status` como una lista; la respuesta real era un objeto, HTTP 200 y sin errores. Se conservaron ambos informes en `preflight-attempts/`. En total se hicieron **30 intentos HTTP** durante el trabajo: 3 preflights y 27 páginas. Los tres informes registraron las mismas cabeceras de cuota al consultar `/status`; el reporte final conserva la preflight válida.

## Validación del ranking

El candidato mantiene una tabla independiente por competición y ordena por amarillas; no mezcla ligas ni interpreta cero como dato ausente. En PostgreSQL efímero se insertaron los **3.119 hechos** en tablas temporales y se recalcularon los **897 jugadores** con `SUM(yellow_cards)`, `RANK()` y `DENSE_RANK()`. Los resultados coincidieron con el JSON, incluidos puestos, empates, grupos de empate y evidencia asociada. El caso revisado queda en La Liga: **Marcos Alonso, 2 amarillas, puesto 20** dentro de esa liga/temporada. No se usó la posición histórica vieja ni se sumaron competiciones.

La validación ejecutada después de corregir el test de SQL pasó con el hash del ranking `b63ea020e7118d69f6e7d8f4ee0b8ce37be1661ee6b23588f9d262280ecca17e`; el informe está en `run-37419802537/BLOCK45_ACTIVE_SEASON_SIX_VALIDATION.json`. La ejecución remota original llegó a PostgreSQL pero su prueba falló por comparar IDs API sin el prefijo canónico `api-football:player:`; se corrigió esa prueba y se repitió contra el mismo artefacto, sin nuevas llamadas a API. El run remoto y su artifact están en [GitHub Actions](https://github.com/nel386/rango90/actions/runs/37419802537).

## Procedimiento exacto para actualizar el servicio

**No se ejecutó ninguno de estos pasos contra el servicio real.** El artefacto candidato todavía usa IDs de API-Football; el backend exige `canonical_player_id` que exista en `entities`, y ese mapeo no está contenido ni validado por esta tanda. Además, la tabla de hechos es append-only: el checkpoint previo detectó 82 valores amarillos que difieren respecto de los hechos actuales. No se deben hacer `UPDATE`, insertar duplicados con la misma clave lógica, ni conservar el snapshot anterior como si fuera equivalente.

Antes de una actualización autorizada:

1. Resolver los 897 IDs del ranking y los IDs de hechos con `entity_identity_links`/entidades existentes; dejar fuera y mostrar cualquier identidad no resuelta. No crear entidades por coincidencia de nombre.
2. Diseñar y probar en PostgreSQL efímero una migración de supersession versionada para los 82 hechos revisados. Mantener todos los hechos de origen y elegir un único hecho efectivo por clave lógica. Los 1.872 hechos adicionales se añaden solo tras comprobar inexistencia lógica. No convertir amarillas en rojas: en nuevas filas las rojas quedan desconocidas (`NULL`).
3. Crear un `club_card_source_capture` con el run `37419802537`, commit de código `28f649f584127c5081a3780ee9881fa4f0460078`, hash de manifiesto y hashes del candidato; insertar los hechos admitidos con IDs canónicos, fuente, página, hash de respuesta y hora de captura.
4. Construir seis snapshots `active_weekly` amarillos de temporada 2026, todos `lab_provisional` al principio, uno por `competition_filter` (`39`, `140`, `135`, `78`, `61`, `94`). Cada uno referencia solo sus hechos y conserva `coverage_complete=true` únicamente al verificar páginas y procedencia. La etiqueta de API debe ser **“Tarjetas amarillas — temporada activa (alcance observado)”**; descriptor: liga seleccionada, temporada 2026, corte propio y `careerComplete=false`.
5. Actualizar el estado de alcance para que las seis ligas aparezcan disponibles solo cuando exista y pase validación cada snapshot correspondiente. El cliente solicita `GET /v1/rankings/club-career-yellow-cards?dataset=active_season_weekly&season=2026&competition=<id>` y el selector cambia únicamente `<id>`; no se usa `complete_scope` para mezclar las seis.
6. En un entorno de staging, verificar endpoint y selector en móvil/escritorio, conteos, empates, hashes, cortes, procedencia y Marcos Alonso. Solo después de revisión y autorización separadas se prepara migración/carga real y despliegue de backend. Esta entrega no autoriza escritura ni despliegue.

La consulta actual de producción y su snapshot no cambian en esta tanda. El ranking de carrera global permanece bloqueado.

## Reproducción

El archivo `run-37419802537/BLOCK45_ACTIVE_SEASON_SIX_RANKING.json` referencia el checkpoint y sus hashes de origen; `BLOCK45_ACTIVE_SEASON_SIX_FACTS.json` contiene los hechos usados y `BLOCK45_ACTIVE_SEASON_SIX_CHECKPOINT.json` registra cada petición y respuesta mediante hashes, sin payloads. El workflow es `.github/workflows/block45-club-yellow-cards.yml`, modo `active-season-six`, `base_run_id=36574961077`; un resume posterior usa el run anterior como `resume_run_id`. Las sumas SHA-256 están en `run-37419802537/SHA256SUMS`.
