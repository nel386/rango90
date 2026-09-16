# BLOQUE 7B — Dossier de aprobación de Champions League

> ARTEFACTO DE AUDITORÍA Y PROPUESTA EDITORIAL. No es una aprobación, no modifica datos, no cambia derechos y no publica snapshots.

- runId: `block7b-champions-340a8c57d9c54f4b`
- watermark: `2026-09-13T13:27:49.626Z`
- auditoría de entrada: `block7a-champions-d1a11f1a22641e50` / `340a8c57d9c54f4be4bc003615baf44b259bcd77ee0a749bae2b8c99c7d6e7e2`
- huella del dossier: `dbc81cc6b176a2ef136d26b83831bdb5612a9b945b0e5a11e2b7d308609530e8`
- readyForApproval: **false**

## Decisión de alcance versionada

- Versión: `uefa-champions-league-goals-v2`; estado: **proposed_not_approved**.
- Etiqueta propuesta: **Goles históricos — Copa de Europa / UEFA Champions League (sin rondas de clasificación)**
- Definición: `{"entityType":"player","metric":"goals","competition":"Copa de Europa / UEFA Champions League","temporalWindow":"1955/56–2025/26; corte del dato al 2026-09-12","snapshotCutoff":"2026-09-12 (snapshot recuperado; no se presume inclusión de partidos posteriores)","tournamentPhase":"torneo principal/fase final; sin rondas de clasificación ni fases previas","gender":"masculino","countingRule":"un gol por anotación oficial registrada por la fuente adoptada; empates por valor exacto y ranking de competición"}`
- Autoridad: UEFA para semántica de competición y rondas; Transfermarkt solo como fuente numérica provisional mientras rights_status no sea approved.
- Justificación: La definición Copa de Europa + Champions masculina desde 1955/56, solo torneo principal y sin clasificación evita mezclar alcances. Debe ser aprobada explícitamente.

La propuesta mide goles de jugadores en la Copa de Europa y UEFA Champions League masculina desde 1955/56, solo torneo principal/fase final y sin rondas de clasificación. El corte temporal exacto permanece en el snapshot archivado; la definición aún requiere confirmación editorial.

## Fuente numérica y derechos

- Fuente numérica provisional: Transfermarkt — historical European Cup / Champions League top scorers [src_257235808020fc330123b522].
- Estado: **provisional_pending_rights**; rights_status=**review_required**.
- Política: No mezclar, promediar ni sustituir valores por coincidencia parcial; resolver por alcance/definición con evidencia.
- Decisión de derechos: **bloqueada** hasta revisión documentada; no se cambia automáticamente a approved.

## Ranking histórico frente a catálogo jugable

- El ranking histórico conserva todas las filas del snapshot, incluidos jugadores no jugables.
- El reto solo selecciona entidades `playable=true`.
- No se eliminan ni sustituyen filas históricas para alterar posiciones.

## Validación del snapshot

- Snapshot: `rs_870f1dff967bb160f2d132cc`, estado `draft`, content_sha256 `870f1dff967bb160f2d132cc7d9ca1f2483b26d32681e6a55985efc744cc718b`.
- data_version: `uefa-champions-league-goals-transfermarkt-top-200-2026-09-12`; algorithm_version: `ranking-v1`.
- Identidades: 20/20 confirmadas; valores: 20/20 con evidencia.
- Cobertura: Completa para el universo declarado de 200 filas reales; el límite top 200 no demuestra cobertura histórica universal.
- Orden y empates: ranks=true; scores=true; ties=true.

## Matriz de los 12 conflictos

| Jugador | Actual | Transfermarkt | UEFA | Δ UEFA | Causa | Estado |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Claudio Pizarro (71) | 21 | 21 (71) | 24 (61) | +3 | definition_or_scope / discrepancia no resoluble | **bloqueado** |
| Cristiano Ronaldo (1) | 140 | 140 (1) | 141 (1) | +1 | scope / diferencia de alcance | **bloqueado** |
| Eusébio (16) | 46 | 46 (16) | 47 (17) | +1 | definition_or_scope / discrepancia no resoluble | **bloqueado** |
| Ferenc Puskás (23) | 36 | 36 (23) | 35 (24) | -1 | definition_or_scope / discrepancia no resoluble | **bloqueado** |
| Gonzalo Higuaín (57) | 24 | 24 (57) | 25 (55) | +1 | definition_or_scope / discrepancia no resoluble | **bloqueado** |
| Heung-min Son (93) | 19 | 19 (93) | 21 (81) | +2 | definition_or_scope / discrepancia no resoluble | **bloqueado** |
| Jardel (52) | 25 | 25 (52) | 28 (44) | +3 | definition_or_scope / discrepancia no resoluble | **bloqueado** |
| Luis Enrique (91) | 19 | 19 (91) | 20 (91) | +1 | definition_or_scope / discrepancia no resoluble | **bloqueado** |
| Luis Suárez (41) | 27 | 27 (41) | 31 (34) | +4 | definition_or_scope / discrepancia no resoluble | **bloqueado** |
| Luiz Adriano (77) | 21 | 21 (77) | 22 (73) | +1 | definition_or_scope / discrepancia no resoluble | **bloqueado** |
| Marco Simone (59) | 24 | 24 (59) | 25 (55) | +1 | definition_or_scope / discrepancia no resoluble | **bloqueado** |
| Rivaldo (43) | 27 | 27 (43) | 31 (34) | +4 | definition_or_scope / discrepancia no resoluble | **bloqueado** |

Los 12 casos conservan el valor actual en draft. No hay evidencia archivada suficiente para atribuir de forma concluyente las diferencias a alcance, rondas o criterio de contabilización. Cada fila del JSON contiene fuentes, diferencias exactas, evidencia y corrección requerida.

## Resolución de las 6 discrepancias

| Tipo | Código | Entidad | Estado | Resolución/acción |
| --- | --- | --- | --- | --- |
| error de identidad | `short_or_ambiguous_source_name` | Neymar da Silva Santos Júnior | **resolved_editorially** | Identidad confirmada mediante el perfil externo archivado; normalización de nombre propuesta solo para una futura versión de metadatos, sin alterar entidad ni valor. |
| error de identidad | `short_or_ambiguous_source_name` | Eusébio | **resolved_editorially** | Identidad confirmada mediante el perfil externo archivado; normalización de nombre propuesta solo para una futura versión de metadatos, sin alterar entidad ni valor. |
| error de identidad | `short_or_ambiguous_source_name` | Raúl | **resolved_editorially** | Identidad confirmada mediante el perfil externo archivado; normalización de nombre propuesta solo para una futura versión de metadatos, sin alterar entidad ni valor. |
| error de alcance | `source_contrast_value_discrepancy` | general | **blocked** | bloqueo_de_contraste; mantener abierto |
| problema de derechos | `source_rights_not_approved` | general | **blocked** | bloqueo_de_derechos; mantener review_required |
| error de fuente | `source_snapshot_unresolved_conflicts` | general | **blocked** | bloqueo_de_contraste; mantener abierto |

Las tres etiquetas abreviadas quedan desambiguadas por sus perfiles archivados, pero la normalización visual se reserva para una futura versión sin cambiar IDs ni valores. Las discrepancias de fuente/alcance y derechos siguen bloqueadas.

## Imágenes

- Top 20 licenciados: 20/20; sin retrato aprobado: 0.
- Jugables: 86; licenciados: 81; fallback: 5; unavailable: 0.
- Retrato propio/licenciado/autorizado/dominio público o placeholder legal; no usar una imagen sin derechos para completar el ranking.

## Puerta y QA aislado

- **scope_definition: block** — La definición está documentada como propuesta, pero no aprobada; permanecen 12 conflictos de contraste.
- **ranking_traceability: pass** — Top 20 con identidades y valores respaldados por el snapshot archivado; scores y empates son deterministas.
- **coverage: pass** — Completa para las 200 filas reales declaradas en el snapshot, sin afirmar universo histórico ilimitado.
- **source_rights: block** — La fuente numérica mantiene rights_status=review_required; requiere revisión documentada.
- **media_policy: pass** — 20/20 retratos del top 20 licenciados; los fallbacks jugables no se presentan como retratos aprobados.
- **conflicts: block** — Los 12 contrastes siguen bloqueados por falta de evidencia suficiente para resolver alcance/definición.
- **isolated_publish_rollback: pending** — No existe RANGO90_ISOLATED_DATABASE_URL; no se simula una publicación ni rollback pasados.
- Publicación/rollback aislado: **integration_pending** — La prueba de publicación y rollback queda pendiente hasta disponer de RANGO90_ISOLATED_DATABASE_URL distinta de DATABASE_URL.

## Recomendación

No aprobar ni publicar. Solicitar revisión explícita de alcance y derechos, resolver o mantener formalmente bloqueados los 12 contrastes, y ejecutar la prueba de publicación/rollback en PostgreSQL aislado antes de una nueva solicitud de aprobación.

No ejecutar seeds, imports, aprobaciones ni cambios en la base real. Cualquier corrección futura debe crear una nueva versión append-only y volver a pasar la auditoría.
