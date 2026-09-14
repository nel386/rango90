# Matriz de salida de Rango90

Última verificación: 14 de septiembre de 2026 (UTC)

Este documento es una lista de control, no una autorización de publicación. La decisión técnica final la emite `backend/src/tools/verify-release-readiness.ts`; la decisión legal requiere evidencia contractual o de licencia conservada en la base de datos y en el expediente de la fuente.

## Objetivo acordado

Preparar una versión local web/PWA/Android de Rango90 sin remote Git y sin contratar una licencia comercial de proveedor. Solo se publicarán datos con permiso de redistribución verificable y recursos visuales con licencia abierta comprobada por activo; los demás datos seguirán siendo `draft` y el guard no se relajará. La matriz elegida es la documentada en `DATA_7X7_OPTIONS.md`: tarjetas amarillas y rojas, títulos de club, goles en Mundiales, goles globales de carrera (clubes + selección), títulos nacionales de equipos y títulos de Champions de equipos.

| Requisito de salida | Evidencia autoritativa | Estado observado |
| --- | --- | --- |
| Dataset y licencias aprobados | `npm run verify:release-readiness`, `DATA_PROVIDER_LICENSE_REVIEW.md`, expedientes de `sources`, `source_snapshots` y `source_rights_reviews` | **Bloqueado**: `approvedSources=0` y `approvedSourceEvidence=false`; ninguna fuente está aprobada para redistribución comercial |
| Matriz 7×7 tipada | `DATA_7X7_OPTIONS.md`, contratos de categoría y snapshots | **Implementado en código; datos bloqueados**: cinco categorías de jugadores y dos de equipos, con entidades comunes dentro de cada tipo; todavía faltan snapshots publicables para la selección elegida |
| Entidades comunes por tipo | Selector `selectCommonDailyEntities()` y auditoría tipada | **Implementado y verificable**: el materializador selecciona cinco jugadores comunes entre categorías de jugador y dos equipos comunes entre categorías de equipo; no cruza respuestas incompatibles |
| Identidades, empates, posiciones y evidencias | Validadores de ranking, manifests de identidad y revisión de producción UEFA | **Bloqueado**: `uefa-champions-league-goals` conserva 12 discrepancias frente al contraste oficial; la consolidación local de API-Football enlazó 7 jugadores y conservó 3 conflictos de ranking sin resolver automáticamente |
| Snapshots y reto diario reales publicados | `npm run verify:release-readiness` | **Bloqueado**: `publishedSnapshots=0`, `publishedDaily7x7=null` |
| Integridad del reto publicado | Migración `077_allow_typed_daily_challenges.sql` y prueba de integración | **Implementado**: la base exige una matriz completa de pares compatibles, rechaza cruces jugador/equipo y respuestas con valores divergentes |
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
