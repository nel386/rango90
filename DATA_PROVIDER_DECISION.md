# Decisión provisional sobre proveedores de datos

## Alcance actual del catálogo de jugadores

Se ha simplificado el catálogo para que las estadísticas de jugador no se dispersen por cada copa. Las categorías globales son `club-career-goals`, `club-career-assists`, `player-career-titles`, `club-career-yellow-cards`, `club-career-red-cards` y `goalkeeper-career-clean-sheets`; las categorías por competición se reservan para ligas principales, Champions, UEFA Cup/Europa League unificada, Conference, Libertadores/Sudamericana y grandes torneos de selecciones. Las copas nacionales, supercopas y Recopa mantienen sus datos de origen y palmarés de clubes cuando corresponde, pero sus estadísticas y títulos de jugador están retirados del juego. Las categorías de una sola edición de la EURO también se conservan únicamente como snapshots de evidencia: el catálogo jugable usa los agregados globales `euro-goals` y `euro-assists`. Las categorías estadísticas que todavía no alcanzan 200 jugadores reales con una fuente homogénea se mantienen como evidencia de investigación, pero están retiradas del juego hasta completar su cobertura.

## Resultado de la investigación

Para estadísticas concretas de una competición seguiremos priorizando la fuente oficial de esa competición. Ya funciona con las estadísticas históricas de jugadores de Premier League y queda almacenada como `draft` hasta revisar derechos y definición.

Actualización de producción del 12 de septiembre de 2026: `premier-league-goals` se reconstruyó desde el endpoint oficial `all-seasons` (`premier-league-official`). El snapshot vigente es `rs_60bf2298d7eeeeb55a4f55c2`, con 200 jugadores únicos, 2.893 registros recibidos, 2.880 valores positivos y `coverageComplete=true`. El corte conserva el empate oficial en la posición 197 (39 goles). El alcance histórico acreditado empieza en 1992/93, por lo que no se presenta como récord de First Division anterior; sigue en `draft` hasta resolver derechos de redistribución.

La misma fuente oficial se ha aplicado a las cinco métricas de Premier League. Los snapshots vigentes son: goles `rs_60bf2298d7eeeeb55a4f55c2`, asistencias `rs_4401e80008b03c7727c59802`, porterías a cero `rs_8bd0292ed420826fe04a3539`, tarjetas amarillas `rs_c1b37011a77d667e55236233` y tarjetas rojas `rs_05fc66e75ab879bab0f04e52`. Cada uno contiene exactamente 200 jugadores únicos, `coverageComplete=true`, conserva el orden oficial y permanece en `draft` hasta resolver los derechos de redistribución. Para asistencias y tarjetas, el importador aplica ahora un corte reproducible de las primeras 200 posiciones oficiales; para porterías a cero filtra primero a los porteros y después aplica el mismo límite.

La página oficial de aclaraciones de estadísticas de la Premier League indica que los datos de rendimiento son recopilados por Opta/Stats Perform, que las estadísticas de jugador cubren desde 1992/93 en las categorías básicas y que pasan por una revisión posterior al partido. Es evidencia de calidad y procedencia, pero no sustituye una licencia de redistribución. Los términos de uso de la Premier League indican que sus marcas, logos y nombres pertenecen a sus titulares y que no se concede permiso para utilizarlos sin autorización escrita.

Para carreras mundiales, partidos históricos y competiciones con cobertura fragmentada necesitamos un proveedor de datos. La API no se consultará durante una partida: solo servirá para importaciones, comprobaciones y detección de cambios.

La UEFA ya se ha incorporado como fuente oficial específica para la Champions League. Sus páginas históricas de estadísticas exponen rankings de goles, asistencias y tarjetas rojas; el importador recorre las diez páginas oficiales, valida el corte técnico de 200 filas, posiciones empatadas, IDs únicos y valores no ascendentes. Los snapshots siguen como `draft`: la cobertura estadística no concede permiso de redistribución. Las URLs de imágenes que acompaña UEFA se registran únicamente como candidatos pendientes: la publicación comercial requiere autorización independiente.

La misma comprobación se ha aplicado a la Europa League. UEFA expone rankings de goles, asistencias y rojas, pero la comprobación del 10 de septiembre de 2026 volvió a devolver 80 filas en ocho páginas y no 100; el importador lo detecta y rechaza la carga antes de escribir datos para no fabricar un top 100 con otra fuente. API-Football identifica correctamente la competición con el ID 3, pero su endpoint completo devuelve entre 95 y 301 páginas por temporada en 2011–2023 (unas 2.757 páginas para esa ventana) y empezó a responder `rateLimit` durante la medición. No se ha iniciado esa importación: el coste de cuota y la cobertura histórica no justifican descargarla sin un presupuesto y una fuente de respaldo.

El mismo flujo cubre la UEFA Conference League y la EURO para goles, asistencias y tarjetas rojas. Sus 100 filas oficiales se guardan como snapshots independientes y no se mezclan entre competiciones; la ausencia de una fila o de una licencia no se rellena por inferencia. La bandera `coverage_complete=true` describe únicamente ese top 100 validado.

### Mundial: títulos de selecciones

Para `world-cup-national_team-titles` se han incorporado las dos páginas históricas oficiales de FIFA que cubren los campeones masculinos de 1930 a 2026. El snapshot `rs_6ef1e4b6e42252fcebc01b97` contiene 8 selecciones, los años de cada título y la regla explícita de continuidad de Alemania Federal/Alemania. La cobertura es completa para este universo cerrado, pero el snapshot permanece `draft` con `rightsStatus=review_required` hasta completar la revisión de publicación.

Las banderas de esas 8 selecciones están normalizadas a WebP 512x512. Se han aprobado únicamente archivos de Wikimedia Commons con licencia de dominio público o compatible; esto no se extrapola a escudos de clubes ni a los logos oficiales de FIFA.

### Goles en fases finales del Mundial

Para `world-cup-goals` se utiliza la tabla específica de [RSSSF de los 100 máximos goleadores de las fases finales](https://www.rsssf.org/tables/30all-scor.html), actualizada después del Mundial 2026. El importador exige 100 filas, orden descendente y conserva país, intervalo de torneos y la página de evidencia. El alcance es únicamente la fase final masculina de 1930 a 2026: no incluye eliminatorias ni goles de selección fuera del torneo. El snapshot queda en `draft` porque RSSSF es una fuente histórica de referencia y sus derechos de redistribución todavía requieren revisión.

### Asistencias en fases finales del Mundial

Para `world-cup-assists` se ha añadido un importador de [StatBunker](https://www.statbunker.com/alltimestats/AllTimeCompetitionMostAssists?comp_code=WC). La tabla global visible devuelve 50 filas, pero el proceso consulta además las páginas históricas de las 86 selecciones enlazadas por el proveedor, deduplica por el ID estable de jugador y obtiene 502 jugadores antes de seleccionar el top 200. Las páginas sin asistentes se aceptan como contribución vacía; cualquier fallo HTTP o agregado inferior a 200 aborta la importación. El alcance declarado es la fase final masculina. El snapshot actual contiene 200 jugadores y se conserva como parcial (`coverageComplete=false`) porque StatBunker es un agregador de referencia y todavía debemos cerrar la validación metodológica cruzada y los derechos de redistribución. La cabecera de la tabla coincide en sus líderes y metodología temporal con la referencia de [Opta Analyst](https://theanalyst.com/articles/world-cup-most-assists), pero las diferencias de actualización (por ejemplo, Messi) se conservarán como evidencia para revisión, nunca se combinarán silenciosamente.

El mismo patrón se ha aplicado a las tarjetas históricas del Mundial con [StatBunker — amarillas](https://statbunker.com/alltimestats/AllTimeYellowCards?comp_code=WC) y [rojas](https://www.statbunker.com/alltimestats/AllTimeRedCards?comp_code=WC). La agregación por las páginas históricas de selecciones ha cerrado 200 jugadores para amarillas. Para rojas solo se han encontrado 183 jugadores con valor positivo; se conserva la categoría sin completar y no se añaden ceros artificiales. Ambos snapshots permanecen en `draft` y `rights_status=review_required`.

Para `world-cup-clean_sheets` se añadió un importador específico de [StatBunker — porterías a cero por edición](https://www.statbunker.com/competitions/Top10KeepersCleanSheets?comp_id=727). El proceso descubre las ediciones históricas expuestas por el proveedor, descarga la tabla de porteros de cada edición y suma `CS` por el `player_id` de StatBunker. Los ceros solo se incluyen cuando aparecen explícitamente en una tabla de una edición; no se fabrican valores para jugadores no registrados. La ejecución del 11 de septiembre de 2026 produjo 200 entradas en `rs_cc024723567a4d5d4f4679b8`, con 200 entidades únicas. El snapshot permanece `draft` y `coverageComplete=false`: falta contrastar el conjunto completo con FIFA, confirmar que la lista de ediciones cubre el alcance que queremos y revisar los derechos de redistribución de StatBunker. Cuando el dominio principal no responde, el cliente usa el mirror de lectura únicamente para recuperar el mismo documento y conserva la URL canónica como evidencia.

Para `copa-america-clean_sheets` se aplica el mismo importador histórico de [StatBunker — Copa América](https://www.statbunker.com/competitions/Top10KeepersCleanSheets?comp_id=595), sin mezclar la Copa América con Libertadores, Sudamericana ni otras competiciones. La ejecución del 12 de septiembre de 2026 recorrió las ocho ediciones que StatBunker expone (IDs `595`, `693`, `637`, `555`, `512`, `355`, `199` y `171`, correspondientes a 2024, 2021, 2019, 2016, 2015, 2011, 2007 y 2004) y recuperó 86 porteros únicos. El snapshot `rs_f939c96f258133373de800b6` queda en `draft`, con `coverageComplete=false`, vinculado al snapshot de fuente `src_3c6b997f0a4a89bf02e355aa`; no se añaden ceros o jugadores fuera de esas tablas para forzar 200. El límite documentado es, por tanto, 86 filas verificadas con la fuente histórica aprobada actualmente; falta contrastar el alcance con CONMEBOL y revisar derechos antes de publicar.

El mismo importador se extendió a `euro-clean_sheets` y `nations-league-clean_sheets`. StatBunker expone 17 ediciones de la EURO (1960–2024), que producen 169 porteros únicos, y cuatro ediciones de Nations League (2018/19–2024/25), que producen 175. Ambos snapshots conservan todos los registros explícitos recuperables, incluidos ceros de participación, y quedan en `draft` con `coverageComplete=false`: no se rellenan artificialmente hasta 200 y deben contrastarse con UEFA antes de publicar.

También se incorporó `club-world-cup-clean_sheets` desde la tanda cerrada de ediciones FIFA Club World Cup del índice de StatBunker ([tabla de porterías a cero](https://www.statbunker.com/competitions/Top10KeepersCleanSheets?comp_id=775)). La reconstrucción del 12 de septiembre de 2026 contiene 19 porteros canónicos en `rs_6eec387e00388202085fa855`, vinculados al snapshot de fuente `src_b6d5d681a16e2919606f4860`, con las ediciones `775` (2025), `388` (2011), `343` (2010) y `221` (2007). Conserva 11 ceros explícitos y no añade ceros, jugadores ni torneos para alcanzar 200. La tanda se cerró sin ampliar alcance; API-Football no aportó un campo explícito `clean_sheets` en las respuestas históricas revisadas y no se derivó el valor desde `goals.conceded`. El snapshot sigue parcial (`coverageComplete=false`), la categoría sigue retirada del juego y quedan pendientes el contraste con FIFA, la confirmación del alcance histórico completo y la revisión de derechos antes de cualquier uso publicable.

Para `copa-libertadores-clean_sheets` se utiliza el mismo índice de StatBunker con las cuatro ediciones que el proveedor expone (2008 y 2011–2013). La reconstrucción del 12 de septiembre de 2026 recuperó 120 porteros únicos en `rs_3bd4166277a496f65b74ff06`, con snapshot de fuente `src_42f40a0085c04c704d986a24`, y los conserva como snapshot parcial (`coverageComplete=false`); no se presenta como histórico completo de CONMEBOL ni se rellena hasta 200. No se ha creado todavía `copa-sudamericana-clean_sheets`: no se encontró un índice histórico equivalente y homogéneo en esta fuente, y no se mezclará una tabla de otro proveedor hasta resolver licencia y definición.

Para el índice histórico de porteros se archivó además la tabla oficial de [IFFHS 1987–2022](https://iffhs.com/en/news/iffhs-mens-all-time-world-best-goalkeeper-ranking-1987-2022-2597), con 50 registros y sus puntos originales. Esa evidencia, junto con las porterías a cero y partidos de RSSSF, alimenta un índice reproducible provisional de 200 porteros (`goalkeeper-historical-index`). Los componentes que todavía no tienen cobertura mundial homogénea se dejan en cero y no se imputan; el snapshot permanece en `draft` y `coverageComplete=false` hasta completar y revisar esos componentes.

La comprobación posterior mantiene esa cautela: Opta publica una serie histórica desde 1966 y FIFA publica los líderes por edición, pero no una tabla pública completa de 200 jugadores con un identificador común. Además, la cifra de Messi no coincide entre la agregación actual de StatBunker y el resumen de Opta. Por tanto, el top 200 técnico existe y es reproducible, pero no se marca como cobertura completa hasta elegir una definición única y contrastar el conjunto entero; no se debe usar para una puntuación definitiva mientras tanto.

El comando reproducible es `npm run import:world-cup:assists`. La fuente está en `review_required` y no se publica hasta confirmar derechos y cerrar la cobertura.

La importación actual contiene 200 jugadores. Esto resuelve el tamaño técnico del corte, pero no convierte el dato en definitivo ni concede licencia de redistribución.

### Balón de Oro

Para `ballon-dor-wins` usamos el [palmarés masculino oficial de France Football](https://www.francefootball.fr/ballon-d-or/palmares/). El importador conserva cada edición y su ganador en `awards`, además del agregado que alimenta el ranking. La edición de 2020 no aparece porque no se concedió el premio. La carga vigente incluye 69 ediciones concedidas, incluidos Rodri (2024) y Ousmane Dembélé (2025), y 47 ganadores únicos. El snapshot vigente es `rs_3987d2e93d62b4c5072d83e9` y queda en `draft` hasta aprobar categoría, fuente e imágenes.

Las fotografías enlazadas en el palmarés son activos editoriales de France Football/L’Équipe: se registran como referencias pendientes, no como imágenes libres ni como una licencia de redistribución.

### Goles de carrera en clubes

#### Investigación específica de un ranking global de al menos 200 jugadores — 12 de septiembre de 2026

Se realizó una búsqueda separada para encontrar una fuente pública o licenciada que permitiera un único ranking homogéneo de al menos 200 jugadores de goles globales de carrera, sin consultar API-Football. El expediente reproducible está en `backend/data/evidence/global-career-goals-2026-09-12/` y se valida con `npm run validate:evidence:global-career-goals`.

El resultado es negativo y no se ha importado ninguna fila nueva. StrikerDuel ofrece una licencia anual no exclusiva bajo petición y documenta club + selección, partidos oficiales y exclusión de amistosos no oficiales, pero declara 134 perfiles y su ranking público es top 50. SportBaseline etiqueta su métrica como goles sénior de club y selección, pero solo muestra top 50 y no publica una licencia de redistribución localizada. RSSSF e IFFHS son referencias históricas con universos/umbrales que no alcanzan un top 200 homogéneo; no se mezclan. Los datasets abiertos revisados no aportan simultáneamente el ranking objetivo y derechos de publicación comercial.

La categoría `club-career-goals` conserva por ello su snapshot provisional existente, basado en la ventana y competiciones ya almacenadas, sin presentarse como carrera mundial completa. El desbloqueo de una importación futura exige 200 jugadores únicos, definición única documentada, procedencia/identidad reconciliable y permiso de redistribución para el juego.

Como avance técnico, los datos API-Football ya importados para las competiciones disponibles y las temporadas 2000–2026 permiten generar snapshots provisionales de 200 entradas para `club-career-goals`, `club-career-assists`, `club-career-yellow-cards` y `club-career-red-cards`. Los cuatro snapshots están en `draft` y `coverageComplete=false`: son agregados reales de la ventana y de las competiciones cargadas, no una afirmación de carrera completa. No se rellenan porterías a cero globales porque el proveedor devuelve ese campo nulo/0 en el histórico cargado y no se debe inferir.

El ranking `player-career-titles` también tiene un snapshot provisional de 200 jugadores. Tras las tandas de `/trophies`, el archivo conserva **12.158 hechos no rechazados de 813 jugadores**; la última tanda dirigida procesó 84 jugadores pendientes mediante 86 peticiones, sin errores y con 2 hechos nuevos. El ranking consolidado vigente es `rs_30bcff61309619139945d8fe` y sigue en `draft`. API-Football no acredita por sí sola la participación efectiva ni cubre todo el palmarés histórico, por lo que el snapshot no es publicable.

La IFFHS es una referencia histórica útil porque documenta una definición explícita: ligas nacionales de primera división y regionales relevantes, copas nacionales y competiciones internacionales de clubes. Su clasificación mundial de goleadores de clubes publicada el 4 de marzo de 2023 muestra 17 posiciones ordenadas y a Erwin Helmchen como registro no rankeado por el tratamiento de sus ligas regionales.

No se utilizará esa página como un `top 100` final: no ofrece un universo de 100 jugadores ni una actualización automática suficiente para un ranking vivo. Sí queda como fuente de contraste y como referencia metodológica para la definición de `club-career-goals`. Hasta que una fuente licenciada o un conjunto de registros federativos permita completar y auditar 100 jugadores con el mismo criterio, esa categoría no se importará artificialmente.

También se ha contrastado la tabla [Prolific Scorers de RSSSF](https://www.rsssf.org/players/prolific.html), actualizada en agosto de 2026. Su bloque de partidos oficiales es valioso como investigación histórica, pero mezcla ligas regionales, reservas, amateur, copas y distintos tipos de selecciones; además, la tabla publicada no alcanza 100 filas verificadas. No se mezclará con el ranking de goles de clubes: hacerlo cambiaría la definición a mitad de la lista y produciría un top 100 aparente pero metodológicamente inconsistente.

### Goles oficiales con la selección

Para `national-team-official-goals` se ha cerrado el top 200 con el registro de [RSSSF](https://www.rsssf.org/miscellaneous/century.html). La propia página declara una tabla completa de jugadores con 30 o más goles; las primeras 200 filas permanecen dentro del universo declarado. El criterio operativo es selección absoluta reconocida por RSSSF y/o por la asociación nacional correspondiente, con amistosos A incluidos cuando la fuente los contabiliza. Las excepciones históricas de reconocimiento se conservan en la evidencia y no se corrigen silenciosamente para aparentar uniformidad FIFA.

Para `national-team-official-assists`, la tabla pública de [IFFHS](https://iffhs.com/en/news/lionel-messis-new-record-4683) solo publica cinco líderes históricos: Messi, Donovan, Neymar, Puskás y Kocsis. Se archivaron esas cinco filas reales en `rs_426920696b203de1e444ca51` como snapshot `draft`, con `coverageComplete=false`; el importador rechaza por defecto cualquier intento de presentarlas como top 200. La categoría continúa retirada hasta adquirir un export histórico mundial con licencia de redistribución o una fuente partido a partido que permita construirlo de forma homogénea.

El snapshot se marca con cobertura estadística completa para el top 200, pero permanece `draft`: RSSSF es una fuente histórica de referencia y sus derechos de redistribución requieren revisión independiente antes de publicar.

La importación actual contiene 200 jugadores y conserva la evidencia de las 200 filas; no completa por inferencia las posiciones posteriores.

### Goleadores históricos de Bundesliga y LaLiga

Se han validado y actualizado dos rankings históricos adicionales. `bundesliga-goals` usa la tabla histórica oficial del [DFB](https://datencenter.dfb.de/competitions/bundesliga/record_scorers), y `la-liga-goals` usa la tabla histórica mantenida de [BDFutbol](https://www.bdfutbol.com/en/c/rankingG1.html). El importador de BDFutbol exige 200 fichas estables únicas, puestos no descendentes y goles no ascendentes; las posiciones empatadas se conservan mediante la lógica común de ranking.

Ambas categorías tienen ahora cobertura estadística estructural, pero continúan en `draft`: la oficialidad del DFB no equivale automáticamente a permiso de redistribución y BDFutbol es una fuente de referencia. No se consideran publicables hasta resolver derechos y completar la revisión cruzada que corresponda.

Las tablas históricas adicionales de BDFutbol para `bundesliga`, `la-liga`, `ligue-1`, `primeira-liga` y `serie-a` (`clean_sheets`, `yellow_cards`, `red_cards` y, donde corresponde, `goals`) también han sido comprobadas directamente: cada página entrega 250 filas y el importador conserva y valida las primeras 200. Se comprueban puestos consecutivos, identificadores de jugador únicos, orden descendente del valor y, para porterías a cero, que todas las filas sean porteros. Estas categorías pasan a `coverage_complete=true` como cobertura estructural del top 200; siguen en `draft` y con `rights_status=review_required`, por lo que esta validación no equivale a permiso de redistribución ni a aprobación editorial de la fuente.

Para `serie-a-goals` se añadió como referencia reproducible la tabla histórica de [la Wikipedia italiana](https://it.wikipedia.org/wiki/Classifica_dei_marcatori_della_Serie_A), consultada mediante la API REST de Wikimedia. La respuesta devuelve la revisión, fecha y licencia CC BY-SA 4.0 y la tabla declara 100 jugadores, con el alcance de Serie A a grupo único desde 1929/30 y exclusión de Alta Italia 1944 y Serie A-B 1945/46. El importador exige exactamente 100 filas, jugadores únicos y orden no ascendente de goles, por lo que la cobertura estructural del top 100 queda completa. Esto resuelve el corte técnico de 93 filas de RSSSF sin inventar entradas, pero no convierte Wikipedia en autoridad estadística: el snapshot permanece `draft` y debe contrastarse con una fuente primaria o licenciada antes de publicar.

### Estadísticas históricas de la CONMEBOL Libertadores

Se comprobó la página oficial de estadísticas de la Libertadores y su widget de datos: la consulta pública expone estadísticas de la temporada seleccionada, no un endpoint histórico completo con el top 100 de goles, asistencias, tarjetas o porterías a cero. El artículo editorial de CONMEBOL menciona posiciones históricas concretas, pero no publica el conjunto completo necesario para reconstruir un ranking reproducible. Por ello no se ha importado un `copa-libertadores-*` de jugadores desde esa interfaz ni se han rellenado filas con una fuente distinta; queda pendiente una fuente licenciada o un registro histórico completo que defina el mismo alcance.

### Asistencias históricas de las grandes ligas

La investigación de las asistencias no ha encontrado todavía una fuente pública que cubra 100 jugadores con un criterio homogéneo desde el inicio de cada competición. La [Ligue 1](https://ligue1.com/en/articles/l1_article_2586-) indica que su clasificación oficial de asistentes comenzó en 2007/08; la [tabla de líderes de LaLiga](https://www.laliga.com/en-US/leaderboard) es una vista de la temporada seleccionada; y las páginas públicas revisadas de Bundesliga y Serie A no exponen un histórico íntegro de 100 filas con definición y alcance auditables. No se importan, por tanto, asistencias de una mezcla de temporadas, Transfermarkt/BeSoccer y tablas parciales: `*-assists` queda pendiente de una fuente licenciada o de un conjunto histórico completo que permita aplicar una única definición.

También se evaluó [StatBunker — asistencias históricas de LaLiga](https://www.statbunker.com/alltimestats/AllTimeCompetitionMostAssists?comp_code=LL), que aparece indexada con una tabla de 50 filas. La misma URL no fue reproducible desde el entorno de importación: una variante devolvió `No assists found` y otras agotaron el tiempo de espera. Los mirrors que sí respondieron (`bbs`, `m` y `dr`) devolvieron exactamente las mismas 50 filas; los parámetros probados `page=2`, `limit=100` y `rows=100` no ampliaron la tabla. La página tampoco prueba por sí sola una licencia de redistribución para Rango 90. Por esas razones no se ha creado un snapshot de StatBunker ni se utilizará como fuente del top 100 hasta disponer de una respuesta estable, una definición verificable y permiso de uso.

#### Decisión específica: `serie-a-assists`

La categoría se ha investigado de forma independiente el **12 de septiembre de 2026**, sin realizar ninguna petición a API-Football y sin escribir datos en PostgreSQL. El requisito de producción es un ranking histórico homogéneo de al menos 200 jugadores de la Serie A, con una definición única de asistencia y trazabilidad por fuente. Ese requisito no queda satisfecho por las fuentes públicas comprobadas:

- [StatBunker — Serie A, All time - Most Assists](https://www.statbunker.com/alltimestats/AllTimeCompetitionMostAssists?comp_code=SA) es la ruta nominal correcta, pero la respuesta pública recuperada muestra `No assists found`; la ruta alternativa [All time - Players Record](https://www.statbunker.com/alltimestats/AllTimePlayerStandings?comp_code=SA) no es un ranking de asistencias, está ordenada por el registro general de jugadores y su columna `A` no constituye por sí sola una tabla histórica exportable de 200 filas. En las respuestas accesibles tampoco se pudo demostrar el alcance temporal completo ni una licencia de redistribución.
- [BeSoccer — histórico de asistencias de Serie A](https://www.besoccer.com/competition/historical-ranking/serie_a/1967/assists) muestra una lista pública parcial (20 nombres en la respuesta recuperada), sin un export histórico de 200 filas ni una licencia de redistribución para Rango 90. No se mezclará con otra tabla para completar el corte.
- [StatMuse — asistencias de Serie A](https://www.statmuse.com/fc/ask?q=most+assists+serie+a+all-time) expone una respuesta consultable con un subconjunto de líderes y declara que sus datos de Serie A se remontan a 2010/11. No ofrece en la interfaz pública una tabla histórica completa de 200 jugadores ni acredita cobertura anterior homogénea; por tanto no sirve como histórico absoluto.
- [Football records and statistics in Italy](https://en.wikipedia.org/wiki/Football_records_and_statistics_in_Italy) publica únicamente los diez primeros y señala que los datos de asistencias no son comparables para toda la historia; [la Lega Serie A](https://www.legaseriea.it/) publica estadísticas por temporada, no una tabla histórica pública de 200 asistentes con un identificador y definición reutilizables.

No se ha creado importador, fixture, snapshot ni entrada de ranking para `serie-a-assists`: hacerlo con los 10/20 líderes publicados, agregar temporadas de proveedores distintos o completar con ceros/padding produciría un ranking aparentemente lleno pero estadísticamente falso. La categoría permanece en `draft`/retirada de la superficie jugable hasta obtener una tabla licenciada o un conjunto temporada-partido completo con metodología homogénea que supere las 200 filas positivas. La condición de desbloqueo queda fijada en **≥200 jugadores únicos, asistencias explícitas, alcance temporal declarado, identificador estable, captura de fuente y derechos de redistribución revisados**.

### Control de calidad visual de jugadores jugables

Las búsquedas de retratos no convierten automáticamente una etiqueta de Commons en una fotografía válida. En la revisión de candidatos de jugadores jugables, una imagen CC0 de un partido de Zeki Amdouni mostraba el campo completo con el jugador indistinguible, y una fotografía etiquetada con Aitor Ruibal incluía una restricción expresa contra materiales comerciales. Ambos casos se mantienen fuera de los activos aprobados; la licencia de un archivo y la identificación/encuadre del jugador se verifican por separado. Las imágenes de API-Football continúan como candidatas `pending` hasta obtener autorización de redistribución.

### Palmarés de clubes de la FA Cup

Para `fa-cup-club-titles` usamos el listado oficial de finales de [The FA](https://www.thefa.com/competitions/thefacup/fa-cup-finals). El importador reconstruye cada edición celebrada entre 1872 y 2026, excluye los años sin competición de las guerras mundiales, resuelve repeticiones y tandas de penaltis y conserva las temporadas ganadoras en la evidencia. La validación actual produce 145 ediciones y 45 clubes ganadores, con los empates calculados por la lógica común de rankings.

Es un universo cerrado y por ello no se fuerza un top 100 inexistente. El snapshot permanece `draft` con `rightsStatus=review_required`: que el palmarés sea oficial no concede automáticamente permiso para redistribuir sus datos, nombres, marcas o escudos. Los escudos se gestionan por separado y no se aprobarán los candidatos de TheSportsDB hasta confirmar licencia para Rango 90.

### Palmarés de clubes del Community Shield

Para `community-shield-club-titles` se incorporó la lista histórica de partidos de [RSSSF](https://www.rsssf.org/tablese/engsupcuphist.html), contrastada con la página histórica de [The FA](https://www.thefa.com/competitions/the-fa-community-shield/more/history). El importador conserva las 104 ediciones celebradas entre 1908 y 2026, cuenta como victoria compartida los empates marcados como compartidos, resuelve los desempates por penaltis y excluye equipos representativos como `Professionals`, `Amateurs` y el `World Cup Team` de 1950 del ranking de clubes. El resultado actual contiene 26 clubes y permanece como `draft` con `rightsStatus=review_required`; la cobertura estadística está completa para ese universo cerrado, pero la aprobación jurídica de datos, marcas y escudos sigue siendo independiente.

El comando reproducible es `npm run import:community-shield:club-titles`. RSSSF permite copiar con reconocimiento al autor, pero esa condición no se trata como una autorización general para todos los activos visuales ni para cualquier explotación comercial; por eso el snapshot no se publica automáticamente.

### Supercopas nacionales incorporadas

Se han añadido dos palmarés oficiales como universos cerrados, sin convertirlos artificialmente en top 100:

- `supercoppa-italiana-club-titles`: 9 clubes y 38 ediciones, importados desde el [palmarés oficial de la Lega Serie A](https://www.legaseriea.it/supercoppa/albo). Sus entidades se consolidan con los clubes canónicos italianos.
- `dfl-supercup-club-titles`: 9 clubes y 26 ediciones, importados desde el historial oficial de [Bundesliga/DFL Supercup](https://www.bundesliga.com/en/bundesliga/news/history-of-supercup-records-goals-all-matches-bayern-dortmund-leipzig-20635). El parser conserva los años ganadores y comprueba que la suma sea exactamente 26; las entidades se consolidan con el catálogo alemán.

Ambos snapshots siguen en `draft`: el palmarés está validado, pero la fuente de datos y los escudos no pasan a `approved` automáticamente. Los escudos normalizados de TheSportsDB se han dejado en `pending` hasta confirmar que la licencia cubre el uso comercial, la caché/CDN y los logos de terceros.

También se han cargado desde la [página oficial de vencedores de la FPF](https://www.fpf.pt/pt/competicoes/futebol/masculino/liga-nos/vencedores) la `primeira-liga-club-titles` (92 temporadas, 1934/35–2025/26, cinco clubes) y la `supertaca-portugal-club-titles` (46 ediciones oficiales hasta 2026). En esta última se excluyen 1979 y 1980 porque la propia FPF las etiqueta como `prova oficiosa`; quedan conservadas en la evidencia, pero no cuentan como títulos oficiales. Ambos snapshots siguen en `draft` por la revisión de derechos de escudos.

## Proveedores revisados

### API-Football / API-Sports

- Precios publicados: plan gratuito de 100 peticiones/día; Pro de 7.500/día; Ultra de 75.000/día.
- Declara cobertura de aproximadamente 1.244 ligas y copas.
- Es útil para probar cobertura y obtener identificadores, eventos y estadísticas de temporada.
- Sus condiciones no conceden una licencia general para publicar los datos en productos del usuario y dejan a cargo del usuario las autorizaciones de terceros.
- Sus imágenes, logos y marcas no deben publicarse solo por estar disponibles en la API.

La confirmación contractual es explícita en los [términos de API-Football](https://www.api-football.com/terms): el proveedor permite crear aplicaciones, webs y juegos de fantasy, pero no concede por sí mismo una licencia de uso y publicación de los datos; además, logos, imágenes y marcas se entregan para identificación/descripción y pueden estar sujetos a derechos de ligas, clubes, federaciones o terceros. Pagar el plan Pro aumenta la cuota y el acceso histórico, pero no convierte esos activos en material con licencia de Rango 90.

Decisión: utilizarlo inicialmente como fuente de importación y contraste, con `rightsStatus=review_required`, hasta obtener confirmación escrita sobre el uso concreto de Rango 90.

La comprobación del 11 de septiembre de 2026 confirmó que la cuenta Pro está activa hasta el 10 de octubre de 2026, con 7.500 peticiones diarias; la key existente sigue siendo válida y no se ha cambiado. La auditoría posterior a las importaciones registró 5.025 peticiones del día, por lo que queda margen controlado para nuevas cargas, sin lanzar descargas masivas innecesarias. El backend debe seguir funcionando sin depender de esta API durante una partida.

En el backend ya existe `npm run import:api-football:premier-league -- --season 2024`, que archiva la muestra de líderes y sus fotos/logos como candidatos pendientes. La opción `--full` recorre ahora todas las páginas de la temporada completa; la auditoría actual confirma que Premier League dispone de 17 temporadas con cobertura de jugadores, goles, asistencias, tarjetas y estadísticas. El importador aborta antes de guardar una carga parcial; el histórico jugable continúa dependiendo de fuentes oficiales con cobertura completa.

Con la suscripción Pro activa se han cargado y validado temporadas utilizables de las seis ligas prioritarias. El lote completo 2025–2026 está archivado, y el lote histórico 2009 se conserva por separado; las temporadas y competiciones sin cobertura no se rellenan. Los snapshots brutos conservan las anomalías históricas de `league_id` nulo verificadas por el nombre de la competición. A partir de las filas almacenadas se regeneraron los cuatro rankings globales provisionales (`club-career-goals`, `club-career-assists`, `club-career-yellow-cards` y `club-career-red-cards`) con 200 entradas cada uno y ventana solicitada 2000–2026; las temporadas con datos regulares disponibles son 2002–2026 y los registros aislados anteriores se conservan como evidencia. El último rebuild, posterior a la carga de Copa América, usa goles `rs_7153c444957a3cc7a616292f`, asistencias `rs_3ff424d538bdecf81b566aee`, amarillas `rs_e3ce0b6bf7ef185be9f57002` y rojas `rs_b1306aea17f2dd0dd3b155ef`. La Copa América no se suma a estos cuatro agregados globales porque API-Football la clasifica como competición de selecciones; sus rankings separados se mantienen en el bloque específico de la competición. Siguen en `draft` con `coverageComplete=false` porque todavía no representan toda la carrera mundial. El comando reproducible es `npm run build:rankings:api-football:career -- --from-season 2000 --to-season 2026 --metric goals,assists,yellow_cards,red_cards`. Las fotos y escudos de proveedores se conservan como candidatos `pending` y no se aprueban sin licencia independiente; la importación histórica tampoco crea automáticamente perfiles jugables: el pool se mantiene curado por `seed-game-audience`.
El estado verificado tras los lotes históricos y actuales cuenta 193.643 filas de `player_season_stats` de API-Football, 0 snapshots publicados y rankings provisionales regenerados con la ventana solicitada 2000–2026. Las importaciones de Club World Cup, Copa América, Nations League y Mundial siguen siendo ventanas disponibles del proveedor, no históricos absolutos.

Para Copa América se corrigió la validación del proveedor que omitía `league.id` y se verificaba únicamente por el nombre normalizado de la competición. Se incorporaron las temporadas 2001 (99 filas), 2004 (143), 2007 (220) y 2011 (256), todas con `status=validated`, `sourceCoverage=usable` y sin muestras parciales. La ventana API-Football disponible queda en 2001–2024. Los rankings provisionales vigentes de 200 entradas son goles `rs_bce48d1f9580982551370f56`, asistencias `rs_bc862348fabe690e8d05b3ef`, amarillas `rs_adf36301ef1e220cbfb09f8e` y rojas `rs_d81b93964a3c7d6d6b1e0967`; todos permanecen en `draft` y `coverageComplete=false`.

Para el Mundial de Clubes se consultaron también las temporadas 2000–2010. API-Football devolvió respuestas vacías para 2000–2007 y cinco filas reales para 2008–2010, que se archivaron con las anomalías históricas de `league_id` nulo verificadas por nombre. Los cuatro rankings específicos se reconstruyeron con 200 entradas, pero permanecen provisionales porque la fuente no cubre todas las ediciones.

La UEFA también expone las tablas históricas de la Eurocopa para las 17 ediciones de fase final entre 1960 y 2024. Se han archivado 34 snapshots reales de goles y asistencias y se han construido `euro-goals` y `euro-assists` con 200 jugadores únicos cada uno; permanecen en `draft` porque la disponibilidad histórica de asistencias y los derechos de publicación requieren revisión específica.

Como ampliación, se han importado también las temporadas completas 2005–2025 de UEFA Champions League (competición API-Football `european-cup-champions-league`), además de conservar la actualización 2026 en curso como snapshot separado. El lote conserva los snapshots brutos por temporada y registró las anomalías del proveedor sin inventar un club cuando faltaba. Con la última ventana cerrada se han generado snapshots provisionales de 200 entradas para goles, asistencias y tarjetas; `coverageComplete=false` porque no representan aún el histórico absoluto de la competición. El comando reproducible es `npm run build:rankings:api-football -- --competition european-cup-champions-league --from-season 2005 --to-season 2025 --metric goals,assists,yellow_cards,red_cards`. Las fotos y escudos de este lote siguen siendo candidatos separados, en `pending` y con `rightsStatus=review_required`.

Como ampliación histórica posterior, API-Football se consultó también para Champions 2000–2003: devolvió 9 filas reales en cuatro snapshots y dejó registrados los `league_id` históricos ausentes, verificados por el nombre de la competición. El ranking específico se regeneró con ventana solicitada 2000–2026, pero solo declara disponibles las temporadas con filas persistidas; no se rellenan los años vacíos.

El histórico de consultas conserva también las tandas anteriores: 657 perfiles, 738 peticiones y 976 hechos nuevos, seguidas de 408 peticiones sin hechos adicionales. El país de competición sigue siendo obligatorio para evitar colisiones como Premier League de Ucrania frente a Inglaterra. La respuesta no acredita participación efectiva; por eso esos datos se conservan como `player_trophy_record:*` y el ranking provisional consolidado `player-career-titles` de 200 entradas (`rs_30bcff61309619139945d8fe`) permanece en `draft` hasta contrastar la participación con fuentes de competición.

### Sportmonks

- Plan Starter: 5 ligas, desde 29 €/mes mensual.
- Growth: 30 ligas, desde 99 €/mes mensual.
- Pro: 120 ligas, desde 249 €/mes mensual.
- Cobertura completa de todas sus ligas: plan Enterprise, desde precio personalizado.
- Su página de integridad indica que permite construir aplicaciones comerciales, almacenar y distribuir datos dentro del producto, sujeto a sus términos.
- La propia empresa aclara que las fotografías de jugadores y logos requieren derechos propios del cliente.

La página pública de precios consultada el 8 de septiembre de 2026 mantiene el Starter desde 29 €/mes para cinco ligas, pero ese precio no incluye por sí mismo una licencia de fotos o escudos. La página de integridad de Sportmonks dice expresamente que las imágenes recibidas por la API son una comodidad técnica, no una licencia.

Decisión: es el candidato más interesante para una fuente principal de datos publicables, pero no encaja con el límite de 30 €/mes si necesitamos todas las competiciones. Hay que solicitar cobertura histórica exacta y condiciones de uso para rankings permanentes antes de contratar.

### TheSportsDB para escudos

TheSportsDB se ha integrado únicamente como fuente auxiliar de candidatos de escudo, no como fuente estadística. El adaptador usa coincidencias exactas y limita el ritmo para evitar los `429` observados con el endpoint gratuito. Puede dejar un escudo local en `pending`, pero nunca aprobarlo: la disponibilidad de una imagen en la API no demuestra una licencia comercial para web, PWA, Android, caché o CDN.

La página oficial muestra Single Developer a **9 USD/mes**, 90 USD/año o 295 USD de por vida, con 100 peticiones por minuto en los planes de pago. El plan gratuito sirve para desarrollo, pero los términos prohíben publicar una aplicación en una tienda si no se es suscriptor. Premium permite usar el artwork personalizado de TheSportsDB con atribución, pero los mismos términos exigen permiso para contenido de terceros y que los logos de marcas deportivas se usen sin modificar. Por tanto, es una vía barata para evaluar API y artwork, no una autorización global para todos los escudos o fotografías. Antes de producción hay que confirmar por escrito que el artwork elegido y el uso de Rango 90 en web, PWA, Android, caché/CDN y entorno comercial quedan cubiertos. Mientras tanto, el estado de la fuente es `review_required`.

### Goles históricos de la Copa Libertadores: Transfermarkt contrastado con BeSoccer/CONMEBOL

Se investigó la tabla histórica de goleadores de [BeSoccer](https://www.besoccer.com/competition/historical-ranking/copa_libertadores/top-scorers). Su página carga 20 filas iniciales y ofrece cuatro páginas AJAX adicionales de 20 filas, por lo que el adaptador de Rango 90 ya puede validar 100 jugadores únicos, conservar el orden y archivar los identificadores de perfil. La fuente queda en `review_required` y no se usan sus fotos o escudos como activos del juego.

No se importa todavía como clasificación canónica porque la misma consulta muestra una discrepancia material en los primeros puestos: BeSoccer devuelve 53 goles para Alberto Spencer y 38 para Pedro Rocha, mientras la tabla histórica de [Transfermarkt](https://www.transfermarkt.com/copa-libertadores/ewigetorschuetzenliste/pokalwettbewerb/CLI) devuelve 54 y 36, respectivamente; [CONMEBOL también identifica a Spencer con 54](https://gol.conmebol.com/libertadores/pt-br/news/quem-e-o-maior-artilheiro-da-historia-da-conmebol-libertadores-veja-como-esta-disputa). Esto demuestra que no debemos mezclar valores ni llamar “oficial” a la tabla de un portal sin fijar antes el alcance exacto de la competición.

Decisión provisional: se ha archivado el snapshot vigente `rs_eab418a96cd848750f4b1148` con 200 entradas reales, `coverageComplete=true`, estado `draft` y `rightsStatus=review_required`. El comando reproducible es `npm run import:copa-libertadores:goals`; la categoría no se considera aprobada ni publicable hasta resolver la licencia de datos y de imágenes. La consolidación automática enlazó 14 perfiles con entidades existentes y dejó los homónimos sin forzar; la captura anterior de 100 filas queda como evidencia histórica, no como ranking vigente.

Con el mismo parser y criterio se ha archivado también `copa-sudamericana-goals` en el snapshot vigente `rs_34745e706faceb731209c882`, con 200 entradas reales, `coverageComplete=true` y estado `draft`; se consolidaron 18 identidades inequívocas. Su comando es `npm run import:copa-sudamericana:goals`. Ambos rankings son datos reales de trabajo, pero no se presentan como publicables hasta cerrar derechos y revisión metodológica.

### Goles históricos de la UEFA Cup / Europa League

La tabla histórica de [Transfermarkt](https://www.transfermarkt.com/uefa-europa-league/ewigetorschuetzenliste/pokalwettbewerb/EL/land_id/0/plus/0/galerie/0) presenta el histórico combinado de la UEFA Cup y la Europa League. Se capturaron sus cuatro primeras páginas, se validaron 100 filas únicas, el orden descendente y los identificadores de perfil; los tres primeros de la captura son Pierre-Emerick Aubameyang (34), Henrik Larsson (31) y Klaas-Jan Huntelaar (30).

Se ha archivado el snapshot vigente `rs_1079d8da3ea56e143c315f57` con `coverageComplete=true`, estado `draft` y `rightsStatus=review_required`; la captura anterior `rs_d698e5eea163c41983471544` queda superseded. La captura de trabajo se obtuvo mediante transporte de archivo del contenido visible, mientras que la URL oficial queda registrada como fuente canónica; el backend no depende del proxy para las partidas. La consolidación enlazó 52 identidades inequívocas y dejó 48 sin forzar. El comando reproducible es `npm run import:uefa-cup-europa-league:goals` cuando la fuente directa sea accesible.

Este ranking no se publica ni se marca como “oficial” hasta revisar el alcance histórico exacto, los derechos de redistribución de los datos y la licencia de las imágenes. Las imágenes `sourceImageUrl` de Transfermarkt son únicamente evidencia de origen y no se convierten automáticamente en activos del juego.

### UEFA Cup / Europa League: ampliación técnica a 200

Para cumplir el corte técnico de 200 sin inventar filas, se añadió un importador de [StatBunker](https://www.statbunker.com/alltimestats/AllTimeCompetitionMostAssists?comp_code=UCUP). Extrae las páginas históricas de los clubes enlazados por el proveedor, identifica a cada jugador por su `player_id` y suma sus valores entre clubes. El proceso aborta si una página falla o si el universo positivo no alcanza 200.

Se han archivado snapshots de 200 entradas para goles, asistencias, tarjetas amarillas y tarjetas rojas. Se mantienen en `draft` con `coverageComplete=false`: StatBunker es una fuente de referencia y la agregación aún debe contrastarse contra la definición histórica oficial de UEFA Cup/Europa League y someterse a revisión de derechos. No se mezclan estos valores con los rankings oficiales de UEFA ni se publican automáticamente.

Como ampliación de archivo, API-Football se descargó de forma completa para las temporadas 2000–2024 que el proveedor expone: 2000 devolvió una respuesta vacía real; 2001–2007 aportaron 3, 1, 2, 3, 8, 49 y 429 filas; 2008–2016 aportaron 2.096, 2.975, 4.040, 4.117, 4.080, 4.103, 4.773, 4.929 y 5.525 filas normalizadas; 2017 aportó 4.937, 2018 aportó 5.428, 2019 aportó 5.640, 2020 aportó 6.075, 2021 aportó 1.941, 2022 aportó 2.008, 2023 aportó 1.912 y 2024 aportó 2.595. Las páginas fueron validadas completas y los duplicados de origen se consolidaron mediante el `upsert` de jugador/equipo/temporada. El proveedor devolvió anomalías históricas conocidas —IDs de liga nulos verificados por el nombre `UEFA Cup` y registros sin equipo sin métricas— que se conservaron como evidencia o se descartaron únicamente cuando eran filas cero sin información. La ventana 2000–2024 se ha usado para regenerar los snapshots provisionales de 200 entradas: goles `rs_1fdbb3264368ddb9a7ce1151`, asistencias `rs_51be0db46cb0fa6f6dd67341`, amarillas `rs_f0ccf79635a68450d755469e` y rojas `rs_93cdcc5551a6bdae06313542`. No demuestra el histórico total; queda pendiente definir si se amplía con otra fuente para temporadas posteriores, además del contraste metodológico y los derechos de redistribución.

Actualización posterior: con las temporadas ya presentes en la base de datos hasta 2026, los rankings globales de carrera se regeneraron en una ventana 2000–2026 y once competiciones de clubes. Los snapshots vigentes son goles `rs_20d78218c77cce41c37fa3cd`, asistencias `rs_8cfb919960b47fe6f20f7b58`, amarillas `rs_c16923ead785819d6d741b6e` y rojas `rs_87f10d8a51031e241e76b913`; contienen 200 entradas reales cada uno y continúan siendo provisionales.

El mismo adaptador se probó para UEFA EURO (`comp_code=EC`). Goles y asistencias alcanzaron 200 y se archivaron como provisionales; las páginas históricas enlazadas para amarillas y rojas no devolvieron jugadores, por lo que ambas importaciones fueron rechazadas sin escribir snapshots. El resultado no se interpreta como ausencia histórica de tarjetas, sino como incompatibilidad de ruta/cobertura del proveedor.

Se corrigió esa limitación para las amarillas de EURO mediante las páginas por edición de StatBunker (2004, 2008, 2012, 2016, 2020 y 2024; `comp_id` 169, 228, 391, 550, 685 y 291). La agregación por `player_id` produjo 683 jugadores positivos y se archivaron los 200 primeros en `rs_65a2693a4f63b3adcbb45a8e`, en `draft` y con `coverageComplete=false`. Para las rojas, la ruta all-time de StatBunker sí produjo 200 entradas y se archivó el snapshot `rs_c48f72ba997458a1d90e58d2`, también provisional; no se mezcló con la lista oficial previa de 100.

La consolidación posterior enlazó 350 de las 514 entidades fuente EURO con identidades canónicas mediante coincidencia exacta/única; las 164 restantes se conservan separadas para revisión y no se fuerzan.

Para la Conference League no existe una tabla all-time equivalente utilizable en StatBunker. Se añadió un recorrido por las temporadas 2021/22–2025/26 disponibles, identificadas por los `comp_id` 706, 738, 359, 771 y 786, y se agregan las tarjetas por el identificador estable del jugador. La ejecución del 10 de septiembre de 2026 produjo 200 jugadores positivos en `rs_039559a84c2a810022451c7f`; el snapshot queda en `draft`, con `coverageComplete=false` y `rightsStatus=review_required`. La fuente permite reproducir la carga por temporada —por ejemplo, [Conference 2022/23](https://statbunker.com/competitions/TopYellowCards?comp_id=738) y [Conference 2023/24](https://statbunker.com/competitions/TopYellowCards?comp_id=359)—, pero no demuestra por sí sola el histórico completo desde el inicio de la competición ni concede derechos de redistribución.

El mismo recorrido produjo 200 goleadores agregados en `rs_ece3c8761a536159a9fb9437`, sustituyendo la cobertura técnica de 100 por una captura provisional de 200. Se aplican las mismas cautelas: las temporadas 2024/25 y 2025/26 no aportaron filas en la consulta realizada, por lo que no se etiqueta como histórico completo hasta verificar esas páginas y contrastar una fuente primaria o licenciada.

Las asistencias requerían una ruta distinta: la página general de StatBunker muestra relaciones de asistente/receptor y no un top histórico completo. Se recorrieron las páginas de club enlazadas por las temporadas 2021/22–2023/24, se tomó únicamente el asistente principal de cada fila y se sumaron los valores por `player_id`. El resultado fue de 200 jugadores en `rs_ebc45664847d98c8d54c3b97`; queda en `draft` y `coverageComplete=false`, porque las temporadas 2024/25 y 2025/26 no devolvieron páginas con datos y la definición de asistencia aún requiere contraste independiente.

También se amplió `world-cup-goals` a 200 mediante las páginas históricas de las 86 selecciones de StatBunker. El snapshot queda en `draft` y `coverageComplete=false` como contraste reproducible del top-100 RSSSF; las dos fuentes no se combinan silenciosamente y el ranking definitivo requiere resolver la definición histórica y sus derechos.

### Copa Libertadores y Copa Sudamericana: ventanas API-Football

La tabla `player_season_stats` ya contenía temporadas completas API-Football de la Copa Libertadores 2011–2025. Se generaron cuatro snapshots provisionales de 200 entradas (goles, asistencias, amarillas y rojas) con `npm run build:rankings:api-football -- --competition copa-libertadores --from-season 2011 --to-season 2025 --metric goals,assists,yellow_cards,red_cards`.

Después se amplió el archivo de origen de Libertadores: las temporadas 2000–2007 no devolvieron filas en API-Football y se conservaron como `empty_season_response`; 2009 aportó 285 filas y 2010 aportó 457. Los cuatro rankings específicos se regeneraron con la ventana 2000–2026 y siguen en `draft`/`coverageComplete=false`, porque la fuente no demuestra el histórico completo.

Para la Copa Sudamericana se han importado y validado temporadas 2011–2025 mediante API-Football; la ventana 2026 no aporta todavía filas históricas cerradas. Con esa ventana se han regenerado cuatro rankings provisionales de 200 entradas (goles, asistencias, amarillas y rojas). No se presentan como históricos completos porque la fuente no expone las ediciones anteriores y los rankings siguen en `draft`; las respuestas vacías y los límites de cuota se conservan como evidencia operativa, sin rellenar valores ni repetir importaciones persistidas.

### Goles históricos de la European Cup / Champions League

Para separar el histórico completo de la vista estadística moderna de UEFA, se archivó la tabla combinada de [Transfermarkt](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0). La captura ampliada recorrió las páginas necesarias hasta validar 200 jugadores únicos ordenados por goles; comienza con Cristiano Ronaldo (140), Lionel Messi (129) y Robert Lewandowski (109).

El snapshot vigente del ranking canónico `uefa-champions-league-goals` es `rs_748b8fb45c7af4e1eecac6d9`, con `coverageComplete=true`, 200 entradas, estado `draft` y `rightsStatus=review_required`; su snapshot de origen es `src_3d13003e2422e688ca3380ae`. La captura anterior de 100 filas queda como evidencia histórica y no como ranking vigente. Se consolidaron las identidades que pudieron enlazarse sin forzar homónimos. El importador reproducible es `npm run import:european-cup-champions-league:goals` cuando la fuente directa sea accesible.

La tabla no se publica todavía: el snapshot sirve como dato real de trabajo y contraste, pero quedan pendientes la licencia de redistribución del ranking, la definición final del alcance histórico y los derechos independientes de cualquier imagen.

### Auditoría de asistencias internacionales de carrera — 2026-09-13

Se revisaron fuentes oficiales y de referencia para decidir si puede reactivarse `national-team-official-assists`. IFFHS publica el récord de Messi y una lista histórica limitada, pero no un top 200 homogéneo; FIFA publica tablas de asistencias por edición del Mundial y declara un inicio de conteo desde 1966; UEFA ofrece el ranking de asistencias de la EURO, también limitado a esa competición. Ninguna de estas fuentes proporciona una serie mundial completa de asistencias en partidos oficiales de selecciones con una metodología común.

Por tanto, la categoría permanece retirada del juego: no se mezclan rankings de torneos, cifras de federaciones y agregados de portales para fabricar un top 200. Para reactivarla hará falta un export partido a partido con alcance internacional explícito y licencia de redistribución, o una fuente que publique directamente ese ranking completo.

Referencias consultadas: [IFFHS — récord de asistencias de selecciones](https://iffhs.com/en/news/lionel-messis-new-record-4683), [FIFA — asistencias en Mundiales](https://www.fifa.com/it/articles/la-classifica-degli-assist-ai-mondiali-2026) y [UEFA — asistencias históricas de la EURO](https://www.uefa.com/uefaeuro/history/rankings/players/assists/).

## Plan inmediato

1. Usar el importador oficial de Premier League para validar el pipeline.
2. Mantener la key de API-Football ya configurada como fuente auxiliar, midiendo sin publicar la cobertura de goles, asistencias, tarjetas, porterías a cero, títulos y selecciones.
3. Comparar una muestra contra fuentes oficiales UEFA, FIFA, federaciones y competiciones.
4. No aprobar ningún snapshot cuya fuente no permita claramente su uso en Rango 90.
5. Para imágenes y escudos seguir el flujo independiente de `MEDIA_RIGHTS_POLICY.md`.

Para escudos alternativos se revisó `badges.football`: ofrece identificadores visuales independientes, no escudos oficiales, y su modelo comercial se cotiza según cobertura, integración y volumen. No publica una tarifa fija; antes de integrarlo hay que pedir una cotización y una licencia escrita.

La key se debe introducir solo como secreto de entorno (`API_FOOTBALL_KEY`) en la máquina o panel de despliegue; nunca en el repositorio ni en el chat.

Referencias oficiales consultadas:

- [Premier League — explicación y procedencia de las estadísticas](https://www.premierleague.com/en/stats/clarification).
- [Premier League — términos de uso](https://www.premierleague.com/en/terms-and-conditions).
- [UEFA — ranking histórico de goleadores de la Champions League](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/).
- [UEFA — manual de estadísticas históricas de la Champions League](https://www.uefa.com/uefachampionsleague/statistics/all-time/).
- [UEFA — ranking histórico de goleadores de la Conference League](https://www.uefa.com/uefaconferenceleague/history/rankings/players/goals_scored/).
- [IFFHS — clasificación mundial histórica de goleadores de clubes](https://iffhs.com/en/news/iffhs-mens-world-all-time-ranking-club-goal-scorers-2594).
- [The FA — listado oficial de finales y ganadores de la FA Cup](https://www.thefa.com/competitions/thefacup/fa-cup-finals).
