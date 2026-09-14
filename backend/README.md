# Rango 90 backend

Backend independiente para datos, rankings y retos de Rango 90.

Las reglas del motor están documentadas en [GAME_ENGINE.md](GAME_ENGINE.md) y el contrato HTTP de la fase 3 en [API_CONTRACT.md](API_CONTRACT.md). El backend ya persiste sesiones, resultados y duelos mediante la migración `028_game_contract.sql`.

La fixture publicada exclusivamente para integración está documentada en [INTEGRATION_FIXTURE.md](INTEGRATION_FIXTURE.md). Tras levantar PostgreSQL y aplicar las migraciones, `npm run seed:integration -- --date YYYY-MM-DD` elimina el 404 de `/v1/challenges/daily` en el entorno local sin publicar datos reales ni habilitarse en producción.

## Requisitos

- Node.js 20.9+
- PostgreSQL 15+

## Arranque local

```bash
npm install
cp .env.example .env
docker compose up -d postgres
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
psql "$DATABASE_URL" -f migrations/041_add_exact_media_identity_aliases.sql
psql "$DATABASE_URL" -f migrations/042_remove_nonfootball_media_alias.sql
psql "$DATABASE_URL" -f migrations/043_add_contextual_uefa_player_aliases.sql
psql "$DATABASE_URL" -f migrations/044_add_hanno_behrens_alias.sql
psql "$DATABASE_URL" -f migrations/045_add_franko_kovacevic_alias.sql
psql "$DATABASE_URL" -f migrations/046_prune_redundant_pending_portraits.sql
psql "$DATABASE_URL" -f migrations/047_reject_wrong_kevin_campbell_portrait.sql
psql "$DATABASE_URL" -f migrations/048_reject_wrong_luis_suarez_portrait.sql
psql "$DATABASE_URL" -f migrations/049_split_bdfutbol_rodri_collision.sql
psql "$DATABASE_URL" -f migrations/050_backfill_audited_media_player_aliases.sql
psql "$DATABASE_URL" -f migrations/051_add_reviewed_missing_player_aliases.sql
psql "$DATABASE_URL" -f migrations/052_add_uefa_conference_player_aliases.sql
psql "$DATABASE_URL" -f migrations/053_deep_catalog_cleanup.sql
psql "$DATABASE_URL" -f migrations/054_simplify_player_category_catalog.sql
psql "$DATABASE_URL" -f migrations/055_link_exact_approved_portrait_duplicates.sql
psql "$DATABASE_URL" -f migrations/056_flatten_reviewed_dida_identity_chains.sql
psql "$DATABASE_URL" -f migrations/057_allow_unknown_assists.sql
psql "$DATABASE_URL" -f migrations/058_add_club_career_titles_category.sql
psql "$DATABASE_URL" -f migrations/059_add_club_global_titles_category.sql
psql "$DATABASE_URL" -f migrations/060_add_api_football_full_name_aliases.sql
psql "$DATABASE_URL" -f migrations/061_repair_thesportsdb_rights_evidence_urls.sql
psql "$DATABASE_URL" -f migrations/062_reconcile_thesportsdb_cc_rights.sql
psql "$DATABASE_URL" -f migrations/063_repair_historical_icon_identities.sql
psql "$DATABASE_URL" -f migrations/064_reject_thesportsdb_explicit_no_assets.sql
psql "$DATABASE_URL" -f migrations/065_exclude_non_iconic_historical_players_from_game_catalog.sql
psql "$DATABASE_URL" -f migrations/066_admit_modern_top200_players.sql
psql "$DATABASE_URL" -f migrations/067_exclude_all_non_iconic_pre1960_players.sql
psql "$DATABASE_URL" -f migrations/068_close_champions_goals_data_candidate.sql
psql "$DATABASE_URL" -f migrations/069_reopen_modern_players_after_birth_date_verification.sql
psql "$DATABASE_URL" -f migrations/070_remove_pre1930_game_exceptions.sql
psql "$DATABASE_URL" -f migrations/071_flatten_reviewed_zaniolo_identity_chain.sql
psql "$DATABASE_URL" -f migrations/072_freeze_published_ranking_snapshots.sql
psql "$DATABASE_URL" -f migrations/073_allow_approved_categories_in_game_challenges.sql
psql "$DATABASE_URL" -f migrations/074_validate_published_game_ranking_values.sql

Para casos de homónimos de Wikidata, el enriquecedor admite un `--qid` explícito; valida que la etiqueta coincida y que la descripción sea futbolística antes de aplicar la fecha.
npm run seed
npm run import:premier-league:club-titles
npm run import:bundesliga:club-titles
npm run import:dfl-supercup:club-titles
npm run import:fa-cup:club-titles
npm run import:dfb-pokal:club-titles
npm run import:copa-del-rey:club-titles
npm run import:copa-libertadores:club-titles
npm run import:copa-sudamericana:club-titles
npm run import:recopa-sudamericana:club-titles
npm run import:copa-america:national-team-titles
npm run import:nations-league:national-team-titles
npm run import:club-world-cup:club-titles
npm run import:taca-portugal:club-titles
npm test
npm run build
```

Las categorías estadísticas de la Copa de Europa/Champions League usan los slugs explícitos `uefa-champions-league-*`. Los slugs generados duplicados se conservan como `retired` para no romper referencias históricas.

El `docker-compose.yml` usa las variables `POSTGRES_*` del `.env`; el ejemplo ya deja `DATABASE_URL` alineada con esas credenciales. En un servidor, cambia la contraseña antes de exponer PostgreSQL y no subas `.env` al repositorio.

El backend no llama a proveedores durante una partida. Las fuentes se usan en trabajos de importación y los retos publicados apuntan a un snapshot inmutable.

La categoría real de la fase 5 está documentada en [PHASE5_PREMIER_LEAGUE.md](PHASE5_PREMIER_LEAGUE.md). La migración `029_phase5_premier_league_club_titles.sql` conserva la evidencia histórica; no alimenta el contrato online legacy. Los comandos `create-daily-draft` y `create-daily` requieren siete slugs homogéneos separados por comas, seleccionan siete entidades comunes jugables de sus snapshots y escriben únicamente `game_challenges`, `game_challenge_categories`, `game_challenge_decisions` y `game_challenge_answers`:

```bash
npm run challenge:daily:draft -- --date YYYY-MM-DD --categories slug1,slug2,slug3,slug4,slug5,slug6,slug7
npm run challenge:daily -- --date YYYY-MM-DD --categories slug1,slug2,slug3,slug4,slug5,slug6,slug7
```

El primer comando deja el reto en `draft`. El segundo solo publica cuando las categorías están aprobadas, los snapshots publicados y las fuentes tienen `rights_status=approved`. Las imágenes son opcionales para la materialización: el frontend y el API usan el fallback visual propio cuando no existe un activo publicable.

El primer candidato abierto de producción está documentado en [CHAMPIONS_GOALS_PRODUCTION.md](CHAMPIONS_GOALS_PRODUCTION.md). `uefa-champions-league-goals` tiene un input reproducible de 200 filas reales, manifest de identidades, contraste UEFA/API-Football y snapshot `rs_870f1dff967bb160f2d132cc`. Se mantiene en `draft`: el contraste conserva 12 discrepancias de valor, los derechos del dato están en `review_required` y la política moderna excluye jugadores históricos del pool. El borrador de reto filtra el catálogo jugable y nunca reactiva esos históricos; el contrato online requiere además una segunda categoría real para formar la matriz multicategoría.

La política `modern-audience-v1` conserva todos los datos históricos para rankings y auditoría, pero excluye del pool jugable por defecto a los clásicos retirados antes de 1990. Solo entran excepciones históricas expresamente curadas como iconos —por ejemplo, Pelé, Cruyff o Gerd Müller—. Las entidades nuevas o sin perfil quedan fuera del juego hasta revisión explícita; el piloto inicial abre únicamente el ranking de Champions ya auditado. La curación moderna se amplía por bloques de competición, nunca por inferencia automática de popularidad. Se aplica con `npm run seed:game-audience`.

Cada importación valida el tipo de entidad, duplicados, valores, paginación y cobertura. El payload normalizado queda archivado en `storage/source-snapshots/` y su SHA-256 se registra en PostgreSQL. Los snapshots se crean como `draft`; publicar exige cobertura completa, cero conflictos y un expediente de derechos aprobado para cada dato y activo visual que se publique. Las imágenes opcionales pueden resolverse con el fallback visual propio del frontend; los escudos de clubes siguen requiriendo autorización marcaria adecuada.

Para una sincronización programable de una temporada completa de las seis ligas principales se puede usar `npm run sync:api-football:season -- --season YYYY`. El job usa un lock para impedir ejecuciones simultáneas, importa las ligas secuencialmente y archiva cada payload como snapshot. Por defecto también deja medios en `pending`; para una actualización estadística rápida se puede usar `--skip-media`, que no ejecuta esa cola: `npm run sync:api-football:season -- --season 2026 --skip-media`. Comprobar el lote sin consumir cuota: `npm run sync:api-football:season -- --season 2026 --dry-run`. Debe ejecutarse desde un worker/cron, nunca durante una partida; la temporada se pasa explícitamente para evitar errores en el cambio de año deportivo.

La Champions League se sincroniza con el mismo importador, pero queda como tarea explícita por su volumen: `npm run import:api-football:league -- --league-id 2 --competition european-cup-champions-league --season YYYY --full`. Después de una importación se reconstruyen únicamente las métricas que proceda actualizar; por ejemplo, tarjetas amarillas: `npm run build:rankings:api-football -- --competition european-cup-champions-league --from-season 2011 --to-season YYYY --metric yellow_cards`. Así una actualización no sustituye accidentalmente rankings completos de otras métricas. El proceso puede programarse después de cada jornada europea y debe mantener los snapshots anteriores hasta validar el nuevo lote.

El endpoint `/trophies` se importa con `npm run import:api-football:player-trophies -- --limit 400 --offset 0 --delay-ms 300`. `--offset` permite cargar cohortes sucesivas sin reemplazar la evidencia anterior y `--missing-only` limita la consulta a jugadores jugables con ID de API-Football que todavía no tienen ningún hecho `player_trophy_record:*`. Por defecto solo archiva registros de trofeo ganados (`place=Winner`) como hechos `player_trophy_record:*`; no crea rankings de títulos porque API-Football no demuestra que el jugador participase en cada edición. `--build-provisional` permite generar rankings exploratorios de la cohorte jugable; el reconstruido `npm run build:rankings:player-career-titles` agrega todos los hechos archivados. Ambos flujos permanecen en `draft` y con `coverageComplete=false`; no deben publicarse sin contrastar la participación con una fuente de competición.

Las categorías `club-career-goals`, `club-career-assists`, `club-career-yellow-cards` y `club-career-red-cards` se regeneran con `npm run build:rankings:api-football:career -- --from-season 2000 --to-season 2026 --metric goals,assists,yellow_cards,red_cards`. La versión actual contiene 200 entradas por métrica y temporadas efectivamente disponibles 2002–2026; las filas aisladas de 2000–2001 se conservan como evidencia, pero no se convierten en cobertura completa. Agregan por jugador las competiciones de clubes API-Football importadas; las competiciones de selecciones, como Copa América, se mantienen en sus rankings específicos y no se mezclan en la carrera de clubes. Se mantienen en `draft` y `coverageComplete=false` hasta completar el histórico y revisar derechos.

`club-career-titles` es la categoría global de títulos de clubes de jugadores. Se reconstruye con `npm run build:rankings:club-career-titles` usando únicamente hechos `player_trophy_record:*` ya importados desde `/trophies`, de las seis ligas actualmente disponibles, deduplicados por jugador canónico, competición y temporada. El comando conserva como evidencia los IDs de hechos y snapshots de origen, no añade ceros ni jugadores sin hechos y deja un máximo de 200 entradas en `draft` con `coverageComplete=false` mientras no exista cobertura mundial completa.

`club-global-titles` es la categoría global de palmarés de clubes. Se reconstruye con `npm run build:rankings:club-global-titles` a partir de los hechos `ranking_value:titles` de clubes ya importados; conserva solo la versión más reciente de cada club y competición, excluye categorías retiradas y limita el resultado a 200 clubes jugables. El snapshot actual es provisional porque todavía no cubre todas las competiciones y épocas.

La columna `entities.is_goalkeeper` se reconstruye únicamente desde posiciones explícitas `G/GK` o snapshots de porterías a cero ya filtrados. No se infiere de cualquier categoría para evitar que un proveedor defectuoso convierta delanteros en porteros.

El catálogo jugable de jugadores prioriza categorías globales de carrera (`player-career-titles`, goles, asistencias, tarjetas y porterías a cero cuando existen datos verificables) y competiciones de referencia. Las estadísticas y títulos de jugador de copas nacionales, supercopas y Recopa están retirados del juego, aunque sus snapshots históricos se conservan. La UEFA Cup y la Europa League se modelan juntas.

Las tablas de goles y asistencias de cada edición aislada de la EURO se conservan como evidencia para los agregados históricos, pero están retiradas del catálogo jugable: un torneo individual no tiene un universo de 200 jugadores. El juego usa `euro-goals` y `euro-assists` como categorías globales.

Además del snapshot y de las entradas del ranking, cada valor importado se registra como una afirmación en `fact_assertions`, enlazada con la entidad, la métrica, la versión de datos y el snapshot de origen. Las importaciones no revisadas quedan `pending`; una importación marcada como revisada solo puede usar una fuente con derechos `approved`.

Los identificadores de proveedores se guardan en `entity_external_ids`. Un proveedor puede tener varios identificadores para la misma entidad canónica, pero un identificador exacto no puede pertenecer a dos entidades. Los conflictos de identidad deben resolverse explícitamente con `entity:link`.

Las migraciones 038-039 separan las colisiones históricas de BDFutbol detectadas por URLs y fechas de nacimiento exactas (por ejemplo, Cissé, Pizzi, Pizarro, Míchel y Vieira). La migración 040 conserva alias completos revisados para jugadores de UEFA cuya tabla solo publica el apellido. Antes de importar más rankings BDFutbol se debe comprobar que no haya más de un identificador de jugador del mismo proveedor bajo una entidad ni fechas de nacimiento incompatibles.

## Importación revisable

`data/examples/ranking-input.json` documenta el formato de una importación normalizada. El fichero debe contener el universo completo de entidades elegibles, no solamente el top 200. El sistema usa las primeras 100 posiciones para la puntuación máxima, pero conserva las posiciones 101–200 para que la selección y la posición del jugador sean reproducibles.

```bash
npm run import:ranking -- --file data/examples/ranking-input.json
npm run import:premier-league -- --metric goals
npm run import:premier-league:club-titles
npm run import:bundesliga:club-titles
npm run import:dfl-supercup:club-titles
npm run refresh:premier-league
npm run import:uefa-champions-league
npm run import:uefa-conference-league
npm run import:uefa-europa-league
npm run import:uefa-club-titles
npm run import:ballon-dor
npm run import:national-team-goals
npm run import:serie-a:goals
npm run import:premier-league-teams
npm run entity:link -- --entity pl:player:123 --source api-football --external-id 456 --type player
npm run entity:consolidate:api-football
npm run entity:consolidate:uefa
npm run entity:consolidate:uefa-shared-clubs
npm run entity:consolidate:rsssf
npm run entity:consolidate:dfl-supercup
npm run approve:category -- --slug premier-league-goals
npm run review:source -- --key premier-league-official --status approved
npm run approve:snapshot -- --snapshot rs_xxx
npm run publish -- --snapshot rs_xxx
npm run audit:data-readiness
```

`audit:data-readiness` genera un informe por categoría con snapshot vigente, cobertura, derechos de la fuente, entidades jugables e imágenes aprobadas. `readyForPublish` solo es `true` cuando se cumplen todas las comprobaciones de publicación; no modifica datos.

La curación del pool jugable está bloqueada por defecto para que una nueva
importación no cambie silenciosamente el denominador de imágenes ni los
porcentajes de progreso. Para revisar el estado actual puede ejecutarse:

```bash
npm run seed:game-audience
```

Ese comando no amplía el catálogo. La expansión deliberada del pool requiere
`npm run seed:game-audience -- --expand` y debe acompañarse de una nueva
auditoría de datos y media.

Para auditar la cobertura visual del universo que realmente entra en el juego, usa `audit:assets` con `--playable-only`. Este filtro cuenta personas únicas con `playable_default=true`, resuelve el retrato canónico compartido entre rankings y excluye entidades importadas o en borrador que no necesitan imagen:

```bash
npm run audit:assets -- --entity-type player --kind portrait --playable-only
```

La migración 024 repara enlaces de identidad recíprocos detectados entre catálogos. Además, `recordIdentityLink` rechaza cualquier nuevo enlace que cree un ciclo, por lo que las consolidaciones pueden repetirse de forma segura después de una reparación.

La migración 025 invalida los snapshots de BDFutbol etiquetados como Premier League: `rankingGEng1` mezcla la máxima categoría inglesa anterior a 1992 con la era Premier League. Se conservan para auditoría, pero el importador ya rechaza esa variante y el ranking válido debe proceder de `premier-league-official`.

La búsqueda masiva de retratos de Commons conserva un manifiesto incremental. Si una sesión sufre rate limiting, se reanuda con `--resume` y vuelve a intentar solo las entradas que fallaron. Cada resultado también queda persistido en `entities.metadata.mediaDiscovery`: una entidad marcada `no_candidate` o `candidates` no se vuelve a consultar durante 30 días, salvo que se use `--retry-no-candidate`; así una cola sin resultados o con candidatos pendientes no se repite indefinidamente. Además, las colas normales excluyen cualquier entidad que ya tenga un asset `pending`, incluso si todavía no se ha descargado localmente; `--include-pending` queda reservado para buscar una alternativa explícita. La cola se ordena por el mejor puesto del jugador en los rankings no superseded y después por nombre, para que el trabajo útil para el juego avance primero. Para nombres abreviados o ambiguos, el buscador exige además que el equipo de contexto aparezca en los metadatos del archivo; así evita asociar un homónimo. `--missing-only` considera únicamente un asset principal aprobado y publicable legalmente, igual que la auditoría y la publicación:

```bash
npm run media:discover:commons:ranking -- --snapshot SNAPSHOT_ID --kind portrait --offset 0 --limit 100 --delay-ms 5000 --resume
```

La aprobación de derechos es deliberadamente explícita: no se ejecuta automáticamente al importar una fuente oficial. `approve-snapshot` comprueba además la categoría, la cobertura, los conflictos y la integridad del archivo archivado. Las migraciones 026-027 separan licencia de archivo, autorización de uso comercial, autorización marcaria y alcance contractual: un escudo de club necesita una licencia o permiso específico y `trademark_status=cleared`; una imagen descargada desde una API o CDN nunca se considera publicable por ese solo hecho.

`media:clean:redundant` ofrece una limpieza segura de candidatos `pending` que ya tienen un activo principal publicable para la misma entidad y tipo. Por defecto solo informa; con `--apply` los marca como `rejected` con el motivo `redundant_approved_primary`, sin borrar el archivo ni su trazabilidad. Así las colas de proveedores no vuelven a presentar imágenes que ya no pueden mejorar el catálogo.

`media:clean:nonrequired -- --apply` retira de las colas los candidatos pendientes de jugadores que no pertenecen al pool jugable actual, marcándolos como `rejected` y `media_not_required`, sin borrar archivos ni trazabilidad. La cola operativa se limita así a los retratos de jugadores jugables que todavía necesitan revisión.

El expediente [MEDIA_LICENSING_OUTREACH.md](../MEDIA_LICENSING_OUTREACH.md) contiene la solicitud lista para pedir cotización y licencia a Sportradar, TheSportsDB y titulares de derechos. No se cambia una fuente a `approved` por una demo o una respuesta informal: hace falta conservar el contrato, la orden de servicio o el permiso escrito.

`refresh:premier-league` vuelve a consultar y archivar las cinco métricas implementadas (goles, asistencias, porterías a cero, amarillas y rojas). Genera snapshots nuevos o idempotentes, pero nunca publica automáticamente; la publicación sigue requiriendo revisión de fuente, imágenes y derechos.

La política de audiencia `modern-audience-v1` se aplica también al staging de retratos: por defecto solo se buscan imágenes de entidades jugables; los clásicos excluidos se conservan para auditoría y un futuro modo histórico. Usa `--include-legacy` únicamente cuando se quiera completar ese catálogo histórico.

`npm run import:api-football:premier-league -- --season 2024` guarda la muestra de líderes que devuelve API-Football para goles y asistencias de esa temporada en `player_season_stats`, junto con el payload bruto, los identificadores del proveedor y su cobertura. Con `--full` descarga y valida todas las páginas si el plan permite ese número de páginas, respetando el límite de 10 peticiones por minuto; el plan gratuito rechaza de forma explícita las temporadas que superan su máximo de `Page=3`, sin guardar datos parciales. No descarga/aprueba imágenes automáticamente.

Para importar una liga histórica sin crear candidatos multimedia se puede añadir `--skip-media`; por ejemplo: `npm run import:api-football:league -- --league-id 61 --competition ligue-1 --season 2003 --full --skip-media`. El modo conserva las entidades y estadísticas, pero no inserta retratos ni escudos en `image_assets`.

Las importaciones completas de API-Football pueden usar un caché reanudable por liga y temporada. `--cache-dir RUTA` guarda cada página descargada en esa ubicación y `--resume` reutiliza únicamente las páginas cuyo JSON y metadatos de paginación sean válidos; las páginas ausentes, corruptas o incompatibles se vuelven a solicitar. Por ejemplo: `npm run import:api-football:league -- --league-id 61 --competition ligue-1 --season 2003 --full --skip-media --cache-dir ./storage/api-football-cache --resume`. El importador valida todas las páginas antes de escribir en PostgreSQL y no hace commit parcial si la descarga o la validación de la temporada falla. Tras un commit correcto, `--cleanup-cache` permite eliminar el caché de esa temporada: `npm run import:api-football:league -- --league-id 61 --competition ligue-1 --season 2003 --full --skip-media --cache-dir ./storage/api-football-cache --resume --cleanup-cache`. La limpieza es opcional y no se ejecuta por defecto.

`import:uefa-champions-league` descarga las clasificaciones históricas oficiales de goles, asistencias y tarjetas rojas de la Copa de Europa/UEFA Champions League desde 1955/56, valida el corte técnico de 200 entradas cuando la fuente lo permite, registra las fotos oficiales como candidatos pendientes y crea snapshots. Siguen sin ser publicables hasta resolver los derechos de datos y activos. Se puede limitar con `--metric goals|assists|red_cards`.

`import:uefa-conference-league` aplica el mismo flujo a las clasificaciones históricas oficiales de la UEFA Conference League. Valida diez páginas y 100 filas únicas/ordenadas por métrica; el snapshot queda con cobertura estructural completa del top 100, pero permanece en `draft` hasta validar derechos e identidad.

`import:uefa-europa-league` aplica el mismo flujo a las clasificaciones históricas oficiales de la UEFA Europa League (antigua Copa de la UEFA), separando sus snapshots de Champions y Conference. Se puede limitar con `--metric goals|assists|red_cards`. La implementación rechaza la importación si UEFA devuelve menos de 100 filas; en la comprobación del 10 de septiembre de 2026 la página volvió a devolver 80, por lo que no se ha creado un ranking incompleto.

`import:uefa-club-titles` importa las listas exhaustivas de clubes ganadores de Champions, Europa League y Conference League. Estas categorías tienen `closedUniverse=true`: se acepta el número completo de campeones que devuelve la fuente (24, 31 o 5), sin añadir clubes con cero títulos. Se puede limitar con `--competition champions|europa|conference`.

`import:premier-league:club-titles` importa la tabla oficial de los siete clubes campeones de la Premier League desde 1992/93. `import:bundesliga:club-titles` reconstruye las 61 temporadas del historial oficial publicado por Bundesliga.com hasta 2023/24 y añade 2024/25 y 2025/26 mediante sus comunicados oficiales. Ambas son categorías de universo cerrado: 7 y 13 clubes respectivamente, con empates calculados por el algoritmo común. Los snapshots permanecen en `draft` y sus escudos de TheSportsDB quedan en `pending` hasta revisión de licencia comercial.

`import:la-liga:club-titles` importa el palmarés oficial de clubes publicado por LALIGA. Valida las nueve filas del universo cerrado que devuelve la página, conserva el nombre oficial y deja el snapshot en `draft` hasta resolver los derechos de los escudos.

`import:ligue-1:club-titles` importa el histórico oficial de campeones publicado por Ligue 1. Reconstruye y valida las 87 temporadas y los 19 clubes del universo cerrado; el snapshot queda en `draft` hasta resolver los derechos de los escudos.

`import:trophee-champions:club-titles` importa el palmarés oficial del Trophée des Champions. Valida las 31 ediciones y los 8 clubes campeones del universo cerrado, reutilizando las entidades de Ligue 1; el snapshot queda en `draft` hasta resolver los derechos de los escudos.

`import:supercopa-espana:club-titles` importa el palmarés completo de la Supercopa de España publicado por la RFEF, con 42 ediciones disputadas entre 1982 y 2026 y 10 clubes campeones. Si la web de la RFEF bloquea la petición directa, utiliza un transporte lector para obtener el mismo contenido oficial; la evidencia y los derechos siguen referenciando la URL de la RFEF. El snapshot queda en `draft` hasta resolver derechos de los escudos.

`import:coupe-de-france:club-titles` importa el palmarés oficial de la Coupe de France publicado por la FFF. Valida 35 clubes campeones y 108 finales ganadas hasta 2026, conserva el caso histórico de los dos Toulouse FC como entidades distintas y añade el primer título del RC Lens con evidencia oficial específica. El snapshot queda en `draft` hasta resolver derechos de los escudos.

`import:primeira-liga:club-titles` importa el historial oficial de la máxima categoría portuguesa publicado por la FPF. Valida las 92 temporadas de 1934/35 a 2025/26, los cinco clubes campeones y sus recuentos (Benfica 38, Porto 31, Sporting 21, Boavista 1 y Belenenses 1). El snapshot queda en `draft` hasta resolver derechos de los escudos.

`import:supertaca-portugal:club-titles` importa el palmarés oficial de la Supertaça Cândido de Oliveira publicado por la FPF. Valida las 48 ediciones listadas hasta 2026, excluye explícitamente las pruebas oficiosas de 1979 y 1980, y conserva 46 ediciones oficiales y cinco clubes campeones. El snapshot queda en `draft` hasta resolver derechos de los escudos.

`import:coppa-italia:club-titles` importa el palmarés oficial de la Coppa Italia publicado por la Lega Serie A. Valida los 16 clubes campeones y deja el snapshot en `draft` hasta resolver los derechos de los escudos.

`import:fa-cup:club-titles` reconstruye el palmarés de clubes a partir del listado oficial de finales de The FA. Valida las 145 ediciones celebradas entre 1872 y 2026, resuelve desempates y tandas de penaltis, y conserva las temporadas ganadoras en la evidencia del snapshot.

`import:copa-del-rey:club-titles` lee la tabla de palmarés de la Copa del Rey y conserva la revisión y licencia de la página fuente; la propia página cita datos oficiales de la RFEF. `import:copa-america:national-team-titles` carga el universo cerrado de las ocho selecciones campeonas y valida que sus títulos sumen las 48 ediciones celebradas hasta 2024. Ambos snapshots permanecen en `draft` hasta la revisión de derechos.

`import:copa-libertadores:club-titles` carga el palmarés de clubes de la Copa Libertadores desde la tabla histórica de la fuente de referencia, valida los 27 clubes campeones y conserva la revisión/licencia de la página. El snapshot permanece en `draft` hasta la revisión de derechos.

`import:copa-sudamericana:club-titles` carga los clubes que han ganado la Copa Sudamericana desde la tabla histórica de referencia, excluye filas de subcampeones y valida el orden descendente antes de crear el snapshot en `draft`.

`import:recopa-sudamericana:club-titles` carga el palmarés de clubes de la Recopa Sudamericana desde la tabla histórica de referencia, excluye subcampeones y valida duplicados y orden antes de crear el snapshot en `draft`.

`import:dfb-pokal:club-titles` carga todas las temporadas del palmarés masculino publicado por la DFB, desde 1934/35 hasta la última edición incluida, agrega los nombres históricos oficiales de Werder Bremen y Bayer Leverkusen y valida que no falten temporadas. El snapshot permanece en `draft` hasta resolver los derechos de los escudos.

`entity:consolidate:dfb-pokal` mueve únicamente las equivalencias de clubes alemanes revisadas al catálogo DFB ya existente; los ganadores históricos sin destino inequívoco permanecen separados.

`entity:consolidate:serie-a-clubs` consolida las identidades inequívocas de Inter, Juventus, Milan, Napoli y Roma con sus entidades UEFA existentes; el resto de clubes se mantiene bajo la fuente Lega Serie A hasta una revisión individual.

`npm run import:supercoppa-italiana:club-titles` importa el palmarés oficial completo de la Supercoppa Italiana desde la Lega Serie A, valida los nueve clubes campeones, las 38 ediciones y la correspondencia entre títulos y temporadas. `npm run entity:consolidate:supercoppa-italiana` enlaza sus clubes con identidades canónicas existentes; el snapshot permanece en borrador hasta resolver derechos de escudos.

`import:nations-league:national-team-titles` carga las cuatro ediciones de la UEFA Nations League disputadas hasta 2025 y valida el cuadro de honor oficial de UEFA. El snapshot permanece en `draft` hasta la revisión de derechos.

`import:club-world-cup:club-titles` carga únicamente las ediciones oficiales del FIFA Club World Cup (2000, 2005–2023 y 2025), sin mezclar la Copa Intercontinental. El snapshot permanece en `draft` hasta la revisión de derechos.

`entity:consolidate:fa-cup` aplica únicamente las equivalencias de clubes de la FA Cup revisadas de forma explícita. Actualmente consolida Leeds United con `pl:club:9`, evitando duplicar sus escudos, perfiles y entradas de ranking; los clubes históricos sin equivalencia segura permanecen separados.

`import:community-shield:club-titles` importa el palmarés histórico del FA Charity/Community Shield desde RSSSF, contrastado con la historia de The FA. Valida las 104 ediciones celebradas entre 1908 y 2026, resuelve empates compartidos y tandas de penaltis, excluye equipos representativos y genera un snapshot de 26 clubes en `draft`; los derechos de los datos y escudos se revisan por separado.

`entity:consolidate:wikipedia:copa-sudamericana` une únicamente clubes con el mismo nombre exacto y único en el catálogo de Libertadores. Sirve para compartir identidad y escudo entre ambos torneos sin mezclar clubes homónimos.

`entity:consolidate:wikipedia:recopa-sudamericana` aplica el mismo criterio para unir clubes de la Recopa con identidades CONMEBOL ya revisadas.

`import:ballon-dor` importa el palmarés masculino oficial de France Football, conserva las 69 victorias anuales en `awards` y genera el ranking agregado de 47 ganadores como universo cerrado. La edición de 2020 no aparece porque no se concedió el premio. La carga vigente incorpora 2024 (Rodri) y 2025 (Ousmane Dembélé) y usa el ranking `rs_206273c3f213e5289a748e49`. Las fotografías del proveedor quedan pendientes de revisión de derechos.

`import:national-team-goals` archiva el top 200 disponible en el registro internacional de RSSSF, con goles, partidos, país y enlace de evidencia. La fuente incluye amistosos A y declara una tabla de jugadores con 30 o más goles; el snapshot tiene cobertura estructural completa del top 200, pero se mantiene como borrador hasta cerrar la revisión de derechos y las excepciones históricas del criterio de selección elegido para el juego.

`import:national-team:official-assists` usa la tabla histórica publicada por IFFHS para asistencias con selecciones absolutas. La fuente pública comprobada solo contiene cinco líderes; por defecto el comando falla y no inventa un top 200. `--allow-partial` permite archivar esas filas reales como borrador parcial mientras se consigue una fuente histórica que cubra el universo completo.

`import:copa-sudamericana:clean-sheets` agrega las porterías a cero de porteros por temporada mediante la API documentada de FootyStats. Requiere `FOOTYSTATS_API_KEY`, exige al menos 200 jugadores con valores positivos y marca el snapshot como parcial mientras falten las temporadas históricas que la API no expone; nunca rellena ceros ni publica automáticamente. Antes de usar sus datos en Rango90 hay que obtener confirmación escrita: sus [términos de uso](https://footystats.org/api/documentations/terms-of-use-and-legal) permiten webs y apps, pero prohíben redistribuir datos y usar la cuenta para copiar, competir o duplicar FootyStats.

`import:api-football:copa-sudamericana:clean-sheets` es un fallback de capacidad para la API-Football configurada. Actualmente comprueba que `/players` no devuelve un campo explícito de porterías a cero y se detiene; no transforma `goals.conceded` ni `goals.saves` en una métrica distinta. Si el proveedor añade el campo en el futuro, el importador podrá agregarlo por jugador y temporada con cobertura declarada.

`import:world-cup:cards -- --metric yellow_cards|red_cards` agrega las páginas históricas de selecciones de StatBunker para tarjetas del Mundial. Las amarillas han producido 200 entradas; las rojas se mantienen pendientes si el universo positivo disponible no alcanza 200. No se rellenan valores cero para simular cobertura.

`import:statbunker:world-cup:clean-sheets` recorre las ediciones históricas de la Copa del Mundo que StatBunker expone en sus páginas de porteros, suma las porterías a cero por el `player_id` estable y conserva 200 jugadores, incluidos ceros que la propia tabla de una edición declara. El snapshot actual queda en `draft` y `coverageComplete=false` hasta contrastar el alcance con FIFA y revisar los derechos; el mirror de lectura solo se usa como transporte cuando el dominio principal expira.

`import:statbunker:copa-america:clean-sheets` recorre las ocho ediciones de Copa América que StatBunker expone actualmente (2004–2024), suma las porterías a cero explícitas por `player_id` y conserva las 86 entidades únicas recuperables. La fuente no alcanza 200: el snapshot queda parcial, retirado del catálogo jugable y documenta el límite sin añadir ceros, jugadores ficticios ni datos de otra competición.

`import:statbunker:euro:clean-sheets` y `import:statbunker:nations-league:clean-sheets` aplican el mismo proceso a las 17 ediciones de la EURO y a las cuatro ediciones de Nations League disponibles. La fuente devuelve 169 y 175 porteros únicos, respectivamente; se conservan esos conjuntos reales como snapshots parciales y no se añaden jugadores ficticios para alcanzar 200.

`import:statbunker:conference:clean-sheets` recorre las cinco temporadas que StatBunker expone para UEFA Europa Conference League (`comp_id` 706, 738, 359, 771 y 786), suma las porterías a cero explícitas por `player_id` y conserva únicamente los 103 porteros únicos recuperables. La fuente no alcanza 200; el snapshot queda parcial, retirado del catálogo jugable y documenta el límite sin añadir ceros ni jugadores de otra competición.

`import:statbunker:club-world-cup:clean-sheets` recorre las ediciones que StatBunker expone del FIFA Club World Cup. La ejecución actual recupera 19 porteros únicos, por lo que el snapshot queda parcial (`coverageComplete=false`) y no se completa artificialmente hasta 200. La fuente de referencia es [StatBunker — FIFA Club World Cup](https://www.statbunker.com/competitions/Top10KeepersCleanSheets?comp_id=775); sus datos y derechos siguen pendientes de contraste y autorización.

`import:iffhs:goalkeepers` archiva la tabla oficial de IFFHS de mejores porteros de 1987–2022 como evidencia histórica, y `entity:consolidate:iffhs-goalkeepers` aplica únicamente equivalencias de identidad explícitas. `build:rankings:goalkeeper-index` genera el índice provisional de 200 porteros usando esa evidencia y RSSSF; no publica el snapshot ni infiere métricas ausentes.

`import:statbunker:uefa-europa -- --metric goals|assists|yellow_cards|red_cards` agrega por ID de jugador las páginas históricas de los clubes enlazados por StatBunker para UEFA Cup / Europa League. El agregador valida y selecciona 200 jugadores positivos por métrica; el valor se suma entre clubes, no se toma el máximo. El snapshot queda en `draft` y `coverageComplete=false` hasta contrastar el alcance histórico combinado con la definición oficial de UEFA y revisar los derechos. El mismo importador admite `--competition euro` para UEFA EURO y `--competition world_cup` para FIFA World Cup, usando las páginas de selecciones que enlaza el proveedor.

Para ampliar el archivo estadístico por temporadas sin tocar medios, se usa el importador completo de API-Football con `--league-id 3 --competition uefa-cup-europa-league --season YEAR --full --skip-media`. La ventana 2000–2024 ya está archivada; 2000 fue una respuesta vacía real y las temporadas con filas se conservan como snapshots validados. Los cuatro rankings provisionales actuales se regeneraron con `npm run build:rankings:api-football -- --competition uefa-cup-europa-league --from-season 2000 --to-season 2024 --metric goals,assists,yellow_cards,red_cards`. La ventana no se presenta como carrera histórica completa y permanece en `draft` hasta contrastar alcance histórico y derechos.

`import:statbunker:conference:yellow-cards` agrega las tarjetas amarillas de las temporadas disponibles de UEFA Conference League (2021/22–2025/26) mediante sus `comp_id` históricos y el identificador estable del jugador. Selecciona 200 jugadores positivos y suma sus tarjetas entre temporadas; el snapshot queda en `draft` y `coverageComplete=false` porque no es una tabla all-time completa ni una licencia de redistribución.

`import:statbunker:conference:goals` aplica el mismo recorrido a los goleadores y selecciona 200 jugadores positivos. Las temporadas sin filas no se convierten en ceros: el snapshot permanece provisional hasta verificar la cobertura.

`import:statbunker:conference:assists` recorre las páginas de club de las temporadas disponibles, suma por `player_id` y selecciona 200 asistentes positivos. Mantiene el snapshot en `draft` y no trata temporadas sin datos como ceros.

`import:statbunker:euro:yellow-cards` agrega las tarjetas amarillas de las ediciones EURO disponibles (2004–2024) por `player_id` y selecciona 200 jugadores positivos. El snapshot queda provisional; EURO rojas no se rellena si el universo positivo no alcanza 200.

`import:serie-a:goals` archiva los 100 primeros goleadores de la tabla histórica versionada de la Wikipedia italiana. La página documenta el alcance de Serie A a grupo único desde 1929/30 y excluye Alta Italia 1944 y el campeonato mixto Serie A-B 1945/46; el importador valida exactamente 100 filas, orden, empates, jugadores únicos y conserva el ID de revisión, la fecha y la licencia CC BY-SA 4.0 de la respuesta REST de Wikimedia. El snapshot tiene `coverageComplete=true` para el top 100, pero sigue en `draft` (`rightsStatus=review_required`): Wikipedia es una referencia reproducible con licencia explícita, pero su tabla debe contrastarse con una fuente estadística primaria o licenciada antes de publicar. El parser antiguo de RSSSF se conserva como contraste histórico y no se mezcla silenciosamente con este ranking.

`import:taca-portugal:club-titles` archiva las 103 ediciones con vencedor del Campeonato de Portugal/Taça de Portugal desde 1921/22 hasta 2025/26 a partir del palmarés oficial de la FPF, validando los 17 clubes campeones y conservando la URL oficial. Si la protección WAF de la FPF devuelve 403, usa un lector de transporte para recuperar el mismo documento oficial y deja ese transporte registrado en la evidencia; no cambia la fuente ni sus derechos.

`import:bundesliga:goals` archiva los 100 primeros jugadores únicos del registro oficial de goleadores históricos del DFB, recorriendo sus páginas 1–3 y deduplicando el solapamiento de la paginación por la ficha estable del jugador. Conserva el puesto visible y las apariciones como evidencia. El snapshot queda en `draft` con `coverageComplete=true` para el top 100; el DFB publica una lista superior, pero la publicación automática sigue bloqueada por derechos y revisión editorial.

`import:la-liga:goals` archiva los 200 primeros jugadores del ranking histórico de Primera División de BDFutbol. Conserva el nombre corto, el nombre completo, el identificador estable de la ficha y los empates del puesto visible. Es una fuente de referencia, no un feed licenciado; el snapshot queda en `draft` con `coverageComplete=true` para el top 200 hasta revisar alcance y derechos.

`import:bdfutbol:ranking -- --league LEAGUE --metric goals|clean_sheets|yellow_cards|red_cards` importa las tablas históricas de BDFutbol para Bundesliga, LaLiga, Serie A, Ligue 1 y Primeira Liga. Cada página entrega 250 filas y el parser valida las primeras 200, identificadores únicos, orden de valores y, en porterías a cero, que sean porteros. La Premier League se excluye de este comando porque la tabla histórica inglesa mezcla etapas anteriores a 1992; se usa su fuente oficial específica. Los snapshots BDFutbol quedan en `draft` y con derechos `review_required`.

Para buscar candidatos de Wikimedia Commons sin aprobarlos:

```bash
npm run media:discover:commons -- --entity pl:player:4338 --kind portrait --limit 5
npm run media:discover:commons -- --entity club:example --kind badge --limit 5
npm run media:discover:commons:ranking -- --snapshot rs_xxx --kind portrait --offset 0 --limit 10 --delay-ms 1500
npm run media:discover:commons:players -- --offset 0 --limit 100 --delay-ms 2000
npm run media:discover:commons:players -- --offset 0 --limit 100 --concurrency 3 --delay-ms 500
npm run media:discover:commons:players -- --all-ranked --offset 0 --limit 100 --delay-ms 2000
npm run media:discover:commons:players -- --offset 0 --limit 100 --include-pending --delay-ms 2000
npm run media:discover:commons:players -- --offset 0 --limit 100 --manifest storage/media-candidates/players-portrait-xxx-0-100.json --resume --delay-ms 3000
npm run media:discover:commons:clubs -- --limit 20 --delay-ms 1500 --concurrency 4
npm run media:stage:commons -- --entity pl:player:89 --title "File:Alan Shearer Sport Relief.jpg" --kind portrait
npm run media:stage:commons:rest -- --entity pl:player:1526 --title "File:Jermain-Defoe (cropped).jpg" --kind portrait
npm run media:stage:commons:manifest -- --manifest storage/media-candidates/rs_xxx-portrait-10-10.json --entity pl:player:1208 --title "File:Michael Owen 2010.jpg" --kind portrait
```

Para comprobar escudos en TheSportsDB existe un adaptador separado. Solo acepta coincidencias exactas, usa el ID estable del proveedor y respeta el límite de ritmo del plan gratuito. La búsqueda no modifica la base de datos:

```bash
npm run media:discover:thesportsdb -- --limit 20 --delay-ms 2100
```

Sin `--snapshot`, el comando busca clubes jugables sin escudo aprobado; con `--snapshot` limita la búsqueda a las entradas de ese ranking.

Cuando se quiera descargar y dejar candidatos locales para revisión, se puede usar `media:stage:thesportsdb`. Los activos quedan siempre `pending` y `review_required`; TheSportsDB no es fuente de estadísticas y sus URLs disponibles no bastan por sí solas como licencia comercial. El adaptador no permite aprobar esos escudos automáticamente:

La aprobación de un activo de TheSportsDB solo se habilita después de ejecutar `review-source --key thesportsdb-artwork --status approved`, una vez confirmada la licencia comercial aplicable a Rango 90. Con `review_required` o `unknown`, el backend rechaza la aprobación de forma intencionada.

```bash
npm run media:stage:thesportsdb -- --limit 20 --delay-ms 2100
```

Para completar retratos pendientes de un top 100 mediante coincidencia exacta:

```bash
npm run media:stage:thesportsdb:portraits -- --snapshot rs_xxx --limit 100 --delay-ms 2100
```

Para procesar directamente la cola completa de jugadores jugables que aún no tienen un retrato aprobado, sin depender de un snapshot concreto:

```bash
npm run media:stage:thesportsdb:playable-portraits -- --limit 100 --delay-ms 2100
```

Para auditar retratos TheSportsDB ya descargados, comprobando que el registro
del proveedor sigue siendo un futbolista y coincide con el nombre de la
entidad. Los casos no verificables permanecen pendientes; los falsos positivos
se rechazan y quedan registrados.

```bash
npm run media:audit:thesportsdb:players -- --limit 100 --delay-ms 2100
```

Cuando TheSportsDB confirma el jugador pero no tiene artwork, se puede usar su
identificador API-Football para recuperar una imagen candidata exacta. Este
comando no llama al endpoint de estadísticas ni aprueba derechos; deja cada
asset en `pending` y exige que la coincidencia TheSportsDB sea de `Soccer`.

```bash
npm run media:stage:api-football:exact -- --limit 100 --delay-ms 2100
```

El comando excluye retratos aprobados y candidatos ya pendientes, y deja los nuevos activos en `pending` para revisión de identidad y derechos. Si el detalle de TheSportsDB no incluye `idAPIfootball`, usa como respaldo la búsqueda exacta de plantilla por equipo UEFA y temporada API-Football (por defecto `2024`), sin aceptar homónimos. Para continuar por bloques sin repetir los casos no resueltos:

```bash
npm run media:stage:api-football:exact -- --limit 3 --offset 3 --season 2024 --delay-ms 8000
```

El comando excluye cualquier jugador que ya tenga un retrato `pending`, aunque
el archivo todavía no se haya descargado. Para buscar una alternativa
explícita sobre esos casos se puede añadir `--include-pending`.

Las imágenes oficiales de UEFA que el importador registra como candidatos también pueden descargarse y normalizarse localmente, sin aprobarlas:

```bash
npm run media:stage:uefa -- --kind badge --limit 60 --delay-ms 300
npm run media:stage:uefa -- --kind portrait --limit 100 --delay-ms 300
```

Openverse se usa como cola adicional de descubrimiento para jugadores jugables que todavía no tienen un retrato publicable. Filtra licencias con permiso comercial, exige una señal de identidad y dimensiones mínimas, descarga y normaliza a WebP 512x512, pero deja siempre el activo en `pending` hasta la revisión visual y legal. La cola registra cada intento durante 30 días y evita duplicados:

```bash
npm run media:stage:openverse -- --limit 20 --delay-ms 300
# Para lotes grandes, hasta ocho consultas concurrentes controladas:
npm run media:stage:openverse -- --limit 100 --concurrency 4 --delay-ms 300
```

La API pública de Openverse puede exigir autenticación y limitar las consultas anónimas. Para lotes de producción, registrar una aplicación en
[Openverse](https://api.openverse.org/v1/#tag/auth/operation/register) y guardar sus credenciales únicamente en el `.env` local:

```bash
OPENVERSE_CLIENT_ID=...
OPENVERSE_CLIENT_SECRET=...
OPENVERSE_TIMEOUT_MS=15000
OPENVERSE_MIN_REQUEST_INTERVAL_MS=1000
```

El backend obtiene y renueva el token OAuth2 automáticamente, serializa las consultas y respeta el intervalo mínimo configurado; nunca se escribe el secreto en la base de datos ni se envía en la URL. La autenticación aumenta el límite de consulta, pero no convierte una imagen en licenciada: cada archivo sigue requiriendo revisión de identidad, licencia y atribución.

No se debe aprobar automáticamente un resultado de Openverse: hay que comprobar que sea el jugador correcto, que sea un retrato individual claro y conservar la página de licencia y la atribución exigida.

Los retratos candidatos de API-Football también pueden descargarse y normalizarse en lote:

```bash
npm run media:stage:api-football -- --limit 100 --delay-ms 300
```

Se mantienen en `pending`: la URL del proveedor sirve para localizar el retrato, pero no demuestra por sí sola una licencia de redistribución comercial. Los términos oficiales de API-Football indican que sus logos, imágenes y marcas se proporcionan para identificación/descripción, que el proveedor no es titular de esos recursos y que cualquier autorización adicional de los titulares corresponde al usuario; por tanto, una suscripción API-Football no convierte esos medios en assets publicables de Rango 90. Véanse [los términos oficiales de API-Football](https://www.api-football.com/terms).

La página oficial muestra TheSportsDB Single Developer a 9 USD/mes. Antes de publicar hay que confirmar en el checkout y por escrito el plan exacto, el uso comercial, la caché local/CDN, las aplicaciones móviles y la atribución; el pago no sustituye los permisos sobre contenido de terceros. Véanse [la guía de API](https://www.thesportsdb.com/docs_api_guide), [los términos](https://www.thesportsdb.com/docs_terms_of_use.php) y [los precios actuales](https://www.thesportsdb.com/pricing).

El resultado incluye la página del archivo, autor, licencia y URL de descarga. `media:stage:commons` valida el título exacto contra Commons, descarga y normaliza a WebP 512x512, pero lo deja `pending`; hay que verificar manualmente la identidad y los derechos antes de aprobarlo. El sistema distingue `portrait` y `badge` según la entidad.

Si una fuente Commons ya fue rechazada pero una nueva revisión manual confirma que el archivo sí corresponde y cumple el estándar, se puede reabrir el mismo registro sin duplicarlo usando `--reopen-rejected`. Debe utilizarse únicamente con evidencia nueva y queda registrado en la metadata del activo.

Si una entidad ya tiene un activo principal publicable, el flujo bloquea candidatos redundantes. Para sustituirlo por una imagen claramente mejor revisada se debe usar explícitamente `--replace-primary` al ejecutar `media:stage:commons` o `media:stage:commons:manifest`; la aprobación posterior vuelve a marcar como principal únicamente el candidato aprobado. Si el archivo exacto ya existe como `rejected` pero se dispone de una revisión nueva y documentada, `media:stage:commons` admite `--reopen-rejected`: reutiliza el mismo registro y archivo normalizado, en lugar de crear un duplicado.

Tras revisar visualmente la identidad y la licencia, una imagen pendiente se puede convertir en principal con una comprobación final de formato, hash y derechos. La aprobación exige registrar quién revisó, qué evidencia contractual/licencial se comprobó y confirmar el uso comercial:

```bash
npm run media:approve -- --id img_xxx --rights-basis open_license --commercial-use --reviewer legal-review-1 --rights-evidence-url https://commons.wikimedia.org/wiki/File:Example.jpg --usage-scope web,pwa,cdn,local_storage --attribution "Autor, licencia CC BY 4.0" --trademark-status not_applicable
npm run media:approve -- --id img_xxx --rights-basis open_license --commercial-use --reviewer legal-review-1 --rights-evidence-url https://commons.wikimedia.org/wiki/File:Example.jpg --usage-scope web,pwa,cdn,local_storage --attribution "Autor, licencia CC BY-SA 4.0" --allow-share-alike --trademark-status not_applicable
npm run media:approve -- --id img_xxx --rights-basis direct_license --commercial-use --reviewer legal-review-1 --rights-evidence-url https://example.com/licence-rango90 --usage-scope web,pwa,android,cdn,local_storage --trademark-status cleared
npm run media:reject -- --id img_xxx --reason "La imagen no corresponde a la entidad"
```

Para saber qué activos bloquean una publicación o qué escudos faltan en el catálogo:

```bash
npm run audit:assets -- --snapshot rs_xxx --kind portrait
npm run audit:assets -- --entity-type club --kind badge
npm run audit:media-rights
npm run media:backfill:commons:rights
# Solo después de revisar la salida y aceptar el lote compatible:
npm run media:backfill:commons:rights -- --apply --reviewer backend-commons-open-license-audit --usage-scope web,pwa,android,ios,cdn,local_storage
```

La auditoría considera aprobado únicamente un activo `primary` con `review_status=approved`; además informa si esa aprobación carece de uso comercial confirmado, evidencia verificable o autorización marcaria. Los candidatos pendientes no cuentan.
`--allow-share-alike` es obligatorio para aprobar un `CC BY-SA`; registra la decisión y exige que la aplicación mantenga la atribución y publique el derivado bajo la licencia correspondiente.

`media:backfill:commons:rights` solo puede aplicar retratos que ya estaban aprobados por identidad, tienen archivo local, página de Wikimedia verificable y licencia CC BY, CC0 o dominio público compatible. Incluye archivos servidos desde Commons y páginas `*.wikipedia.org` que apuntan a un archivo de Wikimedia. Por defecto no aprueba CC BY-SA, autores ausentes, proveedores externos ni ningún escudo; `--allow-share-alike` habilita únicamente los CC BY-SA con autor y deja constancia de que el derivado WebP debe conservar esa licencia.

`entity:consolidate:uefa` aplica únicamente un mapa explícito de identidades UEFA inequívocas. Tras consolidar, los rankings, hechos, perfiles e imágenes apuntan al registro canónico y el comando es idempotente; los homónimos ambiguos se conservan separados.

`npm run entity:consolidate:uefa-shared-clubs` consolida únicamente clubes que comparten el mismo identificador estable de escudo UEFA entre Champions, Europa League y Conference League y cuyo nombre coincide exactamente. Evita duplicar un club jugable por namespace de competición; los conflictos de identidad preexistentes se dejan sin tocar.

`npm run entity:consolidate:uefa-conference` consolida duplicados inequívocos de Conference League cuyo identificador UEFA estable ya aparece en otra categoría. No aplica heurísticas a apellidos ambiguos.

`entity:consolidate:rsssf` hace lo mismo para los identificadores RSSSF explícitamente revisados. No intenta resolver automáticamente nombres homónimos ni crea una falsa coincidencia cuando el catálogo canónico no existe.

El backend expone `GET /v1/attributions` (y `?kind=portrait|badge`) para que la interfaz muestre o enlace la atribución de cada activo aprobado, incluyendo autor, licencia, fuente y transformación aplicada.

No se deben guardar claves de API en el frontend ni enviarlas por el chat. API-Football queda encapsulada en un adaptador opcional y no es una dependencia de ejecución.

Cuando exista una clave local, la conexión y una muestra de cobertura se comprueban con un máximo de tres llamadas:

```bash
npm run audit:api-football -- --season 2023
```

La auditoría no importa ni publica datos; sirve para decidir si el proveedor cubre las competiciones necesarias antes de consumir cuota.

El catálogo de clubes de una temporada de Premier League se importa desde el endpoint oficial y se archiva con hash:

```bash
npm run import:premier-league-teams -- --season-id 841
```

La importación crea las entidades de club y deja los derechos de datos en `review_required`; todavía no aprueba ni descarga escudos.

### Supercopa alemana

`npm run import:dfl-supercup:club-titles` importa el palmarés histórico del DFL Supercup desde la página oficial de Bundesliga. Tras revisar la equivalencia de clubes, `npm run entity:consolidate:dfl-supercup` consolida sus entidades con el catálogo alemán canónico.
La migración `034_deduplicate_media_candidates.sql` conserva el registro histórico pero rechaza duplicados exactos de la misma fuente para una entidad. El staging de Commons también bloquea volver a importar una fuente ya registrada.
La migración `035_backfill_provider_player_aliases.sql` reutiliza los nombres completos asociados a IDs estables de TheSportsDB para mejorar búsquedas de retratos; no cambia el estado de derechos ni aprueba sus imágenes.
