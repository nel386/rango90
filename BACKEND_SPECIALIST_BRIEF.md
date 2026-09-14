# Brief para el especialista backend de Rango 90

## Encargo

Diseñar la base técnica de Rango 90 como especialista en backend y en datos históricos de fútbol.

No asumir un modelo de datos previo. Debes decidir la estructura adecuada, las entidades necesarias, las relaciones, la estrategia de versionado, la validación y la tecnología. No limites la solución a un ejemplo pequeño, pero tampoco diseñes una plataforma sobredimensionada para el MVP.

## Qué es Rango 90

Rango 90 será un juego web/PWA de retos futbolísticos basados en rankings históricos.

El jugador recibe una categoría y varias entidades futbolísticas —jugadores, clubes o selecciones— y debe ordenarlas según una estadística, récord o logro. La puntuación final premia el menor número de errores.

El producto debe poder incorporar:

- Reto diario y, más adelante, retos semanales.
- Clasificación diaria y semanal.
- Duelos asíncronos mediante enlace.
- Resultados visuales compartibles.
- Amigos o grupos.
- Rachas y estadísticas personales en fases posteriores.

## MVP

El primer MVP debe ser pequeño:

- Disponible en español e inglés desde el primer lanzamiento.
- Un único modo de ranking.
- Pocas categorías verificadas.
- Reto diario.
- Sistema de puntuación reproducible.
- Resultado final.
- Tarjeta compartible.
- Enlace para retar a otra persona.
- Clasificación básica.

Quedan fuera inicialmente los resultados en directo, noticias, fantasy completo, chat y multijugador en tiempo real.

## Restricciones fundamentales

- Presupuesto de APIs y datos: aproximadamente 30 €/mes como máximo.
- No se quiere pagar BeSoccer ni Opta en esta etapa.
- Se quiere construir una base de datos propia.
- Los datos deben poder introducirse y revisarse manualmente.
- API-Football puede utilizarse opcionalmente para contrastar o actualizar datos, por ejemplo semanal o mensualmente.
- No debe haber peticiones externas durante una partida.
- Los rankings y retos publicados deben ser reproducibles.
- Las correcciones deben conservar el historial y no cambiar silenciosamente retos antiguos.
- La fuente, fecha, definición y estado de revisión de los datos son importantes.
- No se quiere introducir Cloudflare ni microservicios salvo que exista una justificación concreta.
- La infraestructura disponible es un servidor Ubuntu; hay que priorizar una solución sencilla y económica.
- El frontend debe construirse con Next.js.
- Debe poder publicarse como frontend estático en GitHub Pages.
- Debe existir una salida Android mínima reutilizando la interfaz web, previsiblemente mediante Capacitor.
- La aplicación Android podrá incorporar anuncios mediante integración nativa, sin duplicar la lógica del juego.
- El backend debe ser independiente del alojamiento estático y servir tanto a la web como a Android.
- El MVP debe estar internacionalizado desde el principio para español e inglés, con posibilidad real de crecer a cuatro o más idiomas sin rehacer componentes.
- La capa i18n del frontend debe mantener separados los textos traducibles de los datos futbolísticos neutrales.

## Problema de datos

No es suficiente consultar el dato individual de un jugador. Rango 90 necesita construir conjuntos comparables y rankings completos.

Ejemplos:

- Saber cuántos goles lleva Messi.
- Saber cuántos goles lleva un jugador con su selección.
- Saber la posición histórica de ese jugador entre los goleadores de una selección.
- Saber cuántas Champions ha ganado un club.
- Saber cuántos Balones de Oro tiene un jugador.

Cada categoría debe tener una definición clara: qué competiciones, periodos, niveles, partidos, títulos o tipos de jugador cuentan. Las categorías ambiguas deben quedar fuera hasta poder verificarlas.

## Fuentes

Las fuentes posibles incluyen registros oficiales, federaciones, UEFA, FIFA, páginas de competiciones, fuentes históricas especializadas y API-Football.

API-Football no debe considerarse una autoridad automática ni una dependencia de ejecución. Su función inicial sería ayudar en importaciones, comprobaciones y detección de cambios. La solución debe permitir sustituirla por otra fuente sin rehacer el producto.

La actualización operativa se ejecuta con `npm run refresh:api-football:current` desde `backend/`; por defecto usa la última temporada cerrada y admite `RANGO90_SEASON=YYYY` para fijar otra temporada explícitamente. El flujo importa snapshots sin medios, reconstruye los agregados globales de carrera y termina con la auditoría de datos. Los assets multimedia y sus derechos siguen siendo un flujo separado y nunca se aprueban automáticamente durante una actualización estadística.

## Qué debe entregar el especialista

1. Arquitectura recomendada para el MVP y para su crecimiento razonable.
2. Decisión sobre backend, base de datos, almacenamiento y despliegue.
3. Modelo de datos completo, justificado y preparado para nuevas categorías.
4. Estrategia para datos manuales, importaciones, fuentes, conflictos y revisiones.
5. Estrategia de snapshots, versiones, rankings y retos publicados.
6. Papel exacto de API-Football y sus limitaciones.
7. Separación entre datos originales, datos aprobados, rankings y lógica del juego.
8. Riesgos legales, técnicos y de exactitud.
9. Plan de implementación por fases.
10. Criterios para saber si la arquitectura está preparada para crecer sin sobrediseñarla.

La propuesta debe explicar también cómo convivirán Next.js, la exportación estática para GitHub Pages, el backend independiente y la aplicación Android.

## Regla de trabajo

Primero razona sobre las definiciones futbolísticas y la trazabilidad de los datos. Después decide el modelo de datos y la arquitectura. No empieces por pantallas ni por una API concreta.

La propuesta debe distinguir claramente entre:

- Lo imprescindible para el MVP.
- Lo recomendable para el crecimiento.
- Lo que debe aplazarse.
