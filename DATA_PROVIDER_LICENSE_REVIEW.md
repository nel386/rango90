# Revisión de proveedores y derechos de datos

Fecha de revisión: 14 de septiembre de 2026 (UTC)

Este documento es un registro técnico de diligencia, no una opinión jurídica. Rango90 no debe publicar estadísticas, retratos, escudos o marcas hasta conservar un contrato o autorización verificable que cubra exactamente el uso previsto.

## Resultado operativo

La existencia de una API, un plan gratuito o una respuesta con imágenes no demuestra que Rango90 pueda redistribuir esos contenidos. La fuente solo podrá pasar a `approved` cuando el expediente incluya proveedor, competición, campos autorizados, territorios, duración, uso web/Android, atribución, almacenamiento/cache, sublicencia o redistribución y tratamiento de imágenes/logos.

## Decisión de producto declarada

El proyecto no contratará una licencia comercial de proveedor de datos. En consecuencia:

- Solo se podrán publicar estadísticas cuya fuente tenga términos públicos verificables que permitan expresamente el uso previsto, o una autorización escrita gratuita que cubra ese uso.
- Una API gratuita, una página pública o la mera posibilidad técnica de descargar datos no se considerarán autorización de redistribución.
- Para retratos y otros recursos visuales se usarán únicamente activos con licencia abierta verificable, registrada por activo. La disponibilidad en Wikimedia Commons no sustituye la comprobación de la licencia concreta, sus obligaciones de atribución y, cuando aplique, ShareAlike.
- Los escudos, logos y marcas oficiales quedan fuera salvo que exista una autorización específica. Puede usarse un identificador visual propio como fallback.

Esta decisión permite continuar con el desarrollo local y con datos `draft`, pero no convierte automáticamente las fuentes actualmente revisadas en `approved` ni permite presentar el producto como legalmente listo para publicación.

Para la matriz elegida, `player-career-goals` significa goles oficiales de carrera global, sumando clubes y selección absoluta con una definición y una procedencia homogéneas. `world-cup-goals` es una categoría separada y no sustituye ese total.

## Fuentes revisadas

| Fuente | Lo que permiten inferir sus condiciones públicas | Decisión para Rango90 |
| --- | --- | --- |
| [API-Football, Terms of Service](https://www.api-football.com/terms) | Permite crear aplicaciones con los datos, pero prohíbe la reventa directa y declara que no concede por sí misma la licencia para publicar datos; el usuario debe obtener las autorizaciones necesarias de los titulares. Las imágenes, logos y marcas pueden requerir autorización separada. | No aprobada sin autorización escrita que cubra la redistribución y los activos visuales. |
| [Football-Data.org, General Terms](https://www.football-data.org/client/register) | Exige una aplicación concreta, mantiene las credenciales confidenciales y requiere atribución. Declara que los gráficos, logos y fotos pertenecen a sus titulares y que el consentimiento debe obtenerse por separado. | Puede servir como candidato de alimentación bajo su plan adecuado; no resuelve por sí sola los derechos de publicación ni de imágenes. |
| [Sportradar, Terms and Conditions](https://developer.sportradar.com/sportradar-updates/page/terms-and-conditions) | La licencia pública está limitada al producto y a las propiedades autorizadas; restringe la redistribución y el uso fuera del alcance contratado. Los logos requieren derechos propios o autorización específica. | No aprobada sin contrato con alcance explícito para el juego, web, Android y almacenamiento de snapshots. |
| [Stats Perform, pricing and licensing FAQ](https://www.statsperform.com/faqs/stats-perform-faqs-pricing-licensing/) | Ofrece licencias a medida para estadísticas, analítica y APIs, incluso por competición o país. Esto confirma que el alcance debe contratarse, no presumirse. | Candidato comercial para cotizar; no aprobado mientras no exista oferta/contrato archivado. |
| [OpenFootball/leagues, licencia CC0](https://github.com/openfootball/leagues/blob/master/LICENSE.md) | El repositorio dedica sus contenidos al dominio público mediante CC0 1.0 Universal. La propia licencia advierte que no concede derechos sobre marcas, patentes ni derechos de terceros y que el contenido se ofrece “tal cual”. | Candidato abierto para resultados y temporadas; no aprobado todavía como fuente de publicación porque falta cerrar cobertura, exactitud histórica, atribución documental y derechos de los nombres/logos de terceros. |
| [schochastics/football-data, licencia ODC-By](https://github.com/schochastics/football-data) y [texto oficial ODbL](https://opendatacommons.org/odbl/1-0/) | El proyecto indica que sus resultados están bajo Open Data Commons Attribution License. La ODbL permite compartir, modificar y usar la base de datos, pero exige avisos/atribución, enlace a la licencia y condiciones Share-Alike para bases derivadas; no cubre automáticamente derechos sobre los contenidos individuales ni sobre marcas. | Candidato abierto para derivar campeones nacionales; permanece en `review_required`/`draft` por errores históricos declarados, etiquetas de competición imperfectas y entidades de clubes no resueltas consistentemente. |
| [schochastics/football-data, `goals_time2`](https://github.com/schochastics/football-data/tree/master/data/goals_time2) y [texto oficial ODbL](https://opendatacommons.org/odbl/1-0/) | El mismo repositorio contiene incidentes de partidos con etiquetas explícitas `Yellow Card` y `Red Card`. La extracción fija el commit, conserva cada archivo como evidencia y no transforma `Second Yellow Card` en roja. | Candidato abierto para tarjetas de jugadores, pero permanece en `review_required`/`draft`: las etiquetas son `Surname Initial`, no hay IDs estables, la cobertura histórica no es mundial y las fusiones de identidades requieren revisión. |

## Evidencia local actual

- `sources` contiene 0 fuentes con `rights_status = approved`.
- Las categorías y snapshots candidatos continúan en `draft`; además existen snapshots provisionales de `player-career-goals` (`rs_c2c4a7942b4f8d2bd156306c`, 200 filas, `coverage_complete=false`) y `national-league-club-titles` (`rs_4a6b0b0b2c44aba9486db714`, 200 filas, `coverage_complete=false`), ninguno publicable.
- Los activos de retratos y escudos no se consideran publicables solo por estar descargados o por tener un fallback visual.
- El validador `validate:evidence:global-career-goals` informa que no hay fuente válida para publicar. El agregado provisional existente se mantiene explícitamente en `draft` y no cambia esa decisión.

## Candidato abierto sin licencia de proveedor — Wikidata

La documentación oficial de [licenciamiento de Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing) establece que los datos estructurados de los espacios principales se ofrecen bajo CC0. Su [guía oficial de reutilización](https://www.wikidata.org/wiki/Wikidata:Reuse) confirma que pueden reutilizarse sin obligación de atribución. Esto encaja con la decisión de no contratar una licencia de proveedor.

Wikidata queda aprobado aquí únicamente como candidato para identidad, nombres, fechas y relaciones de entidades. No se considera todavía fuente suficiente para ninguna de las siete clasificaciones: hay que demostrar, mediante una consulta reproducible y una auditoría de cobertura, 200 filas reales, una definición estadística homogénea y procedencia verificable para cada valor. Hasta entonces no se cambia ningún snapshot a `approved`.

## Candidatos abiertos adicionales para títulos de clubes

La revisión de fuentes abiertas identifica dos conjuntos útiles para investigar la categoría `national-league-club-titles`, pero ninguno se aprueba automáticamente ni cubre las cinco categorías de jugadores:

- [OpenFootball/leagues](https://github.com/openfootball/leagues) declara en su archivo de licencia que sus contenidos se ofrecen bajo CC0 1.0 Universal. CC0 elimina las restricciones de copyright que pueda ceder el autor, pero deja expresamente fuera marcas, patentes y derechos de terceros, y no garantiza exactitud. Es un candidato para resultados y temporadas de competiciones, no una fuente de tarjetas, goles individuales o palmarés de jugadores.
- [schochastics/football-data](https://github.com/schochastics/football-data) publica resultados de más de 200 ligas domésticas bajo la Open Data Commons Attribution License. La ODbL permite reutilizar la base con atribución y obligaciones de aviso/Share-Alike para bases derivadas, pero no transfiere por sí sola derechos sobre contenidos individuales, nombres comerciales, escudos o logos. Puede servir para derivar campeones por temporada, pero el propio proyecto advierte de errores en partidos antiguos y de identidades de clubes que se fusionan, dividen o desaparecen.

Antes de usarlos en un snapshot publicable hay que conservar la licencia y versión exactas, reconstruir la clasificación de cada temporada, resolver cambios históricos de identidad, contrastar los campeones y documentar la atribución ODC cuando corresponda. Esta ruta puede ampliar el universo de títulos nacionales; no resuelve por sí misma las tarjetas amarillas/rojas ni los goles globales de carrera.

### Evidencia primaria comprobada el 14/09/2026

- OpenFootball: [LICENSE.md](https://github.com/openfootball/leagues/blob/master/LICENSE.md) identifica CC0 1.0 Universal y conserva las limitaciones sobre marcas, patentes, derechos de terceros y ausencia de garantías.
- football-data: [README del repositorio](https://github.com/schochastics/football-data) identifica la Open Data Commons Attribution License y advierte sobre errores en datos antiguos y fusiones/divisiones/desapariciones de clubes no resueltas de forma consistente.
- ODbL: [licencia oficial](https://opendatacommons.org/odbl/1-0/) exige mantener avisos, incluir la URI de la licencia y aplicar sus condiciones de atribución y Share-Alike cuando se redistribuye una base derivada.

Esta evidencia permite conservar ambos conjuntos como candidatos abiertos documentados; no cambia `rights_status` a `approved`, no autoriza retratos/escudos/logos y no desbloquea `publish` sin completar la auditoría de cobertura y el expediente de uso en la aplicación.

Para las dos categorías de tarjetas se añadió un importador reproducible de `goals_time2`. Genera `club-career-yellow-cards` y `club-career-red-cards` como snapshots candidatos, limita la salida a 200 filas y deja explícita la definición de cada incidente. La consolidación de identidades solo enlaza una etiqueta cuando apellido e inicial resuelven a un único jugador canónico; los casos ambiguos se conservan separados para evitar atribuciones especulativas. Esta fuente mejora la cobertura técnica, pero no convierte todavía ninguna de las dos categorías en publicable.

El backend ya incorpora `openFootballClient.ts`, sus pruebas unitarias, el generador `data:manifest:openfootball` y el comando `build:rankings:openfootball:national-league-club-titles`. El generador fija los commits de los repositorios y excluye temporadas en curso; el comando exige un manifiesto de temporadas con URLs HTTPS, conserva esas URLs en la evidencia y solo produce snapshots `draft`. El manifiesto reproducible usado para la última ampliación está en `backend/data/manifests/openfootball-national-league-titles-2026-09-14.json` (296 temporadas, 73 competiciones). Una prueba contra el archivo real de la Premier League 2023/24 devolvió sus 380 partidos esperados.

Como control adicional, se inspeccionó el archivo `games.parquet` de `schochastics/football-data`: aunque declara 1.309.501 partidos y 206 etiquetas domésticas, contiene etiquetas históricas que no son suficientemente fiables para importar sin revisión (por ejemplo, filas bajo `ddr` corresponden a clubes rusos y `Copa Sud` aparece mezclada con el nivel nacional). Por ello se mantiene como referencia de investigación, no como fuente automática para el ranking.

## Candidato adicional revisado — Football API / Roanuz

El [texto oficial de términos de Football API](https://footballapi.com/legal/terms-of-use/) actualizado el 15 de mayo de 2026 indica que el uso comercial de los datos solo está permitido en la medida autorizada por el plan contratado o por un acuerdo separado. También permite mostrar datos dentro de la aplicación y conservar caché razonable, pero prohíbe redistribuir datos crudos o crear feeds/productos derivados competitivos sin un acuerdo escrito específico.

La [página oficial de precios](https://footballapi.com/pricing/) publica el plan Basic a **172 USD/mes** con facturación anual o **229 USD/mes** con facturación mensual. Esto excede ampliamente el presupuesto operativo aproximado de 30 €/mes y, por sí solo, no demuestra cobertura homogénea de los siete rankings históricos requeridos.

Decisión: **no seleccionado**. Podría solicitarse una oferta empresarial únicamente si cambia el presupuesto; antes de importar o aprobar cualquier dato todavía habría que obtener confirmación escrita sobre el juego comercial, rankings derivados, snapshots inmutables, almacenamiento, Android, atribución y derechos de terceros.

## Candidato adicional revisado — Sportmonks

La [página oficial de precios de Sportmonks](https://www.sportmonks.com/football-api/plans-pricing/) publica planes desde **29 €/mes** o **24 €/mes con pago anual**, con selección de cinco ligas en el plan Starter. La documentación comercial también anuncia estadísticas de equipos y jugadores y datos históricos; sin embargo, el propio proveedor indica que la profundidad histórica y los tipos de estadísticas varían por liga y temporada. Por tanto, el precio y la afirmación general de cobertura no demuestran que exista la matriz exacta de siete categorías homogéneas, 200 jugadores por categoría y siete jugadores comunes que necesita Rango90.

Los [términos oficiales de Sportmonks](https://www.sportmonks.com/terms-of-service/) dicen que el proveedor permite crear aplicaciones, sitios web y juegos, y que la distribución, transferencia y almacenamiento de los datos del servicio están permitidos; también prohíben revender directamente los datos sin aprobación. Los mismos términos declaran que los datos pueden tener huecos o discrepancias y que los logos y fotos de perfil requieren que Rango90 obtenga y conserve su propia prueba de propiedad intelectual. La página oficial para productos de medios confirma que la redistribución depende del plan y del caso de uso y recomienda obtener esos términos por escrito antes de publicar.

Decisión: **candidato condicional, no aprobado**. Antes de contratar o importar datos hay que pedir por escrito, para el plan y las ligas concretas, autorización para los siete rankings históricos derivados, snapshots inmutables, caché/backups, web/PWA/Android, atribución y uso sin retratos/logos del proveedor. También hay que ejecutar una extracción de prueba y demostrar cobertura, identidad canónica, empates y conflictos con el contrato 7×7. Sin esa evidencia, la fuente permanece en `review_required` y los snapshots en `draft`.

## Criterio de desbloqueo

Para cada una de las siete categorías debe incorporarse al expediente:

1. Contrato, permiso o términos aplicables archivados con URL y fecha de comprobación.
2. Identificación de la fuente y de la competición cubierta.
3. Confirmación expresa de uso en una aplicación de juego, web y Android.
4. Confirmación sobre snapshots, cache, backups y exposición de respuestas al cliente.
5. Derechos separados para retratos, escudos, logos y marcas, o decisión documentada de usar únicamente el fallback propio.
6. Atribución y límites de uso implementados en la interfaz y en la política de datos.

Hasta completar esos seis puntos, el pipeline debe mantener la fuente y los snapshots en `review_required`/`draft` y bloquear `publish`.
