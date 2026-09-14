# Fixture de integración del contrato online

`src/integration-seed.ts` materializa un reto multicategoría sintético y
aislado para probar el contrato HTTP. No representa datos futbolísticos reales,
no usa proveedores externos y no debe ejecutarse en producción.

## Arranque local

```bash
cd backend
docker compose up -d postgres
# Aplicar las migraciones SQL del directorio migrations en orden.
npm run seed
npm run seed:integration -- --date 2026-09-13
npm run dev
```

El seed crea o reutiliza:

- reto diario publicado `integration-daily-v1`;
- categorías `integration-test-goals` e `integration-test-assists`;
- dos entidades y sus perfiles jugables;
- dos snapshots publicados y cuatro respuestas servidoras.

La publicación es deliberadamente exclusiva de integración: el script rechaza
`NODE_ENV=production`, detecta colisiones con otro reto diario de la misma
fecha y es idempotente si el fixture ya está publicado.

## Flujo manual

```bash
curl http://localhost:4000/v1/challenges/daily

curl -X POST http://localhost:4000/v1/games \
  -H 'content-type: application/json' \
  -d '{"challengeId":"integration-daily-v1"}'
```

La respuesta de `POST /v1/games` contiene `sessionToken` y `game.id`. Enviar
después las dos elecciones con `Idempotency-Key`; el resultado válido del
fixture suma 3 puntos (`1 + 2`). El cliente no debe enviar ni confiar en
`scoreValue`, `totalScore`, `timedOut` o `resultHash`: el backend los deriva de
la matriz publicada y del reloj servidor.

El test `src/tests/game-contract.integration.test.ts` cubre además el diario,
sesión, resultado, clasificación, duelo, unión, ambos resultados, timeout,
respuestas inválidas, resultados manipulados, conflictos de idempotencia y
repeticiones duplicadas.
