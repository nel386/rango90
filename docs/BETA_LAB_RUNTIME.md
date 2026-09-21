# Beta pública en modo laboratorio

La beta pública usa temporalmente el servicio Render existente con:

- `RANGO90_RUNTIME_MODE=lab`;
- la misma `DATABASE_URL` ya configurada en Render;
- la misma URL pública `https://rango90.onrender.com`;
- GitHub Pages apuntando a ese origen.

El cambio de modo no ejecuta seeds, imports, migraciones, aprobación de snapshots ni cambios de derechos. Los retos y rankings que se muestran siguen siendo provisionales y deben llevar la marca de laboratorio.

## Despliegue y reversión

El workflow manual `Deploy Rango90 runtime mode` modifica únicamente la variable `RANGO90_RUNTIME_MODE` del servicio existente, despliega el commit indicado y comprueba el contrato HTTP. Se puede seleccionar `official` para revertir la beta; en ese modo el backend vuelve a rechazar retos no publicables con `official_not_ready` y no hace fallback a lab.

La variable `NEXT_PUBLIC_API_BASE_URL` de Pages conserva `https://rango90.onrender.com`; solo cambia el modo explícito del backend. No se crea otra URL ni otra base de datos.

## Límites de esta beta

La beta no convierte datos provisionales en oficiales. No publica snapshots, no aprueba derechos y no debe usarse como evidencia de disponibilidad official.
