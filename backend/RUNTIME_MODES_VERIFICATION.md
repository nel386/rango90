# Verificación del BLOQUE 3

Fecha de verificación: 2026-09-16.

La configuración es fail-closed: `RANGO90_RUNTIME_MODE` no tiene valor por
defecto. Fuera de tests, su ausencia o un valor distinto de `lab`/`official`
impide importar la configuración y por tanto impide arrancar el proceso.

## Evidencia ejecutada

- `npm run test:runtime-modes`: pasa los guards lab/official, `testOnly`, derechos `review_required`, cobertura incompleta, snapshot `superseded`, respuesta estable y modo fijo.
- El mismo test verifica que la variable ausente en desarrollo/producción falla, que `lab` y `official` explícitos arrancan y que un valor inválido falla.
- Comprobación de proceso: desarrollo sin la variable termina con error de configuración; producción explícitamente en `lab` carga correctamente el modo `lab`.
- `npm run test:frontend-runtime`: pasa el contrato cliente que acepta laboratorio y rechaza `testOnly` en oficial.
- `npm test` en `backend/`: pasa la suite completa existente y los nuevos tests de runtime.
- `npm run build` en `backend/`: pasa.
- `npm run lint`, `npm run typecheck` y `npm run verify:i18n` en la raíz: pasan.
- Prueba real read-only con `RANGO90_RUNTIME_MODE=lab`: `/v1/config` y `/health` devuelven `runtimeMode=lab`; el endpoint diario no encontró reto en la base actual y devolvió el 404 de laboratorio controlado.
- Prueba real read-only con `RANGO90_RUNTIME_MODE=official`: `/v1/config` y `/health` devuelven `runtimeMode=official`; el endpoint diario devolvió HTTP 503 `official_not_ready` con explicación, bloqueos, requisito de snapshot y sin fallback.
- `npm run test:integration` no se ejecutó: el harness existente inserta, actualiza y borra fixtures en PostgreSQL, incompatible con el criterio de este bloque de no modificar la base. Las pruebas reales anteriores usan `Fastify.inject` y consultas de lectura.

## Estado de datos

No se ejecutaron migraciones, seed, aprobación, publicación, regeneración ni borrado. No se modificaron snapshots, categorías, fuentes, imágenes ni derechos. La base actual no contiene retos en `game_challenges`, por eso la prueba oficial demuestra el estado `official_not_ready`; la prueba de laboratorio confirma que no transforma la ausencia en una publicación falsa.
