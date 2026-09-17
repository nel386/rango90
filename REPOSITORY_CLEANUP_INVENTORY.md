# Inventario de limpieza del repositorio

Fecha de corte: 2026-09-17 UTC
Repositorio: `rango90`
HEAD inspeccionado: `06fa117` (`master`, alineado con `origin/master`)
Alcance Git: 492 archivos rastreados, 145 commits, 4 ramas visibles (`master`, `origin/master`, `backup/764fdad`, `codex/player-career-goals`) y ningún tag.

## Método y límites

Se buscaron referencias textuales antes de clasificar: imports y rutas de código, scripts npm, workflows, migraciones, documentación, fixtures, artefactos de Android/Next y configuración de Render. También se revisaron nombres de archivos sensibles, asignaciones de variables, URLs con credenciales, claves privadas, JWT y tokens conocidos en el estado actual y en las 145 revisiones accesibles.

Los cambios locales existentes al comenzar esta tarea se conservan y no forman parte de una limpieza automática: el árbol ya tenía 30 entradas modificadas o nuevas, incluyendo auditorías y trabajo de los bloques 9–15.

## Resumen por clasificación

| Área | Evidencia | Clasificación | Decisión |
|---|---:|---|---|
| Aplicación frontend/backend | 209 `.ts`, 6 `.tsx`, 8 `.mjs`, configuración y assets públicos | conservar | Hay referencias activas o son puntos de entrada del framework. |
| Dependencias y lockfiles | `package.json`, `backend/package.json`, ambos lockfiles | conservar | Las dependencias instaladas son reproducibles desde lockfile; no se confirmó ninguna dependencia sin uso. |
| Workflows | 12 workflows | conservar | Todos son activos, manuales, programados o requeridos por CI; usan secretos mediante `secrets.*`. |
| Migraciones | 85 SQL rastreadas; 86 presentes con la migración local 084 | conservar | Secuencia histórica y posible estado de base de datos; no se elimina ni reordena. |
| Tests, fixtures y QA | 57 tests; fixtures en `backend/data/` y `backend/src/qa/` | conservar | Varios están invocados por npm/CI y son evidencia de gates. |
| Auditorías e informes | 41 archivos de auditoría rastreados y documentación de bloques | conservar | Son evidencia importante, especialmente derechos, snapshots y validaciones. |
| Scripts CLI/importación | `backend/src/cli.ts`, 4 scripts shell, scripts de raíz | conservar | Los comandos npm apuntan a ellos o están documentados para operación/CI. |
| `.env*` | ejemplos rastreados y `backend/.env` local ignorado | limpiar / contiene posible secreto | Se limpian ejemplos; el `.env` privado no se modifica y queda fuera de Git. |
| Caché API-Football | 1.000 archivos, 24 MB en `backend/storage/api-football-cache/` | eliminar | Es caché regenerable; el código permite reanudar o limpiarlo y no es evidencia jurídica. |
| Builds/caches locales | `.next/` 184 MB, `out/` 1,1 MB, `backend/dist/` 2,5 MB, Android builds 71 MB, `node_modules` 793 MB | limpiar | Son salidas regenerables e ignoradas. |
| Snapshots/capturas/medios | 1.787 snapshots, 8 capturas, 5.980 medios, 795 candidatos | conservar | No se eliminan snapshots ni evidencia de derechos; hay referencias documentales y operativas. |
| Ranking AFC rastreado | `backend/storage/rankings/afc-champions-league-club-titles.json` | conservar | El test `backend/src/tests/afc-champions-league-titles.test.ts` lo carga directamente. |
| Duplicados byte a byte | splash por densidad y dos XML de launcher | conservar | Son recursos Android con rutas/roles distintos; no son duplicados eliminables sin cambiar packaging. |
| Documentación | 66 `.md`, con informes históricos de bloques | conservar / requiere decisión | Hay posible solapamiento temporal; no se archiva ni borra sin decisión editorial y sin perder evidencia. |

## Elementos inspeccionados y referencias

| Elemento | Referencias comprobadas | Clasificación | Acción |
|---|---|---|---|
| `.next/`, `out/`, `backend/dist/` | Generados por builds; ningún archivo rastreado los consume | limpiar | Eliminar tras registrar el manifiesto; se regeneran en validación. |
| `node_modules/`, `backend/node_modules/` | Derivados de los lockfiles; no rastreados | limpiar | Eliminar al final si el entorno lo permite; no tocar lockfiles. |
| `android/.gradle/`, `android/app/build/`, `android/build/`, `android/capacitor-cordova-android-plugins/`, `android/app/src/main/assets/` | Generados por Gradle/Capacitor y explícitamente ignorados | limpiar | Eliminar; `cap:sync` los regenera. |
| `tsconfig.tsbuildinfo` | Caché ignorada del compilador | limpiar | Eliminar. |
| `backend/storage/api-football-cache/` | Referenciado por el importador como caché opcional; no por tests como fixture | eliminar | Eliminar solo esta subcarpeta. |
| `backend/storage/source-snapshots/` | Ledger de fuentes; mencionado por config, derechos y documentación | conservar | No tocar. |
| `backend/storage/source-captures/` | Capturas fuente de bloques de datos | conservar | No tocar. |
| `backend/storage/media/`, `media-candidates/`, `media-review/` | Flujo de medios y derechos; informes apuntan a estos resultados | conservar | No tocar. |
| `backend/storage/rankings/` | CLI y tests consumen rankings; uno está rastreado | conservar | No tocar. |
| `.github/workflows/*.yml` | Workflows activos y referencias a CI, Render, Pages y APIs | conservar | No tocar; revisar seguridad en informe separado. |
| `backend/migrations/*.sql` | `migrate.ts` los ordena/ejecuta; nombres y secuencia son evidencia | conservar | No tocar; hay prefijos repetidos 028 y 029 que requieren una convención futura, sin alterar el historial. |
| `backend/data/fixtures/`, `backend/data/examples/`, `backend/data/manifests/`, `backend/data/production/`, `backend/data/evidence/` | Referencias de tests, auditorías o producción curada | conservar | No tocar. |
| `backend/src/qa/` y `backend/src/tests/` | Invocados desde `package.json` y workflows | conservar | No tocar. |
| `scripts/` y `backend/scripts/` | Referencias desde npm, docs o workflows; los cuatro shell tienen uso documentado | conservar | No tocar. |
| `backend/.env` | Ignorado; contiene valores configurados localmente | contiene posible secreto | No imprimir ni modificar; revisar/rotar fuera de Git si fueran credenciales reales. |
| `backend/.env.example`, `.env.example` | Rastreado; ejemplos visibles | limpiar | Reemplazar valores de muestra por placeholders seguros. |
| `.gitignore`, `android/.gitignore` | Reglas de entornos, builds y firma | conservar | Reforzar exclusión de env privados y material de firma. |
| `android/app/src/main/res/.../splash.png` | Rutas de densidad/orientación Android | conservar | No fusionar recursos con semántica de packaging distinta. |
| `ic_launcher.xml` / `ic_launcher_round.xml` | Referenciados por nombres de recurso Android distintos | conservar | Contenido idéntico pero roles de launcher diferentes. |

## Dependencias y scripts npm

Se revisaron los scripts de raíz y backend contra archivos existentes, CI, workflows y el dispatch de `backend/src/cli.ts`. No hay un script inequívocamente obsoleto que pueda retirarse sin una decisión funcional: los comandos no invocados por CI siguen siendo CLI operativos de importación, auditoría, medios o despliegue. Tampoco se eliminan dependencias solo por falta de imports directos: `next`, Capacitor, Playwright, ESLint, TypeScript y tipos son herramientas de build/QA.

## Documentación contradictoria u obsoleta

Los documentos de bloques 4–15 son informes de auditoría histórica y se conservan. La documentación operativa debe considerarse vigente solo junto con `README.md`, `backend/README.md`, `render.yaml` y los workflows actuales. Las posibles consolidaciones de documentos (`requires_decision`) no se ejecutan en este bloque porque podrían borrar evidencia o cambiar instrucciones de despliegue.

## Resultado previo a la limpieza

La única limpieza destructiva autorizada por el manifiesto es regenerable: caché API-Football, builds, dependencias instaladas y cachés locales. No incluye PostgreSQL, Render, migraciones, auditorías, snapshots, fixtures, workflows ni documentación histórica.
