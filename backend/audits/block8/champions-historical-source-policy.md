# BLOQUE 8 — Decisión de fuente histórica para Champions League

> Política editorial y de publicación. No aprueba fuentes, no modifica datos y no crea categorías ni snapshots.

- runId: `block8-champions-5f4d7368c90cc216`
- fecha: `2026-09-16`
- huella: `2e61ebe13bdb2fbdf094e2be689f27a45a002662c12562b08efdc842fb473695`
- readyForApproval: **false**

## Decisión

Transfermarkt y API-Football/API-Sports quedan congeladas como fuentes no publicables para Champions histórica. Todos los snapshots existentes permanecen en `draft`. No se realizarán importaciones ni peticiones masivas.

## Requisitos mínimos de una fuente válida

| Requisito | Condición bloqueante |
| --- | --- |
| historical_coverage | Cobertura demostrada desde 1955/56 hasta el corte exacto. |
| competition_definition | Definición inequívoca de Copa de Europa / UEFA Champions League masculina, torneo principal y exclusiones. |
| cumulative_scorers | Goleadores acumulados, no solo top scorers por temporada. |
| traceability | Valor, identidad, posición, empate y evidencia trazables por fila. |
| derived_rights | Permiso escrito para almacenar y publicar rankings derivados. |
| attribution | Condiciones de atribución documentadas y aplicables al producto. |
| image_rights | Derechos de imágenes, logos y marcas revisados por separado. |

## Matriz de proveedores

| Proveedor | Cobertura | Trazabilidad | Ranking derivado | Atribución | Imágenes | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| Transfermarkt | snapshot top 200; alcance por fila no certificado | parcial respecto a snapshot archivado | no demostrados | no documentada para Rango90 | separados y no aprobados | **not_eligible** |
| API-Football / API-Sports | observado 2011–2026; insuficiente para v2 | muestra de 20 por temporada consultada | no autorizados por la evidencia actual | requiere confirmación contractual | no concedidos automáticamente | **candidate_requires_evidence** |
| UEFA / proveedor autorizado | a demostrar mediante exportación o licencia | requisito por fila | requiere licencia escrita | a pactar | licencia separada | **candidate_requires_evidence** |

## Separación de alcance

- La categoría histórica es `uefa-champions-league-goals` y exige inicio **1955/56**.
- El rango parcial 2011–2026 no puede presentarse con ese nombre.
- Categoría alternativa propuesta, no creada: `uefa-champions-league-goals-2011-2026`.
- Si algún día se publica 2011–2026, deberá tener etiqueta, definición, snapshot y derechos propios.

## Laboratorio y producto oficial

- `lab`: puede mostrar datos provisionales, siempre con advertencia visible.
- `official`: rechaza cualquier ranking parcial, draft o sin derechos aprobados.
- La página histórica solo es provisional hasta seleccionar y aprobar una fuente válida.

## Fuentes congeladas

- **Transfermarkt** — frozen_non_publishable: Sin autorización de redistribución demostrada; conservar solo como snapshot histórico draft y baseline de auditoría.
- **API-Football / API-Sports** — frozen_non_publishable: La prueba observó 2011–2026, no demuestra 1955/56 ni derechos para publicar el ranking derivado.

## Estado

- historical_source_not_selected
- transfermarkt_frozen
- api_football_coverage_starts_2011_in_observed_probe
- derived_ranking_rights_missing
- provider_plan_and_contract_not_verified
- image_rights_separate_and_unverified
- No se modificó PostgreSQL.
- No se modificó Render.
- No se creó ni publicó ningún snapshot.

La puerta permanece cerrada hasta demostrar cobertura completa desde 1955/56, derechos de ranking derivado y derechos separados de medios.
