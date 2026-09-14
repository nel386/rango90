# Decisión de proveedores de datos visuales y estadísticos

Estado: investigación verificada el 12 de septiembre de 2026.

> **Fuente de verdad operativa:** las cifras actuales de catálogo, retratos y corte top-200 están en [`DATA_CURRENT_STATUS.md`](./DATA_CURRENT_STATUS.md). Los números de este informe que figuran como checkpoints anteriores son históricos y no deben utilizarse para presupuestos, licencias ni medir el progreso.

## Checkpoint operativo vigente — 13 de septiembre de 2026 (roster corregido)

La auditoría actual registra 6.675 jugadores jugables únicos activos, 1.030 retratos legales principales (15,43%) y 5.645 pendientes. Hay 232 clubes jugables y 0 escudos de club publicables con licencia marcaria verificada. Las cifras anteriores pertenecen a auditorías previas o a un roster curado más estrecho; no deben usarse para medir el estado actual. Tras la migración 070 no queda ningún jugador nacido antes de 1930 en el catálogo jugable; sus hechos y rankings históricos se conservan fuera del juego.

La conciliación de derechos de TheSportsDB rechazó los retratos con `strCreativeCommons=No` y dejó únicamente 2 registros con etiqueta ausente en `pending`. Tras la revalidación posterior, 49 con etiqueta explícita `Yes` siguen aprobados; esta corrección es la razón del descenso inicial de la cobertura visual y es intencionada.

Tras nuevas auditorías por lotes, 20 fichas con `strCreativeCommons=Yes` y licencia individual CC BY-SA 4.0 fueron aprobadas tras revisión visual. TheSportsDB queda en 49 retratos aprobados, 2 pendientes y 571 rechazados; la cifra pendiente sigue fuera de la cobertura hasta revisión individual.

## Respuesta corta

El mayor cuello de botella es el retrato legal y no la base de datos. Para escudos oficiales no existe en la investigación actual un repositorio descargable con licencia comercial explícita. La ruta de producción accionable es cotizar Sportradar Images API / Soccer y exigir en el Order Form una licencia expresa para logos oficiales en un juego comercial. TheSportsDB, Sportmonks y las APIs de datos no deben tratarse como licencia automática de escudos.

## Comparativa

| Proveedor | Coste publicado | Qué aporta | Decisión para Rango 90 |
| --- | ---: | --- | --- |
| API-Football | Free: 100 peticiones/día; Pro: 19 USD/mes y 7.500/día | Estadísticas, plantillas, perfiles, fotos, logos | Comprar Pro solo para sincronización estadística. Sus términos dicen que las imágenes/logos son de terceros, se entregan para identificación y no conceden derechos de publicación. |
| TheSportsDB | Free: 0 USD; 30 rpm. Single Developer: 9 USD/mes; 100 rpm. | Artwork de jugadores y equipos, perfiles y datos | Es una opción de bajo coste para consultar artwork y datos. El plan permite desarrollar apps/servicios y usar artwork personalizado con atribución, pero no es una licencia global de escudos ni sustituye la comprobación de derechos de terceros. Mantener `pending` hasta confirmar artwork concreto, derechos marcarios y publicación comercial. |
| Sportmonks | Starter: 29 EUR/mes por 5 ligas; Growth: 99 EUR por 30; Pro: 249 EUR por 120; Enterprise desde 499 EUR | Datos profesionales, perfiles e `image_path` | Su FAQ dice que logos y fotos son de sus titulares y que el cliente debe aportar la prueba de propiedad intelectual. No resuelve los escudos sin acuerdo específico. |
| Sportradar | Precio no publicado; oferta comercial | Imágenes de jugadores, equipos y editoriales | No encaja con el presupuesto de esta fase; requiere contrato y puede implicar derechos de proveedores como Getty/AP/Reuters. |
| SofaScore / endpoints no oficiales | Sin API pública/licencia comercial verificable | Imágenes y estadísticas visibles en su web | No usar scraping ni endpoints no oficiales para producción. |

## Recomendación

1. No pagar todavía una API solo para reemplazar Commons: TheSportsDB sí devuelve imágenes rápidamente, pero las pruebas de Messi, Mertens y Khéphren devolvieron `strCreativeCommons: null`, así que la licencia de cada archivo necesita validación.
2. Si el objetivo inmediato es desbloquear estadísticas, API-Football Pro por 19 USD/mes es la compra más rentable: multiplica la cuota diaria y conserva el proveedor ya integrado. No resuelve por sí sola los derechos de fotos ni escudos.
3. TheSportsDB Single Developer (9 USD/mes) es una opción barata para acelerar consultas, pero no debe comprarse suponiendo que resuelve las licencias de los 276 retratos restantes o de los escudos. Si se contrata, pedir confirmación escrita de que el uso concreto cubre web, PWA, Android/iOS, CDN, almacenamiento local, recortes y atribución; mantener Commons como fuente preferente cuando el archivo tenga licencia abierta explícita.
4. No aprobar automáticamente una imagen de TheSportsDB. Debe guardarse proveedor, URL, `idPlayer`/`idTeam`, respuesta original, fecha, licencia declarada y texto de atribución. Los escudos deben conservarse “as is” y tratarse también como marcas.

## Fuentes oficiales consultadas

- API-Football pricing: https://www.api-football.com/pricing
- API-Football terms: https://www.api-football.com/terms
- TheSportsDB API guide: https://www.thesportsdb.com/docs_api_guide
- TheSportsDB pricing: https://www.thesportsdb.com/docs_pricing.php?billing=monthly
- TheSportsDB terms: https://www.thesportsdb.com/docs_terms_of_use.php
- Sportmonks Football API/pricing: https://www.sportmonks.com/football-api/
- Sportmonks player images: https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/teams-players-coaches-and-referees/players
- Sportradar Images API: https://developer.sportradar.com/images-and-editorials/reference/images-overview

## Verificación adicional de derechos de proveedores — 2026-09-13

- La revisión de los términos de API-Football confirma que sus logos e imágenes se entregan para identificación/descripción, pero pueden estar sujetos a derechos de terceros y el proveedor no concede automáticamente derechos comerciales sobre las competiciones. Por eso los assets de API-Football siguen `pending`.
- La FAQ de Sportmonks confirma la misma separación: las fotos y logos pertenecen a sus titulares y el cliente debe aportar la prueba de propiedad intelectual. Su precio publicado no equivale a una licencia de redistribución de escudos o retratos.
- Conclusión operativa: no existe una API económica identificada que resuelva por sí sola las licencias de los 232 escudos. La ruta válida sigue siendo licencia escrita del proveedor/titular o activos con licencia abierta verificable uno a uno.

Fuentes revisadas: [términos de API-Football](https://www.api-football.com/terms), [FAQ de Sportmonks](https://www.sportmonks.com/faq/) y [precios de Sportmonks](https://www.sportmonks.com/football-api/).
