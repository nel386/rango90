# Candidato de matriz 7×7

Fecha de verificación: 14 de septiembre de 2026 (UTC)

## Resultado

La base local contiene un conjunto candidato de siete categorías homogéneas de jugadores. Cada snapshot tiene 200 entradas y las siete categorías comparten ocho jugadores canónicos; por tanto, existe margen para seleccionar los siete comunes exigidos por el reto.

| Categoría | Snapshot | 200 entradas | Datos completos | Conflictos | Estado | Derechos de fuente |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `club-career-assists` | `rs_d14311b1471a8d9adebbbdb9` | Sí | No | 0 | draft | no aprobados |
| `club-career-goals` | `rs_55c2c60c281389caac66a855` | Sí | No | 0 | draft | no aprobados |
| `club-career-titles` | `rs_9db3675a17b09bda84327786` | Sí | No | 0 | draft | no aprobados |
| `player-career-titles` | `rs_30bcff61309619139945d8fe` | Sí | No | 0 | draft | no aprobados |
| `uefa-champions-league-assists` | `rs_97ca925279ab2bf17cd918a2` | Sí | No | 0 | draft | no aprobados |
| `uefa-champions-league-goals` | `rs_870f1dff967bb160f2d132cc` | Sí | Sí | 12 | draft | no aprobados |
| `uefa-champions-league-yellow-cards` | `rs_fe39f0d5477db2368f222485` | Sí | No | 0 | draft | no aprobados |

## Intersección canónica

Los ocho jugadores comunes encontrados son:

- Alexis Sánchez
- Álvaro Morata
- Cristiano Ronaldo
- Edin Džeko
- Lionel Messi
- Luis Suárez
- Raheem Sterling
- Vinícius Júnior

La intersección se calculó sobre `ranking_entries.entity_id` de los snapshots draft más recientes de cada categoría, sin rellenar filas ni fusionar homónimos durante el cálculo.

## Bloqueos para convertirlo en reto real

1. Conseguir y registrar derechos de redistribución comercial para las siete fuentes.
2. Completar la cobertura histórica de las categorías que siguen en `coverage_complete=false`.
3. Resolver los 12 conflictos de `uefa-champions-league-goals` y volver a generar su snapshot.
4. Auditar las identidades, valores, empates, posiciones y evidencias de los siete jugadores seleccionados.
5. Verificar derechos de retratos o usar el fallback visual propio donde el contrato lo permita.
6. Crear el `game_challenge` draft, cargar la matriz 7×7, aprobar snapshots y publicar solo después de que todos los guards pasen.

Este documento identifica una ruta de datos; no autoriza publicar el candidato actual.
