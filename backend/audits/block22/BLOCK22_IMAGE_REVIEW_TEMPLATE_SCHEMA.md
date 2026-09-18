# BLOQUE 22 — plantilla manual de imágenes

Filas: **307**. Editar solo con enlaces que el propietario pueda revisar.

No se descargan imágenes ni se aprueba ningún activo automáticamente. Una fila con enlace debe conservar autor, licencia, atribución, fecha, huella SHA-256 y evidencias de identidad/derechos.

Columnas:

- `entityId`
- `canonicalName`
- `category`
- `currentImage`
- `proposedUrl`
- `author`
- `license`
- `licenseUrl`
- `attribution`
- `reviewDate`
- `status`
- `observations`
- `resourceSha256`
- `identityVerified`
- `identityEvidenceUrl`
- `licenseVerified`
- `attributionVerified`
- `rightsEvidenceUrl`

Los estados permitidos para incorporar una propuesta son `pending_review` o `needs_source`; `approved` y `published` están prohibidos en esta fase.
