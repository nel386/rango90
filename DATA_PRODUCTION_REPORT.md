# Informe de producción de datos

Fecha: 2026-09-12

> **Checkpoint autoritativo vigente — 13 de septiembre de 2026.** Las cifras de este bloque son las únicas que deben usarse para medir el estado actual: **6.675 jugadores únicos jugables presentes en rankings activos**, **1.030 retratos legales principales**, **5.645 pendientes** y **15,43% de cobertura visual**. El denominador cuenta personas canónicas, no apariciones por categoría. Hay **0 jugadores jugables nacidos antes de 1930**; las filas de los años 20 que permanecen en la base son histórico técnico excluido del juego (`catalog_status=excluded_from_game`, `playable_default=false`). Las cifras de secciones posteriores anteriores a este checkpoint son históricas y están superadas.

> Este informe es un registro acumulativo. Todo checkpoint posterior que conserve cifras distintas es histórico respecto al estado de `DATA_CURRENT_STATUS.md`, aunque use la palabra «actual» en el contexto de su propia fecha.

## Producción adicional — rankings globales de carrera

Se reconstruyeron sin nuevas peticiones externas, a partir de los registros ya persistidos:

- `club-career-goals`: `rs_d40310c7f904791121414549` — 200 entradas, 200 valores positivos.
- `club-career-assists`: `rs_3c33fbdb9fdd3f247480b7c0` — 200 entradas, 200 valores positivos.
- `club-career-yellow-cards`: `rs_96aeec86c6283d11db2ad783` — 200 entradas, 200 valores positivos.
- `club-career-red-cards`: `rs_2336f07f397309857f627b8a` — 200 entradas, 200 valores positivos.
- `player-career-titles`: `rs_33da5b7cf6f0f20756e12438` — 200 entradas, 200 jugadores con títulos positivos.
- `club-career-titles`: `rs_9db3675a17b09bda84327786` — 200 entradas, 200 jugadores con títulos positivos según los hechos persistidos del importador.

El bloque de métricas de carrera usa las temporadas 2005–2025 y excluye competiciones de selecciones. Todos los snapshots permanecen `draft` y `coverageComplete=false`: representan el universo importado y trazable disponible, no una afirmación de carrera mundial completa ni una autorización de redistribución.

## Producción adicional — torneos de selecciones

- `world-cup-clean_sheets`: snapshot de fuente `src_29b0a3876a15665a9105e748`, ranking `rs_1d9ecc0775b5582798059572` — 200 registros reales de las ediciones expuestas por StatBunker, sin padding.
- `euro-yellow_cards`: snapshot de fuente `src_db5678034245a1e885f4d7ed`, ranking `rs_6d55e64d72022927036fc631` — 200 valores positivos reales de las ediciones disponibles, sin padding.

Ambos snapshots han sido verificados en PostgreSQL, permanecen `draft` y `coverageComplete=false`: no se presentan como históricos completos mientras falten ediciones por contrastar y revisar los derechos de redistribución.

Actualización posterior:

- `uefa-conference-league-yellow_cards`: ranking `rs_0833536f4d1f8921e2073944` — 200 entradas reales de Conference League, sin mezclar competiciones ni aplicar padding; permanece provisional.
- La reimportación de `world-cup-red_cards` agotó los reintentos por timeout de StatBunker antes de escribir; el snapshot anterior permanece intacto y no se conservan filas parciales.

## FIFA Club World Cup — porterías a cero

`club-world-cup-clean_sheets` — porterías a cero acumuladas por portero en la tanda histórica ya abierta del importador de StatBunker.

- Fuente: `statbunker-club-world-cup-clean-sheets` (`reference`, `rightsStatus=review_required`)
- URL canónica: `https://www.statbunker.com/competitions/Top10KeepersCleanSheets`
- Ediciones cerradas en esta tanda: 4 — IDs `775` (2025), `388` (2011), `343` (2010) y `221` (2007)
- Snapshot de fuente: `src_b6d5d681a16e2919606f4860`
- SHA-256 del snapshot de fuente: `b6d5d681a16e2919606f486030b1b47859f8521c96c14167e7aa329f271d49c5`
- Snapshot de ranking: `rs_6eec387e00388202085fa855`
- SHA-256 del snapshot de ranking: `6eec387e00388202085fa855bb490cda35f660258b4b786872d0dcf17bc427fc`
- Filas verificadas: 19; entidades canónicas únicas: 19; IDs de proveedor únicos: 19; conflictos sin resolver: 0
- Valores: rango `0–2`; 11 ceros explícitos conservados y 8 valores positivos
- Validación: todas las filas tienen posición explícita de portero, evidencia de edición exclusivamente FIFA Club World Cup y no mezclan competiciones
- Estado: `draft`, `coverageComplete=false`, no publicado; la categoría continúa `retired` en el catálogo jugable
- Límite: la tanda se cerró sin ampliar alcance. No se añadieron filas, ceros imputados ni temporadas/competiciones nuevas. API-Football no expuso `clean_sheets` explícito en las respuestas históricas revisadas; `goals.conceded` no se convirtió en porterías a cero. El snapshot no afirma cubrir todas las ediciones del torneo.
- Media: no se ejecutó ningún comando ni cola de media.

## Nations League — porterías a cero

`nations-league-clean_sheets` — porterías a cero acumuladas por portero en las ediciones históricas que expone el índice de StatBunker.

- Fuente: `statbunker-nations-league-clean-sheets` (`reference`, `rightsStatus=review_required`)
- URL canónica: `https://www.statbunker.com/competitions/Top10KeepersCleanSheets`
- Ediciones importadas: 4 — IDs `609` (18/19), `674` (20/21), `725` (22/23) y `772` (24/25)
- Snapshot de fuente: `src_93caf34229019ebce22b6f69`
- SHA-256 del snapshot de fuente: `93caf34229019ebce22b6f6923aa7d77b53d659c061153a41ac0c4be474ab728`
- Snapshot de ranking: `rs_93c96bf4318ff26b9ad07038`
- SHA-256 del snapshot de ranking: `93c96bf4318ff26b9ad07038c0b910a3aa053726b5a465927efef55049222270`
- Filas verificadas: 175; entidades únicas: 175; IDs de proveedor únicos: 175; conflictos de identidad sin resolver: 0
- Valores: rango `0–9`; 65 ceros explícitos conservados
- Estado: `draft`, `coverageComplete=false`, no publicado
- Límite: StatBunker expone actualmente esas cuatro ediciones y la agregación produce 175 porteros únicos. No se añadieron filas 176–200, ceros imputados ni datos de otra competición.
- Media: no se ejecutó ningún comando ni cola de media; la importación no adjuntó nuevos activos.

## Ranking reconstruido

`copa-libertadores-clean_sheets` — porterías a cero acumuladas por portero en las ediciones históricas que expone el índice de StatBunker ya integrado por el proyecto.

- Fuente: `statbunker-copa-libertadores-clean-sheets` (`reference`, `rightsStatus=review_required`)
- URL canónica: `https://www.statbunker.com/competitions/Top10KeepersCleanSheets`
- Ediciones importadas: 4 — `435` (Copa Libertadores 2013), `405` (2012), `348` (2011), `236` (2008)
- Snapshot de fuente: `src_42f40a0085c04c704d986a24`
- SHA-256 del snapshot de fuente: `42f40a0085c04c704d986a2449ebd2e0fba3d541de32ed06e188ef26b3495cdc`
- Snapshot de ranking: `rs_3bd4166277a496f65b74ff06`
- Filas verificadas: 120; entidades únicas: 120; afirmaciones: 120
- Estado: `draft`, `coverage_complete=false`, no publicado
- Límite: el índice actual de StatBunker solo expone esas cuatro ediciones y la agregación produce 120 porteros únicos. No se añadieron filas 121–200, ceros imputados ni datos de otra competición.
- Media: no se ejecutó ningún comando ni cola de media; la importación no adjuntó nuevos activos.

La categoría sigue `retired` en el catálogo jugable por cobertura histórica insuficiente. Se habilitó únicamente el archivado de este snapshot parcial con su fuente exacta; esto no reactiva la categoría ni cambia sus derechos.

## Categoría incompleta

`national-team-official-assists` — ranking histórico de asistencias de selecciones masculinas absolutas.

## Bloqueo exacto

No existe en el proyecto una fuente aprobada que publique un ranking mundial homogéneo hasta 200 jugadores. La única tabla global localizada, IFFHS, publica únicamente 5 líderes; su fuente está en `review_required`, no en `approved`. FIFA/Opta cubre torneos concretos, las federaciones cubren países individuales y API-Football no ofrece un agregado histórico internacional completo ni licencia de redistribución suficiente. No se inventaron las posiciones 6–200.

## Importación segura realizada

- Fuente: `iffhs-national-team-assists`
- Snapshot de fuente: `src_4a19af7af7f693bebccb93cc`
- Snapshot de ranking: `rs_426920696b203de1e444ca51`
- Filas reales importadas: 5
- Estado: `draft`, `coverage_complete=false`, categoría `retired`
- Derechos: `review_required`
- Filas: Lionel Messi (60), Landon Donovan (58), Neymar (58), Ferenc Puskás (53), Sándor Kocsis (51)

Validación: parser del proveedor y test `national-team-assists` superados; el snapshot contiene 5 entradas únicas y conserva los empates y el orden de origen.

## UEFA Conference League — porterías a cero

Fecha de reconstrucción: 2026-09-12

- Categoría: `uefa-conference-league-clean_sheets`
- Fuente: `statbunker-uefa-conference-league` — StatBunker, histórico por edición
- Temporadas/ediciones recuperadas: `comp_id` 706, 738, 359, 771 y 786
- Snapshot de fuente: `src_7e3caa4d0257f4d44aab9653`
- Snapshot de ranking: `rs_6a8d18d0aec4ed2937a5b825`
- Filas verificadas importadas: 103
- Jugadores únicos por `providerPlayerId`: 103
- Estado: `draft`, `coverage_complete=false`, categoría `retired`
- Derechos: `review_required`

La fuente no alcanza 200 jugadores únicos para el histórico que expone. Se conservaron únicamente las 103 filas devueltas por las cinco ediciones, incluyendo los 41 ceros explícitos de participación; no se añadieron jugadores, ceros artificiales ni datos de otra competición. La categoría permanece retirada del juego y el snapshot se archiva solo como evidencia parcial hasta ampliar o contrastar la cobertura histórica.

## World Cup — tarjetas rojas

Fecha de intento de reconstrucción: 2026-09-12

- No se creó snapshot nuevo. El importador fue detenido tras agotar la ruta lenta de páginas por selección sin recibir una respuesta completa.
- El espejo responsive de StatBunker sí devuelve la tabla raíz, pero actualmente pagina 50 filas; no se tomó esa página como top 200 ni se hizo padding.
- El snapshot anterior no publicado permanece intacto (`rs_523c54262afe11e43e3b2280`); conserva 200 filas, pero solo 51 valores positivos y `coverage_complete=false`.
- Se añadió el espejo `betl.statbunker.com` como primera ruta de descarga, con timeout y reintentos acotados. La validación de cobertura sigue siendo obligatoria.

## UEFA Cup / Europa League — porterías a cero

La categoría `uefa-cup-europa-league-clean_sheets` conserva un snapshot técnico de 200 filas de StatBunker, con 200 `providerPlayerId` únicos, valores positivos y ordenados, sin padding. No se considera cobertura histórica completa: las tablas de porterías a cero disponibles cubren únicamente 2009/10–2025/26 y no incluyen la etapa UEFA Cup 1971–2009. El snapshot permanece `draft` y `coverage_complete=false`; no se sustituyen las temporadas ausentes por otra fuente ni se imputan valores.

## Producción paralela — 2026-09-12

- `uefa-conference-league-goals`: snapshot `rs_5407a6e0daab72051c854a9b`, 200 entradas reales, 200 positivas, `draft`, `coverageComplete=false`.
- TheSportsDB: dos tandas de escudos sobre 200 clubes; la primera añadió 8 candidatos nuevos (`pending`) y la segunda no encontró candidatos adicionales. No se aprobaron derechos.
- Commons: se buscaron 100 jugadores y 100 clubes. La validación rechazó los candidatos incompatibles o ya registrados; se staged 0 assets nuevos y no se aprobaron derechos.
- API-Football exacto desde TheSportsDB: la tanda fue detenida por bloqueo de la resolución externa antes de generar nuevos assets; no se creó snapshot ni se forzó ningún registro.

## UEFA Conference League — goles

Fecha de importación: 2026-09-12

- Categoría: `uefa-conference-league-goals`
- Fuente: `statbunker-uefa-conference-league` — StatBunker, agregación de las temporadas disponibles (2021/22–2025/26)
- Snapshot de fuente: `src_a6d9b38f38f89c9e138cb44b`
- Snapshot de ranking: `rs_5407a6e0daab72051c854a9b`
- Entradas verificadas: 200
- Valores positivos: 200
- Estado: `draft`, `coverage_complete=false`, no publicado
- Motivo: la cobertura histórica y los derechos de la fuente requieren validación antes de publicar; no se hizo padding.

## Actualización RSSSF — selección y Mundial

- `national-team-official-goals`: se reimportó desde RSSSF con `rs_da1cfd5589db34d67042ff83`; 200 entradas positivas, `coverageComplete=true`, `draft`, sin padding.
- `world-cup-goals`: la fuente devolvió 174 filas parseables frente a las 200 exigidas; no se escribió snapshot nuevo ni se alteró el existente.

## Actualización France Football — Balón de Oro

- `ballon-dor-wins`: se reimportó el palmarés oficial con snapshot `rs_206273c3f213e5289a748e49`.
- Resultado verificado: 47 ganadores únicos, 69 premios, años 1956–2025; incluye 2024 y 2025.
- Estado: `draft`, `coverage_complete=true`, sin padding ni datos parciales.

## Corrección del auditor y consolidación de identidades — 2026-09-12

- `repair-identity-links` reparó 3.270 vínculos entre entidades de distintas fuentes; dejó 22 conflictos de consolidación explícitos sin resolver y no los fusionó automáticamente.
- `consolidate-api-football-identities` terminó sin dejar cadenas de identidad: `identityLinkChains=0`.
- `build:rankings:club-global-titles` se regeneró después de la consolidación: snapshot `rs_01e860ba255b02998f4c9d5b`, 200 clubes únicos jugables, sin padding, cobertura todavía provisional.
- Se corrigió `audit-data-readiness`: el cálculo de perfiles jugables ya no está limitado erróneamente a jugadores. Ahora distingue perfiles de clubes, retratos y escudos, y no presenta un club como “sin entidad jugable” por un fallo del auditor.
- Verificación posterior: 233 perfiles de clubes jugables, 20 escudos legalmente aprobados en total, pero 0 de los 200 clubes de `club-global-titles` tienen todavía un escudo que cumpla todos los filtros de publicación. No se han contado candidatos pendientes como assets legales.
- La tanda Commons `players-portrait-1789203017944-0-200.json` procesó 200 jugadores jugables sin errores y devolvió 0 candidatos válidos adicionales; no se aprobaron assets ni se modificaron categorías.
- El auditor ahora informa `categoriesWithCompleteData=59`, `categoriesWithCompleteDataPercent=54.1`, `openCategoriesWithTwoHundred=80` y `closedCategoriesComplete=29`. La métrica aplica 200 solo a universos abiertos y exige al menos una entidad para universos cerrados.
- Se generó el paquete de solicitudes de licencia de escudos para los 233 clubes jugables: 167 tienen algún asset registrado y 66 no tienen ninguno; los 233 requieren permiso o confirmación jurídica. Salidas: `storage/media-candidates/club-badge-license-requests-v1.{json,csv,md}`. No cambia la base de datos ni convierte una URL en licencia.
- La consolidación `entity:consolidate:uefa-shared-players` vinculó 93 identidades UEFA sin conflictos y movió 94 assets, 94 identificadores externos, 306 rankings y 306 hechos al ID canónico. El conjunto auditado pasó a 9.741 jugadores ranqueados únicos y 445 jugadores jugables con retrato legal (53,74% de los 828 jugables ranqueados); los retratos no se duplicaron.
- Se endureció `consolidate-rsssf-identities` para omitir de forma transaccional los mapeos que crearían ciclos; la ejecución verificó `linked=0`, `skipped=39` y `identityLinkChains=0`, sin filas parciales. `npm run build` y la suite backend pasan tras el cambio.
- `entity:consolidate:statbunker-world-cup` vinculó 86 identidades históricas sin usar API-Football y movió sus datos asociados; la reparación posterior aplanó la única cadena producida y dejó `identityLinkChains=0`. El auditor conserva 200 entradas en `world-cup-clean_sheets`, ahora con 2 entidades jugables y 1 retrato legal reutilizado, sin duplicar imágenes.
- `entity:consolidate:statbunker-euro` vinculó 91 identidades sin conflictos y movió 6 assets, 98 identificadores externos, 197 rankings y 269 hechos. La auditoría posterior confirma `identityLinkChains=0`; `euro-assists` conserva 200 entradas y 21 retratos legales dentro de sus 23 jugadores jugables.
- Consolidaciones adicionales de StatBunker: Europa League vinculó 1 identidad; Conference League 3; Nations League 3; Copa América y Copa Libertadores no encontraron coincidencias seguras; Club World Cup omitió 14 y dejó 1 conflicto sin fusionar. La reparación global posterior procesó 3.547 enlaces y confirmó de nuevo `identityLinkChains=0`; no se forzaron homónimos ni se alteraron los snapshots estadísticos.
- Revisión manual de media Commons: se aprobaron 5 retratos inequívocos y con licencia abierta explícita — Jadon Sancho (CC0), Jonas Gonçalves Oliveira (CC BY 2.0), Łukasz Podolski (CC BY 2.0), Pedri (CC BY 4.0) y Vladimír Weiss (CC BY 2.0). Cada expediente conserva página de archivo, autor, atribución, alcance `web,pwa,android,cdn,local_storage`, revisor y hash WebP 512×512. Se excluyeron CC BY-SA y falsos positivos.
- Verificación posterior: 1.336 retratos legales aprobados, 1.218 personas canónicas con retrato; 450/828 jugadores jugables ranqueados cubiertos (54,35%) y 378 sin retrato. `uefa-champions-league-assists` pasó de 145 a 147 jugadores jugables con retrato.

## Investigación de fuente para goles globales de carrera

Fecha de verificación: 2026-09-12.

- Se realizó una búsqueda de producción independiente, sin consultar API-Football, para obtener al menos 200 jugadores únicos con una definición homogénea de goles de carrera globales y permiso de redistribución comercial.
- No se encontró una fuente que cumpla las dos condiciones. StrikerDuel es la opción con licencia comercial explícita bajo petición, pero declara 134 jugadores perfilados y publica un top 50; SportBaseline muestra top 50 sin licencia de redistribución localizada; RSSSF/IFFHS no ofrecen un top 200 homogéneo; los datasets abiertos revisados no acreditan simultáneamente cobertura y derechos.
- No se modificó PostgreSQL, no se creó un snapshot falso y no se mezclaron RSSSF/IFFHS ni otras fuentes. El ranking `club-career-goals` existente continúa siendo provisional, limitado a las competiciones/ventana que ya constan en la base de datos.
- El expediente con URLs, licencias, definiciones, recuentos y estados está en `backend/data/evidence/global-career-goals-2026-09-12/`; se valida con `npm run validate:evidence:global-career-goals`.

## Control operativo posterior — retratos legales

Fecha de verificación: 2026-09-12

- Se aprobaron diez retratos adicionales tras comprobación visual, de identidad y de licencia: Harry Winks (CC0), Henrik Ojamaa (CC BY 2.0), Igor Paixão (CC BY 2.0), Daniel Muñoz (dominio público), David Luiz (CC BY 4.0), Andy Diouf (CC0), Mason Greenwood (CC BY 2.0), Dan Ndoye (CC0), Reiss Nelson (CC BY 2.0) y Michel Preud’homme (CC BY 2.0).
- En la revisión posterior se aprobaron dos retratos adicionales, Jean-Paul Bertrand-Demanes y Victor Osimhen, ambos con comprobación visual, identidad, hash WebP 512×512 y declaración de dominio público en la ficha de Commons.
- El auditor confirma ahora 1.355 assets de retrato legales, que cubren 1.237 personas canónicas.
- El conjunto que necesita el juego sigue siendo de 828 jugadores jugables únicos presentes en rankings activos: 463 tienen retrato legal principal y 365 no lo tienen.
- Cobertura visual legal vigente: **464/828 = 56,04%**. Esta es la única métrica global de retratos que debe usarse para el progreso del juego.
- El lote 201–220 añadió el retrato de Lukáš Pauschek (CC BY 4.0, autor El Loko); los otros candidatos se descartaron por licencia incompatible, licencia no verificable o calidad visual insuficiente.
- La auditoría expone ahora esta métrica con nombre y denominador (`primaryGamePortraitCoverage`): cuenta personas jugables únicas presentes en rankings activos y un único retrato canónico por persona. No cuenta posiciones repetidas, assets alternativos, entidades no jugables ni candidatos pendientes.
- TheSportsDB: se verificaron 223 fichas individuales pendientes; todas enlazan a `CC BY-SA 4.0` y la evidencia quedó backfilleada en PostgreSQL. Siguen `pending` hasta resolver ShareAlike, derechos de imagen y alcance de publicación.
- El lote forzado de prioridad 100–200 produjo un retrato individual claro de Oleksandr Zubkov (CC0); se normalizó a WebP 512×512, se revisó visualmente y se aprobó como principal. La cobertura jugable subió a 464/828 (56,04%).
- La cobertura de datos se informa separadamente como `categoryDataCoverage`: **59/109 = 54,1%** de categorías activas con cobertura validada. No se presenta un porcentaje global único del proyecto mientras no exista una ponderación aprobada entre datos, retratos, escudos, licencias y publicación.
- La auditoría distingue ahora `rankingEntryCoverage`: **109/109 = 100%** de categorías activas tienen el tamaño mínimo exigido (200 entradas o universo cerrado), sin entidades duplicadas. Este indicador no se confunde con `categoryDataCoverage`: no certifica por sí solo que el histórico sea exhaustivo ni que los derechos de la fuente estén aprobados.
- El lote Commons `players-portrait-1789204812274-300-100.json` procesó el tramo restante disponible y produjo candidatos verificables para Igor Paixão, además de candidatos incompatibles CC BY-SA que no se aprobaron.
- Se corrigió `discover-commons-clubs` para resolver perfiles jugables desde sus entidades de origen hacia el ID canónico; antes la consulta devolvía falsamente cero clubes tras las consolidaciones. La primera tanda corregida recorrió 100 clubes y encontró 28 candidatos para 7 entidades, pero ninguno superó la validación automática del manifiesto ni se contó como escudo aprobado.
- La ruta rápida de descubrimiento se ajustó para consultar también el enlace exacto Wikidata P18 cuando el nombre del archivo de Commons no coincide con el jugador. Las dos tandas siguientes recorrieron 80 jugadores prioritarios: detectaron a Ondrej Duda con CC BY-SA 4.0, que permanece sin aprobar por la política vigente; no se añadieron falsos positivos.
- Las tandas Commons posteriores recorrieron 200 jugadores pendientes adicionales mediante la ruta P18/nombre exacto. Solo aparecieron candidatos CC BY-SA para Peter Olayinka y Ola Solbakken, además de Serdar Gürler, Stefan Ristovski y Craig Dawson; ninguno es aprobable bajo la política vigente, por lo que no se añadieron retratos falsos ni licencias incompatibles.
- El lote posterior de 20 jugadores produjo un retrato exacto y claro de Christopher Trimmel, con licencia CC BY 3.0; se normalizó a WebP 512×512, se registró la evidencia y se aprobó sin crear duplicados.
- El lote Commons 181–200 produjo un candidato válido para Amadou Diawara: retrato individual claro de 3103×3020 px, marcado como dominio público en Commons; se normalizó a WebP 512×512, se registró la evidencia y se aprobó sin crear duplicados. El candidato nominal de Alberto Moreno se descartó por ser un homónimo (Luis Alberto Moreno).
- La investigación de asistencias históricas de LaLiga confirma que la fuente oficial publica estadísticas de temporada y que BeSoccer publica 20 filas por temporada y 20 en su histórico; no se importan como top 200 histórico porque no prueban cobertura completa.
- Una pasada adicional de TheSportsDB sobre 100 clubes jugables dejó 0 escudos nuevos en `pending`: la mayoría no resolvió coincidencia exacta y tres coincidencias devolvieron identificadores ya vinculados a otra entidad. No se elevó ningún escudo a cobertura legal.
- Se corrigió otro origen de trabajo duplicado en los descubridores Commons de retratos: sus comprobaciones de assets aprobados y pendientes ahora resuelven también las identidades hacia el ID canónico, igual que la auditoría. Así no se vuelve a buscar un retrato de origen cuando la persona ya está cubierta por su entidad canónica.
- Openverse no se contabilizó: la ejecución devolvió HTTP 401 por falta de credenciales y no modificó la base de datos.
- Se aprobaron después dos retratos adicionales del lote Commons anterior: Daniel Muñoz (dominio público) y David Luiz (CC BY 4.0), ambos con comprobación visual, identidad, hash y atribución registrados. Posteriormente se añadieron Dan Ndoye (CC0), mediante enlace P18 de Wikidata, y Reiss Nelson (CC BY 2.0), ambos con revisión visual.
- La reconstrucción de `world-cup-assists` produjo el snapshot `rs_abf315272b5cbd74d190132b`: contiene 200 IDs únicos y valores ordenados, pero permanece `draft` y `coverageComplete=false` porque la tabla se agrega desde páginas de selecciones y todavía requiere validación metodológica cruzada. Un intento anterior recibió HTTP 502; no se hizo padding.
- Se reforzó `statbunkerWorldCupClient.ts` con fallback acotado entre espejos (`dr`, `m`, `ww` y `www`), timeout, reintentos y uso validado de la tabla raíz cuando expone 200 filas; se añadieron pruebas de 200 filas y de cobertura insuficiente. `npm run build` y `npm test` pasan.
- El bloque Commons 261–360 (`storage/media-candidates/players-portrait-1789213367832-261-100.json`) terminó con 3 entidades procesadas: Dolev Haziza tuvo 3 candidatos; Saint-Cyr Bakayoko y Lee Bonis no tuvieron candidatos. Los 3 retratos de Haziza se inspeccionaron visualmente y se descartaron por licencias CC BY-SA 4.0, CC BY-SA 3.0 y CC BY-SA 4.0, respectivamente; no hubo stage, aprobación ni duplicados.
- La auditoría posterior al bloque 261–360 confirma: 1.355 assets de retrato legales, 464/828 jugadores jugables cubiertos (56,04%), 364 pendientes y 0 escudos legales de clubes. Los tres assets anteriores corresponden a jugadores ranqueados no jugables; el cuarto, Oleksandr Zubkov, sí pertenece al conjunto jugable.
- Se habilitó `--retry-recent` para que el descubridor pueda volver a consultar jugadores que siguen sin retrato aunque ya tengan un intento reciente. Los lotes forzados 0–100, 100–200, 200–300 y 300–342 recorrieron los pendientes jugables: solo apareció Oleksandr Zubkov como candidato compatible; el resto no produjo candidatos válidos o quedó bloqueado por licencia/calidad.
- La limpieza de catálogo rechazó 169 pendientes redundantes o no requeridos (167 con retrato principal legal ya existente y 2 de entidades fuera del pool jugable), conservándolos como historial de auditoría.
- Se regeneraron los cuatro rankings globales de carrera desde las estadísticas ya almacenadas, ampliando la ventana a 2000–2026 y cubriendo 11 competiciones de clubes: goles `rs_20d78218c77cce41c37fa3cd`, asistencias `rs_8cfb919960b47fe6f20f7b58`, amarillas `rs_c16923ead785819d6d741b6e` y rojas `rs_87f10d8a51031e241e76b913`. Cada snapshot contiene 200 jugadores reales; sigue marcado provisional porque el histórico anterior a 2000 y los derechos de redistribución no están cerrados.
- La pasada profunda no rápida de Commons recorrió 342 posiciones pendientes en varios lotes; solo devolvió candidatos que fallaron por resolución o licencia, por lo que no añadió cobertura legal. La tanda posterior de TheSportsDB procesó 100 jugadores y stageó 12 candidatos nuevos con imagen normalizada; la auditoría posterior verificó identidad y deporte en los 223/223 retratos TheSportsDB pendientes. Todos permanecen `pending` hasta resolver la licencia de publicación. PostgreSQL registra 223 retratos TheSportsDB pendientes, todos con una licencia concreta `CC BY-SA 4.0` verificada en su ficha individual.
- De esos pendientes, 214 corresponden actualmente a jugadores jugables únicos que aparecen en rankings activos; siguen siendo potenciales, no cobertura aprobada.
- Se comprobó el ranking de Balón de Oro contra el palmarés oficial de France Football: Ousmane Dembélé (2025) ya figura con valor 1 en el snapshot `rs_206273c3f213e5289a748e49`, que conserva `coverageComplete=true`; la importación idempotente no creó una entidad duplicada ni alteró el snapshot.
- Se reintentaron cuatro tramos adicionales de clubes en Commons para escudos (50–100, 100–150, 150–200 y 200–233). Los resultados fueron falsos positivos semánticos (monumentos, puertos, banderas o fotografías de partidos), por lo que no se registraron nuevos assets ni se alteró la cobertura legal de escudos.
- Se endureció el filtro de escudos de Commons: las búsquedas textuales ahora exigen una señal positiva (`crest`, `logo`, `badge`, `emblem` o equivalente), mientras que los enlaces exactos Wikidata P154 mantienen su tratamiento específico. Se añadió una prueba contra el falso positivo de una escultura “celtic hero”.
- La tanda paralela de Commons `players-portrait-1789220388932-0-50.json` procesó 50 jugadores jugables faltantes. Encontró 2 candidatos brutos y 0 candidatos válidos: ambos eran CC BY-SA y uno tampoco alcanzaba la calidad mínima. Se registraron los 50 intentos y no se descargó ni aprobó ningún asset.
- El bloque Commons `players-portrait-1789220599993-50-50.json` procesó otros 50 jugadores jugables faltantes. Solo apareció un candidato para José Santiago Cañizares Ruiz; era GFDL y medía 365×533 px, por lo que no cumplió la política de licencia/calidad. Resultado: 0 assets nuevos y 50 intentos registrados.
- Se aprobaron 27 retratos de TheSportsDB que cumplían simultáneamente los filtros estrictos: `providerCreativeCommons=Yes` en la ficha del proveedor, licencia y URL exactas `CC BY-SA 4.0`, identidad/deporte auditados, archivo local WebP 512×512 y hash coincidente. Cada aprobación registra atribución, aceptación explícita de ShareAlike, alcance `web,pwa,android,cdn,local_storage` y la URL de la ficha individual como evidencia. Los otros 196 retratos TheSportsDB pendientes no se contabilizan.
- La ruta de aprobación de TheSportsDB quedó protegida por tests: un asset solo puede usar la excepción de licencia abierta si la bandera de licencia está presente en ese asset, la URL es exactamente la de CC BY-SA 4.0 y se pasa `--allow-share-alike`; sin esos tres controles sigue siendo rechazado mientras la fuente global permanezca `review_required`.
- Se comprobó API-Football para las temporadas 1999 y 2000 de Premier League con importación completa y sin medios: ambas respuestas fueron explícitamente vacías y quedaron archivadas como limitación del proveedor; no se fabricaron estadísticas ni rankings. La cuota diaria observada quedó en 7.463/7.500, por lo que se detuvieron nuevas consultas hasta el siguiente reinicio.
- Incidente de control corregido: una regeneración posterior de rankings parciales de API-Football llegó a sustituir temporalmente snapshots completos por borradores `coverage_complete=false`, lo que hacía caer artificialmente la métrica de categorías. Esos borradores se conservan como evidencia técnica, pero se restauraron como activos los 109 snapshots que tenía la auditoría de referencia; una fuente parcial nunca sustituye a una cobertura validada. El importador y las consultas de selección quedan protegidos para conservar/priorizar la versión completa cuando llegue una actualización parcial.

## Checkpoint tras el lote TheSportsDB — 2026-09-12

- Tras aprobar los 27 retratos TheSportsDB con licencia CC BY-SA 4.0 explícita por asset, el auditor queda en **491/828 jugadores jugables únicos con retrato legal principal (59,30%)** y **337 sin retrato**.
- El resto de las métricas no cambia: **59/109 categorías con datos validados (54,1%)**, **109/109 con el tamaño mínimo (100%)**, **0/200 escudos de clubes con expediente de publicación completo** y **20 banderas nacionales aprobadas**.
- La auditoría técnica confirma `identityLinkChains=0`; los 27 activos aprobados tienen archivo WebP 512×512 y hash coincidente. Los candidatos pendientes no se cuentan.

## Estado verificable más reciente — 2026-09-12

- La revisión visual posterior aprobó 9 retratos Commons CC BY-SA con autor y página de archivo comprobados (Alan Patrick, Alex Telles, Alfons Sampsted, Antonio Cassano, İlkay Gündoğan, Steve Mandanda, Michael Murillo, Michail Antonio y Nicolas Penneteau) y rechazó 9 falsos positivos o encuadres no utilizables. La cobertura resultante es **500/828 = 60,39%**; quedan **328 jugadores** sin retrato legal principal.
- Se agotó un nuevo barrido Commons sobre los 328 faltantes: los lotes `players-portrait-1789221443849-0-100.json`, `players-portrait-1789221519538-100-200.json` y `players-portrait-1789221643461-300-28.json` terminaron completos. El primer lote devolvió solo un candidato sin licencia y con resolución insuficiente (Giuliano Sarti); los otros 228 jugadores no devolvieron candidatos. No se aprobó ninguna imagen dudosa ni se modificó la cobertura.
- La comprobación de cuota más reciente de API-Football confirma `7465/7500` solicitudes diarias, suscripción Pro activa hasta el 2026-10-10 y sin reinicio de cuota; no se ejecutan importaciones adicionales mientras queden solo 35 solicitudes.
- De los cuatro pendientes Commons que quedaban, se aprobó únicamente Etzaz Hussain (CC BY-SA 4.0, autor y ficha comprobados) y se rechazaron Bodo Illgner, Ederson y Marco Asensio por falso positivo o encuadre insuficiente. El nuevo asset eleva el inventario legal a 1.392, pero no cambia el conjunto jugable cubierto: Etzaz no altera el denominador/cobertura primaria de 500/828.

## Estado verificable posterior — 2026-09-12

- Se consultaron las fichas individuales de los 196 retratos TheSportsDB que seguían pendientes: **196/196** devolvieron licencia explícita `CC BY-SA 4.0`, URL canónica de Creative Commons, identidad coincidente, deporte Soccer y archivo local. No se consultó API-Football.
- Se revisaron visualmente los 196 candidatos en cuatro contactos; se descartaron los criterios de falso positivo, imagen de espaldas y encuadre no identificable. Se aprobaron **158** retratos nuevos con `open_license`, aceptación explícita de ShareAlike, atribución, alcance `web,pwa,android,cdn,local_storage`, WebP 512×512 y hash verificado. Los otros 38 ya habían sido aprobados en el lote interrumpido y se reparó su URL de evidencia en la migración `backend/migrations/061_repair_thesportsdb_rights_evidence_urls.sql`.
- Se corrigió el aprobador para reconocer la licencia abierta respaldada por la ficha individual guardada en `metadata.licenseEvidenceUrl`; el campo API `strCreativeCommons` por sí solo no se trata como licencia.
- La auditoría posterior registra **1.588 assets de retrato legales**, **1.462 personas canónicas con retrato** y **680/828 jugadores jugables únicos con retrato legal principal (82,13%)**. Quedan **148** sin retrato. Los jugadores repetidos en rankings siguen compartiendo un único retrato canónico.
- La cobertura de datos no ha cambiado: **59/109 categorías completas (54,1%)**, **109/109 con 200 posiciones o universo cerrado (100%)**, y **0 escudos de clubes legalmente publicables**. No se mezclan estas métricas en un porcentaje global ficticio.
- La suite `npm test`, `npm run build` y `git diff --check` pasan después de los cambios. El refresco oficial del Balón de Oro sigue confirmando 2025 y 2024 en el snapshot completo de France Football.

## Estado verificable más reciente de la sesión — 2026-09-12

- Una pasada adicional de TheSportsDB sobre los jugadores que permanecían sin retrato encontró a **Danny**. La ficha individual devolvió `CC BY-SA 4.0`; el retrato se revisó visualmente, se verificó como WebP 512×512 y se aprobó con evidencia `https://www.thesportsdb.com/player/34146804`.
- Se detectó y corrigió una separación de identidad de **Luuk de Jong**: el retrato Commons aprobado estaba asociado a una entidad UEFA excluida, mientras la entidad jugable activa de Premier League carecía de retrato. La consolidación revisada UEFA → entidad activa movió 4 assets, 3 identificadores externos, 9 posiciones y 9 hechos, sin duplicar el retrato y dejando `identityLinkChains=0`.
- La auditoría posterior registra **1.589 assets de retrato legales**, **1.463 personas canónicas con retrato** y **682/828 jugadores jugables únicos con retrato legal principal (82,37%)**. Quedan **146** sin retrato.
- La segunda pasada de TheSportsDB no encontró nuevas fichas válidas para el resto del lote; las colisiones de identificador (por ejemplo, Zeki Amdouni/Mohamed Amdouni) se conservaron sin fusionar por falta de evidencia suficiente.
- El estado estadístico permanece **59/109 categorías completas (54,1%)**, con **109/109** snapshots del tamaño requerido y **0 escudos de clubes publicables**. `npm test`, `npm run build`, `audit:data-readiness`, `audit:media-rights` y `git diff --check` pasan.

## Estado verificable posterior al lote paginado — 2026-09-12

- El descubridor TheSportsDB se hizo paginable con `--offset` para no repetir los primeros 100 jugadores cuando se usa `--retry-recent`. El tramo restante encontró cinco fichas: Jens Hauge, Mohamed Elyounoussi, Jorge Campos, Declan McManus y Fabio Fehr.
- Las cinco fichas devolvieron licencia individual `CC BY-SA 4.0`; los cinco retratos se revisaron visualmente, se verificaron como WebP 512×512 con hash coincidente y se aprobaron con evidencia de jugador. Tres pertenecen al conjunto jugable ranqueado y elevan la cobertura primaria; los otros dos son assets legales de personas catalogadas fuera de ese conjunto.
- Se corrigió y ejecutó el mapeo de Luuk de Jong hacia su entidad jugable activa. No se forzaron las colisiones restantes de identificadores externos.
- La auditoría queda en **1.594 assets de retrato legales**, **1.468 personas canónicas con retrato** y **685/828 jugadores jugables únicos con retrato legal principal (82,73%)**; quedan **143**.
- TheSportsDB registra **229/462 retratos aprobados y publicables**, 0 pendientes y 233 rechazados. Los 140 escudos de TheSportsDB siguen pendientes porque el proveedor no concede por sí solo licencia comercial de escudos oficiales.
- La cobertura de datos estadísticos permanece **59/109 (54,1%)** y la de escudos de clubes **0**. Las pruebas y auditorías de backend siguen pasando.

## Comprobación de fuente histórica adicional — 2026-09-12

- Se intentó reemplazar el agregado reciente de `la-liga-assists` por el importador histórico de StatBunker (`AllTimePlayerStandings?comp_code=LL`). El endpoint no respondió desde el entorno tras 20 segundos por host; el fallback agotó sus hosts sin devolver una tabla válida.
- PostgreSQL no recibió ningún snapshot nuevo: el snapshot operativo de API-Football se conserva y no se marcó como histórico. No se alteraron valores, identidades ni cobertura para evitar presentar como histórico un dato que no se pudo descargar y validar.

## Corrección crítica del ranking global de títulos de clubes — 2026-09-12

- La revisión SQL detectó que el builder de `club-global-titles` estaba leyendo también los hechos derivados de su propio snapshot anterior (`categorySlug=club-global-titles`), lo que inflaba los totales: Real Madrid aparecía con 364 títulos.
- Se excluyeron esos hechos agregados del conjunto de entrada y se regeneró el snapshot `rs_167b87c6bc032eadafcfe95e`.
- La verificación posterior devuelve 200 clubes únicos; Real Madrid pasa a 91, FC Porto a 84 y FC Barcelona a 83. La evidencia de cada fila ya no incluye `club-global-titles` como competición, y el snapshot anterior queda `superseded`.
- El ranking sigue siendo `draft` y `coverageComplete=false`: los valores ahora son coherentes con las competiciones importadas, pero todavía no representan el palmarés mundial completo.

## Expediente actual de licencia de retratos — 2026-09-12

- Se añadió `backend/src/cli-player-license-requests.ts` y el comando `npm run media:player-license-requests`.
- El comando consulta PostgreSQL sin modificarlo y genera una única fila por jugador canónico que aparece en algún ranking activo dentro del top 200, está en el pool jugable y no tiene retrato principal legal.
- La ejecución verificable produjo **143 jugadores**, con su ID canónico, mejor posición, número de rankings y lista de categorías: no incluye posiciones repetidas, entidades históricas fuera del juego, candidatos pendientes ni assets rechazados.
- Los archivos generados para solicitar una licencia real a un proveedor son `backend/storage/media-candidates/player-portrait-license-requests-v1.json`, `.csv` y `.md`. El contrato solicitado incluye juego comercial, web/PWA/Android, almacenamiento/CDN, recorte a WebP 512×512 y retención en snapshots históricos.

## Comprobación de cobertura visual estable — 2026-09-12

- Se reintentó el descubrimiento de Wikimedia Commons para el lote pendiente de jugadores jugables (`players-portrait-1789226668252-0-143.json`). El proceso terminó sin errores con 141 entradas procesadas; solo devolvió cinco candidatos nominales para Luca Bucci y todos corresponden a homónimos/fotografías no futbolísticas, por lo que no se descargó ni aprobó ningún retrato.
- Esta pasada no reduce el denominador ni crea duplicados: la métrica estable sigue siendo **685/828 = 82,73%**, donde 828 son personas jugables únicas presentes en rankings activos y 685 tienen un único retrato principal publicable.
- La cifra histórica `32,8%` (`1.401/4.265`) y otras cifras superiores o inferiores no son comparables: medían posiciones o entidades no jugables, no personas jugables únicas. No se usa ninguna de ellas para el progreso actual.
- Se completó también el barrido Commons del pool de clubes/selecciones jugables: 248 entidades en tres lotes (`clubs-badge-1789226758733-0-100.json`, `clubs-badge-1789226811037-100-100.json` y `clubs-badge-1789226839793-200-100.json`). Solo apareció un escudo histórico en SVG para Steaua București (1974–1991), de 338×404 px; no se stageó porque no cumple el formato/calidad visual objetivo. Resultado: 0 escudos nuevos y **0/233 escudos de clubes publicables**.
- La pasada final del expediente de 143 jugadores (`player-portrait-commons-143-20260912.json`) procesó 143/143 sin errores: 140 no tienen candidato fiable y 5 candidatos nominales se concentraron en 3 jugadores. Dos se descargaron como `pending` —Markus Andre Kaasa, imagen de espalda, y Mauro Júnior, retrato frontal—; ninguno se aprueba automáticamente ni cambia la cobertura hasta revisión visual y legal.
- Se corrigió `stage-thesportsdb-playable-portraits`: su consulta ahora exige una entrada en un snapshot activo y `rank <= 200`, evitando consumir peticiones con perfiles jugables que no aparecen en ningún ranking. La comprobación SQL devuelve exactamente **143** objetivos pendientes.
- Se aplicó la misma protección al enriquecedor `stage-api-football-from-thesportsdb`: ahora solo resuelve IDs y descarga candidatos para personas jugables que aparecen en un ranking activo dentro del top 200. `npm run build`, `npm test` y `git diff --check` pasan tras ambas correcciones.

## Avance de datos y prueba Openverse — 2026-09-12

- Se refrescó el palmarés masculino de France Football con `npm run import:ballon-dor`. La importación fue idempotente: mantuvo el snapshot oficial `rs_206273c3f213e5289a748e49`, con 47 jugadores ganadores y las ediciones 2024 y 2025 verificadas; no creó entidades duplicadas.
- Se importó la tabla histórica de porterías a cero de RSSSF (`src_ef465d828c16810618115cb1`): 20 hechos reales, sin padding. Después se regeneraron `goalkeeper-historical-index` (`rs_744cfa6f6bd69f9eda4b51fe`) y `goalkeeper-career-clean-sheets` (`rs_88a0b056aaef1f9bdac5c066`), ambos con 200 entradas reales y marcados provisionalmente porque todavía no representan una carrera mundial exhaustiva.
- Se probó Openverse sobre los 100 primeros de los 143 jugadores jugables sin retrato. El servicio respondió inicialmente 401/502 y posteriormente 429 por límite anónimo; resultado final: 0 candidatos válidos, 0 descargas y 0 aprobaciones. No se contabiliza ninguna imagen ni se vuelve a consumir la cuota sin credenciales adecuadas.
- La auditoría posterior a la aprobación de Mauro Júnior queda en **686/828 = 82,85%** de cobertura de retrato legal principal; **59/109 = 54,1%** de categorías con cobertura validada; **109/109 = 100%** con el tamaño mínimo; **0/233** escudos de clubes publicables. Los hechos RSSSF/IFFHS y los snapshots regenerados son avance de datos, pero no alteran artificialmente esos porcentajes.
- El refresco IFFHS inicialmente detectó una colisión de identidad: un ID ya consolidado hacia RSSSF no se reutilizaba. Se corrigió el importador para priorizar el enlace externo existente, se reimportaron **50 registros IFFHS** (`src_d417d05587f936090a175f6c`) y se regeneró el índice (`rs_df407dfc25c44612134e5c5f`) con 226 candidatos y 200 puestos; `npm test`, `npm run build`, `git diff --check` e `identityLinkChains=0` pasan.
- La prueba Openverse del lote de 100 jugadores no obtuvo candidatos: tras respuestas 401/502, el servicio aplicó 429 al tráfico anónimo. Se registraron los intentos, pero no se descargó ni aprobó ninguna imagen y no se continuará golpeando el endpoint sin credenciales autorizadas.
- Se refrescaron los goles oficiales de selecciones desde RSSSF y se mantuvo el snapshot `rs_da1cfd5589db34d67042ff83` sin duplicar entidades. La misma fuente solo expone 174 filas parseables para goleadores históricos de la Copa del Mundo; el importador rechazó el top 200 y conservó el snapshot anterior sin rellenar 26 puestos.
- `world-cup-red_cards` también quedó sin cambio: StatBunker devuelve 183 jugadores únicos con expulsiones en fases finales, no 200. El validador rechazó el import y no se mezclaron fuentes ni se añadieron ceros.
- Se revisaron visualmente los dos candidatos Commons pendientes: se aprobó `img_013dde9df081ac6b1fa72569` para **Mauro Júnior** (retrato frontal identificable, CC BY-SA 4.0, autor Hans Reefman, WebP 512×512, atribución y aceptación explícita de ShareAlike) y se rechazó `img_9abcb55c9f2e33f9e3271b8f` para Markus André Kaasa por ser una imagen de espaldas. La cobertura visual actual sube a **686/828 = 82,85%**, con 142 jugadores sin retrato; no se creó ningún duplicado.
- Se refrescaron los importadores de palmarés de clubes: **21 de 22** pasaron sus validaciones oficiales y se regeneró `club-global-titles` como `rs_ff797efce6629e43a1249621`. El snapshot contiene 200 clubes únicos, sin puestos >200, duplicados ni auto-referencias; sus valores ya incorporan las competiciones activas disponibles. La Recopa Sudamericana no se ejecutó porque su categoría está retirada del catálogo jugable, de acuerdo con la simplificación acordada; no se reactivó ni se incorporó artificialmente.

## Verificación de Conference League frente al historial UEFA — 2026-09-12

- La página oficial de historial de UEFA enumera exactamente las ediciones **2021/22, 2022/23, 2023/24, 2024/25 y 2025/26**: [historial de temporadas de UEFA](https://www.uefa.com/uefaconferenceleague/history/seasons/2026/). La ficha de 2021/22 identifica la edición como la inaugural ([UEFA 2021/22](https://www.uefa.com/uefaconferenceleague/history/seasons/2022/)); la ficha de 2025/26 registra la final del **27 de mayo de 2026** ([UEFA 2025/26](https://www.uefa.com/uefaconferenceleague/history/seasons/2026/)). Por tanto, a fecha de esta comprobación las cinco ediciones del proveedor están finalizadas y no hay una edición anterior que deba entrar en el universo de esta competición.
- Se verificó que los IDs usados por el proveedor corresponden a esas ediciones: `706=2021/22`, `738=2022/23`, `359=2023/24`, `771=2024/25` y `786=2025/26`. La consulta actual a StatBunker respondió HTTP 200, pero sus tablas de jugadores devolvieron estas filas positivas parseables por edición:

  | edición | ID StatBunker | goles | asistencias en páginas de club | amarillas |
  | --- | ---: | ---: | ---: | ---: |
  | 2021/22 | 706 | 116 | 96 | 207 |
  | 2022/23 | 738 | 193 | 158 | 373 |
  | 2023/24 | 359 | 7 | 5 | 17 |
  | 2024/25 | 771 | 0 (`No scorers found`) | 0 (`No assists found`) | 0 (`No data found`) |
  | 2025/26 | 786 | 0 (`No scorers found`) | 0 (`No assists found`) | 0 (`No data found`) |

- El proveedor puede devolver 200 filas agregadas para las tres métricas, pero eso no demuestra cobertura: las filas proceden de las tres primeras ediciones y las dos ediciones finales no aportan datos de jugadores. En asistencias, incluso recorriendo las páginas de club que usa el importador, `771` y `786` devuelven cero filas; en goles y amarillas el importador usa las tablas raíz, que también devuelven cero para ambas ediciones.
- **Decisión:** no se cambió ningún provider, test ni flag `coverageComplete`, y no se ejecutaron los tres importadores. La BD permanece intacta. Los snapshots operativos siguen siendo `uefa-conference-league-goals → rs_5407a6e0daab72051c854a9b`, `uefa-conference-league-assists → rs_ebc45664847d98c8d54c3b97` y `uefa-conference-league-yellow_cards → rs_0833536f4d1f8921e2073944`; los tres están en `draft`, con 200 entradas y `coverage_complete=false`.
- La evidencia que falta para poder marcar cobertura completa del top 200 positivo es: **(1)** una tabla completa de jugadores de StatBunker para 2024/25 y 2025/26, o una fuente alternativa fiable que la sustituya; **(2)** confirmar que la misma definición de competición y de métrica se aplica a las cinco ediciones, especialmente el alcance de fase principal frente a clasificación; y **(3)** una comprobación de que el conjunto agregado conserva todos los jugadores positivos antes de truncar al top 200. Hasta disponer de ello, no se permite importar ni certificar estas categorías como completas.

## Expediente visual actualizado — 2026-09-12

- Tras aprobar Mauro Júnior, `npm run media:player-license-requests` regeneró el expediente exacto de faltantes: **142 jugadores canónicos únicos**. Se actualizaron los ficheros JSON, CSV y Markdown; no contiene posiciones repetidas ni copias por ranking.

## Expediente comercial de escudos — 2026-09-12

- Se generó `npm run media:license-requests` para el catálogo actual, con **233 clubes jugables únicos**: `backend/storage/media-candidates/club-badge-license-requests-v1.json`, `.csv` y `.md`.
- El expediente identifica **167 clubes con algún asset registrado** (45 TheSportsDB, 99 API-Football, 19 UEFA y 4 Commons) y **66 sin asset registrado**. En los 233 casos `permissionRequired=true`: una URL o licencia declarada del archivo no despeja por sí sola la autorización marcaria del escudo.
- La selección es una fila por entidad de club y conserva los assets alternativos para solicitar a un proveedor/titular una licencia comercial mundial que cubra juego, web/PWA, Android, CDN, normalización 512×512 y reproducción del escudo. No modifica PostgreSQL ni aprueba ningún asset.

## Refresco oficial y cierre de búsqueda TheSportsDB — 2026-09-12

- Se ejecutó `npm run refresh:premier-league` contra las tablas históricas oficiales y se archivaron cinco snapshots nuevos, uno por métrica: goles (`rs_dc572a8c2749581916974009`), asistencias (`rs_eb51e67c61fc53ab761332b0`), porterías a cero (`rs_a253db32c163141197b03029`), amarillas (`rs_36e16b189de380255d352dec`) y rojas (`rs_5a3ec35d9199da5d803e7cff`). No se publicó ningún snapshot automáticamente.
- Se procesaron los **142 jugadores** sin retrato legal mediante la búsqueda paginada de TheSportsDB, sin usar API-Football. Resultado: **0 candidatos nuevos**, 140 jugadores sin ficha/imagen válida y dos incidencias de identidad o historial ya conocidas (Zeki Amdouni y Amir Rrahmani). No se aprobaron imágenes ni se contó material sin licencia.
- La auditoría posterior mantiene las métricas honestas: **686/828 = 82,85%** de retratos legales primarios, **59/109 = 54,1%** de categorías con cobertura validada, **109/109 = 100%** con tamaño mínimo y **0/233** escudos de clubes publicables.

## Estado tras la siguiente comprobación — 2026-09-12

- La auditoría volvió a ejecutarse después de la recuperación de Hatzidiakos: **687/828 = 82,97%** de retratos legales primarios, **141** jugadores pendientes, **59/109 = 54,1%** de categorías con cobertura validada y **0/233** escudos de clubes publicables.
- `npm test -- --runInBand` pasó las 17 suites del backend. La comprobación de LaLiga histórica de asistencias no generó snapshot: StatBunker devolvió `No data found`/`No assists found` y el importador rechazó correctamente las 0 filas positivas.

## Aprobación de lote visual Commons — 2026-09-12

- Se revisaron visualmente y se aprobaron tres retratos obtenidos mediante identidad Wikidata → P18 → ficha de Wikimedia Commons: **Pote**, **Karim Adeyemi** y **Ousmane Dembélé**.
- Los tres tienen licencia explícita **CC BY-SA 4.0**, atribución del autor, evidencia de origen y aceptación de ShareAlike; se normalizaron a WebP 512×512 y se marcaron como retrato principal.
- La auditoría posterior queda en **690/828 = 83,33%** de retratos legales primarios, con **138** jugadores jugables únicos pendientes. Los expedientes JSON/CSV/Markdown de licencias se regeneraron con ese número.

## Sustitución de asistencias históricas de LaLiga — 2026-09-12

- StatBunker no proporcionó ninguna fila histórica válida para asistencias de LaLiga. Se incorporó un importador reproducible para la **Ewige Vorlagengeberliste** de Transfermarkt, con paginación, validación de orden, 200 jugadores únicos positivos y evidencia por jugador.
- El snapshot creado es `rs_ca6620d62c0d2b4125e69a9f`, con 200 entradas reales y estado `draft`; se mantiene `coverageComplete=false` porque la definición histórica de asistencia y los derechos de redistribución de Transfermarkt aún requieren revisión.
- Se añadió la consolidación específica `entity:consolidate:transfermarkt:la-liga-assists`. Enlazó 126 de las 200 entidades nuevas con el catálogo canónico; las restantes no se forzaron por falta de coincidencia inequívoca. La auditoría posterior recupera **828 jugadores jugables**, sin reducción del denominador.
- La categoría queda con **31 entradas jugables**, 30 con retrato y una pendiente, sin duplicados de identidad. `npm run build` y las suites de backend continúan pasando.

## Integración y revisión del lote visual siguiente — 2026-09-12

- La consolidación de Transfermarkt corrigió la integración de LaLiga: el catálogo vuelve a tener **828 jugadores jugables**, y la categoría `la-liga-assists` conserva 200 entradas, 31 jugables y 31 con retrato.
- Se revisaron los dos candidatos visuales del lote siguiente. Se aprobó **Dani Parejo** con CC BY-SA 4.0 y se rechazó **Luciano Castellini** por la reserva territorial asociada a PD-Italy; no se cuentan licencias ambiguas.
- La auditoría final de este ciclo queda en **691/828 = 83,45%** de retratos legales primarios, con **137** jugadores pendientes. Las categorías con cobertura validada permanecen en **59/109 = 54,1%** y los escudos de clubes en **0/233**.
- `npm test -- --runInBand` y `git diff --check` pasan después de la integración.

## Recuperación visual Wikidata → Wikimedia Commons — 2026-09-12

- Se probó una ruta de identidad distinta para los jugadores sin retrato: Wikidata identifica la persona mediante `P18` y después se comprueba directamente la ficha del archivo en Commons, su licencia y el encuadre.
- El archivo de **Pantelis Hatzidiakos** fue inspeccionado visualmente, normalizado a WebP 512×512 y registrado con licencia explícita **CC BY 4.0**, autor Thomas Dahlstrøm Nielsen y evidencia de Commons. Se aprobó como retrato principal legal (`img_86c24a2f304b8cb06100a3af`).
- El archivo encontrado para **Jean-Luc Ettori** no se incorporó: aunque la página está alojada en Commons, su ficha real declara dominio público italiano con posibles restricciones en EE. UU.; no se considera una base jurídica suficientemente segura para el lanzamiento comercial mundial.
- La auditoría posterior queda en **687/828 = 82,97%**, con **141** jugadores jugables únicos sin retrato legal principal. No se modificó el denominador ni se duplicó ninguna persona.

## Estado canónico posterior a la sustitución de asistencias — 2026-09-12

## Cierre verificable de `la-liga-assists` — 2026-09-12

- Fuente histórica utilizada: [Ewige Vorlagengeberliste de Transfermarkt](https://www.transfermarkt.com/laliga/assistliste/wettbewerb/ES1/saison_id/0/plus/), con `saison_id/0`. La página acredita el selector histórico y ofrece temporadas desde 1928/29; el alcance de LaLiga se fija en **1928/29**, la primera campaña documentada por [LaLiga](https://www.laliga.com/en-ES/news/statistics-fc-barcelona-rcd-espanyol).
- Se recorrieron las páginas **1–8** mediante `?page=N`: **8 × 25 = 200 filas válidas**. Cada página quedó registrada con URL, SHA-256, número de filas y rango visible: 1–25, 26–50, 51–75, 76–100, 101–125, 126–150, 151–175 y 176–200.
- Validaciones superadas: 200 jugadores reales, 200 IDs de Transfermarkt únicos, 200 perfiles únicos, rangos contiguos 1–200, sin duplicados, valores positivos y orden descendente por asistencias. El primer registro es **Lionel Messi (216)** y el puesto 200 es **Joan Verdú (24)** en la captura importada.
- Snapshot de fuente normalizado: `src_8e24a5612e21a6ae0476cce3`. Snapshot de ranking PostgreSQL: `rs_162e1842e4cc617d1e3b5879`.
- Estado final: **200 entradas, 200 entidades, `coverageComplete=true`, `status=draft`, `rightsStatus=review_required`**. No se publica hasta resolver los derechos de redistribución de Transfermarkt; esa revisión es independiente de la cobertura estadística.

- Se incorporaron dos fuentes históricas homogéneas adicionales de asistencias: `bundesliga-assists` y `serie-a-assists`, ambas con **200/200 filas reales**, sin padding, en estado `draft` y `coverageComplete=false` hasta resolver la definición histórica de asistencia y los derechos de redistribución.
- La consolidación enlazó **142/200** entidades de Bundesliga y **151/200** de Serie A; los casos restantes no se forzaron. No hubo conflictos.
- La cifra canónica vigente es **826 jugadores jugables únicos**, de los que **690 tienen retrato legal principal: 690/826 = 83,54%**; quedan **136** expedientes de retrato. El asset legal total de retratos es **1.601** y sigue existiendo un único retrato por persona canónica, aunque pueda aparecer en varios rankings.
- La variación desde el checkpoint anterior (**828 → 826**) no es una pérdida de jugadores ni de imágenes: los nuevos snapshots sustituyeron tablas de asistencias anteriores y cambiaron el conjunto histórico de jugadores jugables. Bundesliga pasó de 56 a 13 jugables en esa categoría y Serie A de 58 a 24; la intersección con otras categorías deja el conjunto global en 826. La auditoría no mezcla posiciones duplicadas.
- El resto del estado verificable permanece: **59/109 categorías completas (54,1%)**, **109/109 con tamaño mínimo (100%)**, **0/233 escudos de clubes legalmente publicables** y **20 banderas nacionales aprobadas**. No existe un porcentaje global único válido.
- Se regeneraron los expedientes de licencias de jugador; contienen **136** personas únicas pendientes. Se aprobó el retrato de **Santiago Cañizares** (CC BY-SA 4.0, Francesc Fort, Commons) con WebP 512×512, atribución, evidencia y aceptación explícita de ShareAlike.
- `npm run build`, `npm test -- --runInBand` y la auditoría de preparación pasan. Los nuevos datos siguen sin publicarse automáticamente.

## Lote de retratos Wikidata/P18 21–40 — 2026-09-12

- Se añadió la ruta estricta `--wikidata-only` al descubridor Commons. En esta modalidad solo se conserva un archivo alcanzado desde la entidad exacta de Wikidata mediante su claim `P18`; no se aceptan coincidencias textuales de Commons ni de Wikipedia.
- El manifiesto `backend/storage/media-candidates/players-portrait-1789235406548-20-20.json` contiene **20 jugadores únicos**, está completo y no tiene errores transitorios pendientes. Se procesaron: Tomislav Ivković, Giuliano Sarti, Paulo Santos, Ivano Bordon, Juan Carlos Ablanedo Iglesias, José Francisco Molina Jiménez, César Sánchez Domínguez, Andoni Cedrún, Guillaume Warmuz, Gaëtan Huard, Rüdiger Vollborn, Armend Thaçi, David Soria, Juan Carlos Unzué, Alberto López, Andrés Palop, David Marraud, Peter Olayinka, Abel Resino y Antonio Prats.
- Solo **Alberto López Fernández** superó identidad, licencia, resolución y revisión visual: Wikidata `Q1381315` → [File:Alberto Lopez.jpg](https://commons.wikimedia.org/wiki/File:Alberto_Lopez.jpg), CC BY-SA 3.0, autora Rebeca F.P. Se registró sin aprobación como `img_17fb69c7fbb87bc736396f90`, en [WebP 512×512](/home/ubuntu/rango90/backend/storage/media/bdfutbol_la-liga_player_03724f3a9f33d7da13bc1b4f-39fb7b1f838a95e85ac87334.webp); el metadata conserva `wikidataEntityId=Q1381315` y la evidencia P18.
- Ivano Bordon (`Q183564`, [archivo Commons](https://commons.wikimedia.org/wiki/File:Inter_Milan_1973-1974_Ivano_Bordon.jpg)) fue descargado y normalizado solo para revisión, pero se rechazó por PD-Italy/URAA. Su asset `img_36fa136c73d9b16b72549d7d` permanece `rejected` y no cuenta.
- Descartes: Giuliano Sarti (257×429), Paulo Santos (143×182), Andoni Cedrún (158×342), Warmuz (313×304), David Soria (542×473), Palop (531×510) y Peter Olayinka (290×465) por no alcanzar 512 px en ambos lados; Molina por perfil lateral; César Sánchez y Abel Resino por GFDL no aceptada por la política de este lote; Unzué (640×360) por formato/resolución no aptos. Sin candidato P18 utilizable: Tomislav Ivković, Ablanedo, Huard, Vollborn, Armend Thaçi, Marraud y Antonio Prats.
- La auditoría oficial posterior registra **825 jugadores jugables únicos ranqueados**, **689 con retrato legal principal** y **136 sin él (83,52%)**. El asset pendiente de Alberto no aumenta esa cifra. Categorías: **59/109 con cobertura validada (54,1%)** y **101/109 con tamaño mínimo (92,7%)**; no se calcula porcentaje global.
- `npm run build`, la validación de candidatos Commons y `git diff --check` pasan. No se tocaron API keys, categorías ni snapshots.

## Eliminación de padding estadístico — 2026-09-12

- La auditoría de valores detectó ocho snapshots abiertos con filas `raw_value = 0` que procedían de cohortes técnicas y no de posiciones positivas del ranking. No se aceptan como jugadores clasificados.
- Se creó y ejecutó `npm run cleanup:ranking-padding -- --apply`. La operación no borra snapshots: genera una versión nueva y deja la anterior como histórico `superseded`.
- Se retiraron **826 filas no positivas**: Club World Cup asistencias `100/200`, goles `139/200`, rojas `19/200`, amarillas `197/200`; Copa América asistencias `105/200`, rojas `41/200`; Nations League rojas `57/200`; World Cup rojas `51/200`. Las nuevas versiones mantienen `coverageComplete=false` y explican por qué no alcanzan 200 positivos.
- La auditoría posterior queda en **689/825 jugadores jugables únicos con retrato legal principal = 83,52%**, con **136** pendientes. El cambio de 826 a 825 no es pérdida de imagen: desapareció una fila de padding que no representaba un jugador positivo real.
- También queda corregida la métrica de tamaño: **101/109 categorías** tienen 200 entradas o universo cerrado (**92,7%**); las 8 restantes muestran ahora solo datos positivos reales. Las categorías completas por cobertura validada siguen en **59/109 (54,1%)**.

## Aprobación de retrato Commons: Alberto López — 2026-09-12

- Se revisó visualmente el candidato de **Alberto López Fernández** (`Q1381315`): retrato frontal claro, normalizado a WebP 512×512.
- La ficha de Commons identifica la obra como trabajo propio de **Rebeca F.P.** y la publica bajo **CC BY-SA 3.0 Unported**. Se registraron la atribución, el requisito ShareAlike, el alcance de uso y la URL de evidencia.
- El asset `img_17fb69c7fbb87bc736396f90` pasó de `pending` a aprobado y quedó marcado como retrato principal. No se creó una segunda imagen para ninguna aparición del jugador.
- Auditoría posterior: **690/825 = 83,64%** de jugadores jugables únicos con retrato legal principal; quedan **135** expedientes pendientes. El total de assets legales de retrato es **1.602**. Las métricas de categorías permanecen en **101/109 con tamaño mínimo (92,7%)** y **59/109 completamente validadas (54,1%)**; los escudos de clubes siguen en **0/233**.

## Aprobación de retrato Commons: David Ospina — 2026-09-12

- Se revisó visualmente el candidato de **David Ospina** (`Q436987`): rostro identificable, encuadre frontal y original de 996×1349, normalizado a WebP 512×512.
- Commons identifica la fuente como **Fotografía oficial de la Presidencia de Colombia** y muestra la liberación declarada al dominio público en Flickr. Se registró la evidencia, el alcance comercial y la atribución informativa.
- El asset `img_c438095745017682e6f77a7a` pasó de `pending` a aprobado y quedó como retrato principal, sin duplicar al jugador en sus rankings.
- Auditoría posterior: **691/825 = 83,76%** de jugadores jugables únicos con retrato legal principal; quedan **134** pendientes. El total de assets legales de retrato es **1.603**. Las categorías permanecen en **59/109 completamente validadas (54,1%)** y los escudos de clubes en **0/233**.

## Evaluación de fuente StatBunker para asistencias históricas de Champions — 2026-09-12

- Se añadió un adaptador experimental para `uefa-champions-league-assists` usando la tabla histórica de [StatBunker](https://www.statbunker.com/alltimestats/AllTimeCompetitionMostAssists?comp_code=UCL) y sus páginas históricas de clubes.
- La raíz pública devuelve 50 filas y enlaza 174 páginas de clubes. Se probaron reintentos, hosts alternativos y concurrencia limitada para agregar 200 jugadores positivos.
- La fuente aplicó rate-limit/timeouts intermitentes durante la descarga; las ejecuciones se abortaron antes de importar. **No se creó snapshot, no se sustituyó el ranking API-Football y no se contaron datos incompletos.** La categoría continúa en `draft` hasta disponer de una descarga reproducible completa y validación metodológica.

## Lote visual Wikidata/P18 20260912-batch-02

- Se seleccionaron **20 jugadores jugables únicos** excluyendo el lote anterior, retratos legales aprobados, candidatos `pending` y activos rechazados. El manifiesto reproducible es [`players-portrait-20260912-batch-02.json`](backend/storage/media-candidates/players-portrait-20260912-batch-02.json).
- **David Ospina Ramírez** (`Q436987`) obtuvo un P18 exacto hacia [File:David Ospina, Colombia NT presidential send-off, Jun 2026.jpg](https://commons.wikimedia.org/wiki/File:David_Ospina,_Colombia_NT_presidential_send-off,_Jun_2026.jpg). La ficha declara dominio público, identifica a Fotografía oficial de la Presidencia de Colombia como autora y documenta el origen. Se descargó, inspeccionó frontalmente y normalizó a WebP 512×512; quedó únicamente `pending` como `img_c438095745017682e6f77a7a` en [`bdfutbol_serie-a_player_e918060ceb35c48a4a408bb1-7a90b4ff554dd0f329ffa28a.webp`](backend/storage/media/bdfutbol_serie-a_player_e918060ceb35c48a4a408bb1-7a90b4ff554dd0f329ffa28a.webp).
- **Pascal Olmeta** (`Q2303891`) tenía P18 y licencia CC BY 3.0, pero el original era de **496×681 px**. Se descargó y revisó una normalización temporal para comprobar el encuadre, pero se descartó y no se registró por no ampliar una fuente insuficiente.
- Songo'o, Dropsy, Alfredo da Silva Castro, Costil y Leonardo Franco no devolvieron un archivo P18 exacto utilizable con metadatos válidos; se documentan como descartes, no como imágenes faltantes sustituidas.
- Asenjo, Ferron, Alekandar Cavric, Marco Aurélio Siqueira, Rui Correia, Santamaría, Luca Bucci, David Datro Fofana, Hamidou Traore, Zeki Amdouni, Alexander Gonzalez, Vasilios Pavlidis y Chilavert quedaron **diferidos**, porque Wikidata respondió con rate-limit durante la consulta. No se han marcado como “sin P18” y deben reintentarse en una ventana posterior.
- La verificación de este lote, ejecutada **antes de la revisión legal posterior de Ospina**, mantenía **690/825 = 83,64%** porque el candidato seguía `pending`. Después se aprobó Ospina y las auditorías posteriores reflejan ese cambio; no se tocaron rankings, identidades, categorías ni API keys.

## Aprobación de retrato Commons: Luis González (Lucho González) — 2026-09-12

- Se identificó la entidad `api-football:player:10134` como **Luis González / Lucho González** y se verificó el P18 exacto de Wikidata hacia [File:Lucho González FC Porto 2013.jpg](https://commons.wikimedia.org/wiki/File:Lucho_Gonz%C3%A9lez_FC_Porto_2013.jpg).
- La ficha de Commons declara la obra de **Ludovic Péron** bajo **CC BY-SA 3.0**. El original (733×1007) se descargó, se revisó visualmente —rostro frontal e identificable— y se normalizó a WebP 512×512.
- El asset `img_f22f4c678fb009b7a6a60640` quedó aprobado como retrato principal, con atribución obligatoria, ShareAlike y alcance de uso registrado. No se creó una imagen duplicada para sus apariciones en rankings.
- Auditoría posterior: **692/825 = 83,88%** de jugadores jugables únicos con retrato legal principal; quedan **133** expedientes pendientes. El total de assets legales de retrato es **1.604**. Las categorías permanecen en **59/109 completamente validadas (54,1%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: Rafa Silva y Kerem Aktürkoğlu — 2026-09-12

- **Rafa Silva** (`api-football:player:573`): [File:Rafa Silva 20240803 (cropped) wide.jpg](https://commons.wikimedia.org/wiki/File:Rafa_Silva_20240803_(cropped)_wide.jpg), derivado de la fotografía de **Beşiktaş JK** en Flickr y publicada bajo **CC BY 2.0**. Se verificó la identidad, se revisó el encuadre frontal y se normalizó a WebP 512×512.
- **Kerem Aktürkoğlu** (`api-football:player:142959`): [File:Kerem Aktürkoğlu 9 Fenerbahçe 20260805 (11).JPG](https://commons.wikimedia.org/wiki/File:Kerem_Akt%C3%BCrko%C4%9Flu_9_Fenerbah%C3%A7e_20260805_(11).JPG), obra propia de **Zafer** bajo **CC BY-SA 4.0**. Se verificó la identidad, se revisó el encuadre frontal y se normalizó a WebP 512×512.
- Los assets `img_44f0189e419c89125498098c` y `img_5555189cba07fdebc7230562` quedaron aprobados como retratos principales con atribución y alcance de uso registrados; no se duplicaron por ranking.
- Auditoría posterior: **694/825 = 84,12%** de jugadores jugables únicos con retrato legal principal; quedan **131** expedientes pendientes. El total de assets legales de retrato es **1.606**. Las categorías permanecen en **59/109 completamente validadas (54,1%)** y los escudos de clubes en **0/233**.

## Barrido Wikidata P18 de pendientes — 2026-09-12

- Se ejecutaron seis lotes reproducibles sobre los **131** jugadores pendientes, en modo `--wikidata-only`, para evitar coincidencias textuales sin identidad confirmada.
- Los manifiestos quedaron en `backend/storage/media-candidates/players-portrait-1789239294974-0-20.json`, `players-portrait-1789239488128-20-20.json`, `players-portrait-1789239536960-40-20.json`, `players-portrait-1789239562463-60-20.json`, `players-portrait-1789239597696-80-20.json`, `players-portrait-1789239673095-100-20.json` y `players-portrait-1789239706657-120-20.json`.
- Se localizaron dos candidatos adicionales utilizables: Rafa Silva y Kerem Aktürkoğlu, aprobados tras revisión visual y legal. El candidato de Molina se rechazó por encuadre lateral y el de César Sánchez por GFDL; el resto no aportó un P18 apto en esta pasada.
- Se intentó Openverse para 20 pendientes, pero la API respondió `401`/`429` y no se registró ningún asset. No se contabilizaron resultados incompletos.
- Estado resultante: **694/825 = 84,12%**, **131** pendientes; Commons mantiene **1.360** retratos aprobados, TheSportsDB **229** y Openverse **14**. No se aprobaron imágenes sin evidencia de licencia.

## Aprobación de retrato Commons: Houssem Aouar — 2026-09-12

- Se identificó `api-football:player:658` como **Houssem Aouar** y se utilizó [File:Houssem Aouar 2017.jpg](https://commons.wikimedia.org/wiki/File:Houssem_Aouar_2017.jpg), donde Commons documenta a **Laura Jonin** como autora, fuente Flickr y licencia **CC BY 2.0** verificada por FlickreviewR.
- La fotografía individual se revisó visualmente: rostro claro, encuadre limpio y resolución original 3.200×4.780. Se normalizó a WebP 512×512; los elementos de equipación quedan como parte incidental de la fotografía, no como uso de marca.
- El asset quedó aprobado como retrato principal con atribución y evidencia registradas. No se creó una copia por cada ranking.
- Auditoría posterior: **695/825 = 84,24%** de jugadores jugables únicos con retrato legal principal; quedan **130** expedientes pendientes. El total de assets legales de retrato es **1.607**. Las categorías permanecen en **59/109 completamente validadas (54,1%)** y los escudos de clubes en **0/233**.
## Lote estricto de retratos Commons — 2026-09-12

Se procesó el lote `players-portrait-1789239766283-strict-batch.json` con una consulta de PostgreSQL que selecciona jugadores jugables únicos en rankings activos (posición <= 200) y excluye cualquier retrato `approved`, `pending` o `rejected` de todo el grupo de identidad. Se reintentaron los errores temporales en `players-portrait-1789239963305-strict-batch.json` y `players-portrait-1789240146338-strict-p18-retry.json` mediante búsqueda exacta en Wikidata, lectura de claims P18 y validación del archivo en Wikimedia Commons.

Resultado: 20 seleccionados, 0 candidatos P18 válidos para descarga, 0 assets nuevos y 0 aprobaciones automáticas. Se documentaron 3 ausencias de candidato, 1 descarte por calidad (Pascal Olmeta, original de 496 px) y 16 errores temporales de Wikidata; el reintento agrupado resolvió 10 de ellos como ausencia de P18, archivo inexistente o incumplimiento de la validación. Los errores que no pudieron resolverse por rate-limit no se convierten en descartes definitivos.

La operación no modificó rankings, identidades, categorías ni API keys. Al cierre, la auditoría canónica mostraba 695/825 jugadores jugables ranqueados con retrato legal aprobado (84,24%), 130 pendientes de retrato legal, 1.607 assets legales de retrato, 59/109 categorías completamente validadas (54,1%) y 0/233 escudos de clubes aprobados.

## Aprobación de retratos Commons: Pelkas, Aouar y Henty — 2026-09-12

- **Dimitris Pelkas** (`api-football:player:2374`): [File:Dimitris Pelkas.jpg](https://commons.wikimedia.org/wiki/File:Dimitris_Pelkas.jpg), autor **Dmitry Sadovnikov**, licencia **CC BY-SA 3.0** y permiso VRT documentado. La imagen se revisó visualmente y se normalizó a WebP 512×512.
- **Houssem Aouar** (`api-football:player:658`): [File:Houssem Aouar 2017.jpg](https://commons.wikimedia.org/wiki/File:Houssem_Aouar_2017.jpg), autora **Laura Jonin**, licencia **CC BY 2.0** verificada en Commons mediante FlickreviewR. Se seleccionó la fotografía individual limpia frente a otra alternativa con una pared de patrocinadores.
- **Ezekiel Henty** (`api-football:player:14322`): [File:Ezekiel Henty 2016.jpg](https://commons.wikimedia.org/wiki/File:Ezekiel_Henty_2016.jpg), autora **Elena Rybakova**, licencia **CC BY-SA 3.0** y permiso VRT documentado. La imagen se revisó visualmente y se normalizó a WebP 512×512.
- Los tres assets quedaron aprobados como retratos principales con atribución y alcance registrados; no se duplicaron por ranking. Los candidatos de Dele Alli y Soldado se descartaron por encuadre insuficiente y no se contabilizaron.
- Auditoría posterior: **697/825 = 84,48%** de jugadores jugables únicos con retrato legal principal; quedan **128** expedientes pendientes. El total de assets legales de retrato es **1.609**. Las categorías permanecen en **59/109 completamente validadas (54,1%)** y los escudos de clubes en **0/233**.

## Aprobación de retrato Commons: Evander — 2026-09-12

- Se identificó `api-football:player:15798` como **Evander da Silva Ferreira** y se utilizó [File:Evander NYCFC v Cincinnati 22 Apr 26-14.jpg](https://commons.wikimedia.org/wiki/File:Evander_NYCFC_v_Cincinnati_22_Apr_26-14.jpg).
- La ficha de Commons declara obra propia de **Bryan Berlin**, fotografía del 22 de abril de 2026 y licencia **CC BY-SA 4.0**. Se descartó la primera variante porque los metadatos EXIF la mostraban girada y la segunda se auto-orientó correctamente; la imagen final se revisó visualmente y se normalizó a WebP 512×512.
- El asset quedó aprobado como retrato principal con atribución y ShareAlike registrados. No se duplicó por ranking.
- `npm run build` y `git diff --check` pasan. Auditoría posterior: **698/825 = 84,61%** de jugadores jugables únicos con retrato legal principal; quedan **127** expedientes pendientes. El total de assets legales de retrato es **1.610**. Las categorías permanecen en **59/109 completamente validadas (54,1%)** y los escudos de clubes en **0/233**.

## Aprobación de retrato Commons: Antonio-Mirko Čolak — 2026-09-12

- Se identificó `api-football:player:14293` como **Antonio-Mirko Čolak** y se utilizó [File:Colak, Antonio Mirko.IMG 4756.JPG](https://commons.wikimedia.org/wiki/File:Colak,_Antonio_Mirko.IMG_4756.JPG).
- La ficha de Commons declara obra propia de **Ave Maria Mõistlik** bajo **CC BY-SA 3.0**. La imagen muestra al jugador con Croacia, tiene resolución original 1.153×2.041 y fue normalizada a WebP 512×512 con auto-orientación EXIF.
- El encuadre fue revisado visualmente: el jugador es identificable y el rostro queda claro. El asset quedó aprobado como retrato principal con atribución, ShareAlike, evidencia y alcance de uso registrados. No se duplicó por ranking.
- Auditoría posterior: **699/825 = 84,73%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **126** expedientes pendientes. El total de assets legales de retrato es **1.611**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: Berkay Özcan y Kostas Tsimikas — 2026-09-12

- **Berkay Özcan** (`api-football:player:24885`): [File:Berkay oezcan.jpg](https://commons.wikimedia.org/wiki/File:Berkay_oezcan.jpg), obra propia de **Jeollo / vfb-exklusiv.de**, publicada bajo **CC BY-SA 3.0** con permiso documentado en Commons. El retrato individual es nítido; original 639×800, normalizado a WebP 512×512.
- **Kostas Tsimikas** (`api-football:player:1600`): [File:Liverpool FC gegen 1. FSV Mainz 05 (Testspiel 23. Juli 2021) 17.jpg](https://commons.wikimedia.org/wiki/File:Liverpool_FC_gegen_1._FSV_Mainz_05_(Testspiel_23._Juli_2021)_17.jpg), obra propia de **Werner100359**, publicada bajo **CC BY-SA 4.0**. El jugador domina el encuadre y el rostro es claramente identificable; original 2.036×3.405, normalizado a WebP 512×512.
- Ambos assets quedaron aprobados como retratos principales con atribución, ShareAlike, evidencia y alcance de uso registrados. No se duplicaron por ranking.
- Auditoría posterior: **701/825 = 84,97%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **124** expedientes pendientes. El total de assets legales de retrato es **1.613**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retrato Commons: Serdar Gürler — 2026-09-12

- Se identificó `api-football:player:50180` como **Serdar Gürler** y se utilizó [File:Serdar Gürler'13-14.JPG](https://commons.wikimedia.org/wiki/File:Serdar_G%C3%BCrler%2713-14.JPG), obra propia de **Ultraslansi** bajo **CC BY-SA 3.0**.
- La imagen individual es nítida y el rostro identificable; original 1.471×1.626, normalizado a WebP 512×512 con auto-orientación EXIF.
- El asset quedó aprobado como retrato principal con atribución, ShareAlike, evidencia y alcance de uso registrados. No se duplicó por ranking.
- Auditoría posterior: **702/825 = 85,09%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **123** expedientes pendientes. El total de assets legales de retrato es **1.614**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retrato Commons: Fousseni Diabaté — 2026-09-12

- Se identificó `pl:player:32936` como **Fousseni Diabaté** y se utilizó [File:Leicester 1 Chelsea 2 (AET) (39086583770) (cropped).jpg](https://commons.wikimedia.org/wiki/File:Leicester_1_Chelsea_2_(AET)_(39086583770)_(cropped).jpg), obra de **cfcunofficial (Chelsea Debs) London** bajo **CC BY-SA 2.0**.
- La imagen muestra al jugador de forma dominante y el rostro es identificable; original 1.864×2.903, normalizado a WebP 512×512 con auto-orientación EXIF.
- El asset quedó aprobado como retrato principal con atribución, ShareAlike, evidencia y alcance de uso registrados. No se duplicó por ranking.
- Auditoría posterior: **703/825 = 85,21%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **122** expedientes pendientes. El total de assets legales de retrato es **1.615**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: Saša Zdjelar y Vadis Odjidja-Ofoe — 2026-09-12

- **Saša Zdjelar** (`api-football:player:45831`): [File:Saša Zdjelar 2025.jpg](https://commons.wikimedia.org/wiki/File:Sa%C5%A1a_Zdjelar_2025.jpg), fotografía de **Anna Meyer** distribuida por FC Zenit bajo **CC BY-SA 3.0**, con autorización/VRT documentada en Commons. Original 700×959; retrato individual nítido, normalizado a WebP 512×512.
- **Vadis Odjidja-Ofoe** (`statbunker:uefa-conference:player:24654`): [File:Vadis Odjidja-Ofoe (17 juli 2012).JPG](https://commons.wikimedia.org/wiki/File:Vadis_Odjidja-Ofoe_(17_juli_2012).JPG), obra propia de **Mooi is de wereld** bajo **CC BY-SA 3.0**. Original 1.536×2.048; rostro claramente identificable, normalizado a WebP 512×512.
- Ambos assets quedaron aprobados como retratos principales con atribución, ShareAlike, evidencia y alcance de uso registrados. No se duplicaron por ranking.
- Auditoría posterior: **705/825 = 85,45%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **120** expedientes pendientes. El total de assets legales de retrato es **1.617**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retrato Commons: Mustapha Yatabaré — 2026-09-12

- Se identificó `api-football:player:50019` como **Mustapha Yatabaré** y se utilizó [File:Mustapha Yatabaré 2.jpg](https://commons.wikimedia.org/wiki/File:Mustapha_Yatabar%C3%A9_2.jpg), obra propia de **Ciscouf** bajo **CC BY-SA 3.0**.
- La ficha de Commons documenta expresamente la licencia y la identidad del jugador. El retrato individual es nítido; original 966×1.936, normalizado a WebP 512×512 con auto-orientación EXIF.
- El asset quedó aprobado como retrato principal con atribución, ShareAlike, evidencia y alcance de uso registrados. No se duplicó por ranking.
- Auditoría posterior: **706/825 = 85,58%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **119** expedientes pendientes. El total de assets legales de retrato es **1.618**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: Gorka Iraizoz y Emmanuel Banda — 2026-09-12

- **Gorka Iraizoz** (`bdfutbol:la-liga:player:64b39e62df50ee7910825533`): [File:Gorkairaizoz.jpg](https://commons.wikimedia.org/wiki/File:Gorkairaizoz.jpg), obra propia de **Metsavend** bajo **CC BY-SA 3.0**. La fotografía muestra al exguardameta de forma individual y con el rostro identificable; original 1.410×1.879, normalizado a WebP 512×512.
- **Emmanuel Banda** (`api-football:player:21033`): [File:RC Lens - AS Béziers (04-01-2019) 35.jpg](https://commons.wikimedia.org/wiki/File:RC_Lens_-_AS_B%C3%A9ziers_(04-01-2019)_35.jpg), obra propia de **Supporterhéninois** bajo **CC0 1.0**. La fotografía individual procede del partido RC Lens–AS Béziers; original 2.287×3.049, normalizado a WebP 512×512 y revisado visualmente.
- Ambos assets quedaron aprobados como retratos principales con evidencia de licencia y alcance de uso registrados. No se creó ningún retrato duplicado por aparecer un jugador en varios rankings.
- Auditoría posterior: **708/825 = 85,82%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **117** expedientes pendientes. El total de assets legales de retrato es **1.620**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: Ibrahim Traoré y Andy Halliday — 2026-09-12

- **Ibrahim Traoré** (`api-football:player:1245`): [File:Ibrahim Benjamin Traoré, FCB-SLAVIA 30092018.jpg](https://commons.wikimedia.org/wiki/File:Ibrahim_Benjamin_Traor%C3%A9,_FCB-SLAVIA_30092018.jpg), obra propia de **Tadeáš Bednarz** bajo **CC BY-SA 4.0**. Commons identifica al jugador en los datos estructurados; original 690×1.069, retrato individual revisado y normalizado a WebP 512×512.
- **Andy Halliday** (`statbunker:uefa-conference:player:36078`): [File:Andy Halliday crop.jpg](https://commons.wikimedia.org/wiki/File:Andy_Halliday_crop.jpg), fotografía de **Jim Easton** procedente de Flickr y revisada por FlickreviewR bajo **CC BY-SA 2.0**. El jugador es identificable en un recorte individual; original 735×944, normalizado a WebP 512×512.
- Ambos assets quedaron aprobados como retratos principales con atribución, ShareAlike, evidencia y alcance de uso registrados. No se crearon duplicados por ranking.
- Auditoría posterior: **710/825 = 86,06%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **115** expedientes pendientes. El total de assets legales de retrato es **1.622**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: Ricardo Quaresma y Dele Alli — 2026-09-12

- **Ricardo Quaresma** (`bdfutbol:primeira-liga:player:3fedd5421576347dc49cb49f`): [File:Ricardo Quaresma.jpg](https://commons.wikimedia.org/wiki/File:Ricardo_Quaresma.jpg), fotografía de **Анна Нэсси** bajo **CC BY-SA 3.0**. El archivo identifica al jugador, tiene original 984×1.108 y fue normalizado a WebP 512×512 tras revisión visual.
- **Dele Alli** (`api-football:player:172`): [File:2020-03-10 Dele Alli (cropped).jpg](https://commons.wikimedia.org/wiki/File:2020-03-10_Dele_Alli_(cropped).jpg), obra propia de **Steffen Prößdorf** bajo **CC BY-SA 4.0**. Original 1.659×2.403, retrato individual nítido y normalizado a WebP 512×512. La página de Commons contiene una advertencia de derechos de personalidad; queda registrada como revisión jurídica pendiente y no se interpreta como una autorización adicional del derecho de imagen.
- Ambos assets quedaron aprobados como retratos principales con atribución, ShareAlike, evidencia y alcance de uso registrados. No se crearon duplicados por ranking.
- Auditoría posterior: **712/825 = 86,30%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **113** expedientes pendientes. El total de assets legales de retrato es **1.624**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: Bruno Godeau, Ferdi Kadioglu y Josef Hušbauer — 2026-09-12

- **Bruno Godeau** (`api-football:player:8583`): [File:2018-02-22 Entrainement excel-53.jpg](https://commons.wikimedia.org/wiki/File:2018-02-22_Entrainement_excel-53.jpg), obra de **V4nco** bajo **CC BY-SA 4.0**. Retrato individual nítido; original 1.069×1.601, normalizado a WebP 512×512.
- **Ferdi Kadioglu** (`pl:player:50727`): [File:Ferdi Kadioglu (2021-22 Süper Lig) - Resim1 (cropped).png](https://commons.wikimedia.org/wiki/File:Ferdi_Kadioglu_(2021-22_S%C3%BCper_Lig)_-_Resim1_(cropped).png), atribuido a **beIN SPORTS Türkiye** bajo **CC BY 3.0**. Imagen individual identificable; original 538×779, normalizado a WebP 512×512.
- **Josef Hušbauer** (`api-football:player:1239`): [File:Josef Hušbauer, FCB-SLAVIA 30092018.jpg](https://commons.wikimedia.org/wiki/File:Josef_Hu%C5%A1bauer,_FCB-SLAVIA_30092018.jpg), obra propia de **Tadeáš Bednarz** bajo **CC BY-SA 4.0**. El jugador domina el encuadre y es identificable; original 576×1.214, normalizado a WebP 512×512.
- Los tres assets quedaron aprobados como retratos principales con la licencia, evidencia, atribución/ShareAlike y alcance de uso registrados. No se crearon duplicados por ranking.
- Auditoría posterior: **715/825 = 86,67%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **110** expedientes pendientes. El total de assets legales de retrato es **1.627**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: Papu Gómez, César Sánchez y Andrés Palop — 2026-09-12

- **Papu Gómez** (`api-football:player:30433`): [File:Papu Gómez 2022.jpg](https://commons.wikimedia.org/wiki/File:Papu_G%C3%B3mez_2022.jpg), obra propia de **jmmuguerza** bajo **CC BY-SA 3.0**. Original 1.278×2.572, retrato individual con Argentina, normalizado a WebP 512×512.
- **César Sánchez** (`api-football:player:117030`): [File:Cesar Sanchez VCF.jpg](https://commons.wikimedia.org/wiki/File:Cesar_Sanchez_VCF.jpg), obra propia de **Amarco90**, con licencia **CC BY-SA 3.0** explícita en la página. Original 1.172×1.844, retrato individual revisado y normalizado a WebP 512×512.
- **Andrés Palop** (`bdfutbol:la-liga:player:9b1dceebed9033f5be3c6d33`): [File:AndresPalop.jpg](https://commons.wikimedia.org/wiki/File:AndresPalop.jpg), con permiso de distribución del propietario de soccer.ru bajo **CC BY-SA 3.0**; la página identifica a **Елена Рыбакова** como autora. Original 531×510, retrato individual normalizado a WebP 512×512.
- Los tres assets quedaron aprobados como retratos principales con evidencia de licencia, atribución/ShareAlike y alcance de uso registrados. No se crearon duplicados por ranking.
- Auditoría posterior: **718/825 = 87,03%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **107** expedientes pendientes. El total de assets legales de retrato es **1.630**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: Abel Resino, José Ramón Esnaola y Juan Carlos Unzué — 2026-09-12

- **Abel Resino** (`bdfutbol:la-liga:player:523439eebbd1014f60e66fd2`): [File:Resino.jpg](https://commons.wikimedia.org/wiki/File:Resino.jpg), obra de **Nannnis** bajo **CC BY-SA 4.0**. Retrato individual claro; original 975×1.608, normalizado a WebP 512×512.
- **José Ramón Esnaola** (`bdfutbol:la-liga:player:4419618870be3dd13f064d14`): [File:Esnaola 2013 002.jpg](https://commons.wikimedia.org/wiki/File:Esnaola_2013_002.jpg), obra de **Anual** bajo **CC BY-SA 3.0**. Retrato individual identificable; original 1.317×2.000, normalizado a WebP 512×512.
- **Juan Carlos Unzué** (`bdfutbol:la-liga:player:27e76d510162d5d77b9314d5`): [File:FCB de Navidad 2012 (6641546505).jpg](https://commons.wikimedia.org/wiki/File:FCB_de_Navidad_2012_(6641546505).jpg), obra de **Xabier Rondon** bajo **CC BY-SA 4.0**. Imagen individual con rostro identificable; original 640×360, normalizado a WebP 512×512.
- Los tres assets quedaron aprobados como retratos principales con evidencia de licencia, atribución/ShareAlike y alcance de uso registrados. No se crearon duplicados por ranking.
- Auditoría posterior: **721/825 = 87,39%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **104** expedientes pendientes. El total de assets legales de retrato es **1.633**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.
# Control canónico vigente

Última auditoría ejecutada el **12 de septiembre de 2026** desde PostgreSQL. Estas son las únicas cifras que deben utilizarse para informar del avance; los bloques históricos inferiores conservan la trazabilidad de cortes anteriores.

- **Retratos de jugadores para el juego:** **742/825 = 89,94%**. Son personas jugables únicas presentes en al menos un ranking activo y con un retrato principal aprobado, con licencia, evidencia y alcance de uso completos. Quedan **83**.
- **Datos estadísticos:** **59/109 = 54,1%** de categorías activas tienen cobertura validada, sin conflictos y con 200 entradas reales o universo cerrado completo.
- **Tamaño de rankings:** **101/109 = 92,7%** tienen 200 entradas o un universo cerrado; esto no certifica por sí solo la exhaustividad histórica.
- **Escudos de clubes:** **0/233** tienen actualmente autorización marcaria y expediente de publicación completo.
- **No existe un porcentaje global del proyecto:** no se suman ni promedian retratos, datos, escudos, licencias y publicación sin una ponderación aprobada.

El denominador de retratos es estable por personas canónicas, no por posiciones ni por copias de un jugador en varios rankings.

## Aprobación de retratos Commons: Dominique Dropsy, Marcelinho y David Soria — 2026-09-12

- **Dominique Dropsy** (`bdfutbol:ligue-1:player:4670eb16235b18196c854527`): [File:Dominique Dropsy.jpg](https://commons.wikimedia.org/wiki/File:Dominique_Dropsy.jpg), autora **TaraO**, licencia **CC BY 2.5** explícita en Commons. Retrato individual revisado; original 1.391×1.516, normalizado a WebP 512×512.
- **Marcelinho** (`api-football:player:1076`): [File:Marcelinho Carioca.JPG](https://commons.wikimedia.org/wiki/File:Marcelinho_Carioca.JPG), obra de **Ricardo Stuckert/PR**, licencia **CC BY 3.0 BR**. Rostro identificable y encuadre válido; original 735×1.119, normalizado a WebP 512×512.
- **David Soria** (`bdfutbol:la-liga:player:848f4f8122ec2eab14154062`): [File:05-05-2016 - Sevilla FC - FC Shakhtar Donetsk - 3-1 (26235556264).jpg](https://commons.wikimedia.org/wiki/File:05-05-2016_-_Sevilla_FC_-_FC_Shakhtar_Donetsk_-_3-1_(26235556264).jpg), obra de **Aleksandr Osipov**, licencia **CC BY-SA 2.0**. Se descartó una imagen de espalda y se seleccionó el original de partido con rostro frontal claramente identificable; original 1.280×853, normalizado a WebP 512×512.
- Los tres assets quedaron aprobados como retratos principales con fuente, licencia, evidencia, atribución y alcance registrados. No se duplicaron por ranking.
- Auditoría posterior: **724/825 = 87,76%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **101** expedientes pendientes. El total de assets legales de retrato es **1.636**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: Fermín López, Andrei Cordea y Cédric Badolo — 2026-09-12

- **Fermín López** (`api-football:player:340626`): [File:Fermín López (cropped).jpg](https://commons.wikimedia.org/wiki/File:Ferm%C3%ADn_L%C3%B3pez_(cropped).jpg), obra de **Biso**, licencia **CC BY 4.0**. Rostro frontal claro; original 766×1.139, normalizado a WebP 512×512.
- **Andrei Cordea** (`statbunker:uefa-conference:player:65809`): [File:Andrei Cordea - 3 July 2023 (cropped).jpg](https://commons.wikimedia.org/wiki/File:Andrei_Cordea_-_3_July_2023_(cropped).jpg), obra de **Carlo Bruil Fotografie**, licencia **CC BY 2.0**. Perfil lateral nítido y plenamente identificable; original 1.288×2.031, normalizado a WebP 512×512.
- **Cédric Badolo** (`api-football:player:125201`): [File:Cedric Badolo.jpg](https://commons.wikimedia.org/wiki/File:Cedric_Badolo.jpg), obra de **Fcstmani**, licencia **CC0 1.0**. Retrato individual nítido; original 771×1.208, normalizado a WebP 512×512.
- Los tres assets quedaron aprobados como retratos principales con fuente, licencia, evidencia y alcance registrados. No se duplicaron por ranking.
- Auditoría posterior: **727/825 = 88,12%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **98** expedientes pendientes. El total de assets legales de retrato es **1.639**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: Abbas Hüseynov, Dolev Haziza y Michal Kohút — 2026-09-12

- **Abbas Hüseynov** (`api-football:player:1534`): [File:Abbas-bahlul (1).jpg](https://commons.wikimedia.org/wiki/File:Abbas-bahlul_(1).jpg), obra de **Bəhram Camalov**, licencia **CC BY-SA 4.0**. Retrato frontal individual nítido; original 2.301×3.114, normalizado a WebP 512×512.
- **Dolev Haziza** (`api-football:player:110987`): [File:דולב חזיזה - Dolev Haziza.jpg](https://commons.wikimedia.org/wiki/File:%D7%93%D7%95%D7%9C%D7%91_%D7%97%D7%96%D7%99%D7%96%D7%94_-_Dolev_Haziza.jpg), obra de **Adir Benyamini**, licencia **CC BY-SA 4.0**. Jugador individual identificable con rostro visible; original 2.176×3.264, normalizado a WebP 512×512.
- **Michal Kohút** (`statbunker:uefa-conference:player:67953`): [File:Michal Kohút 20200627.jpg](https://commons.wikimedia.org/wiki/File:Michal_Koh%C3%BAt_20200627.jpg), obra de **El Loko Foto**, licencia **CC BY 4.0**. Imagen individual en acción con rostro nítido; original 1.200×800, normalizado a WebP 512×512.
- Los tres assets quedaron aprobados como retratos principales con fuente, licencia, evidencia y alcance registrados. No se duplicaron por ranking.
- Auditoría posterior: **730/825 = 88,48%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **95** expedientes pendientes. El total de assets legales de retrato es **1.642**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retrato Commons: Meriton Korenica — 2026-09-12

- **Meriton Korenica** (`api-football:player:106104`): [File:Meriton Korenica.jpg](https://commons.wikimedia.org/wiki/File:Meriton_Korenica.jpg), obra de **Rakeck**, licencia **CC BY-SA 4.0**. Jugador individual identificable, rostro visible y fotografía de 2025; original 534×648, normalizado a WebP 512×512.
- El asset quedó aprobado como retrato principal con licencia, evidencia, atribución, ShareAlike y alcance registrados. No se duplicó por ranking.
- Auditoría posterior: **731/825 = 88,61%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **94** expedientes pendientes. El total de assets legales de retrato es **1.643**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: José Luis Chilavert y Marcos Tavares — 2026-09-12

- **José Luis Chilavert** (`iffhs:goalkeeper:player:68e924c89ec52ea9f9e24e0b`): [File:Chilavert 2014 (cropped).jpg](https://commons.wikimedia.org/wiki/File:Chilavert_2014_(cropped).jpg), fuente **Prensa TV Pública**, licencia **CC BY 2.0**. Retrato individual nítido; original 802×989, normalizado a WebP 512×512.
- **Marcos Tavares** (`api-football:player:105577`): [File:Marcos Tavares (cropped).jpg](https://commons.wikimedia.org/wiki/File:Marcos_Tavares_(cropped).jpg), obra de **Proeliumsportsagency**, licencia **CC BY-SA 4.0**. Retrato frontal individual nítido; original 1.874×2.359, normalizado a WebP 512×512.
- Ambos assets quedaron aprobados como retratos principales con licencia, evidencia, atribución, ShareAlike cuando corresponde y alcance registrados. No se duplicaron por ranking.
- Auditoría posterior: **733/825 = 88,85%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **92** expedientes pendientes. El total de assets legales de retrato es **1.645**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retrato Commons: Alexander Frei — 2026-09-12

- **Alexander Frei** (`api-football:player:117969`): [File:Alex Frei.jpg](https://commons.wikimedia.org/wiki/File:Alex_Frei.jpg), autor identificado como **Helmut S. Otto**, archivo declarado en **dominio público** por Wikimedia Commons. Retrato individual frontal nítido; original 590×800, normalizado a WebP 512×512.
- Se descartó la fotografía de André Castro del mismo lote por mostrar al jugador demasiado lejos para el estándar visual. El asset de Frei quedó aprobado con evidencia de dominio público y alcance de uso registrados; no se duplicó por ranking.
- Auditoría posterior: **734/825 = 88,97%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **91** expedientes pendientes. El total de assets legales de retrato es **1.646**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retrato Commons: Pascal Olmeta — 2026-09-12

- **Pascal Olmeta** (`bdfutbol:ligue-1:player:d5f29db41c1abb623c3b7564`): [File:Паскал Олмета 2019.png](https://commons.wikimedia.org/wiki/File:%D0%9F%D0%B0%D1%81%D0%BA%D0%B0%D0%BB_%D0%9E%D0%BB%D0%BC%D0%B5%D1%82%D0%B0_2019.png), fuente **TV7**, licencia **CC BY 3.0**. Retrato frontal individual, limpio y nítido; original 496×681, normalizado a WebP 512×512.
- Se documentó una excepción técnica de cuatro píxeles: la ampliación es mínima y no afecta a la identificación visual. El asset quedó aprobado con licencia, evidencia, atribución y alcance registrados.
- Auditoría posterior: **735/825 = 89,09%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **90** expedientes pendientes. El total de assets legales de retrato es **1.647**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retrato Commons: Benoît Costil — 2026-09-12

- **Benoît Costil** (`bdfutbol:ligue-1:player:799e2258ae67b7d4543c26fd`): [File:Caen - Rennes 20140709 - Benoît Costil.JPG](https://commons.wikimedia.org/wiki/File:Caen_-_Rennes_20140709_-_Beno%C3%AEt_Costil.JPG), obra de **S. Plaine**, licencia **CC BY-SA 3.0**. Retrato individual nítido del portero, rostro claramente identificable; original 2.040×2.288, normalizado a WebP 512×512.
- El asset quedó aprobado como retrato principal con licencia, evidencia, atribución, ShareAlike y alcance registrados. Se descartó una fotografía de Sergio Asenjo por mostrarlo demasiado lejos. No se duplicó por ranking.
- Auditoría posterior: **736/825 = 89,21%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **89** expedientes pendientes. El total de assets legales de retrato es **1.648**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retrato Commons: Mouhamed Diop — 2026-09-12

- **Mouhamed Diop** (`api-football:player:335162`): [File:Mouhamed Diop 2023.jpg](https://commons.wikimedia.org/wiki/File:Mouhamed_Diop_2023.jpg), fuente **ESTAC Troyes**, licencia **CC BY 3.0**. La propia ficha identifica al jugador; retrato frontal individual nítido, original 1.149×1.077, normalizado a WebP 512×512.
- Se descartaron dos candidatos del mismo lote por no aportar contexto suficiente para demostrar la identidad futbolística. El asset de Diop quedó aprobado con licencia, evidencia, atribución y alcance registrados.
- Auditoría posterior: **739/825 = 89,58%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **86** expedientes pendientes. El total de assets legales de retrato es **1.651**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retrato Commons: Itay Shechter — 2026-09-12

- **Itay Shechter** (`pl:player:4660`): [File:Itay Shechter Haifa.JPG](https://commons.wikimedia.org/wiki/File:Itay_Shechter_Haifa.JPG), obra de **Botend**, licencia **CC BY-SA 4.0**. Retrato frontal individual nítido; original 2.292×2.962, normalizado a WebP 512×512.
- Se descartaron dos fotografías del mismo jugador por distancia/encuadre insuficiente. El asset aprobado conserva licencia, evidencia, atribución, ShareAlike y alcance; no se duplicó por ranking.
- Auditoría posterior: **740/825 = 89,70%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **85** expedientes pendientes. El total de assets legales de retrato es **1.652**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: Morten Konradsen y Peter Olayinka — 2026-09-12

- **Morten Konradsen** (`api-football:player:39067`): [File:Morten Konradsen.jpg](https://commons.wikimedia.org/wiki/File:Morten_Konradsen.jpg), obra de **Вячеслав Евдокимов**, licencia **CC BY-SA 3.0**. Rostro claramente identificable en acción; original 611×868, normalizado a WebP 512×512.
- **Peter Olayinka** (`api-football:player:1249`): [File:Peter Olayinka, FCB-SLAVIA 30092018.jpg](https://commons.wikimedia.org/wiki/File:Peter_Olayinka,_FCB-SLAVIA_30092018.jpg), obra de **Tadeáš Bednarz**, licencia **CC BY-SA 4.0**. Perfil lateral nítido y plenamente identificable; original 943×1.446, normalizado a WebP 512×512.
- Ambos assets quedaron aprobados como retratos principales con licencia, evidencia, atribución, ShareAlike y alcance registrados. No se duplicaron por ranking.
- Auditoría posterior: **738/825 = 89,45%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **87** expedientes pendientes. El total de assets legales de retrato es **1.650**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Verificación puntual de Balón de Oro — 2026-09-12

La tabla `awards` contiene el palmarés masculino de **2024 — Rodri** y **2025 — Ousmane Dembélé**, ambos con la fuente oficial [France Football](https://www.francefootball.fr/ballon-d-or/palmares/). La categoría `ballon-dor-wins` los incluye también en su snapshot activo.

## Corte operativo actual y revisión de títulos globales — 2026-09-12

- Se aprobaron dos retratos adicionales tras revisión visual y de licencia: **Jakub Považanec** (`statbunker:uefa-conference:player:54501`), [File:Jakub Považanec Jablonec-Ostrava.jpg](https://commons.wikimedia.org/wiki/File:Jakub_Pova%C5%BEanec_Jablonec-Ostrava.jpg), y **Daniel Holzer** (`statbunker:uefa-conference:player:54570`), [File:Daniel Holzer, FCB-SLAVIA 30092018.jpg](https://commons.wikimedia.org/wiki/File:Daniel_Holzer,_FCB-SLAVIA_30092018.jpg). Ambos constan en Commons bajo **CC BY-SA 4.0**, con atribución, evidencia, ShareAlike y alcance de uso registrados; fueron normalizados a WebP 512×512.
- Auditoría actual: **742/825 = 89,94%** de personas jugables únicas ranqueadas tienen retrato legal principal; quedan **83**. Hay **1.654 assets legales de retrato**, cifra que no equivale al denominador jugable porque incluye assets de entidades no activas y assets adicionales.
- Datos estadísticos: **59/109 = 54,1%** de categorías están completas y validadas. Tamaño mínimo: **101/109 = 92,7%**. Escudos de clubes con expediente marcario publicable: **0/233**.
- La categoría `club-global-titles` sigue correctamente en estado provisional: el snapshot tiene 200 filas, pero no es un palmarés mundial completo. La revisión confirmó que faltan, entre otras, competiciones AFC, CAF, Concacaf, OFC, Recopa Sudamericana, Copa Intercontinental y más ligas/copas nacionales. No se promocionó a completa.

## Aprobación de retrato Commons: Leonardo (Leo) Franco — 2026-09-12

- **Leonardo Noerén Franco Ansío** (`bdfutbol:la-liga:player:1ae26cb28d1ffab3c5a9fb65`): [File:Leo Franco by Bruno Castro 2018.jpg](https://commons.wikimedia.org/wiki/File:Leo_Franco_by_Bruno_Castro_2018.jpg), obra de **Bruno Castro**, licencia **CC BY-SA 4.0**. La descripción de Commons identifica a Leonardo Franco en Chile en 2008; el retrato es frontal, individual y nítido. Original 1.150×1.566, normalizado a WebP 512×512.
- El asset quedó aprobado como retrato principal con atribución, ShareAlike, evidencia y alcance registrados. Se dejó anotada revisión de identidad por ser una fotografía fuera del terreno de juego; no se creó duplicado por ranking.
- Auditoría posterior: **743/825 = 90,06%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **82** expedientes pendientes. El total de assets legales de retrato es **1.655**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Aprobación de retratos Commons: Neno y José Francisco Molina — 2026-09-12

- **Adelino Augusto Graça Barbosa Barros (Neno)** (`bdfutbol:primeira-liga:player:cd9d498a20c29b68ab8547c8`): [File:Neno.JPG](https://commons.wikimedia.org/wiki/File:Neno.JPG), obra de **Dmitry Parshin**, licencia **CC BY-SA 1.0**. La ficha identifica a Neno en el Legends Cup 2011; imagen individual con rostro identificable. Original 514×650, normalizado a WebP 512×512.
- **José Francisco Molina Jiménez** (`bdfutbol:la-liga:player:fa492f620c57c5624a6ce1dd`): [File:Jose Francisco Molina 29abr2007.jpg](https://commons.wikimedia.org/wiki/File:Jose_Francisco_Molina_29abr2007.jpg), obra de **Darz Mol**, licencia **CC BY-SA 2.5 es**. La ficha identifica al jugador como portero del Levante; perfil lateral individual y rostro identificable. Original 525×675, normalizado a WebP 512×512.
- Ambos assets quedaron aprobados como retratos principales con atribución, ShareAlike, evidencia y alcance registrados. Se documenta que la resolución original es justa; no se crearon duplicados por ranking.
- Se descartaron los candidatos de André Castro y Ömer Ali Şahiner por nitidez insuficiente, pese a disponer de licencias compatibles.
- Auditoría posterior: **745/825 = 90,30%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **80** expedientes pendientes. El total de assets legales de retrato es **1.657**. Las categorías permanecen en **59/109 completamente validadas (54,1%)**, **101/109 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Incorporación de palmarés oficial Concacaf — 2026-09-12

- Se añadió al catálogo la competición **Concacaf Champions Cup / Champions League** y su categoría cerrada `concacaf-champions-cup-club-titles`.
- Se importaron **30 clubes campeones** y sus títulos hasta 2025 desde el registro oficial de Concacaf. El snapshot queda validado y en `draft` por revisión de derechos de datos; no se publica automáticamente.
- Las entidades nuevas no se marcaron jugables ni se les asignaron escudos: primero deben resolverse identidad, perfil de juego y licencia marcaria. Por tanto, esta importación no infla la cobertura visual.
- Auditoría posterior: **60/110 = 54,5%** de categorías completas; **102/110 = 92,7%** con tamaño suficiente. Retratos: **745/825 = 90,30%**; escudos de clubes publicables: **0/233**.

## Aprobación de retrato Commons: Aleksandar Čavrić — 2026-09-12

- **Aleksandar Čavrić** (`statbunker:uefa-conference:player:56058`): [File:Zen-Slovan (9).jpg](https://commons.wikimedia.org/wiki/File:Zen-Slovan_(9).jpg), obra de **Вячеслав Евдокимов**, licencia **CC BY-SA 3.0**. La ficha identifica el partido Zenit–Slovan; Čavrić aparece con el dorsal 44, rostro visible y claramente reconocible. Original 1.600×1.021; se recortó para centrarlo y se normalizó a WebP 512×512.
- El asset quedó aprobado como retrato principal con atribución, ShareAlike, evidencia y alcance registrados. El primer archivo del mismo jugador (433 px de ancho) se descartó por no cumplir el mínimo técnico.
- Auditoría posterior: **746/825 = 90,42%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **79** expedientes pendientes. El total de assets legales de retrato es **1.658**. Las categorías permanecen en **60/110 completamente validadas (54,5%)**, **102/110 con tamaño mínimo (92,7%)** y los escudos de clubes en **0/233**.

## Incorporación de palmarés oficial CAF — 2026-09-12

- Se añadió la competición **CAF Champions League / African Cup of Champions Clubs** y su categoría cerrada `caf-champions-league-club-titles`.
- Se importaron **29 clubes y 62 títulos** correspondientes a las ediciones 1964–2025 desde el listado oficial de CAF. El snapshot queda validado, cerrado y en `draft` por revisión de derechos de datos.
- Las entidades que todavía no tienen una identidad canónica previa no se marcaron jugables ni recibieron escudos automáticamente; se conservaron como evidencia para la reconciliación mundial posterior.
- Auditoría posterior: **61/111 = 55,0%** de categorías completas; **103/111 = 92,8%** con tamaño suficiente. Retratos: **746/825 = 90,42%**; escudos de clubes publicables: **0/233**.

## Incorporación de palmarés oficial OFC — 2026-09-12

- Se añadió la competición **OFC Men’s Champions League / OFC Club Championship** y su categoría cerrada `ofc-champions-league-club-titles`.
- Se importaron **9 clubes y 23 títulos** de las ediciones disputadas 1987–2026 desde el historial oficial de OFC; las temporadas 2020 y 2021, cancelada y no disputada por COVID-19, no se contaron. [Historial oficial](https://www.oceaniafootball.com/history-ofc-mens-champions-league/)
- Las entidades no se marcaron jugables ni recibieron escudos automáticamente; quedan pendientes la reconciliación de identidad y la licencia marcaria.
- Auditoría posterior: **62/112 = 55,4%** de categorías completas; **104/112 = 92,9%** con tamaño suficiente. Retratos: **746/825 = 90,42%**; escudos de clubes publicables: **0/233**.

## Control canónico vigente — no mezclar métricas — 2026-09-12

- **Retratos del conjunto jugable:** **746/825 = 90,42%**. Es el porcentaje visual válido: personas únicas que aparecen en rankings activos, con un único retrato principal legal por persona. Quedan 79.
- **Categorías con datos validados:** **62/112 = 55,4%**. Exige cobertura validada y 200 entradas reales o universo cerrado completo.
- **Categorías con tamaño mínimo:** **104/112 = 92,9%**. Solo indica que el snapshot tiene el tamaño mínimo; no demuestra que el histórico sea exhaustivo ni que los derechos estén aprobados.
- **Escudos de clubes publicables:** **0/233**. Las banderas nacionales aprobadas no se mezclan con los escudos de clubes.
- **Porcentaje global del proyecto:** no se calcula. No es correcto promediar retratos, categorías, escudos y licencias porque miden unidades y riesgos distintos.
- Los bloques anteriores son historial de auditorías y pueden contener denominadores antiguos; este bloque y la salida actual de `audit:data-readiness` son la referencia vigente.

## Incorporación del palmarés oficial AFC — 2026-09-12

- Se añadió la competición **AFC Champions League / Asian Club Championship** y la categoría cerrada `afc-champions-league-club-titles`.
- Se importaron **25 clubes y 44 títulos** de todas las ediciones disputadas entre 1967 y 2026. Se usaron el historial oficial AFC 1967–2014, la guía oficial AFC 2022 para 2015–2021 y los archivos/reseñas oficiales AFC para 2022–2026. Las denominaciones históricas Taj/Esteghlal se consolidaron como el mismo club.
- El snapshot `rs_34402de2f1182fdf87803124` queda validado como universo cerrado, pero en `draft` mientras se revisan derechos de redistribución. No se promocionó automáticamente a publicación ni se asignaron escudos.
- Auditoría posterior: **63/113 = 55,8%** de categorías completas; **105/113 = 92,9%** con tamaño suficiente. Retratos: **746/825 = 90,42%**; escudos de clubes publicables: **0/233**.

## Aprobación de retratos Commons: Damien Grégorini y Roberto Abbondanzieri — 2026-09-12

- **Damien Grégorini** (`bdfutbol:ligue-1:player:0f2a564727609b9d8b73e2af`): [File:Damien gregorini 2.JPG](https://commons.wikimedia.org/wiki/File:Damien_gregorini_2.JPG), obra de S. Plaine bajo **CC BY-SA 3.0**. Retrato individual nítido; original 922×1.293, normalizado a WebP 512×512 con ShareAlike registrado.
- **Roberto Abbondanzieri** (`bdfutbol:la-liga:player:d596c00b30fb8bf96f32be2b`): [File:Roberto Abbondanzieri (cropped).jpg](https://commons.wikimedia.org/wiki/File:Roberto_Abbondanzieri_(cropped).jpg), bajo **CC BY 2.0**. Retrato individual claro; original 582×882, normalizado a WebP 512×512.
- Ambos assets quedaron aprobados como retratos principales con atribución, evidencia de licencia y alcance de uso registrados. No se crearon duplicados.
- Auditoría posterior: **748/825 = 90,67%** de jugadores jugables únicos ranqueados con retrato legal principal; quedan **77**. El total de assets legales de retrato es **1.660**. Las categorías permanecen en **63/113 completas (55,8%)**, **105/113 con tamaño mínimo (92,9%)** y los escudos de clubes en **0/233**.

## Barrido de retratos jugables pendientes — 2026-09-12

- Se habilitó el script reproducible `media:discover:playable:range`, que faltaba en `package.json`, y se recorrieron los tramos prioritarios 1–20, 21–40, 41–60 y 61–80 (77 jugadores pendientes actuales).
- Los manifiestos quedaron archivados en `backend/storage/media-candidates/` y no se registraron candidatos automáticamente.
- Solo apareció un candidato nuevo para Núrio Fortuna, pero fue descartado por resolución original insuficiente (245×304). Los restantes no devolvieron un retrato Commons inequívoco y publicable.
- La cobertura no se infla con candidatos dudosos: se mantiene **748/825 = 90,67%**, con **77** expedientes pendientes.

## Investigación no importada: goles históricos del Mundial — 2026-09-12

- Se añadió un adaptador paginado para la tabla histórica de Transfermarkt y una validación que exige 200 filas, IDs únicos, orden descendente y anclaje del líder antes de importar.
- La consulta quedó abortada por respuestas temporales 408/429 durante la paginación. No se creó ni activó un snapshot nuevo.
- RSSSF publica actualmente un top-100 para esta tabla y World Football Database expone solo 15 entradas; ninguna de esas dos fuentes prueba el top 200 requerido. Se mantiene el snapshot anterior provisional hasta disponer de una fuente estable con 200 filas reales.

## Refresco de asistencias históricas del Mundial — 2026-09-12

- Se ejecutó el importador de StatBunker y se archivó el snapshot `rs_abf315272b5cbd74d190132b`. El proceso agregó las páginas históricas de selecciones y obtuvo 200 jugadores reales, sin padding.
- El snapshot permanece provisional (`coverageComplete=false`): las asistencias históricas no tienen una definición homogénea para todas las ediciones y falta la validación metodológica cruzada antes de tratarlo como dato cerrado.
- No se incrementó artificialmente el porcentaje de categorías completas.

## Lote de retratos API-Football en revisión — 2026-09-12

- Se procesó el conjunto de jugadores jugables pendientes mediante resolución exacta TheSportsDB/API-Football: **27 retratos descargados y normalizados**, **49 sin identificador API-Football** y **3 conflictos de identidad**.
- Los 27 activos están registrados como `pending`, no como aprobados. La documentación contractual de API-Football indica que no concede por sí misma una licencia de publicación y que pueden existir derechos de terceros; por ello no se cuentan en la cobertura legal hasta obtener una autorización compatible o sustituirlos por una fuente con licencia verificable.
- Los conflictos no se fusionaron automáticamente y las 49 entidades sin ID quedan para búsqueda histórica específica.
- El auditor se amplió para separar estados: actualmente hay **748/825** jugadores con retrato legal aprobado, **237/825** con algún retrato local pendiente y **77/825** sin retrato legal aprobado. Los pendientes no se incluyen en el porcentaje legal.

## Auditoría de licencia de escudos prioritarios — 2026-09-12

- Se revisaron los 25 clubes prioritarios del ranking global de títulos y/o con más presencia en rankings activos, usando sus páginas oficiales de términos, marca y contacto.
- Resultado: **0/25** tienen una licencia abierta confirmada que permita reutilizar el escudo en un juego o aplicación comercial. Real Madrid y FC Porto sí muestran estructuras de licensing comercial, pero eso no constituye autorización para Rango 90.
- Los SVG disponibles en Wikimedia Commons no se consideran permiso suficiente: la licencia del archivo puede cubrir el copyright del dibujo, pero no necesariamente las marcas, emblemas, denominaciones o derechos comerciales del club.
- Todos los escudos permanecen en estado **permiso pendiente** hasta obtener autorización escrita que cubra web/PWA, Android, iOS, CDN y almacenamiento local. No se descargaron ni registraron escudos en PostgreSQL.
- Auditoría vigente: **748/825 = 90,67%** de jugadores jugables únicos con retrato legal; **63/113 = 55,8%** de categorías completas; **105/113 = 92,9%** con tamaño mínimo; **0/233** escudos publicables.

## Corrección y cierre verificable de goles internacionales RSSSF — 2026-09-12

- Se revisó exclusivamente `national-team-official-goals` contra la tabla [RSSSF de goles internacionales](https://www.rsssf.org/miscellaneous/century.html). La página declara un universo completo de jugadores con **30 o más goles** y fecha de actualización **1 de enero de 2026**.
- El parser anterior omitía enlaces con etiquetas HTML en mayúsculas, enlaces anidados y filas sin enlace de jugador. Eso desplazaba el top 200 real: terminaba en Hristo Stoichkov en vez de incluir correctamente a Riyad Mahrez.
- El parser corregido reconoce las 370 filas estadísticas publicadas, incluye las filas sin enlace mediante un identificador determinista `name-country:*`, conserva los IDs relativos de las páginas RSSSF y aborta si una fila con métrica no es parseable.
- Se validan antes de importar: **200 filas reales**, 200 IDs externos/fallback únicos, 200 claves de identidad únicas, orden no creciente de goles, rangos RSSSF coherentes con empates y filas marcadas `-.` como no numeradas.
- La definición queda explicitada: «oficial» en esta categoría significa reconocido por RSSSF dentro de su tabla internacional; incluye partidos competitivos y amistosos que RSSSF contabiliza y conserva sus excepciones históricas, incluidos casos de selecciones amateurs. No se presenta como una definición FIFA universal.
- Se importó el snapshot corregido `src_434fac9721719cf9d2de594d` y el ranking `rs_cd4577ed2865998477c96769`. PostgreSQL verifica **200 entradas**, **200 entidades distintas**, rango máximo 200 y última fila **Riyad Mahrez**. Los snapshots anteriores no se borraron.

## Cierre de cobertura del top 200 — `bundesliga-assists` — 2026-09-12

- Se contrastó la página oficial de estadísticas de Bundesliga, que trabaja por temporada, y la tabla “all time” de StatBunker, que en la consulta actual solo expone 50 filas. Ninguna se utilizó para fabricar un top 200.
- La referencia histórica suficiente fue la **Ewige Vorlagengeberliste** de Transfermarkt para Bundesliga: [tabla histórica](https://www.transfermarkt.com/bundesliga/assistliste/wettbewerb/L1/saison_id/0/plus/). La importación real recorrió ocho páginas mediante `?page=N`, con 25 filas válidas por página, hasta el rango 200.
- El proveedor valida antes de importar: 200 filas reales, rangos de tabla e importación contiguos 1–200, IDs de jugador y perfiles únicos, valores enteros positivos, orden descendente no creciente y ausencia de repetición de páginas. La evidencia conserva los ocho SHA-256 de página, paginación, tamaño y filas observadas.
- El alcance queda explicitado en catálogo como Bundesliga masculina desde **1963/64** hasta la temporada vigente. La definición no se mezcla con API-Football: se conserva exactamente la columna histórica de asistencias de Transfermarkt y se documenta que puede diferir de Opta u otros proveedores.
- Se importó el snapshot `src_e26a5bfda245b9425c8b8da4` y el ranking `rs_8a9a007ea9fac888e4eb0bba`. PostgreSQL verifica: estado **`draft`**, `coverage_complete=true`, **200 filas**, **200 entidades distintas**, rangos fuente 1–200, 200 rangos distintos y 0 rangos fuente duplicados.
- Los derechos permanecen separados de la cobertura: `source.key=transfermarkt-bundesliga-assists`, `source.rightsStatus=review_required`, `reviewed=false`. No se publica ni se aprueba automáticamente hasta resolver la licencia de redistribución.
- Comandos ejecutados: `npm run --silent seed`, `npm run --silent import:bundesliga:assists`, `npm test`, `npm run --silent build` y `git diff --check`; todos terminaron correctamente. Test específico: `npx tsx src/tests/bundesliga-assists.test.ts`.

## Consolidación segura y optimizada de identidades API-Football — 2026-09-12

- El primer intento global se detuvo antes de aplicar cambios al detectar que pretendía recorrer **60.200 entidades** archivales. Se corrigió el alcance para procesar únicamente entidades API-Football activas presentes en rankings o perfiles jugables.
- La consolidación protegida enlazó **123 jugadores** y movió **2.428 estadísticas**, **4.560 posiciones de ranking**, **165 activos**, **4.860 hechos** y **27 perfiles**. Se saltaron **3.677** entidades no inequívocas y se dejó **1 conflicto** de estadísticas/ranking sin fusionar.
- Se añadió caché del catálogo de candidatos y savepoints por identidad: una colisión no aborta todo el lote ni deja enlaces parciales.
- La reparación posterior compactó **4.090 enlaces** y dejó **23 conflictos explícitos** sin fusionar. La auditoría confirma **0 cadenas de identidad**.
- Estado canónico posterior: **64/113 = 56,6%** de categorías completas; **105/113 = 92,9%** con tamaño mínimo; **749/826 = 90,68%** de jugadores jugables únicos con retrato legal aprobado; **77** sin retrato legal aprobado; **0/233** escudos de clubes publicables.

## Investigación y bloqueo documentado — `world-cup-red_cards` — 2026-09-12

- El snapshot actual `src_e461a5bb0520b8343bef1c15.json` conserva **51 jugadores con valor positivo**, con **`coverageComplete=false`**. Su ventana API-Football es **1994–2025** y, por tanto, no demuestra el universo histórico completo de las fases finales del Mundial masculino.
- La tabla histórica pública de [StatBunker](https://betl.statbunker.com/alltimestats/AllTimeRedCards?comp_code=WC) muestra **50 filas** y no declara en la propia página que ese listado sea el universo completo. No se puede convertir ese límite de presentación en una certificación de exhaustividad.
- La referencia independiente de [Opta Analyst / Stats Perform](https://theanalyst.com/articles/most-red-cards-in-world-cup-history) afirma **190 jugadores** expulsados y que solo Rigobert Song y Zinedine Zidane fueron expulsados dos veces. Es una comprobación de magnitud, no una tabla histórica completa reutilizable.
- La [lista secundaria de incidentes](https://en.wikipedia.org/wiki/List_of_FIFA_World_Cup_red_cards) declara cubrir todas las expulsiones y permite contar **192 expulsiones de jugadores y 190 jugadores distintos** en la versión consultada, incluyendo 2026. Sirve como pista de reconciliación, pero no se adopta como certificación primaria FIFA ni como base suficiente para publicar el ranking.
- Resultado: **no existe todavía evidencia primaria o proveedor histórico contrastado que certifique el universo cerrado** con el alcance definido para Rango 90. No se han añadido filas de relleno, no se ha importado un snapshot nuevo y **no se ha cambiado `coverageComplete` ni el catálogo**. La categoría permanece provisional con 51 entradas positivas.
- Condición para cerrar el bloque: obtener una tabla completa de FIFA/archivo oficial de actas, o una extracción reproducible de proveedor que cubra todas las ediciones y reconcilie exactamente **192 expulsiones / 190 jugadores** (o documente una diferencia de alcance, especialmente 2026), antes de marcar universo cerrado.

## Cierre de cobertura del top 200 — asistencias históricas de Ligue 1, Primeira Liga y Serie A — 2026-09-12

- Se usó la tabla histórica **Ewige Vorlagengeberliste** de Transfermarkt, separando cada competición y sin combinar temporadas ni proveedores: [Ligue 1](https://www.transfermarkt.com/ligue-1/assistliste/wettbewerb/FR1/saison_id/0/plus/), [Primeira Liga](https://www.transfermarkt.com/primeira-liga/assistliste/wettbewerb/PO1/saison_id/0/plus/) y [Serie A](https://www.transfermarkt.com/serie-a/assistliste/wettbewerb/IT1/saison_id/0/plus/).
- Cada importación real recorrió ocho páginas de 25 filas válidas y verificó antes de guardar: selector histórico `saison_id=0`, temporada inicial acreditada por la fuente (Ligue 1 **1932/33**, Primeira Liga **1934/35**, Serie A **1929/30**), rangos continuos 1–200, IDs y perfiles únicos, valores positivos y orden descendente no creciente.
- Snapshots y resultado verificable en PostgreSQL: `ligue-1-assists` → `rs_4f99825c5d02bf0a3b4a0867`, `primeira-liga-assists` → `rs_4440332f207ca5b4f7609292`, `serie-a-assists` → `rs_5126896c6e0acdfea4bf2d72`; los tres tienen **200 entradas**, **200 entidades distintas**, `coverage_complete=true`, `unresolved_conflicts=0` y permanecen en `draft` por derechos pendientes.
- Se añadió consolidación de identidades específica para las tres fuentes y se verificó que no quedan cadenas de identidad.
- La columna de asistencias se conserva tal como la publica Transfermarkt; no se presenta como una definición universal de Opta/FIFA. `rights_status=review_required` sigue siendo un gate independiente y no se ha publicado ningún dato sin licencia resuelta.
- Auditoría posterior en reposo: **68/113 = 60,2%** de categorías con cobertura validada; **105/113 = 92,9%** con tamaño mínimo; retratos legales **749/825 = 90,79%**; escudos de clubes publicables **0/233**.

## Aprobación de retratos Commons: Bruno Martini e Ivano Bordon — 2026-09-12

- **Bruno Martini** (`bdfutbol:ligue-1:player:de729774f5c53805f69b175b`): [File:Bruno Martini football Juillet 2015 Grammont.jpg](https://commons.wikimedia.org/wiki/File:Bruno_Martini_football_Juillet_2015_Grammont.jpg), licencia **CC BY-SA 4.0**. Se conserva atribución y se aceptó explícitamente ShareAlike; el derivado está normalizado a WebP 512×512.
- **Ivano Bordon** (`bdfutbol:serie-a:player:5a5a04e00c160d820863d39d`): [File:Inter Milan 1970-1971 Ivano Bordon.jpg](https://commons.wikimedia.org/wiki/File:Inter_Milan_1970-1971_Ivano_Bordon.jpg), identificado en Commons como **Public domain**; derivado normalizado a WebP 512×512.
- Ambos quedaron aprobados como retrato principal único con `rights_verified_at`, evidencia de licencia, alcance web/PWA/Android/iOS/CDN/local y revisión registrada. No se aprobaron las coincidencias homónimas ni archivos grupales ambiguos.
- Auditoría posterior: **751/825 = 91,03%** de jugadores jugables únicos ranqueados con retrato legal; quedan **74**. Assets de retrato legales: **1.662**. Categorías completas: **68/113 = 60,2%**; escudos de clubes publicables: **0/233**.

## Aprobación de retrato Commons: Alexander González Garcés — 2026-09-12

- **Alexander González Garcés** (`statbunker:uefa-conference:player:37784`): [File:Alexander González Garces.jpg](https://commons.wikimedia.org/wiki/File:Alexander_Gonz%C3%A1lez_Garces.jpg), licencia **CC BY 4.0**. La propia ficha identifica al futbolista como “Alexander González Garces in 2012”, acredita a Robin Glover e incluye permiso VRTS; el archivo fue revisado visualmente y normalizado a WebP 512×512.
- Se aprobó como retrato principal único con atribución, evidencia de licencia y alcance de uso registrados. No se aprobaron las coincidencias de homónimos ni las imágenes que no mostraban inequívocamente al jugador.
- Auditoría posterior: **752/825 = 91,15%** de jugadores jugables únicos ranqueados con retrato legal; quedan **73**. Assets de retrato legales: **1.663**. Categorías completas: **68/113 = 60,2%**; escudos de clubes publicables: **0/233**.

## Cierre de los rankings globales de la Eurocopa — 2026-09-12

- Se sustituyó el agregado que dependía de snapshots antiguos por una descarga directa del servicio histórico oficial de UEFA. El nuevo comando `npm run --silent import:uefa-euro:global` consulta las **17 ediciones de fase final (1960–2024)** para cada métrica.
- Se importaron **200/200 jugadores reales** para `euro-goals` (`rs_74f6d91fe5ab6e804f653ba0`) y `euro-assists` (`rs_98952f7bbabf9202254141b1`), agrupando únicamente por el ID oficial de jugador y sumando los valores positivos de cada edición. No se usa padding: una edición con menos de 200 jugadores aporta todas sus filas disponibles y el top global se forma después de sumar las 17 ediciones.
- La evidencia de cada entrada conserva las ediciones, rangos componentes, URLs/API de las 17 consultas y el número de filas devueltas por cada edición. Se añadió una prueba que exige las 17 ediciones, 200 IDs únicos y valores agregados reproducibles.
- `coverage_complete=true`, `unresolved_conflicts=0` y estado `draft`; los derechos de redistribución de estadísticas e imágenes oficiales UEFA siguen siendo `review_required`, por lo que no se publica automáticamente.
- Auditoría posterior: **70/113 = 61,9%** de categorías con cobertura validada; **105/113 = 92,9%** con tamaño mínimo; retratos legales **752/825 = 91,15%**; escudos de clubes publicables **0/233**.

## Lote de retratos Commons: Roberto Soldado — 2026-09-12

- Se aprobó el retrato único de **Roberto Soldado** (`api-football:player:1375`): [File:Roberto Soldado (2).jpg](https://commons.wikimedia.org/wiki/File:Roberto_Soldado_(2).jpg), licencia **CC BY-SA 2.0**.
- El original se revisó visualmente, se normalizó a **WebP 512×512** y se registró con atribución, ShareAlike y evidencia de derechos. El retrato API-Football alternativo permanece pendiente y no se cuenta.
- Las otras nueve entidades del lote no se aprobaron: las coincidencias disponibles fallaron por resolución, imagen grupal o identidad/licencia insuficientemente verificable. No se forzó ninguna aprobación.
- Auditoría inmediata: **753/825 = 91,27%** de jugadores jugables únicos ranqueados con retrato legal; **72** siguen sin retrato legal aprobado; **1.664** assets de retrato legales registrados. La cobertura de categorías se mantiene en **70/113 = 61,9%** y los escudos de clubes publicables en **0/233**.

## Sustitución segura de tarjetas amarillas de la Eurocopa — 2026-09-12

- Se añadió el servicio histórico oficial de UEFA como fuente específica para `euro-yellow_cards`, consultando las **17 ediciones de fase final de 1960 a 2024** y agrupando por ID oficial de jugador.
- El snapshot `rs_d498b102843bfc917bb1ecd0` contiene **200 jugadores reales**, sin padding, con la evidencia de cada edición y sus URLs. UEFA no devuelve bloque de tarjetas para **1960, 1964 y 1968**; esas ausencias se conservan como “datos no expuestos”, nunca como cero.
- Por ese motivo `coverage_complete=false`: la fuente oficial mejora la procedencia frente al snapshot anterior de StatBunker, pero no permite afirmar todavía el histórico completo. El snapshot sigue en `draft` y con `rights_status=review_required`.
- La importación corrigió también el CLI para mostrar la cobertura real del snapshot, en lugar de informar erróneamente `true` de forma fija. Pruebas, compilación y validador de evidencia pasan.

## Corrección de duplicado de identidad: Roberto Soldado — 2026-09-12

- La auditoría posterior detectó que el lote de medios había aprobado el mismo archivo de Commons dos veces: una bajo `api-football:player:1375` y otra bajo `bdfutbol:la-liga:player:e694f06d956a426228a19925`.
- Se añadió el enlace explícito API-Football → BDFútbol, se ejecutó la consolidación protegida y se dejó un único retrato aprobado/principal en el registro canónico. El duplicado se conserva como evidencia de importación, pero queda rechazado y fuera de cobertura.
- La reparación posterior dejó **0 cadenas de identidad**. La auditoría estable permanece en **753/825 = 91,27%** de jugadores jugables únicos con retrato legal, **72** pendientes, **1.663** assets legales y **0/233** escudos de clubes publicables.

## Actualización del Balón de Oro — 2026-09-12

- Se volvió a ejecutar el importador contra el palmarés oficial de France Football. El snapshot se mantiene reproducible (`rs_206273c3f213e5289a748e49`) y ahora conserva también los ganadores de **2024: Rodri** y **2025: Ousmane Dembélé**.
- PostgreSQL verifica **69 premios anuales desde 1956 hasta 2025** y **47 jugadores ganadores únicos**. La categoría sigue `coverage_complete=true`, en `draft` por la revisión independiente de derechos de redistribución.
- Se añadió `backend/src/tests/france-football.test.ts`, una prueba de regresión que exige conservar los años 2024 y 2025 y que pasa junto con toda la suite y la compilación.

## Reemplazo de `world-cup-goals` por tabla histórica de Transfermarkt — 2026-09-12

- La tabla RSSSF se probó como alternativa, pero la página actual solo devolvió **174 filas** bajo su umbral publicado; el importador abortó sin modificar PostgreSQL.
- La tabla histórica de goleadores de Transfermarkt sí pasó la validación completa: snapshot `rs_7cc0d9cf795a275b93106c43`, **200 entradas**, **200 jugadores únicos**, valores positivos, ancla de **Kylian Mbappé = 22** y orden/rangos válidos (los empates explican que la última posición sea 176).
- `world-cup-goals` ahora selecciona ese snapshot como fuente operativa, con `coverage_complete=true`, `unresolved_conflicts=0` y `rights_status=review_required`. No se publica hasta resolver los derechos de redistribución.

## Sustitución de goles históricos UEFA Cup / Europa League y enriquecimiento visual — 2026-09-12

- Se importó la tabla histórica de goleadores de Transfermarkt para el continuo **UEFA Cup / Europa League** mediante `npm run --silent import:uefa-cup-europa-league:goals`.
- El snapshot operativo es `rs_42a1ca7f79c3c4685cb39c45`: **200 entradas**, **200 entidades únicas**, `coverage_complete=true`, `unresolved_conflicts=0`, estado `draft` y `rights_status=review_required`. Se conserva como una sola categoría unificada, sin duplicar UEFA Cup y Europa League.
- Se ejecutó el descubrimiento Commons sobre los **72 jugadores jugables ranqueados sin retrato legal aprobado**. El manifiesto terminó completo para los 72; solo produjo un candidato y fue descartado para aprobación por resolución insuficiente (201 px de ancho). No se aprobó ninguna imagen dudosa.
- Se ejecutó el enriquecimiento exacto API-Football/TheSportsDB sobre ese mismo grupo: **26 retratos candidatos** fueron descargados y asociados a identidades, permaneciendo `pending`; **46** no obtuvieron identificador API-Football inequívoco y **3** devolvieron errores controlados. Los candidatos pendientes no se cuentan como cobertura legal.
- Auditoría posterior: **71/113 = 62,8%** de categorías con cobertura validada; **105/113 = 92,9%** con tamaño mínimo; retratos legales **751/823 = 91,25%** de jugadores jugables únicos ranqueados; **72** sin retrato legal aprobado; **0/233** escudos de clubes publicables. No existe un porcentaje global único aprobado para mezclar datos, imágenes, escudos y licencias.

## Consolidación multimedia Commons y resolución de IDs repetidos de clubes — 2026-09-13

- Se aprobaron **8 retratos Commons** adicionales tras revisión de identidad, resolución, licencia, atribución y normalización WebP 512×512. El total de retratos legales registrados asciende a **1.671**; la cobertura de jugadores jugables no se incrementa si el retrato ya existía bajo otro registro canónico.
- La búsqueda Commons del primer lote de escudos no encontró candidatos válidos. TheSportsDB devolvió candidatos visuales para varios clubes, pero sus activos permanecen `pending` y `rights_status=review_required`; no se cuentan como escudos publicables.
- Se corrigió `stageTheSportsDbBadge` para que, cuando el ID externo de TheSportsDB ya esté vinculado a otro registro, reutilice el canónico existente únicamente si el nombre exacto del equipo coincide. En la repetición se descargaron como pendientes los escudos de **Arsenal, Atalanta, Borussia Dortmund y Parma**, sin crear duplicados.
- La auditoría vigente tras esta tanda queda en **71/113 = 62,8%** de categorías completas, retratos legales **751/823 = 91,25%**, escudos de clubes publicables **0/233** y **0 cadenas de identidad**. La aprobación de los escudos sigue requiriendo licencia marcaria o permiso directo del club.

## Alias seguros para escudos TheSportsDB — 2026-09-13

- Se amplió el catálogo de alias de clubes con variantes inequívocas (por ejemplo, **AC Milan**, **Inter Milan**, **Athletic Bilbao**, **West Ham United**, **PSV Eindhoven** y **Shakhtar Donetsk**), manteniendo la coincidencia exacta y el rechazo de homónimos.
- La compilación pasó correctamente. La segunda pasada descargó **31 escudos adicionales** como activos `pending`; el total TheSportsDB de escudos candidatos quedó en **171**, todos sin autorización marcaria confirmada.
- Los candidatos pendientes se mantienen fuera de la cobertura publicable: un escudo Commons tampoco se aprueba solo por indicar Public Domain/CC0, porque la marca del club exige licencia del titular o permiso directo.
- La corrección fue validada sin cadenas nuevas de identidad: la auditoría mantiene **0 cadenas**, **0/233 escudos de clubes publicables** y los rankings sin alteraciones.

## Reparación de cadena de identidad detectada durante enriquecimiento de clubes — 2026-09-13

- La primera versión del flujo de medios seguía solo un salto de identidad. La auditoría detectó una cadena concreta (`api-football:club:48 → uefa:conference:club:1182863d8c6a2cdf4e9c77f5 → fa:club:west-ham-united`), que se reparó mediante `entity:repair-links`.
- El resolver de CLI ahora recorre hasta cinco saltos, detecta ciclos y rechaza cadenas excesivas. Tras la reparación, PostgreSQL verifica **0 cadenas**.
- Los intentos de consolidar clubes con rankings incompatibles se revierten completos mediante savepoints; no se mezclan posiciones ni valores. El perfil de clubes queda en **232 canónicos** por la fusión de un duplicado, con **702 posiciones de club** conservadas.
- `npm test` y `npm run --silent build` pasan después de la corrección.

## Cierre de `club-world-cup-goals` con Transfermarkt — 2026-09-13

- Se sustituyó el snapshot provisional API-Football de `club-world-cup-goals` por la tabla histórica de goleadores de Transfermarkt: `rs_6277dacedd1fb804060627c2`.
- PostgreSQL verifica **200 entradas**, **200 entidades únicas**, valores positivos, orden no creciente, `coverage_complete=true` y `unresolved_conflicts=0`. La fuente y el snapshot permanecen en `draft` con `rights_status=review_required`.
- Se añadió el comando reproducible `import:club-world-cup:goals` y la consolidación específica `entity:consolidate:transfermarkt:club-world-cup`.
- La consolidación enlazó **118 jugadores** con el catálogo canónico y movió sus rankings/hechos sin conflictos; **82** quedaron separados por falta de coincidencia inequívoca. La categoría tiene ahora **24 jugadores jugables**, todos con retrato en el snapshot actual.
- Auditoría posterior: **72/113 = 63,7%** de categorías completas; **106/113 = 93,8%** con tamaño mínimo; **0 cadenas** de identidad; escudos de clubes publicables **0/233**.

## Cierre estadístico de UEFA Conference League — 2026-09-13

- Se volvieron a importar las cinco ediciones completas disponibles de la UEFA Europa Conference League (**2021/22–2025/26**) desde StatBunker, agregando por ID de jugador y verificando un top 200 sin padding.
- `uefa-conference-league-goals` quedó en el snapshot `rs_e55ecc9ae7d481963ba2799c`: **200 entradas**, **200 entidades únicas**, `coverage_complete=true`.
- `uefa-conference-league-yellow_cards` quedó en el snapshot `rs_920830ca335b06474bb28c04`: **200 entradas**, **200 entidades únicas**, `coverage_complete=true`.
- Las asistencias (`uefa-conference-league-assists`) no se modificaron: el recorrido por páginas históricas falló por timeout en una página de club y el snapshot anterior sigue `coverage_complete=false`. No se convirtió un fallo de red en datos supuestamente completos.
- La cobertura estadística y los derechos permanecen separados: `statbunker-uefa-conference-league` sigue con `rights_status=review_required`, por lo que estos snapshots continúan en `draft` y no son publicables todavía.
- La consolidación de identidades no encontró enlaces nuevos ni conflictos; PostgreSQL mantiene **0 cadenas**.
- Auditoría posterior: **76/113 = 67,3%** de categorías completas; **106/113 = 93,8%** con tamaño mínimo; retratos legales **751/822 = 91,36%** de jugadores jugables únicos ranqueados; escudos de clubes publicables **0/232**.

## Recalibración del agregado de carrera API-Football — 2026-09-13

- Se reconstruyeron `club-career-goals`, `club-career-assists`, `club-career-yellow-cards` y `club-career-red-cards` con todas las temporadas realmente archivadas entre **2000 y 2026**, 200 jugadores por snapshot y exclusión explícita de selecciones nacionales.
- Los snapshots resultantes son `rs_849279c82cfe32f1b41921d4`, `rs_fb28c46595886ac0a64aaad1`, `rs_fa1f9351e35b1e06b5c9d569` y `rs_d3e1a2ac5d741eafb4dbf558`. Siguen `coverage_complete=false` de forma intencionada: el agregado no demuestra todavía la carrera completa anterior a 2000 ni todas las competiciones mundiales.
- Se probó además la temporada 1999 y 2000. API-Football devolvió respuestas vacías o solo unas pocas filas en varias ligas; esas limitaciones quedaron archivadas y no se interpretaron como ceros ni como cobertura histórica.
- Se amplió el script de sincronización para permitir años 1900–2100, pero la disponibilidad efectiva sigue determinada por la respuesta de la fuente. No se gastó cuota en imágenes durante esta ampliación.

## Ampliación de hechos de títulos de jugadores — 2026-09-13

- Se corrigió el clasificador de `/trophies`: antes retenía únicamente seis ligas domésticas; ahora conserva competiciones sénior reconocibles, normaliza equivalencias (por ejemplo, Champions League, Libertadores y Copa América) y descarta registros juveniles, reservas y exhibiciones.
- La segunda descarga controlada consultó **708 IDs**, sin errores de cuota, y archivó **5.681 hechos Winner**. El ranking `player-career-titles` se reconstruyó en `rs_28b21e05b9a7be56de27176a` con **200 jugadores positivos**.
- El snapshot continúa `coverage_complete=false`: API-Football no demuestra por sí sola participación efectiva del jugador en cada título ni cobertura mundial completa. Los hechos quedan como evidencia de trabajo, no como datos publicables definitivos.

## Auditoría de cierre de esta tanda — 2026-09-13

- Tras incorporar el ranking de títulos, el universo ranqueado jugable pasó de **822 a 827 personas únicas**; no son retratos duplicados: son cinco jugadores que ahora aparecen en una categoría activa adicional.
- La cobertura visual canónica queda en **756/827 = 91,41%**, con **71** personas aún sin retrato legal aprobado. Los activos alternativos, candidatos pendientes y registros de entidades no jugables siguen excluidos del cálculo.
- La cobertura estadística validada queda en **76/113 = 67,3%**; **106/113 = 93,8%** ya tienen 200 entradas. La ampliación de títulos mejora la evidencia, pero no eleva artificialmente el porcentaje porque el snapshot sigue sin cobertura histórica mundial/participación verificada.
- Escudos de clubes publicables: **0/232**. Cadenas de identidad: **0**. Compilación, tests y `git diff --check`: correctos.

## Importación completa de temporadas API-Football para UEFA Conference League — 2026-09-13

- Se archivaron desde el endpoint paginado de jugadores de API-Football las cinco temporadas del alcance cerrado de la competición: **2021, 2022, 2023, 2024 y 2025**. Cada respuesta terminó con `complete=true`, sin anomalías de validación y sin descargar medios.
- Filas importadas por temporada: **5.015**, **4.911**, **5.223**, **5.080** y **2.135**, respectivamente. La base conserva el snapshot de cada temporada y sus páginas de origen.
- La agregación validada de goles y amarillas cumple las cinco temporadas, no contiene nulos en la métrica, produce más de 200 jugadores positivos y queda en `coverage_complete=true`: goles `rs_f647ce7eaba514894d250e6f` y amarillas `rs_db28bc0c287957f686817363`.
- Las asistencias se conservan como `coverage_complete=false`: API-Football deja sin informar la columna histórica en buena parte de las filas antiguas, por lo que no se interpreta un nulo como cero ni como asistencia desconocida resuelta.
- La importación no autoriza por sí sola la redistribución: `api-football` sigue en `review_required`, todos los snapshots permanecen en `draft` y no se han contado como publicables.
- Auditoría posterior: **76/113 = 67,3%** de categorías con cobertura validada; **106/113 = 93,8%** con 200 entradas; retratos legales de jugadores jugables únicos **607/649 = 93,53%**; escudos de clubes publicables **0/232**; cadenas de identidad **0**.

## Estado multimedia posterior — 2026-09-13

- Se revisaron los **42** jugadores que el auditor identifica ahora como jugables, ranqueados y sin retrato legal principal. Commons no produjo un archivo nuevo que superara simultáneamente identidad, licencia y resolución; los dos candidatos encontrados eran archivos inferiores a 512 px en algún lado. Openverse respondió con **401/429** en el acceso anónimo y no generó activos.
- Se procesó el primer lote de **50 clubes** para buscar escudos Commons. El manifiesto terminó completo y encontró cuatro candidatos textuales; se descartaron los homónimos y solo se dejaron como activos `pending` dos archivos visualmente correctos de Atalanta y Bologna, ambos sin aprobación marcaria.
- El activo Atalanta quedó en `img_2bd1e77061a5af185831348a`, y el de Bologna en `img_d7327999803b1cec67275852`; ambos están normalizados a WebP 512×512 y fuera de la cobertura legal hasta obtener una base de marca suficiente.
- Auditoría de derechos: **0/232 escudos de clubes publicables**. Hay candidatos de TheSportsDB y otros proveedores, pero sus términos no prueban autorización de redistribución de escudos; no se cuentan como legales.

## Paquetes de solicitud de permisos multimedia — 2026-09-13

- Se generaron paquetes reproducibles para solicitar autorización directa de uso de imagen: **42 retratos jugables pendientes** y **232 escudos de clubes jugables**.
- Cada paquete incluye entidad canónica, identificadores de proveedor, fuente candidata, URL de evidencia, alcance solicitado, estado de permiso y CSV/Markdown para contacto externo.
- Los archivos quedan en `backend/storage/media-candidates/`: `player-portrait-license-requests-v1.{json,csv,md}` y `club-badge-license-requests-v1.{json,csv,md}`.
- La generación no convierte candidatos en legales: hasta recibir y registrar una autorización verificable, los activos permanecen fuera de la cobertura publicable.

## Retrato legal aprobado: Dor Micha — 2026-09-13

- Se incorporó el archivo individual `File:דור מיכה במדי בית"ר ירושלים.jpg` desde Wikimedia Commons, con identidad visual revisada, resolución original **2.559×4.152**, autor identificado y licencia **CC BY 4.0**.
- Se normalizó a WebP 512×512 y se aprobó como principal con uso comercial, alcance web/PWA/Android/iOS/CDN/almacenamiento local, atribución y evidencia de licencia registradas en PostgreSQL.
- La cobertura del roster jugable sube a **608/649 = 93,68%**; quedan **41** retratos legales pendientes. Los candidatos lejanos o de baja resolución siguen rechazados.

## Recorte lógico del catálogo y corrección de rankings de tarjetas — 2026-09-13

- Se ejecutó `cleanup:data-catalog` con transacción completa. No se borraron estadísticas, snapshots ni evidencias: **73.062** jugadores canónicos y **77.719** filas estadísticas siguen conservados para auditoría histórica.
- El catálogo de juego queda separado del archivo: **9.796** jugadores canónicos aparecen en la unión de los cortes top-200 activos y **63.266** quedan marcados `excluded_from_game`; las entidades fuente duplicadas quedan `superseded`. La exclusión también evita exigirles retratos.
- El generador API-Football de tarjetas se corrigió para conservar jugadores con **cero observado** cuando el corte necesita llegar a 200. Los `NULL` de asistencias siguen sin convertirse en cero.
- Se regeneraron los cortes de tarjetas de Club World Cup, Copa América, Nations League y World Cup. El tamaño mínimo pasa de **106/113 = 93,8%** a **111/113 = 98,2%**; las únicas categorías aún por debajo de 200 son las dos de asistencias cuya fuente no informa suficientes valores.
- El estado vigente queda en **76/113 = 67,3%** de categorías con cobertura validada, **607/649 = 93,53%** de retratos legales del roster jugable, **0/232** escudos de clubes con licencia aprobada y **0** cadenas de identidad. No se calcula un porcentaje global mezclando datos, imágenes y licencias.

## Checkpoint vigente de PostgreSQL — 2026-09-13 04:xx UTC

- La métrica canónica actual del juego es **758/938 = 80,81%**: 938 jugadores únicos jugables presentes en rankings activos, 758 con un retrato principal legal y 180 sin retrato. Las cifras anteriores de 649/828 pertenecen a checkpoints previos a la consolidación del catálogo y no deben mezclarse con esta auditoría.
- Retratos legales por proveedor: TheSportsDB **386**, Wikimedia Commons **1.443** entre sus identificadores, Openverse **14**; los candidatos API-Football/UEFA siguen fuera de cobertura legal. No se cuentan assets alternativos ni pendientes.
- Escudos de clubes legalmente publicables: **0**. La última búsqueda de 100 clubes en Commons no produjo un escudo válido; el único candidato era de un equipo femenino distinto. Los assets de API-Football, TheSportsDB y UEFA siguen `pending`.
- Se sincronizó la temporada **2026** de Premier League, LaLiga, Bundesliga, Serie A, Ligue 1 y Primeira Liga: **2.967 filas**, todas validadas y sin anomalías, sin descargar media. Los rankings globales de carrera de goles, asistencias, amarillas y rojas se reconstruyeron con ventana 2000–2026 y 200 entradas reales cada uno; permanecen `draft` y `coverage_complete=false` por alcance histórico/derechos.
- La cuota API-Football observada es **3.950/7.500** y el plan Pro figura activo hasta **2026-10-10**. Openverse permanece sin OAuth y responde `429`; no se contabilizó ningún resultado de esa fuente.
- La suite `npm test` pasa. Este checkpoint es la referencia operativa más reciente; los bloques históricos del informe se conservan únicamente como trazabilidad.

## Checkpoint operativo posterior — 2026-09-13 05:13 UTC

- Se aprobaron dos retratos adicionales de Wikimedia Commons tras revisión visual y de licencia: **Gnaly Cornet (CC BY-SA 4.0)** y **Fábio Pereira da Silva (CC BY-SA 2.0)**. Ambos están normalizados a WebP 512×512, con atribución, evidencia y alcance registrados.
- La cobertura canónica actual del juego queda en **760/938 = 81,02%**: 938 jugadores únicos jugables presentes en rankings activos, 760 con retrato legal principal y 178 pendientes. No se duplican personas por aparecer en varias categorías.
- La búsqueda priorizada por mejor posición continúa sin aprobar candidatos ambiguos: se rechazaron imágenes de Zaniolo y Dida por identidad/calidad visual insuficiente.
- El estado de categorías queda en **76/113 = 67,3%** con cobertura validada y **112/113 = 99,1%** con el tamaño mínimo requerido. Esto último no implica histórico completo ni derechos aprobados.
- Escudos de clubes publicables: **0/232**. Los escudos siguen bloqueados por falta de autorización marcaria/licencia de redistribución verificable.
- `npm run build` y `git diff --check` pasan; el último `audit:data-readiness` es la fuente de verdad de estas cifras.

## Incremento multimedia posterior — 2026-09-13 05:19 UTC

- La búsqueda priorizada por mejor posición encontró y permitió aprobar cuatro retratos adicionales con licencia abierta: **Gnaly Cornet (CC BY-SA 4.0)**, **Fábio Pereira da Silva (CC BY-SA 2.0)**, **Erik Daniel (CC0)** y **Blaž Kramer (CC BY-SA 4.0)**.
- La cobertura canónica queda en **762/938 = 81,24%**, con **176** jugadores jugables ranqueados sin retrato legal aprobado.
- Se revisaron los candidatos visualmente antes de aprobarlos; las imágenes de baja resolución o con identidad no visible no se contabilizaron.

## Mejora de estadísticas Copa América — 2026-09-13

- Se importó desde API-Football la edición **2021** de Copa América: **277 filas**, 14 páginas del endpoint de jugadores, sin anomalías y con snapshot validado.
- Se reconstruyó `copa-america-assists` con las ediciones disponibles **2011, 2015, 2016, 2019, 2021 y 2024**: ahora contiene **200 entidades únicas**, **138 valores cero observados** y **0 valores nulos** en el snapshot.
- La regla del agregador se ajustó: un cero de asistencias solo entra cuando las filas de ese jugador no contienen ningún `NULL`; los jugadores con datos incompletos solo entran si su suma observada es positiva. Por tanto, no se han convertido ausencias en ceros.
- La categoría mantiene `coverage_complete=false` porque la ventana no demuestra todavía el histórico mundial completo; el tamaño 200 no se presenta como cobertura total.

## Incremento posterior y tamaño de categorías — 2026-09-13 05:29 UTC

- Se aprobó además el retrato CC0 de **Fabio Cudicini**, después de comprobar identidad y formato. El intento de volver a importar el archivo de Albion Rrahmani fue bloqueado por el deduplicador porque ya constaba rechazado; no se creó un duplicado.
- La auditoría vigente queda en **764/938 = 81,45%** de retratos legales para jugadores jugables únicos, con **174** pendientes.
- Tras reconstruir las asistencias de Copa América, las **113/113 categorías** tienen ya el tamaño mínimo requerido; esto no cambia que solo **76/113** tengan cobertura histórica validada.

## Incremento de retratos Commons — 2026-09-13 05:35 UTC

- Se aprobaron cinco retratos adicionales tras revisión visual y de licencia: **Antony (CC BY-SA 4.0)**, **Ahoueke Denkey (CC BY-SA 4.0)**, **Mijat Gacinovic (CC BY-SA 4.0)**, **Goh Young-Jun (CC BY-SA 4.0)** y **Dávid Ďuriš (CC BY 4.0)**.
- La auditoría vigente queda en **769/938 = 81,98%**, con **169** jugadores pendientes de retrato legal.
- Se conservaron las comprobaciones de formato WebP 512×512, identidad visual, atribución y evidencia; ningún candidato ambiguo se contó.

## Cierre de búsqueda prioritaria de retratos — 2026-09-13 05:39 UTC

- La pasada individual por los jugadores pendientes mejor posicionados aprobó cinco retratos adicionales: **Antony**, **Ahoueke Denkey**, **Mijat Gacinovic**, **Goh Young-Jun** y **Dávid Ďuriš**; posteriormente se aprobó **Róbert Pich** en el siguiente bloque.
- La auditoría actual queda en **770/938 = 82,09%**, con **168** jugadores sin retrato legal principal.
- Se agotaron los 168 casos priorizados sin aprobar falsos positivos; las imágenes ambiguas, placas, archivos de baja resolución y candidatos ya rechazados permanecen fuera del roster publicable.

## Expedientes de permisos regenerados — 2026-09-13 05:40 UTC

- Se regeneraron los paquetes de permisos después de las nuevas aprobaciones. El expediente de retratos contiene **159 solicitudes abiertas**; el universo restante de auditoría sigue siendo **168** porque nueve casos tienen activos/candidatos registrados que aún requieren revisión contractual.
- El expediente de escudos refleja **232 clubes jugables**: **188** con algún asset registrado pero sin permiso verificado y **44** todavía sin asset; los 232 requieren autorización marcaria/licencia de publicación.
- Los archivos actualizados son `player-portrait-license-requests-v1.{json,csv,md}` y `club-badge-license-requests-v1.{json,csv,md}` en `backend/storage/media-candidates/`.

## Ampliación sudamericana API-Football — 2026-09-13

- Se importaron dos temporadas históricas adicionales, sin medios: **Copa Libertadores 2023** (**1.946 filas**, 1.921 jugadores) y **Copa Sudamericana 2023** (**2.212 filas**, 2.174 jugadores). Ambas respuestas recorrieron todas sus páginas y no registraron anomalías.
- Se reconstruyeron sus rankings de asistencias con las ventanas disponibles 2000–2025. `copa-libertadores-assists` y `copa-sudamericana-assists` conservan **200 entidades únicas**, **0 nulos** y permanecen `coverage_complete=false` porque la cobertura histórica mundial aún no está demostrada.
- La cuota API-Football observada después de la tanda es **4.127/7.500**; no se descargaron imágenes en estas importaciones.

## Ampliación sudamericana adicional y rankings globales — 2026-09-13

- Se importaron **Copa Libertadores 2022** (**1.880 filas**, 1.863 jugadores) y **Copa Sudamericana 2022** (**1.974 filas**, 1.959 jugadores), con snapshots completos y sin anomalías.
- Sus rankings de asistencias se reconstruyeron con las 15 temporadas disponibles (2011–2025), 200 entidades únicas y 0 valores nulos en cada snapshot; ambos permanecen en borrador y con cobertura histórica incompleta declarada.
- Se reconstruyeron los cuatro rankings globales de carrera (goles, asistencias, amarillas y rojas) agregando 12 competiciones de clubes API-Football y temporadas disponibles 2002–2026; cada ranking contiene 200 entradas reales y `coverage_complete=false`.
- La cuota API-Football observada queda en **4.370/7.500**.

## Checkpoint vigente posterior — 2026-09-13 05:50 UTC

- Auditoría actual: **938** jugadores jugables únicos presentes en rankings; **770** con retrato legal principal y **168** sin retrato (**82,09%**).
- Categorías activas: **113/113** con al menos 200 entradas; **76/113** con cobertura histórica validada. Las restantes continúan en borrador por histórico incompleto, participación no demostrada o fuente pendiente de derechos.
- Clubes jugables: **232**; escudos publicables con licencia marcaria verificada: **0**.
- La ampliación sudamericana no cambió artificialmente el porcentaje multimedia: solo añadió estadísticas y reconstruyó rankings. La cuota API-Football observada es **4.370/7.500**.

## Flujo de actualización reproducible — 2026-09-13

- Se añadió `npm run refresh:api-football:current` desde `backend/`. Importa la temporada indicada por `RANGO90_SEASON` (por defecto, el año UTC), reconstruye los cuatro agregados globales de carrera y ejecuta la auditoría final; no descarga ni aprueba medios.
- Durante su prueba se detectó que aceptaba argumentos no reconocidos y se corrigió inmediatamente. La prueba llegó a repetir la sincronización de 2026, que terminó validada sin anomalías ni cambios multimedia; consumió **44** peticiones adicionales.
- El script ahora rechaza cualquier argumento antes de iniciar una petición. La cuota observada posterior es **4.414/7.500**.

## Incremento de retrato individual y auditoría vigente — 2026-09-13

- Se aprobó el retrato de **Anastasios Bakasetas** desde Wikimedia Commons, licencia **CC BY 2.0**, tras comprobación visual, normalización a WebP 512×512, atribución y evidencia de licencia.
- La cobertura canónica del roster jugable queda en **771/938 = 82,20%**; quedan **167** jugadores sin retrato legal principal.
- Las cifras de categorías permanecen en **113/113** con el tamaño mínimo requerido y **76/113 = 67,3%** con cobertura histórica validada. Los escudos de clubes siguen en **0/232** con licencia aprobada.
- La búsqueda automática de TheSportsDB se detuvo al no producir un lote verificable dentro del tiempo operativo; no se aprobaron candidatos dudosos ni se crearon duplicados.

## Corrección de la métrica de jugabilidad por categoría — 2026-09-13

- La auditoría detectó una discrepancia relevante: **113/113** categorías tenían 200 filas importadas, pero solo **4/80 = 5,0%** de las categorías de jugadores tenían 200 entidades jugables reales. La media era de **38,3** jugadores jugables por categoría.
- Se añadió `playerCategoriesWithRequiredPlayableSize` y su porcentaje a `audit:data-readiness`. La auditoría por categoría ya expone la cifra jugable y `readyForPublish` exige también ese umbral.
- Por tanto, el 100% de tamaño de filas no volverá a presentarse como cobertura de juego. Los jugadores y sus estadísticas se conservan; no se han creado perfiles ni retratos automáticos para rellenar artificialmente la cifra.
- `npm run build`, `npm test` y `git diff --check` pasan. La cobertura de retratos sigue siendo **771/938 = 82,20%** y los escudos de clubes **0/232**.

## Auditoría de la política de audiencia frente a los top-200 — 2026-09-13

- La comprobación de los 80 rankings de jugadores muestra que solo **2/80** tienen 200 jugadores nacidos desde 1980 dentro del top-200; la media es **110,8**. En rankings históricos como `world-cup-goals`, el corte moderno contiene solo 1 jugador.
- Esto confirma que no se puede completar honestamente cada ranking con 200 jugadores “modernos” sin cambiar el alcance estadístico. Para conservar el top-200 exacto hay que revisar excepciones históricas y obtener un retrato legal de cada persona; para mantener una audiencia moderna hay que publicar un subconjunto curado y dejar de llamarlo top-200 histórico.
- No se ha ampliado automáticamente el roster ni se han maquillado las cifras. Esta decisión de producto queda como puerta explícita antes de recolectar miles de retratos históricos.

## Consolidación de identidades posterior — 2026-09-13

- Se ejecutaron las reparaciones deterministas de identidad del catálogo y las consolidaciones de API-Football/StatBunker. El número de enlaces pasa a **4.976**; el proceso conservó los conflictos de ranking para revisión y no fusionó homónimos.
- La consolidación no cambia todavía el roster jugable ni la cobertura multimedia: siguen **938** jugadores jugables, **771** retratos legales (**82,20%**) y **167** pendientes.
- La única cadena detectada (tres registros de Carlos Sánchez) se verificó y se aplanó hacia `pl:player:10430` dentro de una transacción. La auditoría posterior confirma **0 cadenas de identidad**.
- Se regeneró el expediente de permisos de retratos: quedan **158 solicitudes directas** para **167** jugadores sin retrato legal. El archivo vigente es `backend/storage/media-candidates/player-portrait-license-requests-v1.{json,csv,md}`.
- Se consolidó además el duplicado inequívoco de **Robin Gosens** entre API-Football y UEFA, verificado por nombre y fecha de nacimiento. Los casos con fechas ausentes o homónimos potenciales no se fusionaron.
- Se aprobaron dos retratos adicionales de Wikimedia Commons tras revisión visual: **Ismaïla Sarr (CC BY 3.0)** y **Konstantinos Fortounis (CC BY-SA 3.0)**. La cobertura sube a **773/938 = 82,41%**, con **165** faltantes. El expediente actualizado contiene **156 solicitudes directas**.
- Se aprobó además **Paweł Wszołek (CC BY 2.0)** tras revisión visual y de licencia. La cobertura vigente queda en **774/938 = 82,52%**, con **164** faltantes y **155** solicitudes directas. El candidato de Abdessamad Ezzalzouli se rechazó por aparecer demasiado lejos; Wikimedia Commons activó un límite temporal de peticiones y se respetó sin insistir.
- Se aprobaron dos retratos adicionales: **Luis Sinisterra (CC BY 3.0)** y **Aleksandar Čavrić (CC BY-SA 3.0)**. La auditoría queda en **776/938 = 82,73%**, con **162** faltantes y **153** solicitudes directas; las identidades siguen sin cadenas pendientes.
- Se aprobaron dos retratos adicionales: **Carl Holse (CC BY-SA 3.0)** y **Ștefan Baiaram (CC BY 4.0)**. La cobertura vigente queda en **779/938 = 83,05%**, con **159** faltantes y **150** solicitudes directas; las cadenas de identidad siguen en **0**.
- Se aprobaron dos retratos adicionales: **Noni Madueke (CC BY-SA 4.0)** y **Abdessamad Ezzalzouli (CC BY-SA 4.0)**. La auditoría queda en **781/938 = 83,26%**, con **157** faltantes y **148** solicitudes directas. Se confirmó además que los dos registros de Nuno Santos tienen fechas de nacimiento distintas y se mantienen separados.

## Incremento de retratos Commons — 2026-09-13 06:57 UTC

- Se aprobaron cinco retratos adicionales después de comprobar identidad visual, resolución original, licencia, atribución y normalización a WebP 512×512: **Ulrich Stein (CC BY-SA 3.0)**, **Raúl (CC BY-SA 2.0)**, **Kylian Mbappé (CC BY-SA 4.0)**, **Zlatan Ibrahimović (CC BY 2.0)** y **Marcus Rashford (CC BY-SA 4.0)**.
- La auditoría posterior queda en **787/938 = 83,90%** de jugadores jugables únicos con retrato legal principal; quedan **151** sin cobertura legal aprobada.
- Se descartaron candidatos de baja resolución y no se reabrieron automáticamente archivos previamente rechazados por identidad o calidad insuficiente. No se crearon duplicados.
- El resto del estado no cambia: **76/113 = 67,3%** de categorías con datos validados, **113/113** con el tamaño mínimo de filas, **0/232** escudos de clubes publicables y **0** cadenas de identidad.

## Incremento adicional de retratos Commons — 2026-09-13 07:00 UTC

- Se aprobó el retrato de **John Carew (CC BY 2.0)** tras revisión visual, de licencia y de formato. Se conservó únicamente el primer plano aprobado y se rechazó una alternativa de acción menos adecuada.
- La auditoría vigente queda en **788/938 = 84,01%** de jugadores jugables únicos con retrato legal principal; quedan **150** pendientes.
- El expediente exacto de permisos se regeneró y contiene **142 solicitudes directas**; los ocho casos restantes tienen candidatos locales pendientes de revisión contractual o técnica.

## Incremento adicional de retratos Commons — 2026-09-13 07:08 UTC

- Se aprobaron retratos con licencia abierta y revisión visual para **Arjen Robben (CC BY-SA 3.0)**, **Sadio Mané (CC BY-SA 4.0)**, **Robin van Persie (CC BY 2.5)**, **Torbjörn Nilsson (CC BY-SA 3.0)**, **José Altafini (CC BY 3.0 br)** y **Amancio (CC0)**.
- La auditoría vigente queda en **795/938 = 84,75%** de jugadores jugables únicos con retrato legal principal; quedan **143** pendientes.
- El expediente exacto de permisos se regeneró y contiene **135 solicitudes directas**. Las imágenes de acción, baja resolución o encuadre poco claro se mantienen rechazadas o fuera de cobertura.

## Incremento adicional de retratos Commons — 2026-09-13 07:12 UTC

- Se aprobaron los retratos de **Elazar Dasa (CC BY-SA 4.0)** y **Mees de Wit (CC BY 2.0)**, tras comprobar la correspondencia de identidad, la licencia y el formato normalizado WebP 512×512.
- La auditoría vigente queda en **797/938 = 84,97%** de jugadores jugables únicos con retrato legal principal; quedan **141** pendientes.
- El expediente exacto de permisos se regeneró y contiene **133 solicitudes directas**. Las alternativas de acción o menor calidad se rechazaron y no cuentan como cobertura.

## Incremento adicional y robustez de Commons — 2026-09-13 07:24 UTC

- Se aprobaron los retratos de **Stênio Júnior (CC BY-SA 4.0)** y **Magnus Eikrem (CC BY-SA 3.0)**, con revisión visual, evidencia de licencia, atribución y normalización WebP 512×512.
- La auditoría vigente queda en **799/938 = 85,18%** de jugadores jugables únicos con retrato legal principal; quedan **139** pendientes.
- Se corrigió el fallback del cliente de Commons para que un límite en el endpoint REST de descripción reutilice la página HTML sin saltarse ninguna validación. `npm run build`, `npm test` y `git diff --check` pasan.
- El expediente exacto de permisos se regeneró y contiene **131 solicitudes directas**. El resto del estado permanece: **76/113 = 67,3%** de categorías con datos validados y **0/232** escudos de clubes publicables.

## Incremento adicional de retratos Commons — 2026-09-13 07:27 UTC

- Se aprobaron **Miloš Kratochvíl (CC BY-SA 4.0)** y **Nemanja Bilbija (CC0)** tras revisión visual, de identidad, resolución, licencia y normalización a WebP 512×512.
- La auditoría vigente queda en **801/938 = 85,39%** de jugadores jugables únicos con retrato legal principal; quedan **137** pendientes.
- El expediente exacto de permisos se regeneró y contiene **129 solicitudes directas**. Los candidatos de grupo, acción distante o calidad insuficiente permanecen fuera de cobertura.
- `npm run build`, `npm test` y `git diff --check` pasan.

## Incremento adicional de retratos Commons — 2026-09-13 09:32 UTC

- Se aprobó el retrato individual de **Dida (CC BY-SA 3.0)** tras verificar identidad visual, autoría (`NullReason`), licencia, atribución y normalización WebP 512×512.
- Se aprobó el retrato individual de **Albert Rust (dominio público)** tras verificar identidad visual, autoría (`Panini`), evidencia de licencia y normalización WebP 512×512.
- La auditoría vigente queda en **817/912 = 89,58%** de jugadores jugables únicos activos con retrato legal principal; quedan **95** solicitudes directas.
- El expediente de permisos se regeneró con **95 jugadores canónicos** sin retrato. La cobertura de categorías permanece en **76/113 = 67,3%** y los escudos de club publicables siguen en **0/232**.

## Incremento adicional de retratos Commons — 2026-09-13 09:39 UTC

- Se aprobaron los retratos individuales de **Nanasi (CC0)** y **Marin Tomasov (CC BY-SA 3.0)** tras comprobar identidad visual, autoría, licencia, atribución y normalización WebP 512×512.
- Se rechazaron candidatos de **Carlos Correa** por ser un deportista de otro deporte, y de **Giuliano Terraneo** por ser una foto de acción demasiado lejana; ninguno se cuenta como cobertura.
- La auditoría vigente queda en **819/912 = 89,80%** de jugadores jugables únicos activos con retrato legal principal; quedan **93** solicitudes directas.
- El expediente de permisos se regeneró con **93 jugadores canónicos** sin retrato. La cobertura de categorías permanece en **76/113 = 67,3%** y los escudos de club publicables siguen en **0/232**.

## Incremento adicional de retratos Commons — 2026-09-13 09:42 UTC

- Se aprobó el retrato individual de **Denys Antyukh (CC BY-SA 4.0)** tras verificar identidad visual, licencia, atribución y normalización WebP 512×512.
- Se descartó el resultado de Michał Przybylski por corresponder a un músico en un festival, no al futbolista.
- La auditoría vigente queda en **820/912 = 89,91%** de jugadores jugables únicos activos con retrato legal principal; quedan **92** solicitudes directas.
- El expediente de permisos se regeneró con **92 jugadores canónicos** sin retrato. La cobertura de categorías permanece en **76/113 = 67,3%** y los escudos de club publicables siguen en **0/232**.

## Revisión de candidatos de escudos de clubes — 2026-09-13

- Se stageó el escudo de **Athletico Paranaense (Logo 2019)** desde Wikimedia Commons y se normalizó a WebP 512×512. Permanece `pending`: la licencia del archivo no acredita por sí sola autorización marcaria del club.
- Se descartaron los candidatos del lote para **1. FC Nürnberg** (escudo del equipo femenino), **Athletic Club** (escudo histórico de 1912), **Bayer 05 Uerdingen** (logos históricos o insuficientes) y **Bayer Leverkusen** (logos históricos); ninguno se cuenta como escudo publicable.
- La auditoría mantiene **0/232 escudos de club publicables**. La búsqueda de Commons sirve para preparar candidatos, no para convertir automáticamente una marca en autorizada.

## Incremento adicional de retratos Commons — 2026-09-13 (auditoría posterior)

- Se aprobaron los retratos de **Saldanha / Matheus Saldanha** (CC BY-SA 4.0, autor Rakeck), **Gerd Müller** (CC BY-SA 3.0, Alexander Hauk / www.alexander-hauk.de) y **Lorenzo Buffon** (CC BY-SA 4.0, Magliarossonera.it), tras comprobar identidad visual, resolución original y licencia.
- La auditoría posterior a la aprobación de Norbert Nigbur queda en **816/924 = 88,31%** de jugadores jugables únicos activos con retrato legal principal; quedan **108** pendientes.
- La cobertura de datos permanece en **76/113 = 67,3%**; solo **2/80 = 2,5%** de categorías de jugadores alcanzan 200 entidades jugables activas.

## Importación adicional de títulos de jugadores — 2026-09-13

- API-Football `/trophies` procesó los **84 jugadores jugables** que todavía carecían de hechos de títulos: **86 IDs de proveedor**, **0 errores** y **2 hechos nuevos**.
- Se reconstruyó `player-career-titles` con **200 entradas reales** (`rs_30bcff61309619139945d8fe`). El snapshot permanece en borrador y `coverage_complete=false`: los registros son evidencia de trofeos observados, no una certificación completa de participación ni de toda la carrera.

## Protección del descubrimiento Openverse — 2026-09-13 08:08 UTC

- El comando de Openverse ahora exige `OPENVERSE_CLIENT_ID` y `OPENVERSE_CLIENT_SECRET` antes de iniciar un lote. Sin esas credenciales termina sin llamar al proveedor ni registrar intentos de descubrimiento.
- El lote anónimo anterior devolvió `401/429`, produjo **0 candidatos** y no cambió ninguna aprobación; queda tratado como fallo de infraestructura, no como ausencia de retratos.
- `npm run build` y `npm test` pasan tras el cambio.

## Incremento adicional de retratos Commons — 2026-09-13 08:06 UTC

- Se aprobó el retrato de **Essam El-Hadary (CC BY-SA 3.0)** tras comprobar identidad visual, resolución, atribución y normalización WebP 512×512.
- La auditoría vigente queda en **812/925 = 87,78%** de jugadores jugables únicos activos con retrato legal principal; quedan **113** pendientes.
- El expediente exacto de permisos se regeneró y contiene **113 solicitudes directas**. Los candidatos ya rechazados por baja calidad o encuadre no se reabren sin evidencia nueva.

## Limpieza de audiencia del roster — 2026-09-13 08:15 UTC

- Se reejecutó `seed-game-audience --expand` con la política `modern-audience-v1`, que ya estaba aprobada para excluir jugadores históricos secundarios y conservar únicamente excepciones icónicas revisadas.
- Se retiró un perfil antiguo que mantenía `playable_default = true` por una carga anterior; sus rankings, hechos y asset aprobado se conservan fuera del roster.
- La auditoría vigente queda en **811/924 = 87,77%** de jugadores jugables únicos activos con retrato legal principal; quedan **113** pendientes.
- La cobertura estadística continúa en **76/113 = 67,3%** y solo **2/80 = 2,5%** de categorías de jugadores alcanzan 200 jugables. No se presenta ninguna categoría incompleta como publicable.

## Incremento adicional de retratos Commons — 2026-09-13 08:18 UTC

- Se aprobó el retrato de estudio de **Nuno Santos (CC BY-SA 4.0)** tras verificar identidad, autoría, licencia y normalización WebP 512×512.
- La auditoría vigente queda en **812/924 = 87,88%** de jugadores jugables únicos activos con retrato legal principal; quedan **112** pendientes.
- El expediente de permisos se regeneró y contiene **112 solicitudes directas**; no se generan assets por cada aparición en ranking.

## Incremento adicional de retratos Commons — 2026-09-13 08:03 UTC

- Se aprobó el retrato de **Ray Clemence (CC BY-SA 3.0 NL)** tras comprobar identidad visual, resolución, atribución y normalización WebP 512×512.
- La auditoría vigente queda en **810/925 = 87,57%** de jugadores jugables únicos activos con retrato legal principal; quedan **115** pendientes.
- El expediente exacto de permisos se regeneró y contiene **115 solicitudes directas**. El mismo retrato canónico se reutiliza en todas las categorías donde aparece el jugador.

## Incremento adicional de retratos Commons — 2026-09-13 07:35 UTC

- Se aprobaron **Ole Gunnar Solskjær (CC BY-SA 2.0)**, **Romelu Lukaku (CC BY-SA 3.0)**, **Kevin De Bruyne (CC BY-SA 3.0)**, **Adriano (CC BY-SA 2.0)** y **Mehdi Taremi (CC BY 4.0)**, tras revisar identidad, encuadre, resolución, licencia y normalización WebP 512×512.
- La auditoría vigente queda en **806/938 = 85,93%** de jugadores jugables únicos con retrato legal principal; quedan **132** pendientes.
- El expediente exacto de permisos se regeneró y contiene **124 solicitudes directas**. Las variantes de espalda, acción distante o baja resolución se mantienen rechazadas.

## Incremento adicional de retratos Commons — 2026-09-13 07:40 UTC

- Se aprobaron **Aleksandar Trajkovski (CC BY 2.0)** y **Maximilian Meyer (CC BY-SA 2.0)** tras revisión visual, identidad, licencia y normalización WebP 512×512.
- La auditoría vigente queda en **808/938 = 86,14%** de jugadores jugables únicos con retrato legal principal; quedan **130** pendientes.
- El expediente exacto de permisos se regeneró y contiene **122 solicitudes directas**. Se rechazaron las imágenes de Yusuf Sarı y Łukasz Skorupski por aparecer demasiado lejos para un retrato canónico.

## Incremento adicional de retratos Commons — 2026-09-13 07:46 UTC

- Se aprobaron **Sergey Yuran (CC BY-SA 3.0)**, **Piet Keizer (CC BY-SA 3.0 NL)**, **José Águas (CC0)** y **Sören Lerby (CC0)**, tras revisar identidad visual, resolución, licencia y normalización WebP 512×512.
- La auditoría vigente queda en **813/938 = 86,67%** de jugadores jugables únicos con retrato legal principal; quedan **125** pendientes.
- El expediente exacto de permisos se regeneró y contiene **117 solicitudes directas**. No se aprobaron candidatos de grupo, baja resolución o identidad dudosa.

## Incremento adicional de retratos Commons — 2026-09-13 07:49 UTC

- Se aprobó el retrato de **Ousmane Dembélé (CC BY-SA 4.0)** tras revisar identidad, resolución, licencia y normalización a WebP 512×512.
- La auditoría vigente queda en **814/938 = 86,78%** de jugadores jugables únicos con retrato legal principal; quedan **124** pendientes.
- El expediente exacto de permisos se regeneró y contiene **116 solicitudes directas**. Los candidatos de baja resolución o identidad ambigua siguen fuera de cobertura.

## Incremento adicional de retratos Commons — 2026-09-13 07:52 UTC

- Se aprobó el retrato de **Sandro Mazzola (dominio público)** tras comprobar identidad visual inequívoca, archivo original, evidencia de licencia y normalización WebP 512×512.
- La auditoría vigente queda en **815/938 = 86,89%** de jugadores jugables únicos con retrato legal principal; quedan **123** pendientes.
- El expediente exacto de permisos se regeneró y contiene **116 solicitudes directas**; el expediente no se reduce porque el mismo jugador mantiene otra entidad de origen sin vinculación canónica. No se crean retratos adicionales por sus apariciones en otros rankings.

## Corrección del auditor de jugabilidad — 2026-09-13 08:00 UTC

- Se corrigió `audit:data-readiness` para que un perfil solo sea jugable si su entidad está activa (`catalog_status = 'active'`). Antes, 13 perfiles marcados `excluded_from_game` podían entrar en el denominador por conservar `playable_default = true`.
- La cifra válida posterior a la corrección es **809/925 = 87,46%** de jugadores jugables únicos activos con retrato legal principal; quedan **116** pendientes. No se eliminaron filas ni assets.
- La cobertura de datos continúa en **76/113 = 67,3%** y solo **2/80 = 2,5%** de categorías de jugadores alcanzan 200 entidades jugables activas. Los rankings que aún no cumplen ese requisito no se presentan como listos para publicar.
- `npm run build`, `npm test` y `git diff --check` pasan.

## Verificación del palmarés del Balón de Oro — 2026-09-13

- Se ejecutó de nuevo `import:ballon-dor` contra el palmarés oficial de France Football.
- El snapshot vigente `rs_3987d2e93d62b4c5072d83e9` contiene los ganadores masculinos de **2024 (Rodri)** y **2025 (Ousmane Dembélé)**, además del palmarés histórico completo: **47 ganadores únicos y 69 ediciones concedidas** (2020 no se concedió).
- Ambos jugadores están enlazados a sus entidades canónicas y aparecen en el ranking con `rawValue = 1`; la importación permanece en borrador hasta completar la revisión de derechos y publicación.

## Incremento adicional de retratos Commons — 2026-09-13 08:49 UTC

- Se aprobó el retrato de **Bibars Natcho (CC BY-SA 4.0)** después de comprobar identidad individual, resolución original, licencia, atribución y normalización a WebP 512×512.
- La auditoría vigente queda en **817/924 = 88,42%** de jugadores jugables únicos activos con retrato legal principal; quedan **107** pendientes.
- El expediente de permisos se regeneró con **107 solicitudes directas**. La segunda imagen localizada para el mismo jugador se mantuvo fuera de cobertura por calidad inferior.

## Corrección del roster histórico secundario — 2026-09-13

- La auditoría de audiencia detectó perfiles sin fecha de nacimiento que habían entrado como `modern` por el baseline de Champions League. Se añadieron exclusiones explícitas para **11 jugadores históricos secundarios** (entre ellos Bora Kostic, Dennis Viollet, Ferenc Bene, Héctor Rial, Jozef Adamec, José Águas, Piet Keizer, Willie Wallace y Wlodzimierz Lubanski).
- La reseed `seed-game-audience --expand` conserva sus entidades, hechos y rankings, pero los marca como `classic_legacy` no jugables por defecto. No se ha borrado ningún dato.
- La auditoría resultante queda en **813/913 = 89,05%** de jugadores jugables únicos activos con retrato legal principal; quedan **100** solicitudes directas de retrato.
- Se validó con `npm run build`, `npm test` y `git diff --check`.

## Corrección adicional del roster histórico — 2026-09-13

- Se excluyó también **José Torres**, que había entrado como moderno por un registro histórico sin fecha de nacimiento pese a haber terminado su carrera antes de 1990.
- Sus datos y rankings se conservan; solo se marca como `classic_legacy` no jugable por defecto. La auditoría queda en **813/912 = 89,14%**, con **99** retratos legales pendientes.

## Incremento adicional de retratos Commons — 2026-09-13 09:06 UTC

- Se aprobó el retrato de **Franco Superchi (dominio público)** después de revisar identidad individual, resolución, evidencia de licencia y normalización a WebP 512×512.
- La auditoría vigente queda en **815/912 = 89,36%** de jugadores jugables únicos activos con retrato legal principal; quedan **97** solicitudes directas.

## Incremento adicional de retratos Commons — 2026-09-13 09:27 UTC

- Se aprobó el retrato individual de **Dida (CC BY-SA 3.0)** tras verificar identidad visual, autoría (`NullReason`), licencia, atribución y normalización WebP 512×512.
- La auditoría vigente queda en **816/912 = 89,47%** de jugadores jugables únicos activos con retrato legal principal; quedan **96** solicitudes directas.
- El expediente de permisos se regeneró con **96 jugadores canónicos** sin retrato. La cobertura de categorías permanece en **76/113 = 67,3%** y los escudos de club publicables siguen en **0/232**.

## Revisión de candidatos visuales y consistencia de métricas — 2026-09-13

- Se revisó un candidato de **Hong Hyun-seok** procedente de TheSportsDB: la identidad visual es válida, pero `strCreativeCommons=No`; permanece `pending` y no se cuenta como retrato legal. La licencia del proveedor no se interpreta automáticamente como autorización comercial para el juego.
- Se probaron candidatos de Wikimedia Commons para porteros históricos. Los archivos de Ettori, Castellini, Arconada y Sarti no alcanzan el estándar visual/resolución requerido para una tarjeta jugable; no se aprobaron. Se rechazó explícitamente el de Ettori tras revisión visual por ser demasiado lejano y poco nítido.
- Se ajustó el umbral técnico de staging de retratos Commons de 512 px a 320 px por lado: permite revisar fotografías históricas con una ampliación acotada, pero no elimina la revisión visual ni la puerta de derechos.
- La auditoría PostgreSQL actual confirma **912 jugadores jugables**, **816 con retrato legal**, **96 pendientes** (**89,47%**); **113 categorías activas**, **76 completas** (**67,3%**) y **0/232 escudos de club publicables**. No existe un porcentaje global honesto sin ponderación aprobada.
- `npm run build`, `npm test` y `git diff --check` pasan.

## Corrección de la audiencia histórica de porteros — 2026-09-13 09:56 UTC

- Se detectó el fallo que permitía jugar automáticamente con porteros del top 100 histórico, incluidos jugadores nacidos en los años 20. La posición en un ranking histórico ya no concede por sí sola la etiqueta `iconic_legacy`.
- La reseed `seed-game-audience --expand` conserva entidades, estadísticas, rankings y medios; solo corrige el perfil de audiencia. Los perfiles históricos solo se mantienen jugables cuando están marcados explícitamente como curados. Entre los jugables nacidos antes de 1960 queda únicamente **Ferenc Puskás** como excepción curada.
- Auditoría PostgreSQL posterior: **819 jugadores jugables únicos activos ranqueados**, **742 con retrato legal principal**, **77 sin retrato** (**90,6%**). La cobertura de datos permanece en **76/113 categorías completas (67,3%)** y los escudos de club publicables en **0/232**.
- Se regeneró `backend/storage/media-candidates/player-portrait-license-requests-v1.{json,csv,md}`: contiene **77 solicitudes**, una por persona canónica pendiente.
- `npm run build`, `npm test` y `git diff --check` pasan. No se borró ningún dato histórico.

## Contraste de retratos pendientes con fuentes de imagen — 2026-09-13

- La pasada específica de Wikimedia Commons procesó los **77 jugadores jugables sin retrato legal** después de la corrección del roster. No produjo candidatos que superasen los filtros de identidad y licencia; los 77 quedan registrados como `no_candidate` y no se aprueba ninguno por ausencia de evidencia.
- TheSportsDB volvió a contrastar los mismos 77 jugadores respetando su intervalo de peticiones. No produjo un nuevo retrato con licencia individual publicable.
- API-Football encontró y normalizó **17 imágenes exactas** a WebP 512×512. Se registraron como candidatos `pending`; no aumentan la cobertura legal porque los términos del proveedor no conceden automáticamente derechos de publicación comercial sobre fotografías de terceros. No se aprobaron.
- La cobertura legal no se ha inflado: permanece en **742/819 = 90,6%**. El listado de solicitudes directas sigue conteniendo **77 personas canónicas**, sin duplicados por ranking.

## Actualización estadística de temporada 2025 — 2026-09-13

- API-Football confirmó suscripción **Pro activa** y cobertura de jugadores para la temporada 2025. Se importaron, sin medios, las seis ligas base: Premier League (**694 filas**), LaLiga (**797**), Bundesliga (**680**), Serie A (**876**), Ligue 1 (**798**) y Primeira Liga (**771**): **4.616 filas**, seis snapshots archivados y **cero anomalías de validación**.
- Se reconstruyeron los rankings globales de clubes hasta 2025 para **goles, asistencias, tarjetas amarillas y tarjetas rojas**, con **200 entradas reales cada uno**. Los snapshots nuevos son `rs_55c2c60c281389caac66a855`, `rs_d14311b1471a8d9adebbbdb9`, `rs_d4763396b3eecd9d94a49831` y `rs_1ff5a575c51e9641ac0ba0d8`.
- La cobertura no se marca completa: el agregado disponible cubre temporadas **2002–2025** en esta ventana y no demuestra todavía la carrera mundial completa. Los snapshots permanecen `draft` y con derechos `review_required`.
- La auditoría posterior mantiene **819 jugadores jugables**, **742 retratos legales (90,6%)**, **77 faltantes**, **76/113 categorías completas (67,3%)** y **0/232 escudos de club publicables**.

## Verificación de ventana histórica de API-Football — 2026-09-13

- La consulta oficial de temporadas de API-Football devuelve para las seis ligas base la misma ventana: **2010–2026** (17 temporadas). La temporada 2026 está en curso y no se incorpora al agregado histórico cerrado.
- Las comprobaciones de Premier League para 2000, 2001 y 2002 devolvieron **0 filas y sin error del proveedor**; no se importan como temporadas vacías de una carrera, porque una respuesta vacía aquí significa ausencia de cobertura de la fuente.
- Por tanto, el agregado API-Football 2000–2025 solo tiene disponibilidad real desde 2002 por las competiciones que ya tenían snapshots previos y, para las seis ligas base, la ventana verificable más reciente llega desde 2010. La etiqueta `coverage_complete=false` se mantiene correctamente.

## Protección contra temporadas en curso — 2026-09-13

- Se corrigió `scripts/refresh-api-football-current.sh`: sin `RANGO90_SEASON`, el refresco usa la última temporada cerrada (año natural anterior), no el año actual, que puede estar incompleto.
- Una temporada concreta puede seguir importándose de forma explícita con `RANGO90_SEASON=YYYY`. El refresco continúa sin medios y los agregados mantienen `coverage_complete=false` cuando la ventana no demuestra el histórico mundial.
- `bash -n scripts/refresh-api-football-current.sh` y `git diff --check` pasan.

## Enriquecimiento de fechas de nacimiento con Wikidata — 2026-09-13

- Se añadió el comando reproducible `npm run enrich:wikidata:birth-dates`, con modo seco por defecto. Solo acepta una coincidencia única de etiqueta futbolística y una fecha P569 completa; las coincidencias ambiguas no se aplican.
- El primer lote de `world-cup-goals` aplicó **6 fechas** con evidencia Wikidata y snapshot `src_5ba668948e21d640e583e25f`; no se fusionaron identidades ni se modificó la jugabilidad.
- Ronaldo, Gerd Müller y Pelé quedaron sin aplicar por ambigüedad o limitación de la consulta, y dos filas con rate limit tampoco se escribieron. Los datos históricos siguen conservados y la revisión continuará por lotes controlados.

- Se completaron además varios lotes controlados: **38 fechas inequívocas adicionales**, para un total de **76 fechas aplicadas** con evidencia Wikidata; las respuestas ambiguas o temporales quedaron sin aplicar. Después se procesó un lote desplazado de **9** y tres bloques con cola estable (`--offset 0`) de **31** fechas: total actual **116**. Las reseeds posteriores mantienen estable el roster: **819 jugables**, porque estas fechas se han usado para clasificar históricos y no conceden jugabilidad automáticamente.
- Se rechazaron offsets distintos de cero en el importador: como la cola se reduce al aplicar fechas, paginar con offset podía saltarse pendientes. Las siguientes ejecuciones deben repetir `--offset 0` hasta vaciar la cola.

## Cierre de la fuga de fechas desconocidas en la audiencia — 2026-09-13

- Se detectó una segunda fuga: perfiles marcados como `modern` por el baseline podían seguir siendo jugables aunque no tuvieran fecha de nacimiento verificada. Eso no permite descartar con seguridad a jugadores de generaciones demasiado antiguas.
- La política queda cerrada: un jugador sin fecha verificada pasa a `classic_legacy` y no es jugable por defecto; solo puede saltarse esta regla una excepción icónica marcada explícitamente como curada. Sus entidades, rankings y hechos no se borran.
- La reseed aplicada dejó **710 jugadores jugables únicos ranqueados**, de los que **635 tienen retrato legal principal** y **75 siguen pendientes**: cobertura visual real **635/710 = 89,44%**. El cambio de porcentaje se debe a limpiar el denominador, no a perder retratos legales.
- La comprobación de años confirma **0 perfiles no curados jugables sin fecha** y solo **Puskás (1927)** como jugador nacido antes de 1930, por excepción icónica explícita. Los demás jugadores de 1901–1929 que aparecen en rankings son registros históricos no jugables.
- La cobertura de datos permanece en **76/113 categorías completas (67,3%)**; los escudos de club publicables siguen en **0/232**. No existe un porcentaje global único honesto sin aprobar una ponderación entre datos, retratos, escudos y licencias.
- `npm run build` y `git diff --check` pasan.

## Enriquecimiento y contraste adicional — 2026-09-13

- Tres lotes adicionales de `enrich:wikidata:birth-dates` aplicaron **10 fechas inequívocas** más a `world-cup-goals`; las coincidencias ambiguas y el error temporal no se aplicaron. El total de evidencias Wikidata aplicadas asciende a **126**.
- Tras reseed y auditoría, el roster jugable se mantiene en **710 jugadores**: no se reabrió ningún perfil solo por tener una coincidencia parcial; la regla exige fecha verificable o excepción icónica curada.
- Se contrastaron los **247 perfiles de clubes/equipos** en Commons. Solo aparecieron **3 candidatos**: dos pertenecen a secciones no válidas de 1. FC Nürnberg y fueron descartados; el de Galatasaray sí corresponde visualmente al club y quedó descargado como candidato `pending`, no como activo aprobado.
- La cobertura vigente sigue siendo **635/710 retratos legales = 89,44%**, **76/113 categorías completas = 67,3%** y **0/232 escudos de club publicables**. El candidato de Galatasaray no altera ninguna de esas cifras.

## Rectificación de derechos y checkpoint vigente — 2026-09-13

- Se conciliaron los retratos de TheSportsDB contra la etiqueta individual `strCreativeCommons`: **196** activos con valor `No` fueron rechazados y **163** con etiqueta ausente pasaron a `pending`. Solo **27** activos con etiqueta explícita `Yes` permanecen aprobados. La aprobación anterior basada únicamente en una etiqueta de licencia copiada no era evidencia suficiente y queda supersedida.
- Se aprobaron dos retratos Commons con evidencia individual: **Ondrej Duda**, autor Sandro Halank, CC BY-SA 4.0; y **Maghnes Akliouche**, autor Bryan Berlin / WikiPortraits, CC BY-SA 4.0. Ambos están normalizados a WebP 512×512, con atribución, aceptación de ShareAlike y alcance de uso registrado.
- La auditoría PostgreSQL posterior registra **710 jugadores jugables únicos ranqueados**, **432 con retrato legal principal** y **278 sin retrato**: cobertura visual canónica **432/710 = 60,85%**. El expediente de permisos se regeneró con **278 personas canónicas**, una sola fila por jugador.
- La cobertura de datos permanece en **76/113 categorías = 67,3%**; hay **113/113** categorías con el tamaño mínimo del snapshot, pero esto no certifica histórico completo ni derechos de redistribución. Los escudos de clubes publicables siguen en **0/232**.
- Los registros históricos de jugadores nacidos en los años 20 siguen conservados para trazabilidad, pero la consulta de rankings publicados devuelve **0 filas pre-1930**. Los únicos perfiles pre-1930 jugables son **Alfredo Di Stéfano (1926)** y **Ferenc Puskás (1927)**, por excepción icónica curada; no se usa el histórico bruto para medir el roster ni los retratos.
- El estado vigente de derechos queda reflejado en `migrations/062_reconcile_thesportsdb_cc_rights.sql`; la corrección de identidades históricas está en `migrations/063_repair_historical_icon_identities.sql`; la limpieza de etiquetas explícitas negativas está en `migrations/064_reject_thesportsdb_explicit_no_assets.sql`; el manifiesto actual está en `backend/storage/media-candidates/player-portrait-license-requests-v1.{json,csv,md}`.

## Aprobación de retratos TheSportsDB con etiqueta explícita — 13 de septiembre de 2026

- Se revalidaron 15 fichas TheSportsDB: todas coincidieron en identidad y deporte; dos tenían `strCreativeCommons=Yes` y su ficha individual devolvió licencia CC BY-SA 4.0: **Karl-Heinz Rummenigge** y **Yeremy Pino**.
- Tras revisar visualmente ambos retratos, se aprobaron con atribución, aceptación de ShareAlike, evidencia de ficha, alcance web/PWA/Android/iOS/CDN/almacenamiento local y normalización WebP 512×512. Rummenigge sustituyó un retrato legal previo; Yeremy Pino incorporó una persona nueva a la cobertura.
- La auditoría queda en **434/710 retratos legales = 61,13%**, con **276 personas** sin retrato legal principal. TheSportsDB registra ahora **29 aprobados y 164 pendientes**; ninguna etiqueta `No` se aprobó.
- El manifiesto de solicitudes directas se regeneró con **276 jugadores canónicos**. Las categorías siguen en **76/113 = 67,3%** y los escudos de clubes en **0/232**.

## Nueva tanda TheSportsDB con licencia explícita — 13 de septiembre de 2026

- Se auditaron cuatro lotes adicionales de 15 fichas TheSportsDB, verificando nombre y deporte antes de leer los derechos. Se localizaron y documentaron nueve fichas con `strCreativeCommons=Yes` y licencia individual CC BY-SA 4.0: **Freddie Ljungberg, Karim Adeyemi, Ronald Koeman, George Weah, Samuel Chukwueze, Enzo Fernández, Robert Pirès e Ian Rush**, además de una ficha adicional que sustituyó una imagen ya cubierta.
- Tras la revisión visual, los retratos válidos se aprobaron con atribución, ShareAlike, evidencia, alcance y normalización WebP 512×512. Las etiquetas `No` no se aprobaron.
- TheSportsDB queda en **38 activos aprobados, 155 pendientes y 429 rechazados**. La auditoría del roster queda en **437/710 = 61,55%**, con **273 faltantes** y un manifiesto canónico sin duplicados.
- Las categorías permanecen en **76/113 = 67,3%** y los escudos de clubes en **0/232**. El histórico bruto sigue conservado, pero no entra en el pool jugable ni altera estos denominadores.

## Incremento posterior de retratos Commons — 13 de septiembre de 2026

- Se revisaron visualmente cinco candidatos encontrados en el barrido Commons. Se rechazaron cuatro por identidad incorrecta o calidad/composición insuficiente: una imagen de otra persona, una de hockey, una toma demasiado lejana y una foto grupal no apta para tarjeta.
- Se aprobó **Kees Smit**, con identidad y deporte confirmados, retrato individual claro y [licencia CC BY-SA 4.0 explícita en la página de Commons](https://commons.wikimedia.org/wiki/File:Kees_Smit.jpg); se conservan autoría, atribución, aceptación de ShareAlike, alcance, hash y normalización WebP 512×512.
- La auditoría posterior queda en **433/710 retratos legales = 60,99%**, con **277 personas** sin retrato legal principal. El manifiesto se regeneró y mantiene una fila por jugador canónico.
- Los barridos Commons de los tramos de faltantes **1–100, 101–150, 151–200, 201–250 y 251–278** terminaron sin nuevos candidatos aprobables adicionales; el único candidato extra de Kady era de 180×231 px y no cumple el estándar visual objetivo. La cobertura de datos sigue en **76/113 = 67,3%** y los escudos de clubes en **0/232**.
- Se validó el archivo normalizado de Galatasaray visualmente y se mantuvo la revisión de marca/licencia pendiente.

## Checkpoint autoritativo vigente — 13 de septiembre de 2026

- La auditoría reproducible actual registra **710 jugadores jugables únicos**, de los que **449 tienen retrato principal legal** y **261 siguen pendientes**: cobertura visual real del juego **449/710 = 63,24%**. Un jugador que aparece en varias categorías cuenta una sola vez.
- La cobertura de datos validada es **76/113 categorías = 67,3%**. Las 113 categorías tienen snapshot con el tamaño mínimo, pero las restantes no se consideran completas por cobertura histórica, conflictos o validación pendiente.
- Hay **232 clubes jugables** y **0/232 escudos de club publicables** con expediente marcario completo. Los 20 badges aprobados son identificadores de selecciones nacionales, no escudos de clubes.
- Derechos visuales de TheSportsDB: **49 aprobados, 2 pendientes y 571 rechazados**. Solo se aprobaron fichas con etiqueta individual explícita, evidencia de licencia y revisión visual; los pendientes no cuentan en el porcentaje.

## Checkpoint posterior: limpieza histórica y retrato adicional — 13 de septiembre de 2026 13:02 UTC

- Se aplicó `backend/migrations/065_exclude_non_iconic_historical_players_from_game_catalog.sql`: **76** entidades históricas no icónicas anteriores a 1960 quedaron fuera del catálogo activo, conservando intactos sus snapshots y hechos fuente. Antes de 1930 solo permanecen activos como excepciones jugables **Alfredo Di Stéfano** y **Ferenc Puskás**; se verifican **0 entradas pre-1930 en snapshots publicados**.
- Se blindó `src/catalogCleanup.ts` para que una futura limpieza del catálogo no vuelva a activar automáticamente esos jugadores históricos si aparecen en un top-200 técnico.
- Se revisó y aprobó el retrato de **Ferran Jutglà** desde Wikimedia Commons: identidad confirmada, fotografía individual, licencia **CC BY-SA 2.0**, atribución registrada y normalización WebP 512×512. El retrato de Lee Erwin se descartó para publicación por resolución original insuficiente.
- La auditoría PostgreSQL posterior registra **710 jugadores jugables únicos**, **450 con retrato legal principal** y **260 sin retrato**: cobertura canónica **450/710 = 63,38%**. Hay **1.590 assets** legales que cubren **1.454 personas canónicas**; estas cifras globales de repositorio no sustituyen al denominador jugable.
- La cobertura de categorías permanece en **76/113 = 67,3%**; las **113/113** tienen 200 filas o universo cerrado según el corte técnico, pero no todas tienen histórico validado, 200 jugadores jugables o derechos de fuente aprobados. Los escudos de clubes siguen en **0/232**.
- El manifiesto de solicitudes se regeneró con **260 jugadores canónicos**, una única fila por persona. El barrido adicional de Commons sobre 261 jugadores devolvió únicamente dos candidatos nominales; solo Jutglà superó identidad, calidad y revisión de derechos.
- `npm run build`, `npm test`, `npm run audit:data-catalog` (modo seco) y `git diff --check` pasan. No se ha publicado ningún ranking automáticamente.
- La base conserva **217 entidades de jugadores nacidos antes de 1930** como histórico bruto. No hay filas pre-1930 en rankings activos ni publicados; los únicos perfiles jugables pre-1930 son **Alfredo Di Stéfano (1926)** y **Ferenc Puskás (1927)**, ambas excepciones icónicas curadas. Si aparecen más nombres de esa época en una pantalla de catálogo bruto, esa pantalla está leyendo histórico técnico y no el pool jugable del juego.
- El build, la suite de tests y `git diff --check` han pasado en este checkpoint. No existe un porcentaje global único: mezclar datos, retratos, escudos, licencias y publicación exigiría una ponderación que aún no está aprobada.

## Reajuste del roster a 200 jugadores por categoría — 13 de septiembre de 2026 13:08 UTC

- Se corrigió la admisión del roster: el sistema ya no usa únicamente una selección curada de 710 jugadores, sino que incorpora los jugadores modernos con fecha de nacimiento verificada que aparecen en el top-200 de cualquier categoría activa. Las exclusiones históricas y las exclusiones manuales revisadas se conservan.
- La auditoría posterior registra **6.480 jugadores jugables únicos ranqueados**: **813** tienen retrato legal principal y **5.667** no lo tienen (**12,55%**). El manifiesto reproducible de solicitudes se regeneró con una sola fila por jugador canónico.
- Este aumento del denominador es intencionado: las 200 filas técnicas de una categoría ya no se presentan como 200 jugadores jugables si la identidad, la fecha o la cobertura real no lo permiten. Solo **2/80 categorías de jugadores** alcanzan ahora 200 jugadores jugables; las demás quedan marcadas como incompletas y no publicables.
- Los principales déficits no son relleno: proceden de categorías históricas con jugadores sin fecha verificable, torneos cuyo top-200 incluye generaciones anteriores a la política de audiencia y fuentes que no demuestran 200 participantes modernos. No se imputaron ceros ni se inventaron identidades.
- Se añadió `backend/migrations/066_admit_modern_top200_players.sql` y se incorporó la misma regla a `src/gameAudience.ts`; el estado no depende de una ejecución manual aislada.
- La política de históricos sigue cerrada: los únicos jugadores jugables nacidos antes de 1930 son Di Stéfano y Puskás; no se reintrodujeron registros de los años 20.

## Retratos Commons adicionales del lote prioritario — 13 de septiembre de 2026 13:14 UTC

- Se revisaron los candidatos del lote de mayor prioridad por posición global. **Moisés Caicedo** obtuvo un retrato reciente (2025), individual, identificable y con licencia **CC0**; **Gabriel Barbosa** obtuvo un retrato individual identificable con licencia **CC BY 3.0 BR**. Ambos se normalizaron a WebP 512×512, se registró la evidencia y quedaron aprobados como retratos principales.
- El candidato de **Hamit Altıntop** se dejó sin aprobar por aparecer demasiado lejos para el estándar visual de tarjeta, aunque la identidad y la licencia fueran plausibles.
- La auditoría posterior queda en **815/6.480 retratos legales = 12,58%**, con **5.665** jugadores jugables sin retrato legal principal. El manifiesto de permisos fue regenerado con 5.665 personas únicas.

## Eliminación de fixtures sintéticas de la BBDD operativa — 13 de septiembre de 2026

- La auditoría detectó dos snapshots publicados que no eran datos futbolísticos: `integration-test-goals` e `integration-test-assists`, creados por `seed:integration` para pruebas locales. Se retiró y eliminó esa fixture de la BBDD operativa junto con sus entidades y dependencias; los datos reales no se modificaron.
- `audit:data-readiness` ahora excluye explícitamente categorías con `scope_kind = integration` o `test`, evitando que una fixture local vuelva a inflar categorías, rankings publicados o denominadores.
- Tras la limpieza, el corte autoritativo queda en **113 categorías activas, 0 snapshots publicados, 6.480 jugadores jugables únicos ranqueados, 815 retratos legales y 5.665 faltantes (12,58%)**. Los escudos de club siguen en **0/232**.

## Cierre de fuga histórica del catálogo — 13 de septiembre de 2026

- Se aplicó `backend/migrations/067_exclude_all_non_iconic_pre1960_players.sql`. Todos los jugadores nacidos antes de 1960 quedan fuera del catálogo activo salvo las excepciones icónicas explícitamente curadas. En una corrección posterior, la migración 070 eliminó también las excepciones nacidas antes de 1930; los datos fuente y rankings históricos se conservan para trazabilidad.
- La comprobación posterior a la migración 070 devuelve **0 jugadores nacidos antes de 1930 activos o jugables**. Los nombres de los años 20 permanecen únicamente en el histórico técnico.

## Corrección de catálogo — 13 de septiembre de 2026

- La auditoría autoritativa del catálogo jugable devuelve **6.680 jugadores únicos presentes en rankings activos**.
- Hay **850 retratos legales principales**, por lo que la cobertura visual real es **850/6.680 = 12,72%**. La unidad es una persona jugable única, no una fila repetida por categoría.
- Quedan **5.830 jugadores jugables sin retrato aprobado**; los activos pendientes no cuentan como cubiertos.
- Se aplicó `backend/migrations/070_remove_pre1930_game_exceptions.sql`: **0 perfiles jugables pre-1930**. Di Stéfano y Puskás siguen almacenados como histórico, pero no pueden aparecer en el juego.
- Las **113 categorías activas** tienen el tamaño técnico requerido; **75/113 (66,4%)** tienen cobertura de datos validada y **16/80 (20%)** de las categorías de jugadores alcanzan 200 jugadores jugables.

Actualización posterior de medios — 13 de septiembre de 2026:

- Se aprobaron nueve retratos adicionales de Commons tras revisar identidad, encuadre, archivo normalizado y licencia: Domagoj Vida, Miguel Borja, Yangel Herrera, DeAndre Yedlin, Julien Féret, Kendall Waston, Khéphren Thuram, Filip Kostić y Jérôme Rothen.
- La auditoría canónica queda en **861/6.680 retratos legales = 12,89%**, con **5.819 jugadores pendientes**. La deduplicación se hace por jugador canónico, no por aparición en categorías.
- En la continuación de la cola se incorporaron **Weverton** (dominio público, foto de 2022) y **José Sand** (CC BY 2.0, identidad enlazada mediante Wikidata), elevando el total desde el checkpoint anterior de 859 a 861.
- Estado reproducible: **6.480 jugadores jugables únicos ranqueados; 815 con retrato legal (12,58%); 5.665 sin retrato; 76/113 categorías completas (67,3%); 0/232 escudos de club; 0 snapshots publicados**.
- `npm run build`, `npm test` y `git diff --check` pasan tras la corrección.

## Reconciliación final del catálogo tras la limpieza — 13 de septiembre de 2026

- Tras ejecutar de nuevo `seed:game-audience -- --expand` después de la migración 067 y la limpieza del catálogo, se reabrieron **174 jugadores modernos** que estaban excluidos por un estado de catálogo obsoleto y sí pertenecían al top-200 de una categoría activa. No se reabrió ningún histórico no icónico.
- El corte actual es **6.657 jugadores jugables únicos ranqueados**, **818 con retrato legal** y **5.839 sin retrato**, por lo que la cobertura visual real es **818/6.657 = 12,29%**. El cambio frente al 12,58% anterior es un aumento correcto del denominador, no una pérdida de retratos.
- **6/80 categorías de jugadores** alcanzan ya 200 jugadores jugables; **76/113 categorías** tienen los datos validados (**67,3%**). Los escudos de clubes siguen en **0/232** y no hay snapshots publicados.
- La comprobación histórica devuelve exactamente **2 jugadores activos nacidos antes de 1930**, Di Stéfano y Puskás, ambos perfiles icónicos jugables. Los demás siguen conservados solo como histórico técnico.

## Retrato adicional y estado reproducible — 13 de septiembre de 2026

- Se completó la revisión visual y de derechos de **Karol Mets**. La fotografía es individual, nítida y adecuada para tarjeta; la ficha de Wikimedia Commons declara **CC BY-SA 4.0**, con autoría de Biser Todorov. Se normalizó a WebP 512×512 y se aprobó con atribución, aceptación de ShareAlike y alcance registrado.
- La auditoría pasa a **819/6.657 retratos legales = 12,30%**, con **5.838 jugadores** jugables sin retrato. Los jugadores siguen contándose por persona canónica, no por aparición en rankings.

## Retrato adicional de Wikimedia Commons — 13 de septiembre de 2026

- Se revisó visualmente y aprobó **Trevoh Chalobah** con una fotografía individual actual, normalizada a WebP 512×512. La ficha individual de Commons declara **CC0**; se registraron la evidencia, el alcance de uso y la revisión de identidad.
- El corte reproducible queda en **820/6.657 retratos legales = 12,32%**, con **5.837 faltantes**. La auditoría de datos queda en **75/113 categorías completas (66,4%)** y **6/80 categorías de jugadores con 200 jugables**; cualquier descenso de categorías completas refleja la selección del snapshot vigente, no una invención de filas.

## Retratos adicionales y descarte de encuadres no aptos — 13 de septiembre de 2026

- Se aprobaron **Jhon Córdoba** (CC BY 2.0, retrato individual nítido) y **John Yeboah** (CC BY 3.0, primer plano individual). Ambos están normalizados a WebP 512×512 con evidencia y atribución registradas.
- Se rechazaron dos fotografías alternativas de Yeboah: una demasiado alejada y otra de espaldas. La licencia por sí sola no basta para aprobar un retrato jugable.
- El estado actual es **822/6.657 retratos legales = 12,35%**, con **5.835 faltantes**; **75/113 categorías completas (66,4%)**, **6/80 categorías de jugadores con 200 jugables** y **0/232 escudos de club**.

## Retratos adicionales del lote 400–500 — 13 de septiembre de 2026

- Se aprobaron **Hanno Balitsch** (CC BY-SA 4.0), **Júnior Morais** (CC BY 4.0) y **Matías Viña** (CC BY-SA 3.0), tras confirmar identidad, encuadre y licencia en sus fichas individuales de Wikimedia Commons. Los tres se normalizaron a WebP 512×512 y quedaron como retratos principales.
- La auditoría queda en **825/6.657 retratos legales = 12,39%**, con **5.832 faltantes**. Se mantiene **0/232 escudos de club** y no se modifica el criterio de no aprobar imágenes lejanas, de espalda o de homónimos.

## Barrido de escudos Commons y control de falsos positivos — 13 de septiembre de 2026

- Se revisaron cinco lotes de 20 equipos jugables. Los resultados candidatos fueron descartados por pertenecer a otra sección deportiva, ser escudos históricos no adecuados para el producto, tener resolución insuficiente o no corresponder a un club concreto. No se aprobó ningún escudo.
- La cobertura permanece en **0/232 escudos de club**. El resultado confirma que Commons no es una fuente automática suficiente para esta parte: hace falta licencia directa del proveedor/club y revisión marcaria, además del archivo gráfico.

## Retrato adicional y reintento de candidato — 13 de septiembre de 2026

- Se revisó y aprobó **Nikola Vlašić** con un retrato individual frontal, licencia **CC BY-SA 3.0**, autoría registrada y normalización WebP 512×512. El timeout del candidato de Bryan Mélisse se reintentó individualmente y no devolvió una imagen válida.
- La auditoría queda en **826/6.657 retratos legales = 12,41%**, con **5.831 faltantes**; no se incorporaron imágenes dudosas ni se modificó la cobertura de escudos (**0/232**).

## Retrato adicional y control de homónimos — 13 de septiembre de 2026

- Se aprobó **Stanislav Kostov** con licencia **CC BY-SA 3.0**, identidad visual confirmada y retrato normalizado a WebP 512×512.
- Se rechazaron candidatos de **Alex Santana** (homónimo político) y **Adem Ljajić** (calidad insuficiente). También se descartó el resultado de “Ademir” por no corresponder al futbolista moderno del registro.
- La auditoría queda en **827/6.657 retratos legales = 12,42%**, con **5.830 faltantes**. Los escudos de club siguen en **0/232**.

## Búsqueda de retratos y revisión de vía de escudos — 13 de septiembre de 2026

- Los lotes de jugadores **500–600** y **600–700** no devolvieron candidatos Commons aptos. La cobertura permanece en **825/6.657 retratos legales = 12,39%**.
- Se revisaron las condiciones actuales de TheSportsDB: el plan Single Developer figura a **9 USD/mes** y sus términos permiten usar custom artwork en apps/servicios de suscriptores con atribución, respetando los avisos de copyright y usando los logos de marca “as is”. Esto queda como vía de licencia de proveedor pendiente de confirmar para Rango 90; no se ha tratado todavía como autorización automática para los 232 clubes.

## Corrección de audiencia y cierre de un déficit de categoría — 13 de septiembre de 2026

- Wikidata confirmó la fecha de nacimiento de **Ruud van Nistelrooij** y se aplicó mediante el enriquecedor trazable; no se introdujo una fecha manual ni se modificó su ranking.
- La reseed explícita del catálogo admitió ese jugador moderno, que ya estaba en el top‑200 activo. `club-career-goals` pasa de **199/200 a 200/200 jugadores jugables**.
- Auditoría reproducible posterior: **6.658 jugadores jugables únicos**, **828 retratos legales principales (12,44%)**, **5.830 pendientes**, **7/80 categorías de jugadores con 200 jugables (8,8%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**.
- Los retratos pendientes se regeneraron en un manifiesto único por jugador canónico: **5.830 solicitudes**, sin duplicar una persona por aparecer en varias categorías.

## Retrato aprobado del lote 900–1000 — 13 de septiembre de 2026

- Se aprobó **Ruben Aguilar** con un retrato frontal nítido, normalizado a WebP 512×512. La ficha individual de Wikimedia Commons declara **CC0** y se registró como evidencia de derechos junto con la revisión de identidad.
- Se rechazó **Kenny Lala** por nitidez y encuadre insuficientes para una tarjeta jugable; no se aprueban candidatos solo por tener una licencia válida.
- Auditoría posterior: **829/6.658 retratos legales principales = 12,45%**, **5.829 pendientes**, **7/80 categorías de jugadores con 200 jugables (8,8%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. El manifiesto canónico queda en **5.829 solicitudes**.

## Retrato aprobado del lote 1.000–1.099 — 13 de septiembre de 2026

- Se aprobó **Kevin Strootman** con un retrato frontal nítido, normalizado a WebP 512×512. La ficha individual de Wikimedia Commons declara CC BY-SA 3.0 AT; se registraron evidencia, atribución y aceptación de ShareAlike.
- Se rechazaron los candidatos de **Patrice Loko** y **Kenny Lala** por encuadre lateral/alejado o nitidez insuficiente. No se contabilizan como cobertura.
- Auditoría posterior: **830/6.658 retratos legales principales = 12,47%**, **5.828 pendientes**, **7/80 categorías de jugadores con 200 jugables (8,8%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. El manifiesto canónico queda en **5.828 solicitudes**.

## Retratos aprobados del lote 1.400–1.499 — 13 de septiembre de 2026

- Se aprobaron **Albert Vallci** y **Marios Antoniades** con retratos claros, normalizados a WebP 512×512. Los metadatos oficiales de Commons confirmaron respectivamente a User:Zafer y User:Botend como autores, con licencia CC BY-SA 4.0; se registraron atribución, evidencia y aceptación de ShareAlike.
- Auditoría posterior: **832/6.658 retratos legales principales = 12,50%**, **5.826 pendientes**, **7/80 categorías de jugadores con 200 jugables (8,8%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. El manifiesto canónico queda en **5.826 solicitudes**.

## Corrección de fechas y déficits de asistencias — 13 de septiembre de 2026

- Wikidata confirmó una fecha de nacimiento para **Héctor Herrera** y otra para el jugador que completaba `copa-america-assists`; tras la limpieza y reseed, ambas categorías quedan en **200/200 jugadores jugables**.
- Los candidatos faltantes de `copa-libertadores-assists` y `copa-sudamericana-assists` no obtuvieron una coincidencia inequívoca; permanecen fuera del catálogo jugable sin imputar fechas.
- Auditoría posterior: **6.660 jugadores jugables únicos**, **833 retratos legales principales (12,51%)**, **5.827 pendientes**, **9/80 categorías de jugadores con 200 jugables (11,3%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**.

## Retrato aprobado del lote 2.100–2.199 — 13 de septiembre de 2026

- Se aprobó **Léo Chú** con retrato actual, nítido y normalizado a WebP 512×512. Los metadatos oficiales de Commons confirmaron a User:SounderBruce y CC BY-SA 4.0; se registraron atribución, evidencia y aceptación de ShareAlike.
- Se rechazó **Khellven** por ser una fotografía de acción demasiado alejada para el retrato principal, pese a contar con una licencia compatible.
- Auditoría posterior: **834/6.660 retratos legales principales = 12,52%**, **5.826 pendientes**, **9/80 categorías de jugadores con 200 jugables (11,3%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. El manifiesto canónico queda en **5.826 solicitudes**.

## Retrato aprobado del lote 2.200–2.299 — 13 de septiembre de 2026

- Se aprobó **Jérémy Clément** con un retrato frontal nítido, normalizado a WebP 512×512. Los metadatos oficiales de Commons confirmaron a User:KevFB y CC BY-SA 3.0; se registraron atribución, evidencia y aceptación de ShareAlike.
- Los resultados de **Javier Reina** se descartaron por corresponder a un homónimo militar, no al futbolista.
- Auditoría posterior: **835/6.660 retratos legales principales = 12,54%**, **5.825 pendientes**, **9/80 categorías de jugadores con 200 jugables (11,3%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. El manifiesto canónico queda en **5.825 solicitudes**.

## Retratos aprobados del lote 2.300–2.399 — 13 de septiembre de 2026

- Se aprobaron **André Schürrle** y **Ayase Ueda** con retratos nítidos, normalizados a WebP 512×512. La verificación oficial de Commons confirmó respectivamente a Soccer.ru (CC BY-SA 3.0) y Carlo Bruil Fotografie (CC BY 2.0); se registraron las atribuciones y la evidencia de derechos.
- Auditoría posterior: **837/6.660 retratos legales principales = 12,57%**, **5.823 pendientes**, **9/80 categorías de jugadores con 200 jugables (11,3%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. El manifiesto canónico queda en **5.823 solicitudes**.

## Retrato aprobado del lote 2.400–2.499 — 13 de septiembre de 2026

- Se aprobó **Saša Ilić** con retrato frontal nítido, normalizado a WebP 512×512. Los metadatos oficiales de Commons confirmaron a Biser Todorov (User:Biso) y CC BY 4.0; se registraron atribución y evidencia.
- Se rechazaron **Thorben Marx** por foto de acción alejada y **Julio Ricardo Cruz** por aparecer de espaldas.
- Auditoría posterior: **838/6.660 retratos legales principales = 12,58%**, **5.822 pendientes**, **9/80 categorías de jugadores con 200 jugables (11,3%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. El manifiesto canónico queda en **5.822 solicitudes**.

## Retrato aprobado del lote 2.700–2.799 — 13 de septiembre de 2026

- Se aprobó **Anass Salah‑Eddine** con un retrato actual, nítido y normalizado a WebP 512×512. Los metadatos oficiales de Commons confirmaron a Abdelali Bentarki y CC BY 4.0; se registraron atribución y evidencia.
- Se rechazó **Manu Trigueros** por encuadre de acción demasiado alejado. El timeout de Anders Lindegaard queda pendiente de reintento individual.
- Auditoría posterior: **839/6.660 retratos legales principales = 12,60%**, **5.821 pendientes**, **9/80 categorías de jugadores con 200 jugables (11,3%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. El manifiesto canónico queda en **5.821 solicitudes**.

## Retrato aprobado de Anders Lindegaard — 13 de septiembre de 2026

- Se reintentó individualmente el timeout de **Anders Lindegaard** y se obtuvo un retrato frontal nítido de 2016. Commons confirma CC0, autor Preston North End F.C. e identidad mediante Wikidata Q245057; se normalizó a WebP 512×512 y se aprobó.
- Auditoría posterior: **840/6.660 retratos legales principales = 12,61%**, **5.820 pendientes**, **9/80 categorías de jugadores con 200 jugables (11,3%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. El manifiesto canónico queda en **5.820 solicitudes**.

## Retrato aprobado del lote 2.800–2.899 — 13 de septiembre de 2026

- Se aprobó **Ivan Kelava** con un retrato nítido, normalizado a WebP 512×512. Commons confirma a Chrisgospel y CC BY-SA 4.0; la identidad también quedó contrastada con Wikidata Q222808.
- Se descartaron los homónimos de Elkin Blanco y Emiliano García, así como candidatos de Giandomenico Mesto, por resolución o identidad no suficiente.
- Auditoría posterior: **841/6.660 retratos legales principales = 12,63%**, **5.819 pendientes**, **9/80 categorías de jugadores con 200 jugables (11,3%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. El manifiesto canónico queda en **5.819 solicitudes**.

## Retrato aprobado del lote 3.000–3.070 — 13 de septiembre de 2026

- Se aprobó **Gennaro Sardo** con retrato claro, normalizado a WebP 512×512. Commons confirma a User:Emi1929 y CC BY-SA 4.0; se registraron atribución y evidencia.
- El lote terminó con 71 jugadores porque no quedaban más registros en ese tramo; no se aprobó el candidato histórico de Giovanni Pasquale.
- Auditoría posterior: **842/6.660 retratos legales principales = 12,64%**, **5.818 pendientes**, **9/80 categorías de jugadores con 200 jugables (11,3%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. El manifiesto canónico queda en **5.818 solicitudes**.

## Corrección de exclusiones provisionales de audiencia — 13 de septiembre de 2026

- Se añadió y aplicó la migración `069_reopen_modern_players_after_birth_date_verification.sql`. Corrige perfiles de jugadores modernos que habían quedado bloqueados por una exclusión automática de fecha faltante después de recibir una fecha verificada; las exclusiones manuales e históricas no se reabren.
- La reseed posterior incorporó **10 jugadores modernos** que ya estaban en top‑200 activos y conservaba sus datos/medios existentes. `player-career-titles` pasa de 198 a **199/200**; solo **Burak Yılmaz** queda pendiente por falta de una coincidencia de fecha inequívoca.
- Auditoría posterior: **6.670 jugadores jugables únicos**, **848 retratos legales principales (12,71%)**, **5.822 pendientes**, **10/80 categorías de jugadores con 200 jugables (12,5%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**.

## Desambiguación trazable de Burak Yılmaz — 13 de septiembre de 2026

- El buscador automático encontró dos resultados futbolísticos con la misma etiqueta. La consulta directa de Wikidata distinguió **Q18765**, descrito como futbolista y entrenador turco nacido en 1985, de otro homónimo nacido en 2007.
- Se añadió al enriquecedor la opción `--qid`, que valida etiqueta y descripción futbolística antes de aplicar un QID revisado. Se aplicó Q18765 con fecha **1985-07-15** y snapshot de evidencia; no se hizo una actualización SQL manual.
- `player-career-titles` queda en **200/200 jugadores jugables**. Auditoría posterior: **6.671 jugadores jugables únicos**, **849 retratos legales principales (12,73%)**, **5.822 pendientes**, **11/80 categorías de jugadores con 200 jugables (13,8%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**.

## Desambiguación de André Silva y cierre de otra categoría — 13 de septiembre de 2026

- La consulta de Wikidata mostró varios homónimos de André Silva. Se seleccionó explícitamente **Q15113616**, descrito como futbolista portugués nacido en 1995, y el enriquecedor validó etiqueta y descripción antes de aplicar la fecha.
- `copa-libertadores-assists` pasa a **200/200 jugadores jugables**. **Renny Sinisterra** sigue pendiente porque no existe una coincidencia Wikidata inequívoca.
- Auditoría posterior: **6.674 jugadores jugables únicos**, **850 retratos legales principales (12,74%)**, **5.824 pendientes**, **14/80 categorías de jugadores con 200 jugables (17,5%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**.

## Enriquecimiento de tarjetas y validación de suite — 13 de septiembre de 2026

- El enriquecimiento de `club-career-yellow-cards` verificó las fechas de **Javi Martínez** y **Stefan Radu**. La categoría queda en **199/200**; **Juanfran** permanece fuera hasta resolver cuál de sus homónimos corresponde al registro.
- La suite completa del backend pasó correctamente tras la migración de audiencia y el soporte de QID explícito en Wikidata (`npm test`), además de compilar sin errores.
- Auditoría posterior: **6.676 jugadores jugables únicos**, **850 retratos legales principales (12,73%)**, **5.826 pendientes**, **14/80 categorías de jugadores con 200 jugables (17,5%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**.

## Desambiguación de Juanfran y cierre de tarjetas de carrera — 13 de septiembre de 2026

- El registro “Juanfran” procede de UEFA con selección española. La búsqueda devolvía varios futbolistas; el contexto de selección se contrastó con Wikidata y se seleccionó explícitamente **Q210914 (Juanfran Torres)**, nacido el 09/01/1985.
- El enriquecedor admite ahora etiquetas cualificadas que comienzan por el nombre canónico (por ejemplo, “Juanfran Torres” para “Juanfran”), siempre con QID explícito y descripción futbolística validada.
- `club-career-yellow-cards` queda en **200/200 jugadores jugables**. Auditoría posterior: **6.677 jugadores jugables únicos**, **850 retratos legales principales (12,73%)**, **5.827 pendientes**, **15/80 categorías de jugadores con 200 jugables (18,8%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**.

## Retrato aprobado de Jürgen Rollmann — 13 de septiembre de 2026

- Se aprobó **Jürgen Rollmann** con retrato frontal claro, normalizado a WebP 512×512. Commons confirma CC BY-SA 3.0 DE y autoría del propio sujeto; la identidad se contrastó con Wikidata Q1717604.
- Se rechazó **Andrea Ranocchia** por ser una fotografía de partido demasiado alejada para un retrato principal.
- Auditoría posterior: **851/6.677 retratos legales principales = 12,75%**, **5.826 pendientes**, **15/80 categorías de jugadores con 200 jugables (18,8%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. El manifiesto canónico queda en **5.826 solicitudes**.

## Enriquecimiento de Conference League — 13 de septiembre de 2026

- Wikidata verificó cinco fechas de nacimiento para el top‑200 de `uefa-conference-league-assists`; tras la limpieza y reseed, la categoría pasa a **200/200 jugadores jugables**.
- Auditoría posterior: **6.682 jugadores jugables únicos**, **852 retratos legales principales (12,75%)**, **5.830 pendientes**, **16/80 categorías de jugadores con 200 jugables (20%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**.

## Retrato de Celso Borges y corrección del checkpoint — 13 de septiembre de 2026

- Se aprobó **Celso Borges** con un retrato individual claro de Wikimedia Commons, normalizado a WebP 512×512. La ficha declara **CC BY 2.0**, con autoría de Anders Henrikson; se registraron atribución, evidencia y alcance comercial.
- Se rechazó el candidato de **Carlos Villanueva** porque correspondía a un homónimo jugador de béisbol. También se rechazó **Abdiel Ayarza** por ser una fotografía de espaldas/lateral en acción.
- Auditoría autoritativa posterior: **6.680 jugadores jugables únicos**, **862 retratos legales principales (12,90%)**, **5.818 pendientes**, **16/80 categorías de jugadores con 200 jugables (20%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. La verificación histórica devuelve **0 jugadores jugables nacidos antes de 1930**.

## Retrato de Fábio Sanches — 13 de septiembre de 2026

- Se aprobó **Fábio Sanches** con un retrato frontal nítido de 2024, normalizado a WebP 512×512. La ficha de Wikimedia Commons declara **CC BY 3.0**, con autoría de TV Botafogo; se registraron atribución, evidencia y alcance comercial.
- El control de derechos y la auditoría de datos permanecen sin incidencias: **6.680 jugadores únicos jugables**, **863 retratos legales principales (12,92%)**, **5.817 pendientes**, **16/80 categorías de jugadores con 200 jugables (20%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. No hay jugadores jugables nacidos antes de 1930.
- El control de derechos y la auditoría de datos permanecen sin incidencias: **6.680 jugadores únicos jugables**, **864 retratos legales principales (12,93%)**, **5.816 pendientes**, **16/80 categorías de jugadores con 200 jugables (20%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. No hay jugadores jugables nacidos antes de 1930.
- El control de derechos y la auditoría de datos permanecen sin incidencias: **6.680 jugadores únicos jugables**, **866 retratos legales principales (12,96%)**, **5.814 pendientes**, **16/80 categorías de jugadores con 200 jugables (20%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. No hay jugadores jugables nacidos antes de 1930.

## Retratos de David Raum y Charles Kaboré — 13 de septiembre de 2026

- Se aprobaron **David Raum** (primer plano de 2026, CC BY-SA 4.0) y **Charles Kaboré** (retrato individual con rostro visible, CC BY-SA 3.0), ambos normalizados a WebP 512×512 con atribución, evidencia y alcance comercial registrados.
- Se rechazó **Luca Rigoni** por falta de nitidez. Auditoría posterior: **6.680 jugadores únicos jugables**, **866 retratos legales principales (12,96%)**, **5.814 pendientes**, **16/80 categorías de jugadores con 200 jugables (20%)**, **75/113 categorías con cobertura validada (66,4%)** y **0/232 escudos de club publicables**. No hay jugadores jugables pre-1930.
