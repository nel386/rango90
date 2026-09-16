# Decisión de alcance — UEFA Champions League (v2)

> Propuesta editorial versionada. No es una aprobación ni modifica el snapshot.

- categoría: `uefa-champions-league-goals`
- versión: `uefa-champions-league-goals-v2`
- estado: **proposed_not_approved**
- auditoría de entrada: `block7a-champions-d1a11f1a22641e50`

## Definición propuesta

- Etiqueta: **Goles históricos — Copa de Europa / UEFA Champions League (sin rondas de clasificación)**
- UEFA para semántica de competición y rondas; Transfermarkt solo como fuente numérica provisional mientras rights_status no sea approved.
- La definición Copa de Europa + Champions masculina desde 1955/56, solo torneo principal y sin clasificación evita mezclar alcances. Debe ser aprobada explícitamente.
- Definición completa: `{"entityType":"player","metric":"goals","competition":"Copa de Europa / UEFA Champions League","temporalWindow":"1955/56–2025/26; corte del dato al 2026-09-12","snapshotCutoff":"2026-09-12 (snapshot recuperado; no se presume inclusión de partidos posteriores)","tournamentPhase":"torneo principal/fase final; sin rondas de clasificación ni fases previas","gender":"masculino","countingRule":"un gol por anotación oficial registrada por la fuente adoptada; empates por valor exacto y ranking de competición"}`

## Regla de conflicto

UEFA fija la semántica de competición y fases. Transfermarkt se conserva como fuente numérica provisional del snapshot actual. No se mezclan ni sustituyen valores hasta disponer de evidencia de alcance/definición y revisión aprobada de derechos.

## Estado

- No aprobado.
- No publicado.
- Snapshot actual conservado en draft.
- Los 12 conflictos permanecen bloqueados.
- La prueba de publicación y rollback en PostgreSQL aislado permanece pendiente.
