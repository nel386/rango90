# Rango 90

Rango 90 es un juego web/PWA de retos futbolísticos basados en rankings históricos.

El jugador recibe una categoría y varias entidades futbolísticas —jugadores, clubes o selecciones— y debe ordenarlas según una estadística, récord o logro. La puntuación final premia el menor número de errores.

## Objetivo del proyecto

Construir una experiencia sencilla, repetible y social alrededor de datos futbolísticos fiables:

- Reto diario.
- Retos periódicos.
- Ranking de jugadores.
- Duelos asíncronos mediante enlace.
- Resultados visuales compartibles.
- Clasificación entre amigos o grupos.
- Racha y estadísticas personales en fases posteriores.

## Alcance inicial del MVP

El primer MVP será bilingüe en español e inglés, tendrá un único modo de ranking y un conjunto reducido de categorías revisadas manualmente. Incluirá:

1. Reto diario.
2. Ordenación de entidades según una categoría.
3. Puntuación calculada de forma reproducible.
4. Resultado final.
5. Tarjeta compartible.
6. Enlace para retar a otra persona.
7. Clasificación básica.

Quedan fuera inicialmente los resultados en directo, noticias, fantasy completo, chat, multijugador en tiempo real y la cobertura exhaustiva de todas las competiciones.

## Principios de datos

La base de datos propia será la fuente de verdad de Rango 90.

- No se realizarán peticiones externas durante una partida.
- Los datos se importarán o introducirán previamente.
- Cada dato importante deberá conservar su fuente, fecha, definición y estado de revisión.
- Los rankings publicados deberán poder reproducirse.
- Los retos publicados quedarán ligados a una versión concreta de los datos.
- Las correcciones crearán nuevas versiones y no modificarán silenciosamente los retos antiguos.
- Las categorías ambiguas no se publicarán hasta definir qué se cuenta exactamente.

### Simplificación del catálogo de jugadores

El catálogo de jugadores se organiza en una categoría global por métrica de carrera —goles, asistencias, tarjetas, títulos y porterías a cero cuando proceda— y en categorías históricas de las competiciones de referencia. No se crean rankings de jugadores para cada copa nacional, supercopa o Recopa: esas competiciones pueden conservar sus palmarés de clubes y sus snapshots históricos, pero no forman parte del catálogo jugable de jugadores.

La UEFA Cup y la Europa League se tratan como una única competición histórica. Las categorías retiradas no se borran: sus snapshots, evidencias y datos de origen permanecen auditables, pero no se sirven como categorías activas del juego.

API-Football podrá utilizarse más adelante como ayuda para detectar cambios, contrastar información y actualizar datos activos. No será una dependencia obligatoria del juego ni sustituirá la revisión de los datos históricos.

BeSoccer y Opta quedan como opciones de investigación futura. No se presupone ningún gasto recurrente ni ninguna API de pago para el MVP.

## Prioridad actual

Antes de desarrollar funcionalidades grandes hay que cerrar:

- La mecánica exacta y el sistema de puntuación.
- Las categorías iniciales y sus definiciones.
- El modelo de datos.
- El sistema de fuentes, revisión y versionado.
- El flujo de importación manual y de posibles APIs.
- La arquitectura backend mínima.

El modelo de datos y la arquitectura deben ser definidos por el especialista backend con conocimiento de datos futbolísticos. Este README describe el producto y sus restricciones, pero no impone campos, tablas ni una tecnología concreta.

## Arquitectura objetivo de distribución

La aplicación debe poder salir por tres vías usando la misma experiencia de juego:

- **Web/PWA:** frontend construido con Next.js.
- **Web pública:** exportación estática del frontend para GitHub Pages.
- **Android:** aplicación híbrida basada en el frontend web mediante Capacitor, con integración nativa de anuncios cuando corresponda.

GitHub Pages solo alojará el frontend estático. El backend, la autenticación, las partidas, las clasificaciones, los duelos y la administración de datos deberán ejecutarse como un servicio separado en la infraestructura disponible o en un alojamiento económico.

El frontend no debe contener secretos ni ser la fuente de verdad. Consumirá el backend mediante una API configurable por entorno. El mismo backend servirá al navegador y a la aplicación Android.

La exportación estática de Next.js implica que las funciones que necesitan servidor no pueden vivir en GitHub Pages. Por eso la web, el backend y la aplicación Android deben tratarse como piezas separadas aunque inicialmente vivan en el mismo repositorio.

La aplicación Android no será una segunda aplicación con lógica duplicada: reutilizará la interfaz web y añadirá únicamente las capacidades nativas necesarias, como anuncios, almacenamiento local o notificaciones en fases posteriores.

## Internacionalización desde el MVP

La aplicación usa una arquitectura i18n real mediante `next-intl`, con rutas explícitas por idioma (`/es/` y `/en/`) y mensajes separados por locale. Añadir idiomas nuevos debe consistir en ampliar la configuración y añadir sus mensajes, sin rehacer los componentes.

El segmento `[locale]` tiene `generateStaticParams`, por lo que Next.js genera ambas rutas durante el build estático. El HTML de cada ruta incluye su `lang`, su metadata y su manifest correspondiente. La raíz `/` funciona como selector de idioma. El `basePath` de GitHub Pages se aplica al build y Next.js ajusta los enlaces internos.

No se usará detección automática mediante middleware o redirecciones del servidor: no encaja con un hosting estático. La URL es la fuente de verdad del idioma; más adelante se podrá recordar la preferencia en el cliente. Los códigos de duelo se mantendrán como query string en rutas estáticas, no como segmentos dinámicos desconocidos.

La internacionalización de la interfaz no obliga a decidir ahora el modelo de datos. Cuando se diseñe el backend, se decidirá por separado si alguna respuesta editorial necesita traducciones o si basta con enviar valores futbolísticos neutrales.

## Restricciones

- Presupuesto inicial de APIs y datos: aproximadamente 30 €/mes como máximo.
- Prioridad a infraestructura propia y sencilla.
- No se necesita Cloudflare ni una arquitectura distribuida para el MVP salvo que exista una razón concreta. GitHub Pages puede servir el frontend y el backend puede ejecutarse en el servidor Ubuntu disponible.
- Se debe poder sustituir una fuente de datos sin rehacer el proyecto.
- La exactitud y la trazabilidad tienen prioridad sobre la cantidad de categorías.

## Criterios para continuar

Rango 90 merece avanzar si podemos:

- Verificar al menos el 95 % de los datos iniciales.
- Generar retos sin contradicciones entre fuentes.
- Reproducir los rankings desde una versión de datos concreta.
- Corregir datos conservando el historial.
- Explicar las reglas de cada categoría en menos de un minuto.
- Conseguir que un grupo de prueba vuelva a jugar durante varios días.

## Estado

Proyecto base inicializado con Next.js, TypeScript, App Router, exportación estática y manifest PWA. Incluye una portada mínima ejecutable.

El estado cuantitativo vigente de la BBDD y la definición de cobertura están en [`DATA_CURRENT_STATUS.md`](./DATA_CURRENT_STATUS.md). Ese documento es la referencia para no mezclar auditorías históricas con el estado operativo actual.

La combinación candidata de siete categorías y su intersección 7×7 están documentadas en [`DATA_7X7_CANDIDATE.md`](./DATA_7X7_CANDIDATE.md). Es una ruta de trabajo en estado `draft`, no un conjunto autorizado para publicar.

La matriz requisito-evidencia de la salida está en [`RELEASE_READINESS.md`](./RELEASE_READINESS.md). Resume el estado verificable y no sustituye la aprobación legal ni el guard técnico.

La revisión de proveedores y derechos está en [`DATA_PROVIDER_LICENSE_REVIEW.md`](./DATA_PROVIDER_LICENSE_REVIEW.md). La aplicación no tratará una API o una imagen descargable como autorización de redistribución.

La revisión arquitectónica inicial está documentada en [`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md). La decisión actual es conservar Next.js para el frontend estático y mantener el backend como servicio independiente. La capa inicial de datos ya está preparada en [`backend/`](./backend/); la plataforma Android nativa ya está inicializada con Capacitor.

## Comprobaciones locales

`NEXT_PUBLIC_API_BASE_URL` debe estar definido en cualquier build distribuible del frontend. Sin esa variable, la aplicación muestra un error de configuración y no simula partidas que no se validan ni se guardan en el backend. Los datos sintéticos quedan fuera del runtime distribuible.

```bash
npm install
npm run lint
npm run typecheck
npm run build
```

La guía reproducible de frontend, PWA, CORS y Android está en [`FRONTEND_DEPLOYMENT.md`](./FRONTEND_DEPLOYMENT.md). Incluye los requisitos de máquina, la separación de variables públicas y los comandos de verificación de ambos builds.

Para una publicación en un repositorio de GitHub Pages cuyo nombre sea `rango90`, el build debe ejecutarse con `NEXT_PUBLIC_BASE_PATH=/rango90`. Para Android/Capacitor se utilizará un build separado con base path vacío; así la URL de GitHub Pages no se mezcla con la aplicación nativa.

La plataforma Android ya está inicializada con Capacitor; la compilación de una APK requiere Java y Android SDK instalados en el entorno.

## PWA y Android

La PWA incluye manifests separados para español e inglés, iconos de 192 y 512 píxeles y un service worker de shell estático. No se cachean las rutas `/v1/` para evitar resultados de juego obsoletos.

```bash
# GitHub Pages: base path del repositorio
npm run build:pages
npm run verify:pages

# Android/Capacitor: base path vacío
npm run build:android
npm run verify:android
npx cap sync android
```

Capacitor está preparado con `webDir: out`, `com.rango90.app` y pantalla de arranque. No se han añadido SDKs de anuncios ni plugins de notificaciones: se incorporarán después de validar una APK instalable y funcional.

La primera APK debug se generó y verificó localmente; el detalle reproducible está en [`ANDROID_BUILD_VERIFICATION.md`](./ANDROID_BUILD_VERIFICATION.md). Este artefacto no equivale todavía a una release firmada para distribución pública.

El QA de runtime local está registrado en [`LOCAL_RUNTIME_QA.md`](./LOCAL_RUNTIME_QA.md); confirma los guards de servicio, pero no sustituye la prueba de un reto publicado ni el QA visual externo.

## Backend de datos

La base inicial del backend está en [`backend/`](./backend/). Usa Node.js/TypeScript, PostgreSQL y snapshots inmutables de rankings. El catálogo genera las competiciones y categorías iniciales; los datos reales se incorporarán mediante archivos revisables o un adaptador de fuente autorizado.

Las primeras categorías de clubes cerradas ya importadas desde fuentes oficiales son `premier-league-club-titles` y `bundesliga-club-titles`. Conservan, respectivamente, los siete campeones de la era Premier League y los 13 clubes campeones de la era Bundesliga, con empates, evidencia de temporada y snapshots inmutables. Sus snapshots actuales son de desarrollo (`draft`) y no se publican hasta resolver la licencia de los escudos.

```bash
cd backend
npm install
cp .env.example .env
psql "$DATABASE_URL" -f migrations/001_initial.sql
psql "$DATABASE_URL" -f migrations/002_media_asset_kind.sql
psql "$DATABASE_URL" -f migrations/003_entity_external_ids.sql
psql "$DATABASE_URL" -f migrations/004_fact_assertion_indexes.sql
psql "$DATABASE_URL" -f migrations/005_source_api_type.sql
psql "$DATABASE_URL" -f migrations/006_entity_game_profiles.sql
psql "$DATABASE_URL" -f migrations/007_player_season_stats.sql
psql "$DATABASE_URL" -f migrations/008_entity_identity_links.sql
psql "$DATABASE_URL" -f migrations/009_remove_invalid_national_team_club_categories.sql
psql "$DATABASE_URL" -f migrations/010_repair_goalkeeper_flags.sql
psql "$DATABASE_URL" -f migrations/011_reject_dead_uefa_media.sql
psql "$DATABASE_URL" -f migrations/012_clarify_uefa_torres_identity.sql
psql "$DATABASE_URL" -f migrations/013_ranking_read_indexes.sql
psql "$DATABASE_URL" -f migrations/014_clarify_uefa_short_names.sql
psql "$DATABASE_URL" -f migrations/015_clarify_puskas_identity.sql
psql "$DATABASE_URL" -f migrations/016_clarify_uefa_player_labels.sql
psql "$DATABASE_URL" -f migrations/017_clarify_lisandro_lopez.sql
psql "$DATABASE_URL" -f migrations/018_clarify_uefa_conference_player_names.sql
psql "$DATABASE_URL" -f migrations/019_auth.sql
psql "$DATABASE_URL" -f migrations/020_allow_multiple_provider_ids_per_entity.sql
psql "$DATABASE_URL" -f migrations/021_clarify_uefa_champions_short_player_names.sql
psql "$DATABASE_URL" -f migrations/022_clarify_jose_augusto_identity.sql
psql "$DATABASE_URL" -f migrations/023_rsssf_international_player_aliases.sql
psql "$DATABASE_URL" -f migrations/024_repair_identity_cycles.sql
psql "$DATABASE_URL" -f migrations/025_invalidate_bdfutbol_premier_scope.sql
psql "$DATABASE_URL" -f migrations/026_media_rights_ledger.sql
psql "$DATABASE_URL" -f migrations/027_media_usage_scope.sql
psql "$DATABASE_URL" -f migrations/028_game_contract.sql
psql "$DATABASE_URL" -f migrations/028_record_derived_media_licenses.sql
psql "$DATABASE_URL" -f migrations/029_clarify_rodri_identity.sql
psql "$DATABASE_URL" -f migrations/029_phase5_premier_league_club_titles.sql
psql "$DATABASE_URL" -f migrations/029_clarify_rodri_identity.sql
psql "$DATABASE_URL" -f migrations/030_record_derived_media_licenses_for_new_approvals.sql
psql "$DATABASE_URL" -f migrations/031_repair_bdfutbol_muller_identity.sql
psql "$DATABASE_URL" -f migrations/032_supersede_duplicate_draft_snapshots.sql
psql "$DATABASE_URL" -f migrations/033_prune_redundant_pending_portraits.sql
psql "$DATABASE_URL" -f migrations/034_deduplicate_media_candidates.sql
psql "$DATABASE_URL" -f migrations/035_backfill_provider_player_aliases.sql
psql "$DATABASE_URL" -f migrations/036_clarify_sergio_ramos_identity.sql
psql "$DATABASE_URL" -f migrations/037_add_reviewed_player_aliases_for_media_search.sql
psql "$DATABASE_URL" -f migrations/038_split_bdfutbol_player_collisions.sql
psql "$DATABASE_URL" -f migrations/039_split_remaining_bdfutbol_player_collisions.sql
psql "$DATABASE_URL" -f migrations/040_add_reviewed_uefa_player_aliases.sql
psql "$DATABASE_URL" -f migrations/052_add_uefa_conference_player_aliases.sql
psql "$DATABASE_URL" -f migrations/053_deep_catalog_cleanup.sql
psql "$DATABASE_URL" -f migrations/054_simplify_player_category_catalog.sql
psql "$DATABASE_URL" -f migrations/055_link_exact_approved_portrait_duplicates.sql
psql "$DATABASE_URL" -f migrations/058_add_club_career_titles_category.sql
psql "$DATABASE_URL" -f migrations/072_freeze_published_ranking_snapshots.sql
psql "$DATABASE_URL" -f migrations/073_allow_approved_categories_in_game_challenges.sql
psql "$DATABASE_URL" -f migrations/074_validate_published_game_ranking_values.sql
psql "$DATABASE_URL" -f migrations/075_source_rights_ledger.sql
psql "$DATABASE_URL" -f migrations/076_require_https_rights_evidence.sql
npm run seed
npm run seed:game-audience
npm run entity:consolidate:uefa-shared-clubs
npm run import:premier-league:club-titles
npm run import:bundesliga:club-titles
npm run import:fa-cup:club-titles
npm test
npm run build
```

No se publicará una categoría si no tiene cobertura completa de su universo, conflictos resueltos y 200 entidades jugables reales en los rankings abiertos. En universos cerrados se exige el universo completo (por ejemplo, los campeones históricos de una competición), no un número artificial de 200. Los activos visuales publicados deben tener un expediente de derechos aprobado; cuando la imagen sea opcional, el frontend puede usar el fallback visual propio. Las filas históricas conservadas fuera del roster jugable no cuentan para este requisito.

El guard de salida completo es de solo lectura y debe devolver `ready: true` antes de una publicación:

```bash
npm run verify:release-readiness
```

Comprueba conexión, fuentes aprobadas, snapshots publicados, una matriz diaria 7×7, contratos de sus categorías y los límites del catálogo. No crea fixtures ni cambia la base de datos.
