# BLOQUE 45E — Validación histórica acotada de league.id=0

**Estado: revisión offline de clasificaciones completada. No hubo llamadas de red.**

## Decisión

Cuatro filas con league.id=0 tienen evidencia suficiente para atribución caso por caso: Sergio Ramos 2007/08, Dani Parejo 2009/10 y Franck Ribéry 2007/08 y 2009/10. Las cinco filas restantes examinadas siguen unresolved; una de ellas (Cristiano Ronaldo 2006/07) tiene leagueId=null y no demuestra ID cero. Una propuesta queda not_run. Esto no demuestra una semántica general de league.id=0; la cobertura histórica global permanece parcial.

league.id=0 queda not_assessed como regla general. Las cuatro atribuciones son exclusivas de las filas indicadas. No se crea una regla por liga, nombre, jugador o temporada y la cobertura histórica global sigue parcial.

## Reconciliación de casos y contadores

- Casos preparados: 10. Examinados: 9. not_run: 1.
- Resolución por fila: 4 resolvable_case_by_case, 5 unresolved y 1 not_run.
- De las nueve respuestas examinadas, ocho conservan league.id=0; cuatro se resuelven con evidencia independiente exacta y cuatro siguen unresolved.
- Cristiano Ronaldo 2006/07 conserva leagueId=null en el resumen; no cuenta como fila league.id=0.
- not_tested queda en 0; el único caso no ejecutado se cuenta una sola vez como not_run.
- Peticiones registradas: 10/10; no se hicieron peticiones adicionales durante esta revisión.

| Liga | Jugador | Temporada | ID de competición API | Equipo API | Amarillas API/ref. | Estado de fila |
|---|---|---:|---:|---|---:|---|
| Premier League | Cristiano Ronaldo | 2006/07 | null | Manchester United | 2/2 | unresolved |
| Premier League | Cristiano Ronaldo | 2008/09 | 0 | Manchester United | 6/5 | unresolved |
| La Liga | Sergio Ramos | 2007/08 | 0 | Real Madrid | 14/14 | resolvable_case_by_case |
| La Liga | Dani Parejo | 2009/10 | 0 | Getafe | 6/6 | resolvable_case_by_case |
| Bundesliga | Franck Ribery | 2007/08 | 0 | Bayern München | 2/2 | resolvable_case_by_case |
| Bundesliga | Franck Ribery | 2009/10 | 0 | Bayern München | 1/1 | resolvable_case_by_case |
| Serie A | Zlatan Ibrahimovic | 2006/07 | 0 | Inter | 6/8 | unresolved |
| Serie A | Zlatan Ibrahimovic | 2007/08 | 0 | Inter | 5/4 | unresolved |
| Ligue 1 | Juninho Pernambucano | 2005/06 | no observado | Olympique Lyonnais | —/5 | not_run |
| Ligue 1 | Juninho Pernambucano | 2006/07 | 0 | Lyon | 7/7 | unresolved |

## Cuatro atribuciones caso por caso

- **Sergio Ramos — 2007/08 (La Liga).** La fila API tiene league.id=0, Real Madrid, 14 amarillas e identidad confirmada por ID. La referencia independiente identifica la misma competición, temporada, equipo y total: Statbunker muestra La Liga 2007/08, Real Madrid y 14 amarillas para Sergio Ramos. [Referencia](https://betl.statbunker.com/players/GetHistoryStats?comps_type=-1&dates=-1&player_id=18585). Se resuelve únicamente esta fila.
- **Dani Parejo — 2009/10 (La Liga).** La fila API tiene league.id=0, Getafe, 6 amarillas e identidad confirmada por ID. La referencia independiente identifica la misma competición, temporada, equipo y total: Opta Analyst muestra Primera División 2009/10, Getafe y 6 amarillas para Dani Parejo. [Referencia](https://theanalyst.com/players/1893/dani-parejo/career). Se resuelve únicamente esta fila.
- **Franck Ribery — 2007/08 (Bundesliga).** La fila API tiene league.id=0, Bayern München, 2 amarillas e identidad confirmada por ID. La referencia independiente identifica la misma competición, temporada, equipo y total: Statbunker muestra Bundesliga 2007/08, Bayern München y 2 amarillas para Franck Ribéry. [Referencia](https://www.statbunker.com/players/GetHistoryStats?comps_type=BL&dates=2007&player_id=18728). Se resuelve únicamente esta fila.
- **Franck Ribery — 2009/10 (Bundesliga).** La fila API tiene league.id=0, Bayern München, 1 amarilla e identidad confirmada por ID. La referencia independiente identifica la misma competición, temporada, equipo y total: Statbunker muestra Bundesliga 2009/10, Bayern München y 1 amarilla para Franck Ribéry. [Referencia](https://www.statbunker.com/players/GetHistoryStats?comps_type=BL&dates=2009&player_id=18728). Se resuelve únicamente esta fila.

## Filas unresolved

- **Cristiano Ronaldo — 2006/07 (Premier League).** ID API null; 2 amarillas API frente a 2 registradas en la propuesta. La respuesta resumida conserva leagueId=null. No se puede afirmar que esta fila tenga league.id=0; queda fuera del recuento de casos ID cero. Su atribución general sigue unresolved por falta de ID numérico.
- **Cristiano Ronaldo — 2008/09 (Premier League).** ID API 0; 6 amarillas API frente a 5 registradas en la propuesta. API devuelve league.id=0, Premier League, Manchester United, 2008/09 y 6 amarillas. La referencia guardada corresponde a 2007/08, por lo que el total independiente no está validado; país y tipo también faltan.
- **Zlatan Ibrahimovic — 2006/07 (Serie A).** ID API 0; 6 amarillas API frente a 8 registradas en la propuesta. API devuelve league.id=0, Serie A e Inter; tarjetas 6. La fuente guardada no confirma un total de esa temporada y faltan país/tipo.
- **Zlatan Ibrahimovic — 2007/08 (Serie A).** ID API 0; 5 amarillas API frente a 4 registradas en la propuesta. API devuelve league.id=0, Serie A e Inter; tarjetas 5. La fuente guardada no confirma un total de esa temporada y faltan país/tipo.
- **Juninho Pernambucano — 2006/07 (Ligue 1).** ID API 0; 7 amarillas API frente a 7 registradas en la propuesta. API devuelve league.id=0, Ligue 1, Lyon (ID 80), 2006/07 y 7 amarillas. La referencia nombra Olympique Lyonnais y no aporta evidencia separada suficiente; país/tipo faltan.

## Caso not_run

- Juninho Pernambucano — 2005/06 (Ligue 1): no se consultó para respetar el máximo de diez llamadas.

## Alcance y seguridad

Revisión realizada solo con respuestas resumidas, hashes y referencias guardadas. No se almacenaron payloads nuevos ni se efectuaron llamadas. No se ejecutaron load, expansión, imports, PostgreSQL ni snapshots. Producción permanece intacta.

Hash SHA-256 del JSON canónico: acf1c9c161607508b98bcdc51de9b9162add7cb724e8a0f0f542b2c83410dcda
