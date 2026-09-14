# Ruta de producción para escudos oficiales — Rango 90

**Fecha de comprobación:** 12 de septiembre de 2026  
**Estado:** ruta identificada, pendiente de oferta y acuerdo escrito  
**API-Football:** no consultada durante esta investigación

## Conclusión ejecutiva

No se ha encontrado un repositorio descargable con licencia comercial explícita que permita redistribuir los escudos oficiales de clubes europeos y sudamericanos en una web, PWA y aplicación Android. Los repositorios que dicen MIT, CC o “free” licencian como máximo el código o no acreditan los derechos de los archivos gráficos; no se deben importar como si la licencia del repositorio cubriera las marcas de los clubes.

La ruta de producción realista es solicitar a **Sportradar** una oferta para **Images API / Soccer** con una cláusula expresa de uso de los logos oficiales que cubra Rango 90. Es el proveedor encontrado con la combinación técnica más cercana: API de imágenes, logos de equipos, IDs enlazables, varias resoluciones y cobertura publicada para competiciones europeas y sudamericanas. Sin esa cláusula, Sportradar tampoco queda aprobado: sus condiciones públicas dicen que no conceden derechos sobre logos de ligas, federaciones u organizaciones.

## Evidencia del proveedor prioritario

### Sportradar Images API — candidato contractual

- Documentación oficial: <https://developer.sportradar.com/images-and-editorials/reference/images-overview>
- Cobertura publicada: <https://api-docs.sportradar.us/image-editorial/Sportradar_Image_Editorial_CoverageV3.pdf>
- Condiciones generales: <https://developer.sportradar.com/sportradar-updates/page/master-terms-and-conditions-for-non-betting-services>
- Addendum de imágenes de terceros: <https://developer.sportradar.com/sportradar-updates/page/third-party-images-addendum>
- Contacto/Marketplace: <https://marketplace.sportradar.com/>

La documentación confirma que el producto entrega **team and league logos**, identifica los recursos mediante IDs de Sportradar y permite varias dimensiones. La matriz de cobertura publicada incluye, entre otras, Argentina Superliga, Brazil Serie A, English Premier League, French Ligue 1, German Bundesliga, Italian Serie A, Portuguese Primeira Liga, Spanish La Liga, UEFA Champions League y UEFA Europa League.

La limitación decisiva está en el contrato público:

- La sección 2.9 de las condiciones dice que nada del acuerdo concede licencia sobre logos pertenecientes a ligas, federaciones u organizaciones.
- La sección 2.7 remite las imágenes de terceros a un addendum adicional.
- El addendum limita las imágenes de terceros a uso editorial y exige permisos/clearances propios; también exige retirar las imágenes dentro de los plazos contractuales al terminar.

Por tanto, la solicitud debe pedir una **excepción o licencia específica en el Order Form**, no basta con contratar la API ni con que el endpoint devuelva el archivo.

### Precio

No hay precio público verificable para Images API / Soccer; la documentación dirige al Marketplace/contacto. No se debe asumir que el precio de una suscripción de datos incluya los derechos de logos. La cotización debe separar:

1. acceso técnico a la API;
2. derechos de publicación en el juego;
3. derechos marcarios de los escudos;
4. almacenamiento, CDN, caché y normalización;
5. histórico y procedimiento de sustitución/retirada.

## Ruta concreta de compra y aceptación

Enviar a Sportradar una solicitud para el producto Soccer Images API con este alcance mínimo:

```text
Rango 90 is a public commercial football knowledge game, distributed on web,
PWA and Android. We need official club crests for the clubs in our first 200-club
playable scope, including European and South American clubs.

Please quote Soccer Images API and confirm in the Order Form, expressly and in
writing, that the licence covers:

- official club crests/logos, not only a URL or technical feed access;
- commercial use in an interactive game, not editorial-only use;
- web, PWA, Android, our backend, object storage and CDN/cache delivery;
- downloading, resizing/cropping and converting to 512x512 WebP;
- display to end users and retention in immutable historical ranking snapshots;
- the exact European and South American competitions/clubs covered;
- attribution, trademark notices, takedown/replacement, territory, term and
  post-termination obligations;
- a versioned manifest and update/deprecation notifications;
- written confirmation of the rights chain for the supplied official crests.

Please provide the price for an MVP covering 200 clubs and the recurring price
for updates. A licence restricted to editorial use, identification-only use,
or a licence that excludes club logos is not sufficient for Rango 90.
```

### Gate antes de importar

Un pedido solo pasa a `approved` cuando el contrato/Order Form identifica:

- Sportradar como proveedor y el producto exacto;
- el permiso para escudos oficiales y uso en juego comercial;
- web/PWA/Android, CDN, caché, almacenamiento y conversiones;
- territorio, plazo, atribución y retirada;
- catálogo o cobertura aplicable a cada escudo;
- quién responde ante revocaciones y cómo se sustituye el recurso.

La respuesta de ventas, por sí sola, no es suficiente si no queda incorporada al acuerdo. Hasta entonces, todos los assets de escudo permanecen `pending`.

## Plan alternativo por titular de derechos

Si Sportradar no consigue incluir los escudos en su licencia, la alternativa jurídicamente clara es pedir autorización directa al titular de cada club prioritario. Hay evidencia pública de que este es el canal normal para un producto comercial:

- Liverpool indica que las solicitudes comerciales de nombre, crest o logo deben enviarse a `licensing@liverpoolfc.com`: <https://faq.liverpoolfc.com/articles/fan-mail-special-requests/request-to-use-logo-or-crest/65969c1d74e6ff44331e5653>
- River Plate mantiene una página oficial de licencias y afirma que solo los productos autorizados pueden utilizar su marca, crest y assets oficiales: <https://www.riverplate.com/business/licenses>
- La normativa de licencias de clubes de UEFA exige que el club tenga el control de su identidad visual, incluidos crest, logos y marcas: <https://documents.uefa.com/r/UEFA-Club-Licensing-and-Financial-Sustainability-Regulations-2026/Article-61-Licence-applicant-s-identity-history-and-legacy-Online?contentId=H6KEXv2JzXdGS4WhsOGIWw>

Esto permite una ruta en dos bloques: un proveedor puede centralizar entrega y actualizaciones, pero cada escudo debe estar cubierto por la cadena de derechos del proveedor o por el permiso directo del club. Para el MVP se debe empezar por los clubes que aparecen en más rankings y solicitar una licencia de uso digital en juego, no una licencia de merchandising.

## Alternativas comprobadas y descartadas

| Fuente | Precio/condición pública | Motivo de descarte para escudo oficial |
| --- | --- | --- |
| Sportmonks | Starter 29 €/mes, Growth 99 €, Pro 249 €, Enterprise desde 499 €: <https://www.sportmonks.com/soccer-api/> | Devuelve `image_path` y crests, pero su FAQ dice que logos/fotos tienen propietario legal y que el cliente debe aportar la prueba de propiedad intelectual: <https://www.sportmonks.com/faq/> |
| Badges.football | Precio no publicado; modelo comercial según cobertura: <https://badges.football/> | Declara expresamente que son identificadores visuales independientes, no escudos oficiales ni licenciados por clubes. Puede ser fallback si el producto acepta una identidad propia, no cumple este requisito. |
| FCLOGO | Repositorio con MIT para el repositorio: <https://raw.githubusercontent.com/FCLOGO/fclogo.top/main/LICENSE> | La licencia MIT cubre el software/documentación del repositorio, no demuestra que cada SVG/PNG haya sido licenciado por los titulares de las marcas. No hay cadena de derechos de los escudos. |
| Football Badges API (GitHub) | Código/endpoint y PNG públicos: <https://github.com/leoratzlaff/football-badges> | El README advierte que los logos son marcas de sus propietarios y pide respetar sus directrices antes del uso comercial; no ofrece licencia de redistribución de los gráficos. |
| Football API / Roanuz | Basic 229 USD/mes; Pro 329 USD/mes: <https://footballapi.com/pricing/> | Las condiciones permiten API Data dentro de la aplicación, pero no conceden expresamente los derechos marcarios de los logos de terceros: <https://footballapi.com/legal/terms-of-use/> |
| FootyLogos | Índice y descargas de identidades: <https://www.footylogos.com/logo-usage-right> | Su propia página dice que una descarga no concede licencia de marca, copyright, endorsement ni permiso de uso. Es investigación, no fuente de producción. |

### Reevaluación de Football API / Roanuz — 2026-09-12

La página comercial de Roanuz orienta sus planes a aplicaciones de fantasy y gaming y ofrece planes Basic, Pro y Premium desde 229 USD/mes en pago mensual (172 USD/mes con facturación anual para Basic). Sin embargo, sus términos solo conceden el uso comercial que autorice expresamente el plan y declaran que los materiales, logos e imágenes pueden pertenecer a proveedores o licenciantes. No confirman públicamente que los escudos oficiales estén licenciados para un juego comercial, ni que puedan almacenarse, transformarse y distribuirse por CDN. Por ello se mantiene como **candidato de consulta**, no como fuente aprobada.

La pregunta contractual para Roanuz debe exigir confirmación escrita de: escudos oficiales concretos, uso en juego comercial web/PWA/Android, almacenamiento y CDN, conversión a WebP, territorio, duración, atribución y retirada. Hasta recibirla, sus assets no entran en `approved`.

## Estado de Rango 90 y muestra

El paquete operativo actual contiene el alcance real que debe cotizarse:

- **232 clubes jugables** en el catálogo actual;
- **188** tienen algún asset registrado, pero los **232** requieren permiso según la regla interna;
- **44** no tienen asset registrado;
- no hay ningún escudo de club contado como legal/publicable en la auditoría vigente.

Se regeneró el paquete de solicitudes desde PostgreSQL en:

- `backend/storage/media-candidates/club-badge-license-requests-v1.json`
- `backend/storage/media-candidates/club-badge-license-requests-v1.csv`
- `backend/storage/media-candidates/club-badge-license-requests-v1.md`

No se descargó una muestra de cinco escudos: ninguna fuente descargable comprobada ofreció simultáneamente escudo oficial, licencia comercial explícita y permiso de redistribución para web/app. Descargar una muestra de Sportmonks, Badges.football o un repositorio GitHub habría creado un artefacto técnicamente útil pero jurídicamente no compatible y habría falseado el progreso.

## Decisión de implementación

1. Preparar el expediente de cotización de Sportradar con el CSV de los 232 clubes.
2. Pedir precio para MVP de 200 clubes y para los 232 actuales, manteniendo separados acceso API y derechos de escudos.
3. Si Sportradar no concede la cláusula, negociar permisos por bloques con titulares de clubes/competiciones prioritarios.
4. Mientras no exista contrato, usar únicamente placeholders/identificadores propios en producción; no publicar ni contar URLs de proveedores como escudos legales.
