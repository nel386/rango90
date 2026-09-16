# BLOQUE 6 — QA aislado y puerta de publicación

Estado actual: `readyForRelease=false`.

Última ejecución unificada BLOQUE 6A: `runId=block6a-20260916-001`, `timestamp=2026-09-16T00:00:00.000Z`, base aislada `rango90_block6a`, huella `655ebebed442500f5a6f7a91a6a216b00253ae0a79efd7ee675b4a93236770da`.

Este bloque no publica, aprueba ni modifica datos. La integración PostgreSQL está diseñada para aceptar únicamente `RANGO90_ISOLATED_DATABASE_URL` y rechazar una URL igual a `DATABASE_URL`. Si falta la variable, el estado es `integration_pending`; no se interpreta como una prueba pasada.

## Evidencia

- Puerta reproducible: `cd backend && npm run verify:block6-release`.
- Resultado: [backend/audits/block6/block6-release-gate.json](backend/audits/block6/block6-release-gate.json).
- Evidencia normalizada: [backend/audits/block6/block6-evidence.json](backend/audits/block6/block6-evidence.json).
- Informe de la ejecución: [backend/audits/block6/block6-report.md](backend/audits/block6/block6-report.md).
- Matriz: [backend/audits/block6/test-matrix.md](backend/audits/block6/test-matrix.md).
- Integración aislada: [backend/audits/block6/isolated-integration-report.md](backend/audits/block6/isolated-integration-report.md).
- Auditoría pública GET: [backend/audits/block6/public-readonly.json](backend/audits/block6/public-readonly.json).
- Auditoría móvil: [backend/audits/block6/mobile-audit.md](backend/audits/block6/mobile-audit.md).

## Bloqueos honestos

1. La integración aislada y el fixture oficial sintético pasaron contra un contenedor PostgreSQL efímero; no se usó `DATABASE_URL` real. La URL se eliminó al terminar.
2. La auditoría pública de solo lectura falló contra el despliegue actual: `/v1/config` devuelve 404, no expone el modo, el reto diario público continúa en `testOnly=true` y el ranking público devuelve el contrato antiguo.
3. No hay navegador/capturador disponible en esta sesión; la auditoría visual móvil queda `not_run` y no se han creado capturas ficticias.
4. La puerta oficial permanece cerrada mientras exista cualquier evidencia `failed` o `not_run`.

## Verificación de código

Pasaron los tests puros, lint, typecheck, i18n y builds frontend/backend. La auditoría de rankings y medios se ejecutó en modo explícito `lab` y conserva sus hashes. La prueba aislada está añadida, pero debe ejecutarse en un entorno efímero preparado con el esquema completo:

```bash
cd backend
RANGO90_ISOLATED_DATABASE_URL='postgres://usuario:clave@host:5432/rango90_qa' npm run test:rankings:isolated
```

La suite no debe recibir la URL de la base real. En esta ejecución se aplicaron las migraciones en un contenedor efímero, se sembró un reto `draft` `testOnly`, se verificó `lab` (`200`, `provisional`, fallback), se verificó `official` (`503 official_not_ready`) y se ejecutó la integración completa del contrato. El contenedor se eliminó al terminar.
