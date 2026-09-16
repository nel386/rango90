# BLOQUE 4 — Verificación del flujo de juego

Estado: implementado en frontend y contratos de sesión; sin cambios en datos.

## Garantías

- `GameFlowState` separa carga, inicio de sesión, juego, envío, feedback, finalización, abandono, error y `official_not_ready`.
- La carga diaria se deduplica por ciclo, admite `AbortController`, timeout controlado y reintento explícito.
- `Reintentar carga` nunca inicia una sesión. `Jugar` valida una única respuesta de `POST /v1/games` antes de entrar en `playing`.
- Las decisiones se bloquean durante el envío y las respuestas tardías se ignoran tras abandono, expiración, reinicio o desmontaje.
- El reloj usa exclusivamente `deadlineAt`; la expiración se procesa una sola vez y también se reevalúa al volver de una pestaña suspendida.
- La imagen actual y la siguiente se precargan sin bloquear el juego; hay fallback, monograma y cancelación de cargas visuales.
- El feedback presenta la categoría elegida, jugador, puesto, puntuación, mejor categoría, mejor puesto y diferencia usando la respuesta del servidor.
- La transición de feedback es breve, tiene botón `Continuar` y se cancela al abandonar.
- El modo laboratorio sigue visible mediante el banner existente; el reto oficial no hace fallback al laboratorio.

## Tests ejecutados

Tests puros de frontend:

```bash
cd backend
npm run test:frontend-flow
npx tsx src/tests/game-flow-boundaries.test.ts
```

Incluyen deduplicación de carga, timeout, cancelación, validación de sesión, máquina de estados, reloj con reloj controlado, precarga rápida/lenta/rota, fallback, cancelación y respuestas visuales obsoletas.

Checks del repositorio:

```bash
npm test
npm run lint
npm run typecheck
npm run verify:i18n
npm run build
cd backend && npm run build
```

No se ejecutó `npm run test:integration`: el test existente escribe y borra fixtures PostgreSQL y queda reservado para una base efímera o aislada en QA. No se modificaron tablas, snapshots, fuentes, derechos ni retos.
