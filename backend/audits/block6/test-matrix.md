# Matriz de pruebas BLOQUE 6

| Área | Cobertura prevista | Estado de esta ejecución | Evidencia / bloqueo |
| --- | --- | --- | --- |
| Runtime | `lab` y `official` explícitos | passed en tests puros | `src/tests/runtime-modes.test.ts` |
| Backend PostgreSQL | health, config, challenge, rankings, categorías, partida, resultado, timeout, abandono, duplicación | passed en PostgreSQL efímero | Migraciones + `test:integration` + prueba aislada |
| Fixture oficial sintética | reto oficial válido, ranking publicado, draft/testOnly inválido y cleanup | passed en PostgreSQL efímero | `test:block6:official-fixture`; sin publicación productiva |
| Guards oficiales | draft, testOnly, derechos, cobertura, conflictos, scores, entidades, snapshots superseded | passed en tests puros | `src/tests/game-flow-boundaries.test.ts` y guard de publicación |
| Ranking histórico | filas no jugables conservadas y `playable` separado | passed en contrato/código | `rankingScope=historical_snapshot` |
| Medios | licensed, fallback, unavailable y estados de revisión/derechos | passed en auditoría determinista | `audits/media/playable-media-audit.*` |
| Frontend | carga, partida, feedback, imagen, timeout, abandono, reinicio y rankings | passed en tests puros | Tests de flujo y repositorio |
| Frontend + backend aislados | recorrido completo con fixture PostgreSQL | not_run | No hay capturador/browser automatizado disponible |
| Móvil visual | viewport móvil, overflow, foco, contraste, estados y ES/EN | not_run | Sin navegador/capturador disponible |
| Auditoría pública | frontend, backend, health, config y endpoints GET | failed | `/v1/config` 404, modo ausente, reto público `testOnly=true`, ranking con contrato antiguo |
| Puerta de publicación | todos los requisitos y hashes | blocked | `readyForRelease=false` |
