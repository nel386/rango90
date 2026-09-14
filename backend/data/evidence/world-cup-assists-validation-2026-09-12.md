# Validación de `world-cup-assists`

Fecha de comprobación: 2026-09-12  
Alcance: Copa Mundial de la FIFA masculina, fases finales, asistencias acumuladas por jugador.

## Estado reproducible de Rango90

- Snapshot vigente: `rs_abf315272b5cbd74d190132b`.
- Snapshot bruto de la fuente: `src_c3b8ec982a6bee7b9be9bb16`.
- `dataVersion`: `statbunker-world-cup-assists-top-200-2026-09-12`.
- 200 entradas, 200 IDs de proveedor distintos y valores positivos ordenados de forma descendente.
- Estado: `draft`, `reviewed=false`, `coverageComplete=false`.
- Comando reproducible: `npm run --silent import:world-cup:assists` desde `backend/`.
- La ejecución del 2026-09-12 fue idempotente y devolvió el mismo snapshot (`rs_abf315272b5cbd74d190132b`); no creó una versión nueva.
- Archivo almacenado: `backend/storage/source-snapshots/src_c3b8ec982a6bee7b9be9bb16.json`.

El cliente de StatBunker no recibe actualmente una tabla directa de 200 filas. La página raíz devuelve 50 filas y 86 enlaces de selecciones. El importador descarga esas páginas, deduplica por `providerPlayerId`, conserva el mayor valor observado y ordena por asistencias descendentes, con el nombre como desempate. Por tanto, las 200 filas son una agregación reproducible de Rango90, no una tabla top 200 que StatBunker publique directamente.

## Comprobación de fuentes

| Fuente | Qué demuestra | Resultado para un top 200 homogéneo |
| --- | --- | --- |
| [FIFA — Top assisters at the World Cup](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/most-assists-top-assisters) | Líderes de cada edición y nota metodológica: las asistencias se registran desde 1966. | No publica el universo acumulado de 200 jugadores ni una tabla completa exportable. |
| [Opta Analyst — Most Assists at the World Cup](https://theanalyst.com/articles/world-cup-most-assists) | Lista histórica desde 1966 y explicación de que Opta dispone de esos datos desde esa edición. | Publica solo los líderes hasta 5 asistencias, no 200 filas ni el dataset completo. |
| [BeSoccer — All time most assists in World Cup](https://www.besoccer.com/competition/historical-ranking/world_cup/assists) | Página histórica con 20 filas visibles. | No alcanza 200 y no expone en la página una definición suficiente para reconciliar discrepancias. |
| [StatBunker — All time most assists](https://www.statbunker.com/alltimestats/AllTimeCompetitionMostAssists?comp_code=WC) | Tabla de referencia y páginas históricas por selección. | La raíz solo devuelve 50 filas; el top 200 actual depende de la agregación propia descrita arriba. La página no aporta una definición de asistencia ni una validación externa completa. |

## Discrepancia observable

La diferencia aparece ya en la parte que debería ser más fácil de validar:

| Fuente | Primeros valores observados |
| --- | --- |
| Snapshot StatBunker de Rango90 | Lionel Messi 13; Michael Olise 7; Ivan Perišić 6; Kylian Mbappé 6; Antoine Griezmann 5. |
| Opta Analyst | Lionel Messi 12; Diego Maradona 8; Pierre Littbarski 7; Grzegorz Lato 7; Michael Olise 7. |
| BeSoccer | Lionel Messi 12; Diego Maradona 8; Grzegorz Lato 7; Michael Olise 7; Pierre Littbarski 7. |

Además, Maradona figura con 8 en Opta y BeSoccer, pero no aparece entre las primeras 20 filas del snapshot de StatBunker. No es una diferencia de desempate: afecta a los valores y al orden de líderes. FIFA confirma el alcance temporal desde 1966, pero no permite resolver esta contradicción para las 200 posiciones.

## Decisión

No existe evidencia suficiente para afirmar que el conjunto actual sea un top 200 histórico homogéneo bajo una única definición de asistencia. En consecuencia:

1. No se cambia `coverageComplete`.
2. No se mezclan valores de FIFA, Opta, BeSoccer y StatBunker.
3. No se añaden ceros, filas de relleno ni posiciones inventadas.
4. No se modifica el cliente ni se promueve el snapshot a publicado.

El bloqueo queda abierto hasta disponer de una tabla completa de 200 o de datos partido a partido desde 1966, con definición de asistencia y metodología constante, procedentes de una fuente oficial o de un proveedor cuya licencia y cobertura histórica puedan demostrarse.

