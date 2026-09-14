# QA de runtime local

Fecha: 14 de septiembre de 2026 (UTC)

Se levantó el backend compilado (`npm start`) contra la instancia PostgreSQL local y se probaron los endpoints mediante HTTP en `127.0.0.1:4000`.

| Caso | Resultado observado | Evaluación |
| --- | --- | --- |
| `GET /health` | `200`, `{"ok":true,"service":"rango90-backend"}` | Correcto |
| Cabeceras de seguridad | `nosniff`, `DENY`, `no-referrer` | Correcto |
| `GET /v1/categories` | `200`, lista vacía | Correcto para la base sin categorías publicadas |
| `GET /v1/challenges/daily` | `404`, `daily_challenge_not_found` | Guard correcto: no inventa un reto |
| `GET /v1/rankings/club-career-goals` | `404`, ranking no publicado | Guard correcto: no expone snapshots draft |
| `POST /v1/games` desde origen no permitido | `403`, `csrf_origin_rejected` | Correcto |

También pasaron las regresiones automatizadas del frontend y backend, incluyendo lint, typecheck, builds estáticos, pruebas de contratos, rate limit y compilación de APK debug.

La prueba `npm run test:integration` también pasó y limpió su fixture sintético: verificó sesión, inicio de partida, cálculo de resultado, idempotencia, conflicto de resultados, intento de manipulación, expiración, leaderboard, duelos y replay.

## Límites de esta evidencia

- No existe todavía un reto o snapshot publicado contra el que probar el flujo completo de partida.
- No hay dispositivo ni emulador conectado para una prueba de instalación e interacción Android.
- No sustituye QA visual/manual en navegador, móvil, español, inglés y accesibilidad.
- La base local contiene datos draft y fuentes sin derechos aprobados; no se alteró ese estado para forzar un resultado positivo.
