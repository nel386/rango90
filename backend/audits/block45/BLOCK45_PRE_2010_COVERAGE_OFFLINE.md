# BLOQUE 45 — revisión offline de cobertura anterior a 2010

**Resultado: cobertura parcial; cero llamadas nuevas.** Revisión basada en el manifiesto del run `36436241212` y los índices/auditorías guardados de temporadas anteriores.

## Lo que puede reconstruirse

El manifiesto base contiene 85/85 combinaciones para cinco ligas, pero selecciona únicamente temporadas 2010–2026. Sus 72.783 hechos tienen como temporada más antigua 2010. Por sí solo, este manifiesto no cubre años previos.

La auditoría exacta de `league.id=0` permite atribuir cuatro filas históricas, y solo esas filas, con evidencia independiente de jugador, temporada, competición, equipo y tarjetas:

| Jugador | Temporada | Competición | Equipo | Amarillas |
|---|---:|---|---|---:|
| Sergio Ramos | 2007/08 | La Liga | Real Madrid | 14 |
| Dani Parejo | 2009/10 | La Liga | Getafe | 6 |
| Franck Ribéry | 2007/08 | Bundesliga | Bayern München | 2 |
| Franck Ribéry | 2009/10 | Bundesliga | Bayern München | 1 |

Los tres jugadores ya cumplen por separado la regla de elegibilidad en temporadas del manifiesto base: Ramos tiene 13 temporadas de La Liga, Parejo 16 y Ribéry 9 de Bundesliga entre 2010 y 2026. Esa evidencia de elegibilidad no procede de la atribución histórica.

## Lo que sigue pendiente

La auditoría registra cuatro filas `league.id=0` no resueltas: Cristiano Ronaldo 2008/09, Zlatan Ibrahimović 2006/07 y 2007/08, y Juninho Pernambucano 2006/07. El caso de Ronaldo 2006/07 tiene `leagueId=null`, así que no confirma ID cero. La consulta preparada para Juninho 2005/06 quedó `not_run`.

El índice histórico contiene 27 pares jugador-temporada únicos anteriores a 2010. En 17, la evidencia guardada no confirma que se comprobara el campo `errors`; en los otros cinco consta que se revisó, pero sus filas siguen con ID cero y no tienen aprobación exacta reutilizable en el ranking. Son candidatos para auditoría, no cobertura ya validada. No hay base para generalizar por nombre o liga.

## Decisión

Solo las cuatro filas de la tabla pueden reconstruirse con los artefactos actuales. Todo el resto del histórico anterior a 2010 permanece parcial o sin atribución demostrada. `league.id=0` sigue `not_assessed` como semántica global. No se ejecutaron expansión histórica, `load`, importaciones, PostgreSQL ni snapshots.

El JSON complementario conserva los conteos y un SHA-256 canónico: `b910ceabd4783b3733a920ebb8cb5f39347b50e7ef7c6a55b478274d16a73cda`.
