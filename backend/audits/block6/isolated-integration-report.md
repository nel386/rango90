# Informe de integración aislada

Estado: `passed` para el entorno PostgreSQL efímero de esta ejecución. El mismo run `block6a-20260916-001` también verificó el fixture oficial sintético.

La prueba real está implementada en [rankings-route.isolated.integration.test.ts](../../src/tests/rankings-route.isolated.integration.test.ts). Verifica que la URL exista, que sea distinta de `DATABASE_URL`, que PostgreSQL responda y que `/v1/rankings/world-cup-goals` devuelva el contrato `ranking_not_available` en `official` cuando no hay snapshot publicado.

Se creó un contenedor PostgreSQL efímero en `127.0.0.1:55432`, se aplicaron las 84 migraciones y se ejecutó `npm run test:integration` con `DATABASE_URL` apuntando únicamente a esa base. La suite cubrió health/configuración mediante smoke de endpoints, reto diario, ranking, sesión, decisiones, resultado, duplicación, conflictos, expiración, leaderboard, duelos y replay. La prueba específica `test:rankings:isolated` también pasó con una URL aislada distinta de `DATABASE_URL`.

En modo `lab`, el fixture `integration-daily-v1` se sirvió como `testOnly=true`, `runtimeMode=lab`, `provisionalData=true`, con snapshots draft y fallback. En modo `official`, ese mismo reto devolvió `503 official_not_ready`; el ranking draft devolvió `404 ranking_not_available` con `reason=no_published_snapshot`.

El fixture oficial sintético sí se creó temporalmente para QA: siete categorías, snapshots publicados, fuentes con derechos aprobados, entidades jugables, imágenes aprobadas, scores consistentes y reto `testOnly=false`. `official` cargó el reto y su ranking; un ranking draft y un reto inválido continuaron bloqueados. Se limpió antes de destruir el contenedor y no tiene posibilidad de llegar a la base real.

Esto no certifica ningún snapshot productivo ni convierte el draft de laboratorio en oficial. La base efímera y su contenedor fueron eliminados al terminar.
