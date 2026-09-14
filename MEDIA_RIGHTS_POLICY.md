# Política de imágenes y escudos de Rango 90

## Decisión

No se considera que una API de fútbol conceda derechos sobre las fotografías, escudos o marcas que devuelve. Las URLs de API-Football y Sportmonks sirven para localizar recursos, pero no son por sí solas una autorización suficiente para redistribuirlos en una web, PWA o aplicación Android.

Para el MVP se utilizarán dos vías separadas:

1. **Fotografías de jugadores:** Wikimedia Commons como fuente de descubrimiento y descarga, únicamente cuando el archivo concreto tenga una licencia compatible y verificable. Se priorizan CC0, dominio público y CC BY. CC BY-SA solo se acepta mediante revisión explícita de sus obligaciones de atribución y compartir derivados. Se descartan CC BY-NC, CC BY-ND, licencias desconocidas y archivos sin una página de origen verificable.
2. **Escudos de clubes y selecciones:** se buscará primero autorización o licencia directa del titular, o un proveedor que conceda expresamente derechos de uso comercial en aplicaciones. Un archivo de Commons puede ser técnicamente reutilizable por su licencia de copyright, pero eso no elimina automáticamente marcas, diseños protegidos ni otros derechos del escudo. No se aprobará un escudo solo porque aparezca en Wikipedia, Commons, Simple Icons o una API.

## Reglas de revisión

Cada activo debe conservar:

- URL de la página de origen, no solo la CDN.
- Autor o línea de atribución.
- Licencia y URL de la licencia.
- Fecha de descarga y hash del archivo descargado.
- Entidad asociada y tipo de activo: `portrait` o `badge`.
- Estado `pending`, `approved` o `rejected`.

La aprobación es manual. El normalizador genera WebP 512x512, pero recortar o recomprimir una imagen no sustituye el cumplimiento de la licencia original ni de los derechos de imagen o marca.

La calidad visual también es obligatoria: el rostro debe ser identificable y ocupar una parte útil del encuadre. Se descartan fotografías de espaldas, demasiado lejanas, borrosas, de grupos o en las que el jugador solo aparece parcialmente. Para jugadores activos o retirados recientemente se prioriza una imagen de los últimos años; una fotografía antigua solo se conserva como excepción si es nítida, individual y no existe una alternativa abierta más reciente. La licencia por sí sola no convierte una mala coincidencia visual en un retrato válido.

## Fuentes descartadas como autorización automática

- **API-Football:** sus condiciones indican que no concede una licencia de uso/publicación de los datos y que el usuario debe obtener las autorizaciones necesarias para imágenes, logos y marcas.
- **Sportmonks:** indica expresamente que las fotos de perfiles y logos pertenecen a sus titulares y que el cliente debe disponer de sus propios derechos.
- **Openverse:** es útil como buscador de material abierto, pero su documentación advierte que no garantiza la exactitud de la información de licencia; siempre hay que verificar el archivo original. La API ofrece un nivel autenticado estándar para evitar depender del límite anónimo, pero eso solo mejora el acceso técnico y no concede derechos sobre cada archivo. Véase su [documentación de autenticación y límites](https://docs.openverse.org/_preview/3965/api/reference/authentication_and_throttling.html).
- **Simple Icons:** el repositorio se publica bajo CC0 como software/proyecto, pero advierte que los iconos individuales pueden tener otra licencia y que la licencia CC0 no elimina derechos de marca.
- **Repositorios de GitHub de escudos:** que el repositorio declare MIT, CC0 o una licencia similar no demuestra que el autor tuviera autorización para relicenciar las marcas y diseños de los clubes. No se usarán como fuente automática.
- **Búsqueda de Commons para escudos:** la búsqueda puede devolver documentos, banderas, escudos históricos o resultados no relacionados. En una prueba con los 20 clubes de Premier League no produjo una cobertura fiable de escudos oficiales; esos resultados no se han descargado ni aprobado.
- **Términos de la Premier League:** la propia Premier League indica que sus marcas, logos y nombres pertenecen a la liga, clubes o proveedores, y que no concede derechos para utilizarlos sin permiso escrito. Que un escudo esté servido por una página oficial no basta para reutilizarlo.
- **UEFA:** las páginas históricas de estadísticas sirven como fuente oficial del ranking, pero las URLs de fotos de jugador y escudos que aparecen en el HTML no contienen una licencia de redistribución para Rango 90. Se registran como candidatos `pending` y no pueden aprobarse sin autorización escrita o una licencia independiente.
- **France Football/L’Équipe:** el palmarés oficial sirve como fuente de los ganadores del Balón de Oro, pero sus fotografías editoriales no incluyen por sí mismas una licencia de redistribución para Rango 90. Se registran como candidatos `pending`.
- **Stats Perform/Opta:** sus condiciones públicas no deben interpretarse como una autorización para usar headshots dentro del gameplay. El Master License Agreement de diciembre de 2025 excluye expresamente el uso comercial de fotografías/headshots en elementos de juego salvo que el contrato aplicable establezca otra cosa; además, sus términos para logos de terceros indican que Stats Perform no puede conceder por sí sola esos derechos. Solo podría valorarse mediante una excepción contractual expresa para Rango 90.

La comprobación específica de proveedores comerciales tampoco ha encontrado una solución global que permita asumir los derechos de todo el catálogo:

- **Sportmonks:** su [FAQ oficial](https://www.sportmonks.com/faq/) dice que los logos y fotos de perfil pertenecen a sus titulares y que el cliente debe aportar la prueba de sus derechos. Pagar el acceso a datos no resuelve las imágenes.
- **badges.football:** su [sitio oficial](https://badges.football/) ofrece identificadores visuales independientes para productos comerciales, pero declara expresamente que no son escudos oficiales ni están licenciados o respaldados por clubes, ligas o federaciones. Puede servir como fallback visual, no para cumplir el requisito de mostrar escudos reales.
- **Sportradar Images API:** sí ofrece técnicamente headshots y logos de equipos, y sus manifiestos permiten seguir cambios, pero sus [términos oficiales](https://developer.sportradar.com/sportradar-updates/page/terms-and-conditions) dicen que Sportradar no posee los logos/headshots de terceros ni puede conceder sus derechos. Las imágenes de terceros requieren permiso confirmado en el pedido y el addendum impone restricciones editoriales y de retirada. No se aprobará como licencia de Rango 90 hasta que una orden de servicio confirme por escrito el uso concreto del juego.
- **Stats Perform/Opta:** su [Master License Agreement](https://www.statsperform.com/legal/mla-december-2025/) contiene una limitación específica para fotografías/headshots en usos comerciales de gameplay, y sus [términos de AP](https://www.statsperform.com/legal/apterms/) advierten que los logos deportivos de terceros se suministran sin que Stats Perform pueda licenciarlos. Se mantiene fuera de la lista de fuentes aprobadas salvo contrato o addendum que modifique expresamente esas limitaciones.
- **SportsDataIO:** su [página de imágenes](https://sportsdata.io/news-and-images) describe los headshots como “fully licensed for editorial use”. Eso es una autorización más limitada que la que necesitamos para un juego comercial; no se extrapola a gameplay, Android, caché/CDN ni al fútbol histórico sin contrato.
- **Genius Sports:** su [API Explorer](https://developer.geniussports.com/warehouse/rest/index_football.html) documenta campos de `logo` y `photo` para clubes, equipos y personas, y su [documentación de licensing](https://developer.geniussports.com/licensing/index.html) documenta el acceso técnico al servicio de licencias. Ninguna de esas páginas públicas constituye una licencia de redistribución para Rango 90; queda como proveedor a consultar mediante contrato.
- **Conclusión:** no se integrará ninguna fuente como “licencia universal” sin un contrato que cubra expresamente los activos, el uso comercial, web/PWA/Android, almacenamiento local, CDN/caché, atribución y el territorio. Esta es la razón por la que el sistema conserva candidatos descargados en `pending`.

## Alternativa de bajo coste para el MVP

Si todavía no se consigue una licencia de los escudos oficiales, hay dos opciones seguras:

1. Solicitar a un proveedor de identificadores visuales independientes, como [`badges.football`](https://badges.football/), una licencia comercial escrita. El proveedor explica que sus identificadores no son escudos oficiales y que su modelo comercial se negocia según cobertura, integración y volumen, sin publicar una tarifa fija. Hay que confirmar precio, cobertura, derechos de uso dentro de la aplicación, almacenamiento local y límites de peticiones antes de contratar.
2. Diseñar identificadores propios de Rango 90 —por ejemplo, una forma, color y sigla por club— y etiquetarlos claramente como identificadores del juego, no como escudos oficiales. Es la opción de menor coste y riesgo, pero no satisface el requisito de mostrar el escudo real.

También se ha preparado un adaptador de TheSportsDB para descargar candidatos de escudo con coincidencia exacta. La fuente sirve para explorar cobertura y dejar activos locales `pending`, pero no se considera autorización automática: sus términos distinguen el acceso gratuito de la publicación de aplicaciones y dejan al usuario la responsabilidad sobre contenido de terceros, marcas y permisos. La página oficial muestra Single Developer a 9 USD/mes, 90 USD/año o 295 USD de por vida, con 100 peticiones por minuto en los planes de pago; permite usar artwork personalizado con atribución, pero sigue exigiendo permiso para contenido de terceros y que los logos de marcas deportivas se usen sin modificar. Es una alternativa potencialmente barata, no una licencia global: antes de contratar hay que confirmar que cubre el artwork elegido y el uso web, PWA, Android, caché/CDN y comercial de Rango 90. Ningún activo de proveedor se aprueba desde el importador.

La lectura de sus [términos oficiales](https://www.thesportsdb.com/docs_terms_of_use.php) y [precios](https://www.thesportsdb.com/docs_pricing.php) queda fijada así: el plan gratuito sirve para desarrollo, pero no para publicar en una tienda; el plan de pago permite usar el artwork personalizado con atribución, no convierte automáticamente en licenciados los escudos o imágenes aportados por terceros. El campo `strCreativeCommons` de cada jugador debe comprobarse cuando exista; la ausencia de ese campo no se interpreta como una licencia abierta. Por ello TheSportsDB puede cubrir artwork propio o claramente licenciado, pero no autoriza por sí solo toda la colección de escudos oficiales.

No se presupone que exista un proveedor de escudos oficiales completo y barato. La decisión económica correcta requiere una cotización y una licencia que cubra expresamente publicación comercial, web estática, Android, caché/CDN y uso histórico. Hasta entonces, los activos oficiales permanecen en `pending` y ningún ranking con escudos se publica.

API-Football tampoco se considera por sí sola una licencia de imágenes: sus [condiciones de uso](https://www.api-football.com/terms) advierten de posibles restricciones de terceros sobre datos, logos e imágenes y trasladan al usuario la responsabilidad de comprobar el uso legal. Por eso sus URLs de medios se archivan como candidatos de contraste, pero no se aprueban automáticamente para Rango 90.

Las imágenes `CC BY-SA` pueden aprobarse únicamente mediante una decisión explícita con `--allow-share-alike`. En ese caso Rango 90 debe conservar la atribución, enlazar la licencia, indicar la transformación a WebP 512x512 y ofrecer el derivado bajo la licencia aplicable. La aprobación automática sigue prohibida.

La verificación de TheSportsDB del 12 de septiembre de 2026 confirmó que 223/223 fichas de los candidatos pendientes coinciden en identidad y deporte, y que enlazan a `CC BY-SA 4.0`; la evidencia se conserva en cada asset. Siguen pendientes hasta aceptar ShareAlike, revisar derechos de imagen y confirmar contractualmente el alcance de publicación.

## Procedimiento operativo

1. Descubrir candidatos en Commons sin aprobarlos automáticamente.
2. Revisar manualmente identidad, autoría, licencia, restricciones de persona y, para escudos, marca/diseño.
3. Descargar el original o una copia permitida, normalizar a WebP 512x512 y calcular SHA-256.
4. Registrar el activo con `media:register` y sus datos de licencia.
5. Aprobarlo solo después de la revisión.
6. Publicar un ranking solo cuando sus 200 primeras entradas tengan cobertura de datos validada y cualquier activo visual publicado tenga expediente aprobado. Las imágenes opcionales pueden usar el fallback propio.

Esta política no sustituye asesoramiento jurídico. Si se quiere una cobertura completa de escudos comerciales, la decisión presupuestaria correcta es negociar una licencia de marca/activos con los titulares o contratar un proveedor que la incluya por escrito. 

## Comprobación de proveedores de API (11 de septiembre de 2026)

La revisión de alternativas no cambia el criterio de publicación. Los términos de [Football API](https://footballapi.com/legal/terms-of-use/) permiten, sujetos al plan, mostrar los datos dentro de la aplicación y mantener una caché razonable, pero reservan los derechos de los materiales, prohíben redistribuir el feed bruto y no constituyen por sí solos una licencia de retratos o escudos de terceros. Los [términos oficiales de API-Football](https://www.api-football.com/terms) son aún más explícitos: no conceden una licencia de uso y publicación de los datos en aplicaciones o webs y trasladan al usuario la obtención de autorizaciones necesarias. Por tanto, ninguna suscripción de API se contabiliza como licencia visual para Rango 90 sin una autorización escrita que cubra específicamente retratos, escudos, almacenamiento, CDN, web, PWA, Android y uso comercial.

## Estado de cobertura auditado

### Estado real de cobertura (12 de septiembre de 2026; última auditoría de BBDD)

La BBDD contiene actualmente 253 definiciones: 109 no retiradas y 144 retiradas. Las 109 categorías no retiradas tienen snapshot no superseded; todavía no hay snapshots publicados. El universo de perfiles jugables contiene 906 jugadores, pero el conjunto real de juego son 828 personas únicas presentes en rankings activos: 464 tienen retrato legal aprobado y 364 siguen sin retrato legal publicable (56,04%). La cobertura se expresa por personas únicas y por posiciones por separado: un jugador puede aparecer en muchos rankings, pero solo necesita un retrato canónico. Los assets aprobados de entidades no jugables o las alternativas auditadas no se cuentan como jugadores jugables cubiertos.

Las cifras históricas que aparecen más abajo conservan contexto de auditorías anteriores; para el estado actual debe utilizarse siempre el bloque “Control operativo más reciente”.

### Control operativo más reciente

Tras la consolidación de identidades y la revisión Commons del 12 de septiembre de 2026, el control operativo vigente es de 828 jugadores jugables únicos presentes en rankings activos: 464 tienen retrato principal que cumple el expediente técnico de licencia abierta, uso comercial, atribución, evidencia y alcance, y 364 no lo tienen (56,04%). La métrica secundaria de perfiles jugables completos es 906, pero no representa el conjunto que necesita el juego. Hay 1.355 assets de retrato de jugadores aprobados y publicables, que cubren 1.237 personas canónicas; el juego cuenta únicamente personas jugables únicas y puede conservar alternativas históricas para trazabilidad. Los candidatos pendientes siguen sin contabilizarse como cobertura legal. Los 20 assets de badge aprobados son banderas de selecciones: hay 20 banderas nacionales y **0 escudos de clubes** con autorización marcaria y expediente de publicación completo.

En el snapshot de goles históricos de Premier League (`rs_3f86528d7ef5b1f7d88891e0`) hay 98 retratos principales aprobados de 100; las 98 imágenes aprobadas tienen ya derechos de publicación registrados conforme a esta política. Los dos huecos pendientes son Kevin Campbell y Chris Armstrong; Brian Deane ya tiene una imagen CC BY 3.0 revisada. No se han rellenado los huecos restantes con homónimos ni fotografías de identidad dudosa. Los rankings históricos de clubes conservan los candidatos oficiales en `pending` hasta resolver la licencia de sus escudos. El snapshot del Mundial de selecciones (`rs_6ef1e4b6e42252fcebc01b97`) tiene 8/8 banderas aprobadas como dominio público y cobertura visual completa. El ranking de Balón de Oro tiene retratos aprobados y otros pendientes por licencia CC BY-SA; los CC BY-SA están descargados y normalizados, pero requieren aceptar explícitamente la obligación de compartir derivados.

La revisión del 9 de septiembre de 2026 conserva el criterio de no aceptar homónimos ni fotografías de identidad dudosa. Los derivados CC BY-SA aprobados con base legal abierta conservan además la licencia del derivado explícitamente registrada. Los escudos Commons pendientes actuales se mantienen separados de la cobertura de retratos y sujetos a revisión de marca; los candidatos de otros proveedores siguen sujetos a revisión contractual o de derechos.
En la revisión del 12 de septiembre, el comando de descubrimiento considera “cubierta” únicamente una imagen con expediente legal completo, no cualquier imagen aprobada por identidad. Los retratos borrosos, lejanos o mal identificados se rechazan. El control global actual queda en 1.355 assets de retrato de jugadores aprobados y publicables, que cubren 1.237 personas canónicas; para el juego se contabilizan 464 de 828 jugadores únicos ranqueados (56,04%). Los candidatos de escudos y de otros proveedores siguen sujetos a revisión de marca o contractual.
