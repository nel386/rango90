# Informe de validación de limpieza

Fecha: 2026-09-17 UTC. Validación ejecutada después de aplicar el manifiesto, sin despliegues ni conexión a PostgreSQL de producción.

## Resultado resumido

| Comprobación | Resultado | Nota |
|---|---|---|
| Tests backend completos | PASS | La suite `npm test` terminó correctamente. |
| Tests frontend | PASS | Contrato runtime, flujo, reloj, precarga y repositorio pasaron desde la suite backend. |
| Lint | PASS | 0 errores; 3 warnings preexistentes de variables no usadas en herramientas de Block 15. |
| Typecheck | PASS | Frontend y backend compilan con TypeScript. |
| i18n | PASS | 265 claves compartidas entre `es` y `en`. |
| Build frontend | PASS | `npm run build` terminó correctamente. |
| Build backend | PASS | `npm run build` en `backend/` terminó correctamente. |
| Build/verificación Pages | PASS | Base `/rango90`, PWA y manifests presentes. |
| Build/verificación Android estática | PASS | Base `/`, PWA y manifests presentes. |
| Workflows | PASS | Los 12 YAML parsean con `js-yaml`; no hay interpolación directa de secretos en `run:` ni patrones inseguros conocidos. |
| Migraciones | PASS estático | 86 SQL presentes, orden lexicográfico válido; no se ejecutó `migrate` para no tocar ninguna base. Los prefijos 028 y 029 están repetidos históricamente y se conservan. |
| Auditoría de secretos | PASS con revisión local | No hay secreto rastreado ni coincidencia fuerte en historia; `backend/.env` local queda marcado como posible secreto y no se imprime/modifica. |
| `git diff --check` | PASS | Sin errores de whitespace. |
| Render | PASS | `render.yaml` no cambia. |
| PostgreSQL producción | NO TOCADO | No se usaron workflows ni credenciales de producción. |
| Auditorías/snapshots | PASS | Permanecen auditorías, migraciones, fixtures, capturas y los 1.787 snapshots. |

## Runtime

Los tests de modos de runtime pasan y conservan la separación `lab`/`official`; el modo `official` sigue requiriendo `RANGO90_RUNTIME_MODE` en configuración de producción. El proceso backend arranca con `RANGO90_RUNTIME_MODE=lab` y anuncia escucha en el puerto de prueba. `/health` respondió 503 porque no había PostgreSQL local disponible; no se inició ni modificó una base para ocultar esa condición.

Las integraciones que requieren `RANGO90_ISOLATED_DATABASE_URL` quedaron `integration_pending` por ausencia deliberada de esa URL. Esto no es un fallo de la limpieza y evita tocar una base externa.

## Seguridad de dependencias

`npm audit` del frontend reporta una vulnerabilidad alta en la dependencia directa `playwright`. No se ejecutó `npm audit fix` ni se actualizaron dependencias automáticamente; requiere revisión separada para no mezclar cambios de seguridad funcional con esta limpieza.

## Artefactos y recuperación

Los builds y dependencias regenerados por la validación se movieron al archivo temporal de validación para devolver el workspace a un estado sin salidas generadas. La caché API-Football se movió al archivo inicial. No se eliminó de forma irreversible ningún artefacto autorizado.
