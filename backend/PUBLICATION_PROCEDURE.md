# Procedimiento de publicación oficial

Este procedimiento es una guía operativa. La auditoría del BLOQUE 7 no lo
ejecuta y no concede ninguna aprobación.

## Precondiciones

Antes de publicar una categoría, una persona autorizada debe aprobar
explícitamente el informe de candidato y verificar, en una base aislada, el
`runId`, el watermark, los IDs de snapshots y estas huellas:

- `data_version` y `algorithm_version`.
- `content_sha256` del snapshot de ranking.
- `content_sha256` del snapshot de fuente.
- definición completa de alcance y ventana temporal.
- evidencia de derechos de fuente y de imágenes publicables.

El snapshot candidato debe ser una nueva fila append-only en estado `draft`.
Los snapshots históricos no se editan ni se borran.

## Publicación atómica

La publicación autorizada debe ejecutarse en una única transacción:

1. Adquirir un advisory lock estable para la categoría.
2. Bloquear el snapshot candidato con `SELECT ... FOR UPDATE`.
3. Volver a ejecutar todos los gates: categoría aprobada, fuente con derechos
   `approved`, cobertura completa, identidades sin conflicto, scores y
   empates consistentes, entidades válidas y política de imágenes satisfecha.
4. Verificar de nuevo el archivo archivado y su `content_sha256`.
5. Marcar el snapshot publicado anterior de esa categoría como `superseded`.
6. Marcar el candidato verificado como `published`.
7. Registrar actor, motivo, timestamp, IDs, hashes y `runId`.
8. Hacer `COMMIT` únicamente si todas las comprobaciones pasan. Ante cualquier
   error, ejecutar `ROLLBACK`.

No se debe publicar cambiando solo un estado desde una interfaz sin volver a
validar el contenido y los derechos.

## Reversión

La reversión es otra operación autorizada y transaccional. No modifica el
contenido del snapshot publicado: conserva el snapshot actual, lo marca como
`superseded` y vuelve a publicar el snapshot anterior conservado, después de
validar sus hashes y gates. El historial de estados y el motivo de reversión
quedan registrados.

## Registro de auditoría

Cada operación debe producir un registro con:

```json
{
  "action": "publish|rollback",
  "actor": "identidad autorizada",
  "category": "slug",
  "candidateSnapshotId": "snapshot candidato",
  "previousSnapshotId": "snapshot anterior",
  "runId": "auditoría que habilita la operación",
  "dataVersion": "versión",
  "algorithmVersion": "versión",
  "contentSha256": "hash",
  "timestamp": "UTC",
  "result": "committed|rolled_back"
}
```

El informe de candidato y este procedimiento son artefactos de auditoría y
documentación. No son una fuente de datos de producción ni constituyen una
aprobación editorial.
