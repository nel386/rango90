# BLOQUE 7A — Candidatura oficial de Champions League

> ARTEFACTO DE AUDITORÍA. Solo lectura: no modifica PostgreSQL, no aprueba derechos, no aprueba snapshots y no publica datos.

- runId: `block7a-champions-d1a11f1a22641e50`
- watermark: `2026-09-13T13:27:49.626Z`
- huella de datos: `f15a9c7cdf40d36aebb551d74f6e1a5e40c8a16133084f491339f45a2a41dee6`
- huella del informe: `5dab5cca93b2a0641dc257eafab1f6f958f6479c57a277a14246c5696d3cef69`
- readyForApproval: **false**

## Resultado ejecutivo

La candidatura no está lista para aprobación. Hay **12 conflictos de contraste** y **6 discrepancias pendientes**. El snapshot `rs_870f1dff967bb160f2d132cc` conserva estado `draft` y no se ha modificado.

## Definición propuesta

- Etiqueta: **Goles históricos — Copa de Europa / UEFA Champions League (sin rondas de clasificación)**
- Estado editorial: `proposed_not_approved`
- Definición exacta: `{"entityType":"player","metric":"goals","competition":"Copa de Europa / UEFA Champions League","temporalWindow":"1955/56–2025/26; corte del dato al 2026-09-12","snapshotCutoff":"2026-09-12 (snapshot recuperado; no se presume inclusión de partidos posteriores)","tournamentPhase":"torneo principal/fase final; sin rondas de clasificación ni fases previas","gender":"masculino","countingRule":"un gol por anotación oficial registrada por la fuente adoptada; empates por valor exacto y ranking de competición"}`
- Incluye: Ediciones desde 1955/56, incluida la etapa denominada Copa de Europa.; Jugadores que hayan anotado en esas ediciones, sin limitar por nacionalidad ni estado de retiro.; Partidos oficiales del torneo principal de clubes.
- Excluye: Amistosos, juveniles, reservas, testimoniales y otras competiciones UEFA.; Filas sintéticas: el límite de 200 es de filas reales de la fuente, no una afirmación de cobertura universal.; Rondas de clasificación y fases previas.
- Los 12 conflictos continúan abiertos; no se ha escogido silenciosamente ninguna de las dos cifras.

## Linaje y comprobaciones

- Snapshot: `rs_870f1dff967bb160f2d132cc`, `uefa-champions-league-goals-transfermarkt-top-200-2026-09-12`, algoritmo `ranking-v1`, content_sha256 `870f1dff967bb160f2d132cc7d9ca1f2483b26d32681e6a55985efc744cc718b`.
- Filas auditadas: 200; filas totales del snapshot: 200. Completa para el universo declarado de 200 filas reales; el límite top 200 no demuestra cobertura histórica universal.
- Identidades: 20/20 confirmadas; valores con evidencia: 20/20.
- Ranking: posiciones=consistentes, scores=consistentes, empates=consistentes; 25 grupos de empate registrados.
- Fuente primaria: `src_257235808020fc330123b522`, Transfermarkt — historical European Cup / Champions League top scorers, rights_status=**review_required**, content_sha256 `257235808020fc330123b52274a0e7ee38094114021b287527f0a4a996e72a36`.
- Contraste UEFA: `src_c9359c9f91bba9215af8fef6`, UEFA Champions League official player statistics, content_sha256 `c9359c9f91bba9215af8fef602e0b4826b505fd96fd19072212748aeb1ee51f9`.

## Top 20 trazable

| Rank | Jugador canónico | Nombre fuente | Valor | Score | Tie group | Evidencia |
| ---: | --- | --- | ---: | ---: | ---: | --- |
| 1 | Cristiano Ronaldo | Cristiano Ronaldo | 140 | 1 | 1 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 2 | Lionel Messi | Lionel Messi | 129 | 2 | 2 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 3 | Lewandowski | Lewandowski | 109 | 3 | 3 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 4 | Karim Benzema | Karim Benzema | 90 | 4 | 4 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 5 | Kylian Mbappé | Kylian Mbappé | 71 | 5 | 5 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 5 | Raúl | Raúl | 71 | 5 | 5 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 7 | Haaland | Haaland | 59 | 7 | 6 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 8 | Thomas Müller | Thomas Müller | 57 | 8 | 7 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 9 | Ruud van Nistelrooij | Ruud van Nistelrooij | 56 | 9 | 8 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 10 | Harry Kane | Harry Kane | 55 | 10 | 9 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 11 | Thierry Henry | Thierry Henry | 50 | 11 | 10 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 11 | Mohamed Salah | Mohamed Salah | 50 | 11 | 10 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 13 | Alfredo Di Stefano | Alfredo Di Stefano | 49 | 13 | 11 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 14 | Andriy Shevchenko | Andriy Shevchenko | 48 | 14 | 12 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 14 | Zlatan Ibrahimović | Zlatan Ibrahimović | 48 | 14 | 12 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 16 | Eusébio | Eusébio | 46 | 16 | 13 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 16 | F. Inzaghi | F. Inzaghi | 46 | 16 | 13 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 18 | Antoine Griezmann | Antoine Griezmann | 44 | 18 | 14 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 18 | Didier Drogba | Didier Drogba | 44 | 18 | 14 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |
| 20 | Neymar da Silva Santos Júnior | Neymar da Silva Santos Júnior | 43 | 20 | 15 | https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 |

## 12 conflictos de contraste

| Jugador | Actual / posición | Transfermarkt / posición | UEFA / posición | Δ UEFA-actual | Causa propuesta | Decisión |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Claudio Pizarro | 21 / 71 | 21 / 71 | 24 / 61 | +3 (-10) | definition_or_scope; discrepancia no resoluble | **mantener abierto; conservar actual en draft** |
| Cristiano Ronaldo | 140 / 1 | 140 / 1 | 141 / 1 | +1 (+0) | scope; diferencia de alcance | **mantener abierto; conservar actual en draft** |
| Eusébio | 46 / 16 | 46 / 16 | 47 / 17 | +1 (+1) | definition_or_scope; discrepancia no resoluble | **mantener abierto; conservar actual en draft** |
| Ferenc Puskás | 36 / 23 | 36 / 23 | 35 / 24 | -1 (+1) | definition_or_scope; discrepancia no resoluble | **mantener abierto; conservar actual en draft** |
| Gonzalo Higuaín | 24 / 57 | 24 / 57 | 25 / 55 | +1 (-2) | definition_or_scope; discrepancia no resoluble | **mantener abierto; conservar actual en draft** |
| Heung-min Son | 19 / 93 | 19 / 93 | 21 / 81 | +2 (-12) | definition_or_scope; discrepancia no resoluble | **mantener abierto; conservar actual en draft** |
| Jardel | 25 / 52 | 25 / 52 | 28 / 44 | +3 (-8) | definition_or_scope; discrepancia no resoluble | **mantener abierto; conservar actual en draft** |
| Luis Enrique | 19 / 91 | 19 / 91 | 20 / 91 | +1 (+0) | definition_or_scope; discrepancia no resoluble | **mantener abierto; conservar actual en draft** |
| Luis Suárez | 27 / 41 | 27 / 41 | 31 / 34 | +4 (-7) | definition_or_scope; discrepancia no resoluble | **mantener abierto; conservar actual en draft** |
| Luiz Adriano | 21 / 77 | 21 / 77 | 22 / 73 | +1 (-4) | definition_or_scope; discrepancia no resoluble | **mantener abierto; conservar actual en draft** |
| Marco Simone | 24 / 59 | 24 / 59 | 25 / 55 | +1 (-4) | definition_or_scope; discrepancia no resoluble | **mantener abierto; conservar actual en draft** |
| Rivaldo | 27 / 43 | 27 / 43 | 31 / 34 | +4 (-9) | definition_or_scope; discrepancia no resoluble | **mantener abierto; conservar actual en draft** |

### Detalle de cada conflicto

#### 1. Claudio Pizarro

- Valores: actual 21; primaria 21 (Δ +0); UEFA 24 (Δ +3).
- Posiciones: actual 71; primaria 71; UEFA 61.
- Fuentes: [Transfermarkt](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0) [src_257235808020fc330123b522], [UEFA](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/) [src_c9359c9f91bba9215af8fef6].
- Causa posible: **definition_or_scope**; clasificación archivada: discrepancia no resoluble.
- Evidencia: Los snapshots documentan valores distintos, pero no conservan el desglose de partidos, rondas ni criterio de contabilización necesario para atribuir la diferencia sin inventar una explicación. https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/
- Decisión propuesta: **mantener abierto y conservar el valor almacenado en draft**.
- Corrección necesaria: Obtener un desglose autorizado por partido/ronda o una reconciliación documental del titular. No sustituir el valor almacenado por una de las fuentes sin esa evidencia.

#### 2. Cristiano Ronaldo

- Valores: actual 140; primaria 140 (Δ +0); UEFA 141 (Δ +1).
- Posiciones: actual 1; primaria 1; UEFA 1.
- Fuentes: [Transfermarkt](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0) [src_257235808020fc330123b522], [UEFA](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/) [src_c9359c9f91bba9215af8fef6].
- Causa posible: **scope**; clasificación archivada: diferencia de alcance.
- Evidencia: La referencia UEFA separa explícitamente una lista sin clasificación (140) de otra con clasificación (141); el snapshot archivado no documenta qué corte explica este caso. https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/
- Decisión propuesta: **mantener abierto y conservar el valor almacenado en draft**.
- Corrección necesaria: Obtener un desglose autorizado por partido/ronda que confirme el tratamiento de clasificación; solo después generar, si procede, una nueva versión draft append-only.

#### 3. Eusébio

- Valores: actual 46; primaria 46 (Δ +0); UEFA 47 (Δ +1).
- Posiciones: actual 16; primaria 16; UEFA 17.
- Fuentes: [Transfermarkt](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0) [src_257235808020fc330123b522], [UEFA](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/) [src_c9359c9f91bba9215af8fef6].
- Causa posible: **definition_or_scope**; clasificación archivada: discrepancia no resoluble.
- Evidencia: Los snapshots documentan valores distintos, pero no conservan el desglose de partidos, rondas ni criterio de contabilización necesario para atribuir la diferencia sin inventar una explicación. https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/
- Decisión propuesta: **mantener abierto y conservar el valor almacenado en draft**.
- Corrección necesaria: Obtener un desglose autorizado por partido/ronda o una reconciliación documental del titular. No sustituir el valor almacenado por una de las fuentes sin esa evidencia.

#### 4. Ferenc Puskás

- Valores: actual 36; primaria 36 (Δ +0); UEFA 35 (Δ -1).
- Posiciones: actual 23; primaria 23; UEFA 24.
- Fuentes: [Transfermarkt](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0) [src_257235808020fc330123b522], [UEFA](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/) [src_c9359c9f91bba9215af8fef6].
- Causa posible: **definition_or_scope**; clasificación archivada: discrepancia no resoluble.
- Evidencia: Los snapshots documentan valores distintos, pero no conservan el desglose de partidos, rondas ni criterio de contabilización necesario para atribuir la diferencia sin inventar una explicación. https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/
- Decisión propuesta: **mantener abierto y conservar el valor almacenado en draft**.
- Corrección necesaria: Obtener un desglose autorizado por partido/ronda o una reconciliación documental del titular. No sustituir el valor almacenado por una de las fuentes sin esa evidencia.

#### 5. Gonzalo Higuaín

- Valores: actual 24; primaria 24 (Δ +0); UEFA 25 (Δ +1).
- Posiciones: actual 57; primaria 57; UEFA 55.
- Fuentes: [Transfermarkt](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0) [src_257235808020fc330123b522], [UEFA](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/) [src_c9359c9f91bba9215af8fef6].
- Causa posible: **definition_or_scope**; clasificación archivada: discrepancia no resoluble.
- Evidencia: Los snapshots documentan valores distintos, pero no conservan el desglose de partidos, rondas ni criterio de contabilización necesario para atribuir la diferencia sin inventar una explicación. https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/
- Decisión propuesta: **mantener abierto y conservar el valor almacenado en draft**.
- Corrección necesaria: Obtener un desglose autorizado por partido/ronda o una reconciliación documental del titular. No sustituir el valor almacenado por una de las fuentes sin esa evidencia.

#### 6. Heung-min Son

- Valores: actual 19; primaria 19 (Δ +0); UEFA 21 (Δ +2).
- Posiciones: actual 93; primaria 93; UEFA 81.
- Fuentes: [Transfermarkt](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0) [src_257235808020fc330123b522], [UEFA](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/) [src_c9359c9f91bba9215af8fef6].
- Causa posible: **definition_or_scope**; clasificación archivada: discrepancia no resoluble.
- Evidencia: Los snapshots documentan valores distintos, pero no conservan el desglose de partidos, rondas ni criterio de contabilización necesario para atribuir la diferencia sin inventar una explicación. https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/
- Decisión propuesta: **mantener abierto y conservar el valor almacenado en draft**.
- Corrección necesaria: Obtener un desglose autorizado por partido/ronda o una reconciliación documental del titular. No sustituir el valor almacenado por una de las fuentes sin esa evidencia.

#### 7. Jardel

- Valores: actual 25; primaria 25 (Δ +0); UEFA 28 (Δ +3).
- Posiciones: actual 52; primaria 52; UEFA 44.
- Fuentes: [Transfermarkt](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0) [src_257235808020fc330123b522], [UEFA](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/) [src_c9359c9f91bba9215af8fef6].
- Causa posible: **definition_or_scope**; clasificación archivada: discrepancia no resoluble.
- Evidencia: Los snapshots documentan valores distintos, pero no conservan el desglose de partidos, rondas ni criterio de contabilización necesario para atribuir la diferencia sin inventar una explicación. https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/
- Decisión propuesta: **mantener abierto y conservar el valor almacenado en draft**.
- Corrección necesaria: Obtener un desglose autorizado por partido/ronda o una reconciliación documental del titular. No sustituir el valor almacenado por una de las fuentes sin esa evidencia.

#### 8. Luis Enrique

- Valores: actual 19; primaria 19 (Δ +0); UEFA 20 (Δ +1).
- Posiciones: actual 91; primaria 91; UEFA 91.
- Fuentes: [Transfermarkt](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0) [src_257235808020fc330123b522], [UEFA](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/) [src_c9359c9f91bba9215af8fef6].
- Causa posible: **definition_or_scope**; clasificación archivada: discrepancia no resoluble.
- Evidencia: Los snapshots documentan valores distintos, pero no conservan el desglose de partidos, rondas ni criterio de contabilización necesario para atribuir la diferencia sin inventar una explicación. https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/
- Decisión propuesta: **mantener abierto y conservar el valor almacenado en draft**.
- Corrección necesaria: Obtener un desglose autorizado por partido/ronda o una reconciliación documental del titular. No sustituir el valor almacenado por una de las fuentes sin esa evidencia.

#### 9. Luis Suárez

- Valores: actual 27; primaria 27 (Δ +0); UEFA 31 (Δ +4).
- Posiciones: actual 41; primaria 41; UEFA 34.
- Fuentes: [Transfermarkt](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0) [src_257235808020fc330123b522], [UEFA](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/) [src_c9359c9f91bba9215af8fef6].
- Causa posible: **definition_or_scope**; clasificación archivada: discrepancia no resoluble.
- Evidencia: Los snapshots documentan valores distintos, pero no conservan el desglose de partidos, rondas ni criterio de contabilización necesario para atribuir la diferencia sin inventar una explicación. https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/
- Decisión propuesta: **mantener abierto y conservar el valor almacenado en draft**.
- Corrección necesaria: Obtener un desglose autorizado por partido/ronda o una reconciliación documental del titular. No sustituir el valor almacenado por una de las fuentes sin esa evidencia.

#### 10. Luiz Adriano

- Valores: actual 21; primaria 21 (Δ +0); UEFA 22 (Δ +1).
- Posiciones: actual 77; primaria 77; UEFA 73.
- Fuentes: [Transfermarkt](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0) [src_257235808020fc330123b522], [UEFA](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/) [src_c9359c9f91bba9215af8fef6].
- Causa posible: **definition_or_scope**; clasificación archivada: discrepancia no resoluble.
- Evidencia: Los snapshots documentan valores distintos, pero no conservan el desglose de partidos, rondas ni criterio de contabilización necesario para atribuir la diferencia sin inventar una explicación. https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/
- Decisión propuesta: **mantener abierto y conservar el valor almacenado en draft**.
- Corrección necesaria: Obtener un desglose autorizado por partido/ronda o una reconciliación documental del titular. No sustituir el valor almacenado por una de las fuentes sin esa evidencia.

#### 11. Marco Simone

- Valores: actual 24; primaria 24 (Δ +0); UEFA 25 (Δ +1).
- Posiciones: actual 59; primaria 59; UEFA 55.
- Fuentes: [Transfermarkt](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0) [src_257235808020fc330123b522], [UEFA](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/) [src_c9359c9f91bba9215af8fef6].
- Causa posible: **definition_or_scope**; clasificación archivada: discrepancia no resoluble.
- Evidencia: Los snapshots documentan valores distintos, pero no conservan el desglose de partidos, rondas ni criterio de contabilización necesario para atribuir la diferencia sin inventar una explicación. https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/
- Decisión propuesta: **mantener abierto y conservar el valor almacenado en draft**.
- Corrección necesaria: Obtener un desglose autorizado por partido/ronda o una reconciliación documental del titular. No sustituir el valor almacenado por una de las fuentes sin esa evidencia.

#### 12. Rivaldo

- Valores: actual 27; primaria 27 (Δ +0); UEFA 31 (Δ +4).
- Posiciones: actual 43; primaria 43; UEFA 34.
- Fuentes: [Transfermarkt](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0) [src_257235808020fc330123b522], [UEFA](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/) [src_c9359c9f91bba9215af8fef6].
- Causa posible: **definition_or_scope**; clasificación archivada: discrepancia no resoluble.
- Evidencia: Los snapshots documentan valores distintos, pero no conservan el desglose de partidos, rondas ni criterio de contabilización necesario para atribuir la diferencia sin inventar una explicación. https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0 https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/
- Decisión propuesta: **mantener abierto y conservar el valor almacenado en draft**.
- Corrección necesaria: Obtener un desglose autorizado por partido/ronda o una reconciliación documental del titular. No sustituir el valor almacenado por una de las fuentes sin esa evidencia.

## Seis discrepancias pendientes

| Tipo | Código | Jugador/entidad | Estado propuesto | Corrección necesaria |
| --- | --- | --- | --- | --- |
| error de identidad | `short_or_ambiguous_source_name` | Neymar da Silva Santos Júnior | identidad_confirmada_por_URL; pendiente normalizar nombre de fuente sin cambiar entidad ni valor | Conservar el nombre canónico y el identificador externo; opcionalmente normalizar la etiqueta visible en una nueva versión de metadatos. |
| error de identidad | `short_or_ambiguous_source_name` | Eusébio | identidad_confirmada_por_URL; pendiente normalizar nombre de fuente sin cambiar entidad ni valor | Conservar el nombre canónico y el identificador externo; opcionalmente normalizar la etiqueta visible en una nueva versión de metadatos. |
| error de identidad | `short_or_ambiguous_source_name` | Raúl | identidad_confirmada_por_URL; pendiente normalizar nombre de fuente sin cambiar entidad ni valor | Conservar el nombre canónico y el identificador externo; opcionalmente normalizar la etiqueta visible en una nueva versión de metadatos. |
| error de alcance | `source_contrast_value_discrepancy` | general | bloqueo_de_contraste; mantener abierto | Resolver los 12 contrastes con evidencia de alcance/definición antes de proponer aprobación. |
| problema de derechos | `source_rights_not_approved` | general | bloqueo_de_derechos; mantener review_required | Completar revisión documental de derechos y cambiar el estado solo mediante el flujo explícito de revisión. |
| error de fuente | `source_snapshot_unresolved_conflicts` | general | bloqueo_de_contraste; mantener abierto | Resolver los 12 contrastes con evidencia de alcance/definición antes de proponer aprobación. |

## Media y derechos

- Top 20 con imagen licenciada/aprobada: 20/20; sin retrato aprobado: 0.
- Entidades jugables auditadas: 86; licenciadas: 81; fallback: 5; unavailable: 0.
- Los fallbacks jugables no se presentan como retratos aprobados. La fuente numérica mantiene rights_status=review_required.

## Rollback y puerta de aprobación

- Rollback aislado: **integration_pending**. Falta RANGO90_ISOLATED_DATABASE_URL; el procedimiento de rollback está documentado pero no probado en este entorno.

| Gate | Estado | Detalle |
| --- | --- | --- |
| identities | **pass** | 20/20 filas del top 20 tienen identidad canónica y no hay conflictos estructurales. |
| values_positions | **pass** | Los valores, posiciones, scores y empates son trazables al snapshot archivado y a su URL de evidencia. |
| scope | **block** | 12 conflictos de contraste abiertos; la decisión editorial sigue en proposed_not_approved. |
| coverage | **pass** | Cobertura completa solo para el universo declarado de 200 filas reales; no equivale a universo histórico total. |
| source_rights | **block** | La fuente numérica mantiene rights_status=review_required. |
| media | **pass** | 20/20 retratos del top 20 licenciados; 5 entidades jugables dependen de fallback. |
| rollback_isolated | **pending** | No existe RANGO90_ISOLATED_DATABASE_URL; no se simula una prueba pasada. |
| open_discrepancies | **block** | 6 discrepancias de validación siguen abiertas. |

## Recomendación técnica

Mantener el snapshot rs_870f1dff967bb160f2d132cc en draft. Resolver documentalmente los 12 conflictos y los 6 pendientes, completar derechos y ejecutar rollback en una base aislada antes de solicitar aprobación explícita.

No publicar, aprobar ni modificar datos en este bloque. Si una futura evidencia cambia valores o alcance, crear un snapshot append-only nuevo, conservar este content_sha256 y someterlo de nuevo a auditoría y aprobación explícita.
