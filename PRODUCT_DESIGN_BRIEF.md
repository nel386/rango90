# Rango 90 — Brief de producto y diseño

Este documento recoge las decisiones explícitas tomadas antes de comenzar la implementación visual.

## Referencia de producto

GeoHunter se utiliza únicamente como referencia de análisis de mecánica, jerarquía y patrones de juego. Rango 90 no debe copiar su nombre, textos, interfaz, estructura visual, iconos, colores, ilustraciones, modos ni reglas exactas.

La referencia sirve para entender el patrón general: entidad individual, categorías disponibles, asignación inmediata, puntuación basada en el ranking de la categoría y feedback después de cada decisión.

## Principios visuales obligatorios

- Diseñar una identidad propia para Rango 90.
- Aplicar patrones anti-IA de forma deliberada.
- Evitar composiciones genéricas de dashboard o quiz.
- No utilizar iconos genéricos elegidos por defecto por una IA.
- No utilizar emojis como sustitutos de una identidad gráfica.
- No reproducir la paleta ni el tratamiento cromático de GeoHunter.
- Crear una dirección visual adecuada principalmente para público masculino de 15 a 40 años, sin asumir que eso justifica una estética estereotipada.
- Priorizar personalidad, tensión competitiva, legibilidad móvil y reconocimiento de marca.
- Cada elemento visual debe tener una razón de producto y no existir únicamente como decoración.

## Mecánica base

- Las categorías vienen determinadas por el reto.
- En el reto normal hay siete categorías.
- Aparecen siete jugadores, uno por uno, en orden aleatorio.
- Las categorías están visibles desde el principio.
- Cada categoría solo puede utilizarse una vez.
- En cuanto se asigna un jugador, la decisión queda bloqueada.
- No se puede deshacer una asignación.
- Tras cada asignación se revela el puesto real y la puntuación obtenida.
- La puntuación es el puesto absoluto del jugador en la categoría elegida.
- Cuanto menor sea la suma total, mejor es el resultado.
- No habrá multiplicadores ni bonificaciones.
- Los empates mantienen el mismo puesto y suman la misma cantidad.
- Si una categoría queda sin completar al agotarse el tiempo, suma 100 puntos.

Ejemplo:

```text
Cristiano Ronaldo → Goles en carrera → puesto 2 → +2
Sergio Ramos → Tarjetas rojas → puesto 27 → +27
```

## Tiempo y tipos de reto

- La partida normal tendrá una cuenta atrás total de 120 segundos.
- Al llegar a cero, las categorías o decisiones restantes reciben automáticamente 100 puntos cada una.
- El reto normal no permite saltar jugadores.
- Se podrán investigar y diseñar variantes como Flash y Extended.
- Otros retos podrán tener menos o más categorías.
- En los modos que lo permitan, se podrá saltar un jugador una vez sin penalización.

## Repetición y competición

- El reto diario se puede repetir libremente.
- Todo resultado del reto diario inferior a 250 puntos puede entrar en la clasificación.
- Los duelos no se pueden repetir dentro del mismo duelo.
- La revancha existe para los duelos y crea una nueva competición.
- No habrá revancha para el reto diario ni para los retos de clubes o selecciones.

## Entidades

Se quiere trabajar con:

- Jugadores.
- Clubes.
- Selecciones.

La estrategia recomendada para el primer diseño es tratar cada universo como un tipo de reto separado. No se mezclan jugadores, clubes y selecciones hasta que las categorías sean comparables y estén definidas sin ambigüedad.

## Autenticación y arquitectura paralela

El frontend puede avanzar con datos mock mientras el especialista trabaja en la base de datos.

Debe existir una capa sustituible para:

- Reto publicado.
- Entidades y categorías.
- Puesto correcto.
- Puntuación calculada.
- Envío de resultado.
- Clasificación.
- Estado de duelo.
- Usuario autenticado o invitado.

La capa frontend no debe imponer tablas, migraciones ni endpoints concretos al backend.

El acceso inicial previsto podrá incluir:

- Usuario invitado.
- Email y contraseña.
- Google.
- Magic Link.

## Pendientes críticos

- Definir qué categorías futbolísticas sustituyen exactamente a las categorías de GeoHunter.
- Resolver si un duelo utiliza los mismos jugadores para ambos participantes o genera selecciones aleatorias equivalentes.
- Definir cómo se emparejan categorías cuando el reto utiliza jugadores, clubes o selecciones.
- Definir la presentación de resultados al superar 100 puntos.
- Definir la pantalla final, aunque no es necesario decidirla antes de crear el motor de partida.
