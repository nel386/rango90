# Matriz de salida de Rango90

Última verificación: 14 de septiembre de 2026 (UTC)

Este documento es una lista de control, no una autorización de publicación. La decisión técnica final la emite `backend/src/tools/verify-release-readiness.ts`; la decisión legal requiere evidencia contractual o de licencia conservada en la base de datos y en el expediente de la fuente.

## Objetivo acordado

Preparar una versión local web/PWA/Android de Rango90 sin remote Git y sin contratar una licencia comercial de proveedor. Solo se publicarán datos con permiso de redistribución verificable y recursos visuales con licencia abierta comprobada por activo; los demás datos seguirán siendo `draft` y el guard no se relajará. La matriz elegida es la documentada en `DATA_7X7_OPTIONS.md`: tarjetas amarillas y rojas, títulos de club, goles en Mundiales, goles de carrera de clubes, asistencias de Champions y goles de Champions.

| Requisito de salida | Evidencia autoritativa | Estado observado |
| --- | --- | --- |
| Dataset y licencias aprobados | `npm run verify:release-readiness`, `DATA_PROVIDER_LICENSE_REVIEW.md`, expedientes de `sources`, `source_snapshots` y `source_rights_reviews` | **Bloqueado**: `approvedSources=0` y `approvedSourceEvidence=false`; ninguna fuente está aprobada para redistribución comercial |
| Siete categorías homogéneas | `DATA_7X7_CANDIDATE.md`, contratos de categoría y snapshots | **Candidato únicamente**: hay siete snapshots draft de 200 entradas, pero seis tienen `coverage_complete=false`, y todos carecen de derechos aprobados |
| Siete jugadores comunes | Selector `selectCommonDailyEntities()` y guard de publicación | **Implementado y verificable**: el selector exige presencia en los siete snapshots; el candidato actual tiene ocho jugadores comunes |
| Identidades, empates, posiciones y evidencias | Validadores de ranking, manifests de identidad y revisión de producción UEFA | **Bloqueado**: `uefa-champions-league-goals` conserva 12 discrepancias frente al contraste oficial |
| Snapshots y reto diario reales publicados | `npm run verify:release-readiness` | **Bloqueado**: `publishedSnapshots=0`, `publishedDaily7x7=null` |
| Integridad del reto publicado | Migración `074_validate_published_game_ranking_values.sql` y prueba de integración | **Implementado**: la base rechaza entidades no presentes en todos los snapshots y respuestas con valores divergentes |
| QA web, móvil, idiomas y accesibilidad | `LOCAL_RUNTIME_QA.md` | **Parcial**: smoke Chromium revalidado en español/inglés y builds estáticos Pages/Android verificados; flujo funcional con fixture sintética en escritorio/móvil emulado; falta validación con reto real, QA visual exhaustiva y QA externo |
| APK Android | `ANDROID_BUILD_VERIFICATION.md` y artefactos debug/release | **Parcial**: variante release firmada y verificada con keystore temporal de QA; falta clave oficial protegida, instalación y prueba en dispositivo/emulador |
| Código y archivos versionados | `git status`, historial Git y `.github/workflows/ci.yml` | **Localmente correcto**: repositorio limpio y workflow versionado; no hay remoto Git configurado, pero eso no bloquea la entrega local |

## Puerta final

La salida solo puede continuar cuando todos los requisitos anteriores estén respaldados por evidencia actual y el guard devuelva `ready: true`:

```bash
cd backend
npm run verify:release-readiness
```

No se deben cambiar estados de fuentes, snapshots o categorías para hacer pasar el guard sin la evidencia correspondiente. Los datos draft, las fixtures de integración y los fallbacks visuales no sustituyen derechos de redistribución, cobertura completa, retratos autorizados ni un reto diario de producción.
