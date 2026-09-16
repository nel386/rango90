# BLOQUE 7D — Selección de fuente publicable para Champions League

> Artefacto de auditoría. No es aprobación legal, no publica datos y no modifica PostgreSQL, snapshots, fuentes, derechos ni imágenes.

- runId: `block7d-champions-c327f2bfe8e93650-2ac6680f`
- fecha: `2026-09-16`
- huella: `30a04c8b77f287fb5ff1556282760e3abbd5b979a3da71c72b2364f764bbe1de`
- readyForApproval: **false**

## Resultado

Champions debe permanecer bloqueada. No seleccionar Transfermarkt para publicación. API-Football solo puede seguir como candidato condicional después de verificar plan/contrato, derechos de ranking derivado, cobertura histórica completa y derechos separados de imágenes; si no se obtiene esa evidencia, solicitar una licencia directa a UEFA o a un proveedor autorizado con cobertura explícita.

## Proveedor configurado y plan

- Proveedor configurado: **API-Football / API-Sports**.
- Base URL configurada: `https://v3.football.api-sports.io`.
- Plan, cuenta, factura y contrato: **not_verified**; no se imprime ni se persigue ninguna credencial.
- El repositorio muestra configuración de API-Football, pero no acredita cuenta, plan contratado, factura ni autorización contractual del uso histórico y derivado.

## Alcance de la prueba

- Competición consultable: Champions League, league id 2; nunca se consultan otras competiciones.
- Ventana objetivo: `1955/56–2025/26; corte del dato al 2026-09-12`.
- Estado de prueba: **integration_pending**; peticiones de red: **0**.
- Cobertura observada: **not_run**; reconstrucción completa: **not_tested**.
- Motivo: API_FOOTBALL_KEY_missing; no se realizó ninguna llamada de red ni consulta de base de datos.

## Artefactos y seguridad

- Se guarda únicamente el artefacto local de prueba; no se almacenan respuestas crudas ni credenciales.
- La comparación con el snapshot Transfermarkt es solo de diferencias y no autoriza ningún valor.
- No se consultaron ni importaron imágenes.
- Baseline: `rs_870f1dff967bb160f2d132cc`, content_sha256 `870f1dff967bb160f2d132cc7d9ca1f2483b26d32681e6a55985efc744cc718b`, estado **draft**, derechos **review_required**.

## Matriz comparativa

| Fuente | Papel | Derechos | Cobertura | Plan | Decisión |
| --- | --- | --- | --- | --- | --- |
| Transfermarkt | current_snapshot | **blocked** | unverified | not_applicable | retain_draft_only |
| API-Football / API-Sports | candidate_numeric | **conditional_not_approved** | unverified | not_verified | conditional_candidate |
| UEFA | semantic_authority | **blocked** | unknown | not_contracted | request_license |
| Wikidata | metadata_only | **open_metadata_only** | unknown | not_applicable | metadata_only |
| OpenFootball / football-data | not_suitable | **open_metadata_only** | not_suitable | not_contracted | reject_for_scope |

### Transfermarkt

- Evidencia: [enlace](https://www.transfermarkt.com/intern/anb), [enlace](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0).
- La auditoría 7C identifica la fuente actual como draft y rights_status=review_required.
- La revisión pública no acredita permiso de redistribución del ranking histórico.
- Almacenamiento: El snapshot ya archivado se conserva; no se autoriza nueva extracción ni redistribución con la evidencia actual.
- Rankings derivados: No demostrado y no publicable con la evidencia archivada.
- Atribución: No existe una autorización archivada que defina atribución suficiente.
- Restricciones comerciales: Los términos públicos restringen la copia automatizada y reservan los derechos de bases de datos/material.
- Imágenes: No se consideran publicables por defecto; cada retrato requiere licencia independiente.
- Evidencia que falta:
  - Permiso escrito que cubra extracción, almacenamiento, ranking derivado y redistribución pública/comercial.

### API-Football / API-Sports

- Evidencia: [enlace](https://apifootball.com/terms_of_use/), [enlace](https://www.api-football.com/pricing).
- El repositorio configura API_FOOTBALL_BASE_URL, pero no contiene API_FOOTBALL_KEY, factura, plan o contrato verificable.
- La prueba técnica quedó integration_pending con cero peticiones; no hay muestra ni cobertura histórica observada.
- Almacenamiento: Los términos públicos mencionan distribución, transferencia y almacenamiento de datos, sujetos a sus límites; no hay contrato de Rango90 archivado.
- Rankings derivados: No se debe asumir autorización para el ranking histórico derivado sin confirmación escrita del plan y del uso previsto.
- Atribución: No se ha localizado en el repositorio una obligación contractual concreta; debe confirmarse con el plan.
- Restricciones comerciales: Los términos prohíben revender el producto sin permiso previo; el modelo de Rango90 debe ser revisado contra esa cláusula.
- Imágenes: Las imágenes, logos y vídeos tienen tratamiento separado; el proveedor no demuestra derechos de publicación para Rango90.
- Evidencia que falta:
  - Plan/cuenta contratados.
  - Permiso para almacenar snapshots, generar/publicar rankings derivados y operar con uso comercial.
  - Cobertura comprobada de 1955/56 hasta el corte v2.
  - Derechos de imágenes, logos y marcas.

### UEFA

- Evidencia: [enlace](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/), [enlace](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-2-Definitions-Online), [enlace](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-72-Commercial-rights-for-the-play-offs-and-UEFA-Champions-League-Online).
- UEFA es la referencia semántica más fuerte para competición y fases.
- La existencia de estadísticas públicas no demuestra permiso para redistribuirlas en una aplicación de terceros.
- Almacenamiento: No se ha encontrado una licencia de redistribución para conservar y servir un snapshot de terceros.
- Rankings derivados: UEFA define y controla los derechos de datos de la competición; la página pública de estadísticas no es una licencia.
- Atribución: Debe pactarse en la licencia o términos de uso autorizados.
- Restricciones comerciales: Las regulaciones reservan derechos comerciales y de datos de la competición a UEFA/socios autorizados.
- Imágenes: No se consultaron ni incorporaron imágenes UEFA.
- Evidencia que falta:
  - Licencia o permiso para el ranking derivado, almacenamiento, nombres, estadísticas y uso web/PWA/Android.
  - Exportación o desglose autorizado para reconciliar los 12 conflictos.

### Wikidata

- Evidencia: [enlace](https://www.wikidata.org/wiki/Wikidata:Licensing), [enlace](https://www.wikidata.org/wiki/Wikidata:Reuse).
- Es una opción abierta para IDs y metadatos.
- No es fuente numérica suficiente sin una reconstrucción independiente y auditada.
- Almacenamiento: CC0 según la documentación de Wikidata.
- Rankings derivados: No se ha demostrado que sus datos permitan reconstruir este ranking de goles completo.
- Atribución: CC0 no impone una atribución obligatoria, aunque se recomienda documentar procedencia.
- Restricciones comerciales: No identificadas en la licencia CC0; la calidad/cobertura sigue sin estar probada.
- Imágenes: No se consultaron imágenes.
- Evidencia que falta:
  - Dataset completo y reproducible de goles por partido/ronda bajo la definición v2.

### OpenFootball / football-data

- Evidencia: [enlace](https://github.com/openfootball), [enlace](https://github.com/schochastics/football-data).
- Pueden servir como apoyo de resultados, no como fuente definitiva demostrada para este ranking histórico.
- Almacenamiento: Sus licencias deben respetarse por dataset; no se propone importar datos en este bloque.
- Rankings derivados: La evidencia local no demuestra resultados completos de goleadores de Champions desde 1955/56.
- Atribución: Depende del dataset concreto.
- Restricciones comerciales: Dependen del dataset y licencia concreta.
- Imágenes: No se consultaron imágenes.
- Evidencia que falta:
  - Cobertura completa y licencia que cubra el ranking derivado bajo v2.

## Bloqueos

| Puerta | Estado | Motivo |
| --- | --- | --- |
| contracted_provider | **block** | Plan, cuenta y contrato actual no están acreditados. |
| api_probe | **pending** | Falta API_FOOTBALL_KEY; no hubo llamadas de red. |
| historical_coverage | **block** | No está demostrada la cobertura completa 1955/56–corte v2. |
| derived_ranking_rights | **block** | No existe autorización suficiente archivada para publicar el ranking derivado. |
| image_rights | **block** | No se han demostrado derechos de imágenes del proveedor. |
| conflicts | **block** | Los 12 conflictos de alcance/definición siguen abiertos. |
| isolated_publish_rollback | **pending** | No se ejecuta sin RANGO90_ISOLATED_DATABASE_URL. |

- provider_plan_and_contract_not_verified
- api_football_champions_probe_pending
- historical_coverage_1955_56_not_demonstrated
- derived_ranking_redistribution_rights_not_confirmed
- image_rights_not_confirmed
- 12_scope_and_definition_conflicts_remain_from_block7c
- isolated_postgresql_publish_rollback_not_run

## Decisión

- Champions **no es viable para aprobación en esta ejecución**.
- Mantener snapshot actual en `draft` y `rights_status=review_required`.
- No crear snapshot append-only hasta contar con fuente, alcance y derechos resueltos.
- La prueba PostgreSQL de publicación/rollback queda pendiente de una base aislada.
