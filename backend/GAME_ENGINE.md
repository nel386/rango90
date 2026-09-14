# Motor de partidas — fase 2

Este documento describe las reglas provisionales implementadas en `src/game-engine.ts`. El motor es puro: no importa PostgreSQL, Fastify, autenticación ni proveedores externos. Recibe un reto publicado ya materializado y devuelve estados y resultados inmutables; por tanto puede ejecutarse igual en tests locales, en un servicio de partidas o en una tarea de validación posterior.

## Reglas de juego

1. Un reto publicado identifica un `id`, una `sourceVersion`, un límite de tiempo, un tope de puntuación, una lista ordenada de categorías y una lista ordenada de decisiones.
2. Cada decisión identifica una entidad y contiene la puntuación histórica de esa entidad para todas las categorías. El motor usa el `score_value` ya publicado —la posición del ranking, con su tope— y no consulta ni recalcula rankings durante la partida.
3. El reto debe tener el mismo número de categorías y decisiones. Cada entidad, categoría y ordinal debe ser único; la matriz debe estar completa. Así, cada entidad recibe exactamente una categoría y cada categoría se utiliza exactamente una vez.
4. `startGame` fija `startedAtMs` y calcula `deadlineAtMs`. El reloj que importa es el del servidor o el del caller confiable, nunca un tiempo enviado por el navegador sin comprobar.
5. Solo se acepta la decisión cuyo `ordinal` y `entityId` coinciden con el turno actual. Una categoría desconocida, ya usada o una respuesta fuera de la matriz se rechaza.
6. Al aceptar una respuesta, el servidor obtiene la puntuación de la matriz. Nunca confía en un `scoreValue` enviado por el cliente.
7. La partida finaliza cuando se completa la última decisión. Una respuesta en `nowMs >= deadlineAtMs` llega tarde: no se acepta y se aplica el timeout.
8. En timeout, las decisiones pendientes se completan en el orden publicado con las categorías restantes en su orden publicado y `scoreCap` como puntuación. El cierre se fija exactamente en el deadline, haciendo que el resultado no dependa de cuándo se procese el timeout.
9. Gana el resultado con menor `totalScore`. Los empates se resuelven por menor tiempo exacto (`elapsedMilliseconds`) y, si aún coinciden, por orden lexicográfico de `resultHash`. Dos resultados idénticos empatan.
10. `calculateGameResult` genera el total, tiempos, asignaciones, versión del motor y un SHA-256 de la representación canónica. `validateGameResult` vuelve a derivar puntuaciones, orden, timeout, total, tiempos y hash antes de aceptar un resultado.
11. `InMemoryResultSubmissionLedger` es un fixture del límite de persistencia. Por jugador y reto, una misma clave de idempotencia con el mismo hash devuelve `duplicate`; la misma clave con otro resultado da conflicto; otra clave con el mismo hash también devuelve `duplicate`.

## Flujo del motor

```text
reto publicado + startedAtMs
        │
        ▼
    startGame ──► getCurrentDecision
        │                  │
        │             submitDecision
        │                  │
        ├── respuesta válida ──► siguiente ordinal
        │                              │
        ├── última respuesta ──────────┴──► calculateGameResult
        │
        └── deadline alcanzado ──► expireGame ──► calculateGameResult
                                                   │
                                      validateGameResult + ledger
```

El módulo no muta el estado recibido. La capa que lo use debe persistir la transición de forma atómica cuando exista almacenamiento; esta fase no añade endpoints ni migraciones.

## Contrato de datos y reproducibilidad

`PublishedGameChallenge` es el agregado que necesita el motor. La matriz `scoreByCategory` queda deliberadamente en el lado servidor. `getCurrentDecision` devuelve solo entidad, ordinal y categorías disponibles, de modo que una futura API no tenga que exponer respuestas antes de tiempo.

El hash incluye el reto, su versión, la versión del motor, las marcas temporales, el timeout, el orden completo de asignaciones y el total. La serialización ordena las claves de objetos antes de aplicar SHA-256. Un cambio de snapshot o de algoritmo invalida el resultado anterior.

## Decisiones para el futuro backend

- El esquema actual `challenges`/`challenge_items` representa un reto diario basado en una sola categoría y no contiene por sí solo la matriz entidad-categoría de esta fase. No se fuerza una migración todavía. Un adaptador futuro debe construir un `PublishedGameChallenge` completo desde un agregado versionado, o introducir tablas específicas de partidas publicadas, antes de abrir endpoints.
- La `sourceVersion` debe apuntar a una versión inmutable del snapshot y el payload publicado debe conservar un hash. No se debe leer el ranking “latest” mientras una partida está activa.
- La transición de `submitDecision` debe protegerse con control de concurrencia (por ejemplo, versión de estado o bloqueo optimista) para que dos peticiones no acepten el mismo ordinal.
- La persistencia de resultados debe tener restricciones únicas equivalentes a `(player_id, challenge_id, idempotency_key)` y `(player_id, challenge_id, result_hash)`, con validación del motor dentro de la transacción. El ledger en memoria solo sirve para fixtures y tests.
- El `playerId` es parte del scope de idempotencia: dos jugadores pueden producir el mismo resultado legítimamente. La política de “un único intento” por jugador y reto queda abierta para una decisión de producto posterior.
- El resultado guarda milisegundos aunque la presentación pueda mostrar segundos. Esto evita empates artificiales por redondeo y permite una clasificación estable.
- La autenticación existente puede aportar `playerId`, pero no debe cambiar las reglas ni introducir acceso directo del motor a la base de datos.

## Tests locales

`src/tests/game-engine.test.ts` y `src/tests/fixtures/gameChallenge.ts` cubren inicio y orden, suma reproducible, desempates, categorías y respuestas inválidas, duplicados, límite exacto, timeout parcial y completo, validación contra manipulación de puntuación/orden/tiempo/hash, retos ambiguos e idempotencia por clave, hash y jugador.
