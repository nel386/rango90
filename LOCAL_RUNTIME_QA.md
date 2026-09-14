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

## Smoke manual de navegador

Se sirvió el build estático Android en `127.0.0.1:4174` y se abrió con Chromium headless. Se comprobó el DOM resultante en viewport de escritorio (`1280x900`) y móvil emulado (`390x844`), para ambos idiomas.

| Caso | Resultado observado | Evaluación |
| --- | --- | --- |
| `/es/` | `lang=es`, título en español, encabezado `La tabla no ha cargado.`, estado `role=alert`, navegación etiquetada y enlace `/en/` | Correcto para estado sin backend/reto publicado |
| `/en/` | `lang=en`, título en inglés, encabezado `The table did not load.`, estado `role=alert`, navegación etiquetada y enlace `/es/` | Correcto para estado sin backend/reto publicado |
| `/es/` y `/en/` a `390x844` | Misma estructura accesible; no hubo error de renderizado ni HTML de fallback 404 | Smoke móvil correcto |

## QA funcional con fixture aislada

Para cubrir el recorrido interactivo sin publicar datos no autorizados, se levantó una fixture sintética local y se accedió al build mediante un proxy HTTPS local. La fixture se eliminó al terminar y no representa datos de producción.

| Caso | Resultado observado | Evaluación |
| --- | --- | --- |
| Español, escritorio `1280x900` | Inicio → `Jugar reto` → dos decisiones (`Goles integración` y `Asistencias integración`) → resultado; puntuación total `3`; filas oficiales visibles y guardado como invitado | Flujo funcional correcto con fixture |
| Inglés, móvil emulado `390x844` | Inicio → `Play challenge` → dos decisiones → `See result`/resultado; puntuación total `3`; guardado como invitado; `lang=en` conservado | Flujo funcional responsive correcto con fixture |
| API del reto diario | Respuesta `200` a través del proxy HTTPS después de corregir el hash de la fixture; el guard también devolvió `503 challenge_hash_mismatch` ante un hash inconsistente | Integridad y guard de publicación correctos |

Esta evidencia cubre el flujo de aplicación con datos sintéticos, pero no sustituye la comprobación contra un reto diario real, la QA visual exhaustiva, la prueba en un dispositivo Android físico ni una revisión externa.

## Límites de esta evidencia

## Revalidación local — 14/09/2026 12:12 UTC

Se reconstruyeron los artefactos estáticos con `NEXT_PUBLIC_API_BASE_URL` apuntando a un origen HTTPS de QA y pasaron `build:pages`, `verify:pages`, `build:android` y `verify:android`. Chromium 152 headless sirvió `out/` en `127.0.0.1:4174` y comprobó `/es/` y `/en/`: ambas rutas terminaron con estado 0, `lang` correcto, título localizado, `role="alert"` y enlace al idioma contrario. Esta ejecución confirma nuevamente el smoke de arranque y accesibilidad del estado sin backend publicado.

## Revalidación local — 14/09/2026 14:47 UTC

Se repitió el smoke sirviendo el `out/` recién generado en `127.0.0.1:4174` y ejecutando Chromium 152 headless con ventana `390x844`. `/es/` y `/en/` devolvieron HTML válido, atributo `lang` correcto, títulos localizados, `role="alert"` y enlaces de cambio de idioma. `manifest-es.webmanifest` conservó `start_url: ./es/`, `display: standalone` y `lang: es`. También pasaron `build:pages`, `verify:pages`, `build:android`, `verify:android` y `verify:i18n` con `NEXT_PUBLIC_API_BASE_URL=https://api.example.com`.

- No existe todavía un reto o snapshot publicado real contra el que probar el flujo completo; la prueba funcional anterior usa únicamente una fixture sintética aislada.
- No hay dispositivo ni emulador conectado para una prueba de instalación e interacción Android.
- No sustituye QA visual exhaustivo ni una prueba en un dispositivo Android físico; el smoke de navegador anterior cubre arranque, estados de error, idiomas, estructura accesible y viewport móvil emulado.
- La base local contiene datos draft y fuentes sin derechos aprobados; no se alteró ese estado para forzar un resultado positivo.
