# Manifiesto de limpieza segura

Fecha: 2026-09-17 UTC
Base: `REPOSITORY_CLEANUP_INVENTORY.md` y `REPOSITORY_CLEANUP_INVENTORY.json`
Objetivo: retirar únicamente salidas regenerables y una caché explícita, sin tocar la base de datos ni evidencia.

## Autorizado

| Ruta | Operación | Motivo | Recuperación |
|---|---|---|---|
| `.next/` | eliminar | Build/cache local de Next.js | `npm run build` |
| `out/` | eliminar | Salida estática de Pages/Android | `npm run build:pages` o `npm run build:android` |
| `backend/dist/` | eliminar | JavaScript generado del backend | `npm run build --prefix backend` |
| `node_modules/` | eliminar | Dependencias instaladas | `npm ci` |
| `backend/node_modules/` | eliminar | Dependencias instaladas del backend | `npm ci --prefix backend` |
| `android/.gradle/` | eliminar | Caché de Gradle | Build Android |
| `android/app/build/` | eliminar | Build Android generado | `npm run cap:build:debug`/release |
| `android/build/` | eliminar | Build Android generado | Build Android |
| `android/capacitor-cordova-android-plugins/` | eliminar | Proyecto generado por Capacitor | `npx cap sync android` |
| `android/app/src/main/assets/` | eliminar | Assets copiados por Capacitor | `npx cap sync android` |
| `tsconfig.tsbuildinfo` | eliminar | Caché del compilador | Typecheck |
| `backend/storage/api-football-cache/` | eliminar | Caché de páginas regenerable; no es snapshot ni evidencia de derechos | Reimportación con `--full --cache-dir` |

## Modificaciones de seguridad autorizadas

- `.env.example` y `backend/.env.example`: mantener solo nombres y valores ficticios/placeholders, con separación local/CI/producción y notas de origen.
- `.gitignore` y `android/.gitignore`: ignorar variantes `.env` privadas y material de firma/credenciales Android.

## Protegido explícitamente

No se elimina ni mueve: `backend/migrations/`, `backend/audits/`, `backend/data/`, `backend/storage/source-snapshots/`, `backend/storage/source-captures/`, `backend/storage/media/`, `backend/storage/media-candidates/`, `backend/storage/media-review/`, `backend/storage/rankings/`, `render.yaml`, workflows, tests, fixtures, fuentes, snapshots, informes de derechos, ni el fixture AFC rastreado.

Tampoco se modifica `backend/.env`: es un archivo local ignorado y puede contener configuración de trabajo. Sus valores no se imprimen; si alguno fuera una credencial real, corresponde rotarlo fuera de este cambio.

## Estado de ejecución

La limpieza se ejecutó como archivo reversible, no como borrado permanente:

- Archivo inicial: `/tmp/rango90-cleanup-archive-20260917/` contiene los 12 elementos autorizados, incluida la caché API-Football.
- Archivo de artefactos regenerados durante la validación: `/tmp/rango90-cleanup-validation-archive-20260917/` contiene `.next/`, `out/`, `backend/dist/`, ambas instalaciones `node_modules/` y `tsconfig.tsbuildinfo`.
- Los elementos autorizados están ausentes del workspace después de la validación.
- Las rutas protegidas permanecen presentes; sus conteos se registran en `REPOSITORY_CLEANUP_VALIDATION.md`.

No se borró ningún archivo de forma irreversible. Los archivos de los dos directorios temporales pueden eliminarse manualmente después de revisar el commit y el manifiesto.
