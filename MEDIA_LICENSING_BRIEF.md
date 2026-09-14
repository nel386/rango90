# Brief de licencias de imágenes y escudos

## Requisito de Rango 90

Necesitamos poder mostrar en un juego público y comercial:

- retratos de jugadores históricos y actuales;
- escudos oficiales de clubes y, cuando corresponda, símbolos de selecciones;
- copias normalizadas en WebP de 512×512 servidas desde nuestro backend/CDN;
- uso web, PWA y Android, con caché local y posibilidad de conservar snapshots históricos.

La licencia debe cubrir expresamente ese uso. “La imagen está en una API”, “la web oficial la sirve” o “el repositorio dice MIT/CC0” no son pruebas suficientes.

## Resultado de la investigación

### Corte operativo actual — 13 de septiembre de 2026

La base contiene **6.675 jugadores jugables únicos ranqueados**, de los que **1.030 tienen retrato legal principal** y **5.645 siguen pendientes (15,43% de cobertura)**. Hay **232 clubes jugables** y **0 escudos de club publicables**. Este corte sustituye las cifras históricas de los apartados de auditoría anteriores.

| Vía | Qué resuelve | Qué falta | Decisión |
|---|---|---|---|
| Wikimedia Commons | Algunos retratos y banderas con licencia abierta verificable | Identidad, derechos de imagen/persona y, para clubes, marca/diseño | Candidatos; revisión individual |
| API-Football | URLs y datos auxiliares | Sus términos no conceden licencia general para publicar imágenes/logos | No publicar automáticamente |
| TheSportsDB | API y artwork con bajo coste | El contenido de terceros y los escudos no quedan globalmente licenciados por pagar el plan | Solo `pending` hasta confirmación escrita |
| Sportmonks | Datos e imágenes accesibles por API | Exige que el cliente aporte sus propios derechos de logos/fotos | No usar como licencia visual |
| Sportradar Images | Headshots/logos, IDs estables y manifiestos de actualización | Sus términos dicen que no posee los derechos de logos/headshots de terceros; requiere permiso específico en el pedido | Solicitar oferta, sin asumir cobertura |
| Stats Perform/Opta | Datos y algunos contenidos visuales | El acuerdo público limita el uso comercial de headshots en gameplay y no licencia automáticamente logos de terceros | No usar para gameplay sin excepción contractual expresa |
| SportsDataIO | Headshots y feeds de imágenes mediante proveedores asociados | Su información pública describe los headshots como licenciados para uso editorial; no demuestra permiso para elementos de gameplay ni cobertura histórica de fútbol | No usar sin confirmación contractual específica |
| Genius Sports | API con campos técnicos para logos/fotos de clubes y personas, además de un servicio de licencias | La documentación técnica no concede por sí sola derechos de imagen o marca para Rango 90 | Contactar para oferta y contrato |
| badges.football | Identificadores visuales uniformes para productos comerciales | No son escudos oficiales ni están licenciados por clubes | Fallback, no cumple el requisito de escudo real |
| Titular del club/liga/federación | Puede autorizar escudo y activos oficiales | Negociación y alcance por territorio/competición | Vía necesaria para escudos oficiales |

## Preguntas obligatorias a cualquier proveedor

1. ¿La licencia incluye expresamente el catálogo de clubes, selecciones y jugadores que necesitamos?
2. ¿Incluye publicación comercial en web, PWA y Android?
3. ¿Permite descargar, transformar a WebP, almacenar en PostgreSQL/objeto/CDN y cachear sin límite de tiempo?
4. ¿Cubre los escudos oficiales como marcas y diseños, no solo la URL o el archivo?
5. ¿Cubre fotografías de jugadores retirados y derechos de imagen, no solo fotos editoriales de actualidad?
6. ¿Qué territorio, duración, atribución, avisos legales, retirada y proceso de sustitución exige?
7. ¿La autorización aparece en contrato/Order Form y no únicamente en la documentación técnica?
8. ¿Puede entregar una lista versionada de activos autorizados y avisar de revocaciones?

## Criterio de aceptación

No se compra ni se integra una fuente visual como solución definitiva hasta recibir una respuesta escrita que conteste esas preguntas. Una licencia de estadísticas no se reutiliza como licencia de imágenes, y una licencia copyright abierta no se interpreta como autorización marcaria del escudo.

El backend registra esta decisión en `image_assets` y `media_rights_reviews`: ningún activo pasa a publicable sin base jurídica, uso comercial, evidencia, alcance, revisor y —para un escudo de club— estado marcario `cleared`.

## Siguiente acción externa

Solicitar una cotización de Sportradar para `Images API / Soccer` y, en el mismo correo, exigir confirmación contractual de logos oficiales, headshots, almacenamiento/CDN, Android/PWA, histórico y juego comercial. En paralelo, contactar con los titulares de las competiciones prioritarias para los escudos. Hasta recibir esas respuestas, continuar solo con retratos de Commons cuya licencia concreta sea compatible y con candidatos locales marcados `pending`.

### Verificación adicional de Sportradar y SportsDataIO — 13 de septiembre de 2026

La documentación oficial de Sportradar confirma que su Images API incluye headshots, imágenes de equipos y logos, pero sus términos también indican que Sportradar no es titular de los logos/headshots de terceros ni puede conceder por sí sola esos derechos. Además, su addendum de imágenes de terceros restringe el material editorial y exige condiciones específicas de proveedor. Por tanto, una suscripción o una respuesta positiva de la API no basta: el permiso para un juego comercial debe aparecer expresamente en el contrato/Order Form.

SportsDataIO describe públicamente sus headshots como “fully licensed for editorial use”. Ese alcance no prueba autorización para gameplay, almacenamiento permanente, Android o escudos oficiales; queda fuera de publicación hasta recibir confirmación contractual específica.

Fuentes: [Sportradar Images API](https://developer.sportradar.com/images-and-editorials/reference/images-overview), [Sportradar Terms and Conditions](https://developer.sportradar.com/sportradar-updates/page/terms-and-conditions), [Sportradar Third Party Images Addendum](https://developer.sportradar.com/sportradar-updates/page/third-party-images-addendum), [SportsDataIO News Feeds and Player Images](https://sportsdata.io/news-and-images).

## Estado técnico actual (13 de septiembre de 2026; auditoría de BBDD tras la corrección del roster histórico)

### Porcentaje real de cobertura

La auditoría vigente registra 113 categorías activas, todas con snapshot no superseded, pero todavía 0 snapshots publicados. La cobertura de datos validada es 75/113 (66,4%): una categoría solo cuenta como completa cuando su cobertura está validada y no tiene conflictos. El conjunto operativo del juego contiene 6.675 personas jugables únicas activas presentes en rankings activos; 1.030 tienen retrato principal legal y 5.645 no lo tienen (15,43%). Estas cifras son de personas únicas: un jugador puede aparecer en muchos rankings, pero solo necesita un retrato canónico.

La auditoría distingue deliberadamente entre el porcentaje del juego y los totales del repositorio:

- `primaryGamePortraitCoverage`: 1.030/6.675 = 15,43%. Esta es la única métrica de retratos para el progreso del juego; no incluye posiciones repetidas, entidades no jugables, candidatos pendientes ni assets alternativos.
- `categoryDataCoverage`: 75/113 = 66,4%. No se calcula un porcentaje global único mezclando datos, retratos, escudos, licencias y publicación porque no existe una ponderación aprobada.
- Hay 1.795 assets de retrato legales aprobados que cubren 1.659 personas canónicas. Este total de assets no equivale al número de jugadores que necesita el juego.
- Hay 20 assets de bandera de selecciones aprobados y 0 escudos de clubes publicables. Los escudos requieren autorización marcaria o un contrato específico.
- La política de audiencia ya no convierte el top 100 histórico de porteros en una excepción icónica: los jugadores nacidos antes de 1960 quedan fuera salvo perfil histórico explícitamente curado. Los datos y rankings de esos jugadores se conservan.
- La política de auditoría exige ahora también `catalog_status = 'active'` para un perfil jugable; los registros `excluded_from_game` ya no pueden inflar el denominador ni la cobertura.
- La cifra histórica de retratos aprobados de TheSportsDB quedó invalidada en la conciliación de derechos: los activos con `strCreativeCommons=No` fueron rechazados y los que tienen la etiqueta ausente quedaron pendientes. Tras revalidar nuevas fichas, **49** activos con etiqueta explícita `Yes` siguen aprobados; solo **2** permanecen pendientes sin etiqueta, y los demás quedan rechazados fuera de la cobertura.

### Rectificación operativa — 13 de septiembre de 2026

La cifra vigente que deben usar backend, frontend y cualquier expediente externo es **6.675 jugadores jugables únicos, 1.030 retratos legales principales y 5.645 faltantes (15,43%)**. La conciliación anterior había tratado etiquetas de TheSportsDB no verificadas como si fueran licencia suficiente y además se retiró una identidad de Pelé incorrecta; se corrigió antes de incorporar los nuevos activos válidos. El manifiesto vigente de solicitudes contiene 5.645 personas canónicas, sin duplicados por ranking.

La auditoría de audiencia confirma que los registros históricos se conservan en PostgreSQL, pero no entran en el juego: hay **0 filas pre-1930 visibles en los rankings publicados** y solo Alfredo Di Stéfano (1926) y Puskás (1927) están jugables como excepciones icónicas curadas. Los datos históricos no jugables no deben usarse para calcular cobertura visual.

El descubrimiento de retratos prioriza enlaces exactos de Wikidata (`P18`), búsquedas nominales de Commons y el artículo exacto de Wikipedia cuando el archivo está alojado en Commons. Todas esas rutas solo crean candidatos `pending`; no conceden derechos ni aprueban identidad automáticamente. Los candidatos incompatibles, dudosos o de baja calidad se rechazan y no se usan para mejorar artificialmente el porcentaje.

La documentación oficial de API-Football indica que sus logos, imágenes y marcas son de terceros y que el proveedor no concede por sí solo derechos de publicación; Sportmonks declara igualmente que las imágenes son una comodidad de la API y que el cliente debe aportar sus propios derechos. Por tanto, ninguna de las dos APIs resuelve por sí misma la licencia de escudos para Rango 90. [API-Football, términos](https://www.api-football.com/terms) · [Sportmonks, FAQ de derechos](https://www.sportmonks.com/faq/)

Se revisó también `badges.football`: ofrece identificadores visuales propios para productos comerciales, pero declara expresamente que no son escudos oficiales ni están licenciados por clubes; puede servir como fallback visual, no como cumplimiento del requisito de escudo oficial. `Sportsmarks` gestiona assets de marca para licenciatarios, pero su catálogo público está centrado en equipos estadounidenses y también declara que los logos pertenecen a sus titulares; no se ha encontrado una licencia pública que cubra nuestros 200 clubes. [badges.football](https://badges.football/) · [Sportsmarks](https://www.sportsmarks.com/)

La política técnica y el comando de publicación aplican la misma puerta legal: un recurso solo es publicable si conserva página de origen, autoría, licencia, evidencia, alcance de uso, hash y revisión. Las URLs de API-Football, UEFA y TheSportsDB siguen siendo candidatos de contraste, no licencias automáticas. Las últimas tandas profundas de Commons recorrieron 342 jugadores y 50 clubes; no produjeron ningún retrato o escudo nuevo que cumpliera todos los requisitos, por lo que la cobertura legal no aumentó.
