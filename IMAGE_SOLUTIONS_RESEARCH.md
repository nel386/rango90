# Soluciones de imágenes y escudos para Rango 90

## Conclusión ejecutiva

La cobertura visual actual del juego es de **1.030 retratos legales principales para 6.675 jugadores jugables únicos: 15,43%**. Quedan **5.645 jugadores** sin retrato principal. Hay **232 clubes jugables y 0 escudos oficiales publicables con licencia marcaria verificada**. Un jugador que aparece en varios rankings cuenta una sola vez.

El cuello de botella dominante es el trabajo manual de localizar, verificar y documentar retratos; no es PostgreSQL ni el acceso a las estadísticas. A una estimación de 2–5 minutos por jugador, completar manualmente los 5.645 faltantes supondría aproximadamente **188–470 horas**. Es una estimación operativa, no una medición exacta, pero explica por qué el enfoque actual no escala.

**Decisión recomendada:** detener la búsqueda masiva manual y abrir inmediatamente dos vías comerciales en paralelo:

1. **FIFPRO Commercial Enterprises** para una licencia colectiva de nombres, imágenes y likeness de futbolistas en un producto digital/juego.
2. **Sportradar Images API / Soccer** para obtener headshots, logos y manifiestos automatizables, pero únicamente si el Order Form concede expresamente los derechos de juego comercial, almacenamiento, CDN, recortes y Android/PWA.

Como tercera vía, mantener **Wikimedia Commons/Openverse** únicamente para casos concretos con licencia verificable, especialmente jugadores históricos. **TheSportsDB**, aunque barato, sirve como acelerador de descubrimiento y datos; no debe considerarse una licencia global de sus fotografías o escudos. **badges.football** puede cubrir visualmente equipos con identificadores propios, pero reconoce que no son escudos oficiales.

No existe en la investigación una API económica que entregue automáticamente 6.675 retratos y 232 escudos oficiales con una licencia comercial de juego clara y universal. Si el producto exige caras reales y escudos oficiales desde el primer día, hay que aceptar una negociación/licencia profesional. Si se quiere mantener un coste bajo, hay que aceptar un fallback visual propio y no oficial para parte del catálogo.

## Evidencia y alcance operativo

El catálogo vigente ya separa los datos históricos de los jugadores realmente jugables. Los rankings operativos usan un corte máximo de 200 entradas por categoría y un jugador solo necesita un retrato canónico aunque figure en muchas categorías. Las entidades fuera de ese circuito no deben generar trabajo de medios.

El estado de medios que debe usarse para medir el proyecto es:

| Métrica | Estado |
|---|---:|
| Jugadores jugables únicos | 6.675 |
| Retratos legales principales | 1.030 |
| Jugadores sin retrato principal | 5.645 |
| Cobertura de retratos | 15,43% |
| Clubes jugables | 232 |
| Escudos oficiales publicables | 0 |
| Categorías activas | 113 |

Estas cifras no cuentan candidatos `pending`, imágenes rechazadas, duplicados por ranking ni jugadores históricos excluidos del juego.

## Qué se ha comprobado

### 1. Licencia colectiva de jugadores: FIFPRO

FIFPRO Commercial Enterprises declara que desarrolla acuerdos colectivos para proteger y licenciar los derechos NIL —nombre, imagen y likeness— y que trabaja con productos que incorporan futbolistas reales, incluyendo videojuegos, aplicaciones y experiencias digitales. También tiene un formulario específico para desarrolladores de videojuegos donde solicita plataforma, territorio, duración, monetización y si se necesitan nombres, imágenes o likeness.^1

Es la vía más alineada con un juego de fútbol para jugadores profesionales actuales. No debe interpretarse como que FIFPRO entrega automáticamente los archivos fotográficos ni como cobertura garantizada de todos los jugadores históricos, retirados, asociaciones nacionales o mercados. Hay que preguntar expresamente:

- qué jugadores, asociaciones y territorios cubre;
- si la licencia incluye uso en gameplay y no solo promoción/editorial;
- si entrega headshots o solo derechos NIL;
- qué ocurre con retirados, leyendas y jugadores no afiliados;
- duración, renovaciones, retirada de jugadores y coste mínimo.

La licencia de FIFPRO tampoco resuelve los escudos de clubes ni el copyright concreto de una fotografía. Puede resolver el permiso para representar al jugador, pero el archivo visual debe tener además una fuente licenciada o producirse específicamente para Rango 90.

### 2. Feed profesional de imágenes: Sportradar Images API

La documentación de Sportradar confirma que su Images API ofrece headshots de jugadores, imágenes de equipos y logos, varios tamaños, IDs vinculables a jugadores/equipos y manifiestos de actualización. En 2026 también documenta nuevas colecciones de headshots de fútbol/UEFA y formatos JPG y PNG transparente, aunque la disponibilidad puede variar por jugador y equipo.^2

El punto importante está en el contrato: sus términos públicos indican que si se autoriza el uso de imágenes de terceros, esa autorización debe confirmarse en el **Order Form**; los términos generales también dicen que Sportradar no es titular de los logos/headshots de terceros ni puede conceder automáticamente esos derechos.^3

Por tanto, Sportradar es técnicamente la opción más prometedora para automatizar la ingesta, pero **no se debe pagar ni integrar como solución jurídica hasta obtener una cláusula escrita** que cubra Rango 90. La petición debe nombrar explícitamente el producto como juego de rankings futbolísticos, no como portal editorial.

### 3. Editorial y fotografía de agencia: IMAGO, Getty, Reuters, AP

IMAGO ofrece cobertura futbolística mundial, archivo histórico, headshot packages, webshop y API, con precios personalizados según uso y volumen. Su propia FAQ aclara que las imágenes están disponibles por defecto para uso editorial; eso no equivale a una autorización para usarlas como elementos permanentes de un juego comercial.^4

La documentación pública de Getty/Stats Perform es todavía más restrictiva: limita el uso editorial, excluye determinados usos comerciales y de fantasy/gameplay salvo autorización expresa, no garantiza derechos de imagen o marcas de las personas/clubes representados y puede exigir retirada del contenido. Por ello, una suscripción editorial de Getty, Reuters, AP o IMAGO no debe usarse para poblar fichas permanentes sin una licencia específica de juego.^5

Estas agencias pueden ser útiles si aceptan un paquete de headshots con derechos de producto digital, pero no son la opción barata por defecto.

### 4. TheSportsDB: barato, útil, insuficiente como solución global

TheSportsDB publica un plan Single Developer de **9 USD/mes**, con 100 solicitudes por minuto, y permite utilizar la API para desarrollar aplicaciones y servicios pagando la suscripción. Sus términos permiten copiar/modificar contenido devuelto por los endpoints oficiales y usar artwork personalizado mencionando la fuente.^6

Pero esos mismos términos dicen que gran parte del artwork lo crean usuarios, que los avisos de copyright/marca no deben eliminarse, que los logos de terceros deben usarse “as is”, y que el contenido de terceros solo se puede usar con permiso del titular o base legal suficiente. También recomienda comprobar `strCreativeCommons` para saber si un artwork concreto está bajo CC.^7

Conclusión: TheSportsDB puede acelerar candidatos, especialmente cuando una imagen tiene licencia CC explícita, pero pagar 9 USD/mes **no convierte sus 276 o miles de assets en una biblioteca licenciada para un juego**. Cada asset publicable debe conservar su evidencia individual.

### 5. API-Football y Sportmonks: sirven para datos, no para resolver derechos visuales

Los términos de API-Football dicen expresamente que las imágenes, logos y marcas proceden de terceros, se entregan para identificación/descripción y no incluyen una licencia general de publicación; la responsabilidad de obtener autorizaciones recae en el usuario.^8

Sportmonks mantiene la misma separación: declara que los logos y fotos de perfil tienen como titulares a terceros y que el cliente debe disponer de prueba de propiedad intelectual para mostrarlos en su aplicación o web.^9

La suscripción de API-Football que ya existe puede seguir usándose para estadísticas y sincronización. No hace falta cambiar la key ni comprar otra para resolver imágenes.

### 6. Wikimedia Commons y Openverse: legalmente viables, no escalables para todo el roster

Wikimedia Commons permite reutilizar contenido bajo la licencia individual indicada en cada archivo. CC BY y CC BY-SA permiten uso comercial, pero obligan a atribuir; CC BY-SA añade la obligación de compartir adaptaciones bajo una licencia compatible. Commons también advierte que pueden existir derechos morales, de personalidad u otras restricciones según el país.^10

Openverse indexa contenido CC o de dominio público, pero advierte expresamente que no puede garantizar la exactitud de la información de licencia y que el reutilizador debe verificar cada obra.^11

Para Rango 90 esto significa:

- sí para una cola curada de jugadores históricos o casos concretos;
- no como proceso principal para 5.645 jugadores;
- no asumir que una fotografía de una persona con CC resuelve automáticamente todos los derechos de personalidad;
- guardar autor, título, URL de la página de archivo, licencia, fecha de consulta, cambios realizados y hash.

### 7. Escudos oficiales: problema separado

Los escudos son marcas y elementos de identidad del club; no son simplemente “imágenes gratuitas”. La Premier League indica que sus marcas requieren permiso expreso y que los clubes conservan sus propias marcas, por lo que deben contactarse directamente antes de reproducir nombres o badges.^12 UEFA también exige que la identidad visual oficial del club —incluidos escudo, logos, marcas y colores— esté bajo propiedad/control del club o del miembro registrado.^13

`badges.football` ofrece más de 5.000 identificadores visuales y mapeo a proveedores, pero declara expresamente que son diseños independientes, no escudos oficiales y que no están afiliados, respaldados ni licenciados por clubes, ligas o federaciones.^14 Es un buen fallback coherente, pero no cumple el requisito “escudo oficial”.

Las vías reales son:

1. pedir al proveedor de imágenes una sublicencia expresa de logos;
2. negociar con clubes/ligas o con el agente que gestione sus derechos;
3. usar diseños propios claramente no oficiales mientras se tramitan los permisos.

### 8. Stock generalista y generación automática

Adobe Stock, Shutterstock y Alamy tienen APIs/licencias comerciales, pero están pensados para licenciar obras concretas, no para resolver una biblioteca mundial de retratos futbolísticos vinculada a IDs. Las imágenes editoriales suelen tener restricciones comerciales y las licencias se compran asset por asset. Adobe señala además que los assets editoriales no están autorizados para usos comerciales y que los activos con personas reconocibles dependen de los permisos incluidos en la licencia.^15

Generar una ilustración o avatar genérico propio es una solución segura para representar un slot sin usar una fotografía ajena. Generar una imagen que imite reconociblemente a un jugador real no debe considerarse automáticamente libre: puede activar derechos de imagen/personality y no sustituye una licencia de likeness. Solo debe usarse como fallback no identificable o después de obtener la autorización correspondiente.

## Comparativa de opciones

| Opción | Coste público | Automatización | Cobertura esperable | Seguridad para juego comercial | Veredicto |
|---|---:|---|---|---|---|
| FIFPRO + producción/fuente visual licenciada | No publicado; cotización | Alta para derechos, media para archivos | Profesionales afiliados; no garantiza leyendas | Alta si el contrato cubre NIL/gameplay | Abrir ya |
| Sportradar Images + Order Form específico | No publicado; enterprise | Alta: manifiestos, IDs, tamaños | Fútbol profesional; variable por jugador | Condicional: solo con permiso escrito | Cotizar ya |
| IMAGO / agencia con paquete de headshots | Personalizado | Media/alta | Muy buena cobertura editorial e histórica | Condicional; editorial no basta | Cotizar como alternativa |
| TheSportsDB | 9 USD/mes Single Developer | Alta técnicamente | Irregular | Media/baja salvo asset CC o permiso claro | Acelerador, no solución total |
| Wikimedia/Openverse | Gratis | Baja en validación | Irregular y baja para roster mundial | Alta por asset si se verifica | Cola histórica |
| badges.football | Cotización | Alta | 5.000+ equipos | Alta para el diseño propio; no es badge oficial | Fallback visual |
| API-Football/Sportmonks | Desde planes económicos | Alta | Datos y URLs | No conceden automáticamente derechos visuales | Mantener para datos |
| Clubes/ligas directamente | Variable | Baja inicialmente | Solo titulares contactados | Alta para el alcance firmado | Complemento para escudos |
| Stock/IA | Variable | Media | No garantizada | Depende de cada asset/resultado | No usar como vía principal |

## Ruta de ejecución para dejar de perder tiempo

### Decisión inmediata

1. **Congelar la búsqueda manual masiva** de Commons, salvo jugadores históricos prioritarios o casos que ya tengan candidato claro.
2. **No ampliar el denominador**: solo los jugadores jugables y activos del corte actual generan requisito de retrato. Un jugador repetido en 10 rankings sigue necesitando un solo retrato.
3. **No descargar ni publicar automáticamente** fotos/logos de API-Football, Sportmonks, SofaScore, Flashscore o webs de terceros.
4. Mantener los 1.030 retratos aprobados que ya tienen evidencia; no reabrirlos salvo alerta de derechos o error de identidad.

### Solicitudes comerciales que deben enviarse

Enviar el mismo brief a FIFPRO, Sportradar e IMAGO con estas condiciones:

- producto: Rango 90, juego de rankings de fútbol, web/PWA/Android;
- uso: fichas, retos, rankings, selección aleatoria, marketing propio del producto;
- territorio: mundial o países concretos claramente enumerados;
- jugadores: roster actual de 6.675 canónicos, con prioridad por frecuencia de aparición;
- históricos: lista separada de leyendas;
- formatos: descarga o URL autorizada, recorte, redimensionado, WebP 512×512, CDN y caché;
- almacenamiento: PostgreSQL para metadatos y object storage/CDN para binarios;
- actualizaciones: notificación de cambios, reemplazos y revocaciones;
- garantía/indemnidad: alcance de derechos de copyright, imagen, likeness y marcas;
- salida: qué ocurre con assets cuando termina el contrato.

No aceptar una respuesta de ventas del tipo “puedes usar la URL de la API”. Debe aparecer en contrato u Order Form.

### Puerta de aceptación contractual

Un proveedor solo se acepta si responde por escrito “sí” o delimita exactamente cada punto:

1. uso en juego comercial y elementos de gameplay;
2. uso web, PWA, Android y futuras plataformas acordadas;
3. publicación mundial o territorio contratado;
4. almacenamiento, CDN, caché y transformaciones técnicas;
5. retratos de jugadores activos y retirados, según lista;
6. escudos oficiales y marcas, si se incluyen;
7. atribución y avisos legales;
8. retirada, sustitución y tiempo de respuesta;
9. identificadores estables y manifest de actualización;
10. derecho a conservar snapshots históricos durante el periodo permitido.

## Arquitectura de actualización recomendada

La aplicación nunca debe consultar directamente al proveedor de imágenes durante una partida. El backend debe sincronizar los assets de forma programada y servir únicamente assets aprobados.

```text
Proveedor/licencia
        │ manifiesto + cambios + derechos
        ▼
Job de sincronización backend
        │ valida ID, licencia, hash, tamaño y estado
        ▼
PostgreSQL: asset + evidencia + vigencia + atribución
        │ binario normalizado
        ▼
Object storage/CDN Rango 90
        │ solo publicable y activo
        ▼
Frontend / juego
```

Cada asset debe guardar, como mínimo: `canonical_player_id` o `club_id`, proveedor, `provider_asset_id`, URL de origen, URL de términos, tipo de licencia, territorio, fecha de inicio/fin, evidencia contractual o de licencia, autor/credit, hash, dimensiones, formato, fecha de última comprobación, estado de retirada y fallback.

La actualización debe ser incremental: consultar manifiestos diarios o semanales según proveedor, comparar `provider_asset_id`, `updated_at`, ETag y hash, descargar solo cambios, generar WebP 512×512 y dejar un snapshot auditable. Si un asset se revoca, se marca no publicable y se activa el fallback sin borrar la evidencia histórica.

## Recomendación final

El enfoque actual no es sostenible para 6.675 rostros. El proyecto no está “al 15%” en datos generales; está al **15,43% en cobertura de retratos legales principales**, que es precisamente la parte que está consumiendo el tiempo. La solución no es otra API barata: es obtener una licencia de juego o reducir jurídicamente el requisito de fotografía real.

La ruta que recomiendo para Rango 90 es:

1. **FIFPRO** para la capa de derechos de jugadores.
2. **Sportradar Images** como primera cotización técnica de assets y logos, condicionada a un Order Form específico.
3. **IMAGO** como alternativa de imágenes si ofrece un paquete de headshots para producto digital/gameplay.
4. **Commons** solo para históricos con licencia individual demostrable.
5. **badges.football** como fallback de identidad visual no oficial mientras no exista licencia de escudo.
6. Mantener API-Football para datos y no comprar otra API solo por sus URLs de imágenes.

Si FIFPRO/proveedores no ofrecen una licencia asumible, la alternativa de bajo coste debe ser explícita: **fotografía real solo donde exista licencia; avatar/silueta propia para el resto; ningún retrato de terceros de procedencia dudosa**. Eso permite seguir desarrollando y lanzar sin convertir cada nuevo jugador en una investigación manual.

## Fuentes

1. FIFPRO, “Empowering Players Through Strategic Partnerships” y formulario de desarrolladores de videojuegos: [fifpro.org/commercial](https://www.fifpro.org/en/who-we-are/commercial), [formulario de licencias](https://www.fifpro.org/en/who-we-are/contact/video-game-developers).
2. Sportradar, [Images API](https://developer.sportradar.com/images-and-editorials/reference/images-overview) y [actualización de headshots de fútbol 2026](https://developer.sportradar.com/sportradar-updates/changelog/images-api-new-soccer-and-nascar-headshots).
3. Sportradar, [Terms and Conditions](https://developer.sportradar.com/sportradar-updates/page/terms-and-conditions), secciones de imágenes, logos y headshots.
4. IMAGO, [licencia de imágenes de fútbol](https://connect.imago-images.com/en/license-football-images).
5. Stats Perform/Getty, [Getty Terms and Conditions](https://www.statsperform.com/legal/getty-terms-conditions/).
6. TheSportsDB, [precios](https://www.thesportsdb.com/docs_pricing.php?billing=monthly).
7. TheSportsDB, [términos de uso](https://www.thesportsdb.com/docs_terms_of_use.php).
8. API-Football, [términos de servicio](https://www.api-football.com/terms).
9. Sportmonks, [FAQ sobre derechos de fotos y logos](https://www.sportmonks.com/faq/).
10. Wikimedia Commons, [reutilización y licencias](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/licenses).
11. Openverse, [documentación y advertencia sobre verificación de licencias](https://docs.openverse.org/_preview/4707/api/reference/made_with_ov.html).
12. Premier League, [uso de marcas y badges](https://www.premierleague.com/en/news/102426) y [términos](https://www.premierleague.com/en/terms-and-conditions).
13. UEFA, [reglamento de identidad visual de clubes](https://documents.uefa.com/r/UEFA-Reglement-zu-Klublizenzierung-und-finanzieller-Nachhaltigkeit-2026/Artikel-61-Identitat-Geschichte-und-Vermachtnis-des-Lizenzbewerbers-Online).
14. badges.football, [identificadores visuales independientes](https://badges.football/).
15. Adobe, [uso y licencias de Stock](https://helpx.adobe.com/stock/web/common-questions/usage-licensing.html) y [Stock API](https://developer.adobe.com/stock/docs/api/).
