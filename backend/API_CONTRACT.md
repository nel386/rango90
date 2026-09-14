# Contrato online de partidas — fase 3

Base URL local: `http://localhost:4000`. Las respuestas usan JSON. El backend no realiza peticiones a proveedores externos durante una partida: carga un `game_challenge` publicado y sus snapshots antes de crear la sesión.

## Modelo de acceso

Jugar es anónimo: `POST /v1/games` devuelve un `sessionToken` opaco y el cliente debe conservarlo. La autenticación existente sigue funcionando mediante la cookie HttpOnly `rango90_session`. Si una sesión anónima se envía mientras el usuario está autenticado, el resultado se asocia a ese usuario.

Guardar progreso y aparecer en una clasificación requiere una cuenta autenticada. Un resultado anónimo se conserva y se valida, pero no entra en `/leaderboard`. El token de sesión o de participante es obligatorio para evitar que un identificador público sea suficiente para modificar una partida.

Los endpoints de escritura devuelven errores con esta forma:

```json
{
  "error": "result_invalid",
  "message": "The idempotency key was used with another result"
}
```

Los resultados oficiales se construyen en el servidor desde `assignments`. El cliente no controla `scoreValue`, `totalScore`, `elapsedMilliseconds`, `timedOut` ni `resultHash`; esos valores se recalculan con el motor y con el reloj del servidor.

## Reto diario y sesión

### `GET /v1/challenges/daily`

Devuelve el último reto diario publicado. También existe `GET /v1/challenges/:challengeId` para recuperar un reto concreto publicado. Las decisiones están ordenadas por `ordinal` y no contienen la matriz de puntuaciones.

```json
{
  "challenge": {
    "id": "gc_2026-09-09",
    "kind": "daily",
    "challengeDate": "2026-09-09",
    "sourceVersion": "rankings-2026-09-08-v4",
    "engineVersion": "game-engine-v1",
    "timeLimitSeconds": 90,
    "scoreCap": 100,
    "decisionCount": 7,
    "categories": [
      { "ordinal": 0, "id": "category-career-goals", "rankingSnapshotId": "rs_2026_09_08_goals", "slug": "career-goals", "labelEs": "Goles", "labelEn": "Goals" }
    ],
    "challengeSha256": "64-hexadecimal-sha256",
    "decisions": [
      { "ordinal": 0, "entityId": "pl:player:1", "name": "Jugador A", "shortName": "JA", "entityType": "player" }
    ]
  }
}
```

### `POST /v1/games`

Inicia una sesión a partir de un reto publicado. La hora, deadline y token los fija el backend. `201 Created`:

```json
{
  "sessionToken": "opaque-token",
  "game": {
    "id": "gs_7f…",
    "challengeId": "gc_2026-09-09",
    "status": "active",
    "startedAt": "2026-09-09T12:00:00.000Z",
    "deadlineAt": "2026-09-09T12:02:00.000Z",
    "currentOrdinal": 0
  },
  "challenge": { "id": "gc_2026-09-09", "decisionCount": 7 }
}
```

El contrato actual envía el resultado completo de elecciones al final; el navegador puede mostrar las decisiones en el orden recibido, pero no necesita ni debe recibir sus scores.

### `POST /v1/games/:gameId/result`

Requiere `Idempotency-Key` (8–200 caracteres), `sessionToken` y las elecciones. Solo se usa la parte de elección del payload:

```http
POST /v1/games/gs_7f…/result
Idempotency-Key: result-20260909-01
Content-Type: application/json
```

```json
{
  "sessionToken": "opaque-token",
  "result": {
    "assignments": [
      { "ordinal": 0, "entityId": "pl:player:1", "categorySlug": "career-goals" },
      { "ordinal": 1, "entityId": "pl:player:2", "categorySlug": "ballon-dor" }
    ]
  }
}
```

El backend usa la hora actual del servidor como final para un resultado normal. Si la hora ha alcanzado el deadline, se rechaza este envío y debe usarse `/expire`. Una misma petición repetida devuelve `200` con `duplicate: true`; una misma clave con otra elección devuelve `409 submission_conflict`.

```json
{
  "accepted": true,
  "duplicate": false,
  "leaderboardEligible": true,
  "resultId": "gr_…",
  "result": {
    "challengeId": "gc_2026-09-09",
    "sourceVersion": "rankings-2026-09-08-v4",
    "engineVersion": "game-engine-v1",
    "startedAtMs": 1788955200000,
    "finishedAtMs": 1788955208123,
    "elapsedMilliseconds": 8123,
    "elapsedSeconds": 8,
    "timedOut": false,
    "assignments": [],
    "totalScore": 42,
    "resultHash": "64-hexadecimal-sha256"
  }
}
```

### `POST /v1/games/:gameId/expire`

Requiere `sessionToken`. Solo funciona después del deadline. Puede incluir las elecciones ya realizadas en `result.assignments`; el backend las valida con el motor, completa únicamente las pendientes con la regla determinista de `GAME_ENGINE.md`, persiste un resultado oficial y marca la sesión como `expired`. Es idempotente si ya existe un resultado.

```json
{
  "sessionToken": "opaque-token",
  "result": { "assignments": [
    { "ordinal": 0, "entityId": "pl:player:1", "categorySlug": "career-goals" }
  ] }
}
```

### `POST /v1/games/:gameId/replay`

Requiere `sessionToken` y solo permite repetir una sesión `completed` o `expired`. Crea otra sesión con nuevo token, conserva `replay_of_session_id` y vuelve a fijar el reloj; no altera el resultado anterior.

## Clasificación

### `GET /v1/challenges/:challengeId/leaderboard?limit=100`

Es pública para lectura, pero solo incluye el mejor resultado de cada jugador autenticado. El orden es `totalScore ASC`, `elapsedMilliseconds ASC`, `resultHash ASC`. Los resultados anónimos no aparecen.

```json
{
  "challengeId": "gc_2026-09-09",
  "entries": [
    {
      "rank": 1,
      "playerId": "user_1",
      "displayName": "Rango Player",
      "totalScore": 42,
      "elapsedMilliseconds": 8123,
      "elapsedSeconds": 8,
      "resultHash": "…",
      "timedOut": false,
      "submittedAt": "2026-09-09T12:00:08.123Z"
    }
  ]
}
```

## Duelos asíncronos

Un duelo tiene dos participantes independientes. Cada uno recibe su propio `startedAt` y deadline al crear o unirse, por lo que no depende de que ambos estén conectados a la vez.

### `POST /v1/duels`

Body: `{ "challengeId": "gc_2026-09-09" }`. La autenticación es opcional. Devuelve un código compartible y el token privado del primer participante:

```json
{
  "duel": { "id": "duel_…", "code": "A1B2C3D4E5F6A7B8", "status": "open", "challengeId": "gc_2026-09-09", "expiresAt": "2026-09-16T12:00:00.000Z" },
  "participantToken": "opaque-token",
  "joinUrl": "/v1/duels/A1B2C3D4E5F6A7B8"
}
```

### `GET /v1/duels/:code`

Consulta pública por código o enlace. Expira el duelo de forma perezosa si supera `expiresAt` y nunca devuelve tokens, hashes de token ni puntuaciones históricas de las respuestas.

### `POST /v1/duels/:code/join`

No requiere cuenta. Si hay plaza, crea el participante 2 y devuelve su `participantToken`. Un tercer participante recibe `409 duel_full`.

### `POST /v1/duels/:code/result`

Requiere `participantToken`, `Idempotency-Key` y el mismo formato de assignments que una partida. El resultado se recalcula con el reloj del servidor y se guarda vinculado a `duel_participant_id`. Cuando ambos participantes tienen resultado, el duelo pasa a `completed`.

### `POST /v1/duels/:code/replay`

Requiere el token de un participante y solo permite repetir duelos `completed` o `expired`. Crea un nuevo código, nuevo token y relación `replay_of_duel_id`.

## Persistencia y restricciones

La migración `028_game_contract.sql` introduce:

- `game_challenges`, `game_challenge_categories`, `game_challenge_decisions` y `game_challenge_answers` para el agregado publicado y su matriz completa.
- `game_sessions` y `game_session_assignments` para el runtime de una partida.
- `game_results` y `game_result_assignments` para el resultado oficial inmutable.
- `duels` y `duel_participants` para invitación, expiración, repetición y los dos resultados independientes.

Incluye FKs a entidades, categorías, snapshots y usuarios; unicidad de ordinal, entidad y categoría; una única daily publicada por fecha; índices de expiración, token, jugador, reto y leaderboard; triggers para impedir publicar matrices incompletas, usar snapshots/categorías no publicadas, superar el score cap o modificar la definición de un reto publicado.

El flujo editorial debe insertar primero el agregado en `draft`, cargar categorías, snapshots, decisiones y la matriz completa, y ejecutar después el cambio a `published`. Una vez publicado, solo puede pasar a `retired`; su contenido no se puede editar.

La persistencia de resultados se realiza dentro de una transacción con bloqueo de la sesión o participante. Las restricciones únicas cubren `(submission_scope, game_challenge_id, idempotency_key)`, `(submission_scope, game_challenge_id, result_hash)`, una sesión y un participante de duelo. El scope es `user:<id>` para partidas autenticadas, `session:<id>` para anónimas y `participant:<id>` para duelos; así el mismo usuario puede jugar el reto diario y un duelo sin colisión.

La política evita peticiones externas durante la partida y conserva la separación entre datos históricos, retos publicados, runtime, resultados y leaderboard.

## Variables de entorno

Obligatorias en un entorno con base de datos:

```dotenv
DATABASE_URL=postgres://usuario:contraseña@host:5432/rango90
PORT=4000
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_WRITE_MAX=60
RATE_LIMIT_READ_MAX=120
TRUST_PROXY=false
```

Autenticación existente:

```dotenv
AUTH_FRONTEND_ORIGIN=http://localhost:3000/es/
AUTH_VERIFICATION_BASE_URL=http://localhost:4000/v1/auth/verify-email
AUTH_EMAIL_WEBHOOK_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4000/v1/auth/google/callback
AUTH_COOKIE_SAMESITE=lax
```

`AUTH_EMAIL_WEBHOOK_URL` es opcional en desarrollo, pero obligatorio para registrar cuentas en producción; la URL de verificación no se escribe en logs de producción. Las tres variables de Google son opcionales. Las variables de proveedores de datos y medios siguen siendo necesarias solo para trabajos de importación o revisión; el contrato de partidas no las consulta.
