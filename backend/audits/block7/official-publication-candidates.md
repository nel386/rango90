# BLOQUE 7 — Candidatos de publicación oficial

> ARTEFACTO DE AUDITORÍA. Solo lectura: no modifica PostgreSQL, no aprueba derechos, no aprueba categorías, no publica snapshots y no representa producción.

- runId: `block7-candidate-d1a11f1a22641e50`
- watermark: `2026-09-15T04:17:11.503Z`
- acceso a base de datos: **ninguno**
- huella de datos: `2de044c222c1d0765926c3dc66c38343d5d561cc60e65eca2ab5c8cec45651de`
- huella del informe: `1ac16fe30b7b8d0342bdaf61179547816bc032d4aae1db25effe66bf5b2b0151`
- readyForApproval: **no**
- readyForPublication: **no**

## Resumen

| Categoría | Snapshot candidato | Alcance | Identidad top 20 | Valores | Cobertura declarada | Derechos | Imágenes | Resultado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| uefa-champions-league-goals | rs_870f1dff967bb160f2d132cc (draft) | proposed_not_approved | 20/20 | 20/20 | sí | review_required | 20/20 top 20; 5 fallback jugable | **no publicable** (block) |
| world-cup-goals | rs_7cc0d9cf795a275b93106c43 (draft) | proposed_not_approved | 20/20 | 20/20 | sí | review_required | 3/20 top 20; 159 fallback jugable | **no publicable** (block) |

## Candidatos

### uefa-champions-league-goals

Estado: **candidate_not_publishable**. No publicar uefa-champions-league-goals. Mantener el snapshot en draft, resolver todos los gates no satisfechos y generar una nueva versión append-only si cambia cualquier valor, alcance o metadato.

#### Definición y alcance

- Decisión editorial: **proposed_not_approved**; aprobada: no.
- Definición: `{"entityType":"player","metric":"goals","competition":"Copa de Europa / UEFA Champions League","temporalWindow":"1955/56–2025/26; corte del dato al 2026-09-12","snapshotCutoff":"2026-09-12 (snapshot recuperado; no se presume inclusión de partidos posteriores)","tournamentPhase":"torneo principal/fase final; sin rondas de clasificación ni fases previas","gender":"masculino","countingRule":"un gol por anotación oficial registrada por la fuente adoptada; empates por valor exacto y ranking de competición"}`
- Incluye:
  - Ediciones desde 1955/56, incluida la etapa denominada Copa de Europa.
  - Partidos oficiales del torneo principal de clubes.
  - Jugadores que hayan anotado en esas ediciones, sin limitar por nacionalidad ni estado de retiro.
- Excluye:
  - Rondas de clasificación y fases previas.
  - Amistosos, juveniles, reservas, testimoniales y otras competiciones UEFA.
  - Filas sintéticas: el límite de 200 es de filas reales de la fuente, no una afirmación de cobertura universal.

#### Linaje del snapshot

- Ranking: `rs_870f1dff967bb160f2d132cc`; estado: `draft`; data_version: `uefa-champions-league-goals-transfermarkt-top-200-2026-09-12`; algorithm_version: `ranking-v1`; content_sha256: `870f1dff967bb160f2d132cc7d9ca1f2483b26d32681e6a55985efc744cc718b`.
- Fuente: `src_257235808020fc330123b522`; Transfermarkt — historical European Cup / Champions League top scorers; rights_status: **review_required**.
- Fuente content_sha256: `257235808020fc330123b52274a0e7ee38094114021b287527f0a4a996e72a36`.
- Cobertura: Completa para el universo declarado de 200 filas reales; no implica que el top 200 sea el universo histórico total.

#### Gates

| Gate | Estado | Detalle |
| --- | --- | --- |
| snapshot_status | **block** | El snapshot candidato está en estado draft; debe seguir en draft hasta aprobación explícita. |
| scope_decision | **block** | La decisión editorial está en estado proposed_not_approved; no se convierte en aprobación automáticamente. |
| identities | **pass** | 20/20 identidades del top 20 confirmadas; conflictos registrados: 0. |
| values_and_evidence | **pass** | 20/20 valores del top 20 tienen evidencia; valores no positivos: 0. |
| ordering_and_ties | **pass** | La posición, el score, los empates y la unicidad canónica deben coincidir con el algoritmo archivado. |
| coverage | **pass** | Completa para el universo declarado de 200 filas reales; no implica que el top 200 sea el universo histórico total. |
| source_rights | **block** | La fuente numérica mantiene rights_status=review_required. |
| images | **pending** | 20/20 retratos aprobados en top 20; 5 apariciones jugables usan fallback. |
| open_differences | **block** | 12 conflictos de alcance/definición y 6 discrepancias de validación siguen abiertas. |

#### Top 20: identidad, valor, posición, empate y media

| Rank | Nombre canónico | Nombre fuente | Valor | Score | Tie group | Identidad | Jugable | Media |
| ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | Cristiano Ronaldo | Cristiano Ronaldo | 140 | 1 | 1 | canonical | sí | licensed |
| 2 | Lionel Messi | Lionel Messi | 129 | 2 | 2 | canonical | sí | licensed |
| 3 | Lewandowski | Lewandowski | 109 | 3 | 3 | canonical | no | licensed |
| 4 | Karim Benzema | Karim Benzema | 90 | 4 | 4 | canonical | sí | licensed |
| 5 | Kylian Mbappé | Kylian Mbappé | 71 | 5 | 5 | canonical | no | licensed |
| 5 | Raúl | Raúl | 71 | 5 | 5 | canonical | no | licensed |
| 7 | Haaland | Haaland | 59 | 7 | 6 | canonical | sí | licensed |
| 8 | Thomas Müller | Thomas Müller | 57 | 8 | 7 | canonical | sí | licensed |
| 9 | Ruud van Nistelrooij | Ruud van Nistelrooij | 56 | 9 | 8 | canonical | sí | licensed |
| 10 | Harry Kane | Harry Kane | 55 | 10 | 9 | canonical | sí | licensed |
| 11 | Thierry Henry | Thierry Henry | 50 | 11 | 10 | canonical | sí | licensed |
| 11 | Mohamed Salah | Mohamed Salah | 50 | 11 | 10 | canonical | sí | licensed |
| 13 | Alfredo Di Stefano | Alfredo Di Stefano | 49 | 13 | 11 | canonical | no | licensed |
| 14 | Andriy Shevchenko | Andriy Shevchenko | 48 | 14 | 12 | canonical | sí | licensed |
| 14 | Zlatan Ibrahimović | Zlatan Ibrahimović | 48 | 14 | 12 | canonical | no | licensed |
| 16 | Eusébio | Eusébio | 46 | 16 | 13 | canonical | sí | licensed |
| 16 | F. Inzaghi | F. Inzaghi | 46 | 16 | 13 | canonical | no | licensed |
| 18 | Antoine Griezmann | Antoine Griezmann | 44 | 18 | 14 | canonical | sí | licensed |
| 18 | Didier Drogba | Didier Drogba | 44 | 18 | 14 | canonical | no | licensed |
| 20 | Neymar da Silva Santos Júnior | Neymar da Silva Santos Júnior | 43 | 20 | 15 | canonical | sí | licensed |

- Empates registrados: 25. La regla es valor bruto exacto, mismo rank/tie_group y salto competitivo posterior.
- Medios: 20/20 top 20 con retrato aprobado; 0 prioridades sin retrato aprobado; No hay prioridades sin retrato aprobado en el artefacto seleccionado.

#### Conflictos de contraste de alcance/definición (12)

| Jugador | Primaria | UEFA/contraste | Almacenado | Clasificación |
| --- | ---: | ---: | ---: | --- |
| Claudio Pizarro | 21 | 24 | 21 | discrepancia no resoluble |
| Cristiano Ronaldo | 140 | 141 | 140 | diferencia de alcance |
| Eusébio | 46 | 47 | 46 | discrepancia no resoluble |
| Ferenc Puskás | 36 | 35 | 36 | discrepancia no resoluble |
| Gonzalo Higuaín | 24 | 25 | 24 | discrepancia no resoluble |
| Heung-min Son | 19 | 21 | 19 | discrepancia no resoluble |
| Jardel | 25 | 28 | 25 | discrepancia no resoluble |
| Luis Enrique | 19 | 20 | 19 | discrepancia no resoluble |
| Luis Suárez | 27 | 31 | 27 | discrepancia no resoluble |
| Luiz Adriano | 21 | 22 | 21 | discrepancia no resoluble |
| Marco Simone | 24 | 25 | 24 | discrepancia no resoluble |
| Rivaldo | 27 | 31 | 27 | discrepancia no resoluble |

#### Diferencias pendientes

| Tipo | Código | Entidad | Detalle |
| --- | --- | --- | --- |
| error de identidad | `short_or_ambiguous_source_name` | bdfutbol:la-liga:player:8496753b629895ff211f4d41 | La etiqueta de fuente es abreviada; el perfil URL se usa como desambiguación. |
| error de identidad | `short_or_ambiguous_source_name` | france-football:player:10294 | La etiqueta de fuente es abreviada; el perfil URL se usa como desambiguación. |
| error de identidad | `short_or_ambiguous_source_name` | transfermarkt:european-cup-champions-league:player:b8cc45b74357d05470f9fa6c | La etiqueta de fuente es abreviada; el perfil URL se usa como desambiguación. |
| error de alcance | `source_contrast_value_discrepancy` | general | La fuente de contraste «UEFA Champions League official player statistics» registra 12 discrepancias de valor; hay que resolver si corresponden a alcance o definición estadística distinta. |
| problema de derechos | `source_rights_not_approved` | general | La fuente mantiene rightsStatus=review_required; no puede publicarse como dato aprobado. |
| error de fuente | `source_snapshot_unresolved_conflicts` | general | El snapshot de fuente declara 12 conflictos sin resolver. |


### world-cup-goals

Estado: **candidate_not_publishable**. No publicar world-cup-goals. Mantener el snapshot en draft, resolver todos los gates no satisfechos y generar una nueva versión append-only si cambia cualquier valor, alcance o metadato.

#### Definición y alcance

- Decisión editorial: **proposed_not_approved**; aprobada: no.
- Definición: `{"entityType":"player","metric":"goals","competition":"FIFA World Cup masculina","temporalWindow":"1930–2026 inclusive; corte del dato al 2026-09-12","snapshotCutoff":"2026-09-12 (posterior al cierre de la edición 2026)","tournamentPhase":"solo fases finales del torneo","gender":"masculino","countingRule":"goles anotados en partidos de las fases finales; empates por valor exacto y ranking de competición"}`
- Incluye:
  - Ediciones de la Copa Mundial masculina desde 1930 hasta 2026 inclusive.
  - Futbolistas participantes en las fases finales, incluido cualquier estado de retiro.
  - La edición 2026 solo hasta el cierre documentado del snapshot.
- Excluye:
  - Clasificatorias, repescas y partidos de preparación.
  - Torneos femeninos, juveniles, olímpicos, confederativos o de clubes.
  - Filas sintéticas: el top 200 es un corte de filas reales y no añade jugadores con cero goles.

#### Linaje del snapshot

- Ranking: `rs_7cc0d9cf795a275b93106c43`; estado: `draft`; data_version: `transfermarkt-fifa-world-cup-final-tournaments-goals-top-200-2026-09-12`; algorithm_version: `ranking-v1`; content_sha256: `7cc0d9cf795a275b93106c43eb12dc800629d29e64ee68bcdb6c6bd9f4af8a63`.
- Fuente: `src_a5862ab2e594939ddfa99181`; Transfermarkt — historical FIFA World Cup final tournaments top scorers; rights_status: **review_required**.
- Fuente content_sha256: `a5862ab2e594939ddfa99181bb0a5408697478685f2e6993b49c2d589418b9f8`.
- Cobertura: Completa para el universo declarado de 200 filas reales; no implica que el top 200 sea el universo histórico total.

#### Gates

| Gate | Estado | Detalle |
| --- | --- | --- |
| snapshot_status | **block** | El snapshot candidato está en estado draft; debe seguir en draft hasta aprobación explícita. |
| scope_decision | **block** | La decisión editorial está en estado proposed_not_approved; no se convierte en aprobación automáticamente. |
| identities | **pass** | 20/20 identidades del top 20 confirmadas; conflictos registrados: 0. |
| values_and_evidence | **pass** | 20/20 valores del top 20 tienen evidencia; valores no positivos: 0. |
| ordering_and_ties | **pass** | La posición, el score, los empates y la unicidad canónica deben coincidir con el algoritmo archivado. |
| coverage | **pass** | Completa para el universo declarado de 200 filas reales; no implica que el top 200 sea el universo histórico total. |
| source_rights | **block** | La fuente numérica mantiene rights_status=review_required. |
| images | **pending** | 3/20 retratos aprobados en top 20; 159 apariciones jugables usan fallback. |
| open_differences | **block** | 0 conflictos de alcance/definición y 21 discrepancias de validación siguen abiertas. |

#### Top 20: identidad, valor, posición, empate y media

| Rank | Nombre canónico | Nombre fuente | Valor | Score | Tie group | Identidad | Jugable | Media |
| ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | Kylian Mbappé | Kylian Mbappé | 22 | 1 | 1 | canonical | sí | licensed |
| 2 | Lionel Messi | Lionel Messi | 21 | 2 | 2 | canonical | sí | fallback |
| 3 | Miroslav Klose | Miroslav Klose | 16 | 3 | 3 | canonical | sí | fallback |
| 4 | Ronaldo | Ronaldo | 15 | 4 | 4 | canonical | sí | fallback |
| 5 | Harry Kane | Harry Kane | 14 | 5 | 5 | canonical | sí | fallback |
| 5 | Gerd Müller | Gerd Müller | 14 | 5 | 5 | canonical | sí | fallback |
| 7 | Just Fontaine | Just Fontaine | 13 | 7 | 6 | canonical | sí | fallback |
| 8 | Pelé | Pelé | 12 | 8 | 7 | canonical | sí | fallback |
| 9 | Cristiano Ronaldo | Cristiano Ronaldo | 11 | 9 | 8 | canonical | sí | fallback |
| 9 | Sándor Kocsis | Sándor Kocsis | 11 | 9 | 8 | canonical | sí | fallback |
| 9 | Jürgen Klinsmann | Jürgen Klinsmann | 11 | 9 | 8 | canonical | sí | licensed |
| 12 | Gabriel Batistuta | Gabriel Batistuta | 10 | 12 | 9 | canonical | sí | licensed |
| 12 | Thomas Müller | Thomas Müller | 10 | 12 | 9 | canonical | sí | fallback |
| 12 | Teófilo Cubillas | Teófilo Cubillas | 10 | 12 | 9 | canonical | sí | fallback |
| 12 | Grzegorz Lato | Grzegorz Lato | 10 | 12 | 9 | canonical | sí | fallback |
| 12 | Helmut Rahn | Helmut Rahn | 10 | 12 | 9 | canonical | sí | fallback |
| 12 | Gary Lineker | Gary Lineker | 10 | 12 | 9 | canonical | sí | fallback |
| 18 | Uwe Seeler | Uwe Seeler | 9 | 18 | 10 | canonical | sí | fallback |
| 18 | Paolo Rossi | Paolo Rossi | 9 | 18 | 10 | canonical | sí | fallback |
| 18 | Neymar | Neymar | 9 | 18 | 10 | canonical | sí | fallback |

- Empates registrados: 10. La regla es valor bruto exacto, mismo rank/tie_group y salto competitivo posterior.
- Medios: 3/20 top 20 con retrato aprobado; 17 prioridades sin retrato aprobado; 17 prioridades continúan sin retrato aprobado y se muestran mediante fallback; esto no equivale a resolución editorial.

#### Conflictos de contraste de alcance/definición (0)

| Jugador | Primaria | UEFA/contraste | Almacenado | Clasificación |
| --- | ---: | ---: | ---: | --- |
| — | — | — | — | Ninguno registrado. |

#### Diferencias pendientes

| Tipo | Código | Entidad | Detalle |
| --- | --- | --- | --- |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:07764ef34483a7bdc0e228ba | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:08acf787022849299b30ba6a | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:0f03fc0cf25d0c58202b8f98 | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:142f3bb04550dc5e2f02bdd8 | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:37b048dc34b525d71f181e89 | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:3885ec2e25136d206ab6b3f2 | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:4a3c94c4023852ebc490ff8f | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:4e1e0ec1c733d4220521a4a4 | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:60b9f1301d8ba69070e83af0 | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:70cc893c99cf8f0529a17150 | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:82e85a04938cf6b187c8456d | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:a32bb03e7a3742893dd3f7a3 | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:ba9459195f1c91f27eac05dc | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:c3d6c2623b247e42120cbd68 | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:e0cbd48e4220c983d0bc20e3 | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:e8ffdf6a1c959832f75eac0a | No hay imagen disponible para el jugador en el catálogo actual. |
| problema de imagen | `image_unavailable` | transfermarkt:world-cup:player:ee353ea3ec0b143f6f5fb032 | No hay imagen disponible para el jugador en el catálogo actual. |
| error de identidad | `short_or_ambiguous_source_name` | transfermarkt:world-cup:player:0f03fc0cf25d0c58202b8f98 | La etiqueta de fuente es abreviada; el perfil URL se usa como desambiguación. |
| error de identidad | `short_or_ambiguous_source_name` | transfermarkt:world-cup:player:3885ec2e25136d206ab6b3f2 | La etiqueta de fuente es abreviada; el perfil URL se usa como desambiguación. |
| error de identidad | `short_or_ambiguous_source_name` | transfermarkt:world-cup:player:ee353ea3ec0b143f6f5fb032 | La etiqueta de fuente es abreviada; el perfil URL se usa como desambiguación. |
| problema de derechos | `source_rights_not_approved` | general | La fuente mantiene rightsStatus=review_required; no puede publicarse como dato aprobado. |


## Procedimiento de publicación preparado

El procedimiento está documentado, pero no se ha ejecutado en este bloque y requiere aprobación explícita posterior.

1. Congelar los artefactos de evidencia y verificar sus hashes, `data_version`, `algorithm_version`, `content_sha256`, watermark e IDs de snapshots.
2. Crear una nueva versión append-only si cambia cualquier valor, alcance o metadato. Nunca editar ni borrar snapshots históricos.
3. Ejecutar todos los gates en una base aislada y adjuntar el resultado al `runId` de la propuesta.
4. Con aprobación explícita, abrir una transacción y adquirir un advisory lock por categoría.
5. Volver a validar derechos, cobertura, identidades, scores, entradas, imágenes y que el candidato continúa en el estado esperado.
6. Cambiar el candidato aprobado a `published` y el snapshot publicado anterior a `superseded` dentro de la misma transacción; hacer `COMMIT` solo si todas las validaciones pasan.
7. Registrar actor, motivo, timestamp, IDs, hashes y resultado. Si falla cualquier precondición, hacer `ROLLBACK`.

### Reversión

La reversión no edita el contenido publicado: publica de nuevo, mediante otra transacción auditada y con aprobación explícita, el snapshot anterior conservado, y marca el actual como `superseded`. El snapshot original y sus hashes permanecen intactos.

## Recomendación

- `uefa-champions-league-goals:images`
- `uefa-champions-league-goals:open_differences`
- `uefa-champions-league-goals:scope_decision`
- `uefa-champions-league-goals:snapshot_status`
- `uefa-champions-league-goals:source_rights`
- `world-cup-goals:images`
- `world-cup-goals:open_differences`
- `world-cup-goals:scope_decision`
- `world-cup-goals:snapshot_status`
- `world-cup-goals:source_rights`

No publicar ninguno de los dos candidatos. Champions mantiene 12 conflictos de contraste además de derechos y alcance no aprobados. Mundial mantiene derechos no aprobados, evidencia temporal/partido pendiente y 17 prioridades del top 20 sin retrato aprobado.
