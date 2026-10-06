# BLOQUE 45G — ranking de temporada activa (seis ligas)

- Estado: **ready_for_isolated_validation**
- Temporada API-Football: **2026**
- Alcance: seis rankings separados por competición; no es carrera ni ranking global.
- Run base: `36574961077` · commit `73f2365eb84cbe23963ae882ec57a0721f149fdc`
- Manifiesto base: `b0ffddc63e0a0d71687642c743d3bb6358f912380040c58a8f9e0ee751caee16`
- Intentos acumulados del checkpoint: 28; esta tanda: 28; reintentos: 0.
- Páginas Primeira Liga pendientes: 0.
- Llamadas exactas para completar desde el checkpoint, incluida una nueva preflight si requiere otra tanda: 0.

| Competición | Estado | Páginas | Filas de hechos | Jugadores con amarillas | Cero explícito | Corte observado |
|---|---:|---:|---:|---:|---:|---|
| Premier League (39) | complete | 26/26 | 511 | 150 | 361 | 2026-09-28T13:45:22.989Z |
| La Liga (140) | complete | 29/29 | 573 | 199 | 374 | 2026-09-28T13:48:51.248Z |
| Serie A (135) | complete | 30/30 | 608 | 132 | 476 | 2026-09-28T13:46:22.479Z |
| Bundesliga (78) | complete | 22/22 | 426 | 110 | 316 | 2026-09-28T13:46:39.473Z |
| Ligue 1 (61) | complete | 24/24 | 468 | 125 | 343 | 2026-09-25T08:40:00.551Z |
| Primeira Liga (94) | complete | 27/27 | 533 | 181 | 352 | 2026-10-06T05:42:20.492Z |

La cuota diaria (`x-ratelimit-requests-remaining`) y el límite por minuto (`X-RateLimit-Remaining`) se registran por respuesta por separado. No se atribuye causa a diferencias entre contadores.

Solo los hechos de respuestas HTTP 200 completas y validadas entran en el candidato. No se guardan payloads crudos ni secretos. No se ejecuta expansión de carrera, importación, load, escritura en base real, snapshot oficial ni despliegue.