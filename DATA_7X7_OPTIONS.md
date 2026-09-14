# Opciones para la matriz 7×7

Fecha: 14 de septiembre de 2026 (UTC)

La elección de una opción fija el alcance del reto. No aprueba por sí sola las fuentes ni convierte datos parciales en publicables. En todos los casos se mantienen estas reglas técnicas: siete categorías de jugadores, 200 entradas reales por categoría, siete jugadores comunes jugables, selección diaria dentro del top 90, identidades canónicas, empates reproducibles y cero conflictos.

## A — Mantener el candidato actual

Es la opción que conserva el diseño que ya existe y cambia menos el producto:

1. `club-career-assists`
2. `club-career-goals`
3. `club-career-titles`
4. `player-career-titles`
5. `uefa-champions-league-assists`
6. `uefa-champions-league-goals`
7. `uefa-champions-league-yellow-cards`

Ventaja: ya tiene ocho jugadores comunes calculados. Coste: seis snapshots no tienen cobertura completa y uno conserva 12 conflictos.

## B — Carrera global de jugadores

Una matriz más fácil de entender para el usuario final, basada en estadísticas de trayectoria:

1. `club-career-goals`
2. `club-career-assists`
3. `club-career-titles`
4. `club-career-yellow-cards`
5. `club-career-red-cards`
6. `player-career-titles`
7. `national-team-official-goals`

Ventaja: relato de producto claro y sin depender de una única competición. Coste: hay que cerrar una definición común de carrera y validar cobertura, porque las fuentes y los alcances actuales no son idénticos.

## C — Competiciones europeas de clubes

Concentrar las siete categorías en rankings históricos de competiciones UEFA, por ejemplo goles, asistencias y tarjetas de Champions, Europa League y Conference League.

Ventaja: marco competitivo coherente. Coste: hay que elegir las siete métricas exactas y verificar que cada una alcance 200 jugadores y siete comunes; las auditorías actuales muestran varias categorías europeas todavía parciales.

## D — Reducir el requisito para publicar antes

Mantener una matriz de siete categorías, pero cambiar mediante decisión de producto uno de los límites actuales: menos de 200 entradas, menos de siete comunes o selección diaria fuera de la banda top 90.

Ventaja: reduce el trabajo de cobertura. Coste: cambia la dificultad, la comparabilidad y los guards del juego; requiere modificar especificación, validadores, interfaz y documentación.

## Matriz elegida

La selección recibida queda fijada así:

1. `club-career-yellow-cards` — jugadores con más tarjetas amarillas.
2. `club-career-red-cards` — jugadores con más tarjetas rojas.
3. `club-career-titles` — jugadores con más títulos de club.
4. `world-cup-goals` — jugadores con más goles en Mundiales.
5. `player-career-goals` — jugadores con más goles oficiales en carrera global (clubes + selección absoluta).
6. `uefa-champions-league-assists` — jugadores con más asistencias en Champions League.
7. `uefa-champions-league-goals` — categoría añadida para completar la matriz y mantener el bloque de Champions coherente.

Las dos menciones a “goles en carrera” se han contado como una sola categoría. El total global incluye los goles oficiales de clubes y de selección absoluta; `world-cup-goals` mantiene el subconjunto específico de Mundiales. `player-career-goals` es una categoría nueva respecto al catálogo actual y necesitará una fuente homogénea, una definición única y un snapshot propio. Esta matriz sustituye como objetivo de producto al candidato anterior; todavía hay que generar/validar sus snapshots, resolver identidades y derechos, y pasar el guard antes de publicarla.
