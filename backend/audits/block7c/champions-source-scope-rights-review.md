# BLOQUE 7C — Fuente, alcance y derechos de Champions League

> REVISIÓN DOCUMENTAL. No es una opinión jurídica ni una aprobación de fuente. Solo lectura: no modifica PostgreSQL, snapshots, derechos ni publicaciones.

- runId: `block7c-champions-a6b35b2370f0599d`
- fecha: `2026-09-16`
- auditoría de entrada: `block7b-champions-340a8c57d9c54f4b` / `a6b35b2370f0599dffbf6b49cc4d337ef9fed94e69bd18d98a6543831cccf770`
- huella del informe: `d4cf23a2d0d18ecbf89b080db16c27446d2025699b2a3ea63f416532beb3506b`
- readyForApproval: **false**

## Conclusión

Mantener el snapshot en draft y rights_status=review_required. No aprobar Transfermarkt con la evidencia actual. Solicitar permiso escrito a Transfermarkt o seleccionar una fuente alternativa con licencia expresa; resolver los 12 contrastes bajo v2 y ejecutar publicación/rollback en PostgreSQL aislado antes de solicitar aprobación.

## Alcance v2

- Estado: **proposed_not_approved**; versión `uefa-champions-league-goals-v2`.
- Copa de Europa + UEFA Champions League masculina desde 1955/56.
- Solo torneo principal/fase final; sin rondas de clasificación ni fases previas.
- Definición archivada: `{"entityType":"player","metric":"goals","competition":"Copa de Europa / UEFA Champions League","temporalWindow":"1955/56–2025/26; corte del dato al 2026-09-12","snapshotCutoff":"2026-09-12 (snapshot recuperado; no se presume inclusión de partidos posteriores)","tournamentPhase":"torneo principal/fase final; sin rondas de clasificación ni fases previas","gender":"masculino","countingRule":"un gol por anotación oficial registrada por la fuente adoptada; empates por valor exacto y ranking de competición"}`

## Fuentes y derechos

| Fuente | Estado | Decisión |
| --- | --- | --- |
| Transfermarkt | **blocked** | La extracción archivada no demuestra derecho de redistribución. La fuente no puede pasar a approved para una aplicación pública con los documentos actuales. |
| API-Football / API-Sports | **conditional_not_approved** | Es un candidato condicional para datos, no una aprobación. El pago o la disponibilidad del endpoint no demuestra autorización para este snapshot histórico, ni resuelve los derechos de imágenes. |
| UEFA | **blocked** | UEFA es autoridad semántica y posible fuente numérica definitiva, pero necesita autorización contractual o términos explícitos para el uso previsto. |
| Wikidata | **candidate_open** | Puede apoyar identidad y metadatos; no es fuente numérica suficiente para sustituir el snapshot sin reconstrucción y auditoría completa. |

### Transfermarkt

- Evidencia: [enlace](https://www.transfermarkt.com/intern/anb), [enlace](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0).
- Los términos públicos prohíben acceder o copiar contenido digital mediante bots, spiders, screen scraping u otros procesos automatizados.
- Los términos reservan derechos sobre programas, bases de datos y material para los fines de las licencias aplicables; no aparece una autorización pública específica para redistribuir este ranking derivado.
- Evidencia que falta:
  - Contrato o permiso escrito que cubra extracción, almacenamiento de snapshots, ranking derivado, redistribución web/PWA/Android, atribución y uso comercial.
  - Confirmación expresa del corte sin clasificación de la definición v2.

### API-Football / API-Sports

- Evidencia: [enlace](https://apifootball.com/terms_of_use/), [enlace](https://www.api-football.com/pricing).
- Los términos públicos indican que la distribución, transferencia y almacenamiento de los datos del servicio están permitidos, pero prohíben revender el producto sin permiso previo.
- Los términos tratan por separado el material del sitio y las imágenes/logos/videos, y responsabilizan al usuario de obtener la prueba de propiedad intelectual.
- El repositorio no contiene contrato, plan contratado ni confirmación escrita que cubra este ranking histórico derivado desde 1955/56.
- Evidencia que falta:
  - Plan y cuenta contratados identificables.
  - Permiso escrito para snapshots derivados, caché/backups, exposición a usuarios, aplicación pública/comercial y Android.
  - Demostración de cobertura homogénea 1955/56–corte v2 y reconciliación de las 12 diferencias.
  - Derechos separados para imágenes, logos y marcas.

### UEFA

- Evidencia: [enlace](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/), [enlace](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-2-Definitions-Online), [enlace](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-72-Commercial-rights-for-the-play-offs-and-UEFA-Champions-League-Online).
- La normativa UEFA define los data rights como el derecho a compilar y explotar estadísticas y otros datos de la competición.
- La normativa atribuye a UEFA los derechos comerciales de la competición y distingue la fase de clasificación de los play-offs y la competición principal.
- Una página oficial de estadísticas no proporciona por sí sola una licencia de redistribución para una aplicación de terceros.
- Evidencia que falta:
  - Licencia o permiso escrito para publicar el ranking derivado, almacenar snapshots, usar nombres/estadísticas y operar en web/PWA/Android.
  - Definición autorizada por fila o exportación que explique las diferencias frente a Transfermarkt.

### Wikidata

- Evidencia: [enlace](https://www.wikidata.org/wiki/Wikidata:Licensing), [enlace](https://www.wikidata.org/wiki/Wikidata:Reuse).
- Los datos estructurados de Wikidata se ofrecen bajo CC0 según su documentación de licenciamiento.
- La documentación no demuestra cobertura ni exactitud para este ranking histórico de goles.
- Evidencia que falta:
  - Dataset reproducible de goles con cobertura 1955/56–corte v2, referencias por valor y reconciliación histórica.

## Reconciliación de los 12 conflictos

- Casos totales: 12.
- Caso compatible con hipótesis de alcance: Cristiano Ronaldo: el +1 UEFA es compatible con una diferencia de tratamiento de clasificación, pero el snapshot no prueba qué cifra corresponde exactamente al alcance v2.
- Casos todavía sin resolver: 11.
- Conclusión: La evidencia pública y los snapshots archivados permiten formular una hipótesis de alcance, no resolver las cifras. UEFA mantiene estadísticas separadas de clasificación y su documentación histórica indica que algunos compendios incluyen clasificación/play-offs; aun así, no existe desglose archivado por jugador para atribuir los otros 11 casos ni confirmar de forma concluyente el caso de Ronaldo.
- Ningún valor ha sido cambiado.

| Jugador | Estado |
| --- | --- |
| Cristiano Ronaldo | bloqueado; Cristiano Ronaldo: el +1 UEFA es compatible con una diferencia de tratamiento de clasificación, pero el snapshot no prueba qué cifra corresponde exactamente al alcance v2. |
| Claudio Pizarro | bloqueado; falta desglose por partido/ronda y criterio de fuente |
| Eusébio | bloqueado; falta desglose por partido/ronda y criterio de fuente |
| Ferenc Puskás | bloqueado; falta desglose por partido/ronda y criterio de fuente |
| Gonzalo Higuaín | bloqueado; falta desglose por partido/ronda y criterio de fuente |
| Heung-min Son | bloqueado; falta desglose por partido/ronda y criterio de fuente |
| Jardel | bloqueado; falta desglose por partido/ronda y criterio de fuente |
| Luis Enrique | bloqueado; falta desglose por partido/ronda y criterio de fuente |
| Luis Suárez | bloqueado; falta desglose por partido/ronda y criterio de fuente |
| Luiz Adriano | bloqueado; falta desglose por partido/ronda y criterio de fuente |
| Marco Simone | bloqueado; falta desglose por partido/ronda y criterio de fuente |
| Rivaldo | bloqueado; falta desglose por partido/ronda y criterio de fuente |

Evidencia pública adicional: UEFA separa la fase de clasificación y publica estadísticas históricas que pueden incluir clasificación/play-offs según el compendio; esa documentación apoya la hipótesis de alcance, pero no sustituye una reconciliación por jugador.

## Identidades, media y snapshot

- Las tres discrepancias de nombres abreviados quedan desambiguadas mediante perfiles archivados; no se han modificado nombres ni IDs.
- Media: 20/20 retratos licenciados del top 20; 5 jugables con fallback; 0 unavailable.
- Snapshot actual: `rs_870f1dff967bb160f2d132cc`, Transfermarkt, estado de derechos **review_required**, decisión **retain_in_draft_only**.

## Plan append-only y QA

- No se creó snapshot nuevo.
- Solo crear uno nuevo si cambia alcance, valores, fuente o metadatos; conservar el snapshot y hashes anteriores.
- Publicación/rollback aislado: **integration_pending**. RANGO90_ISOLATED_DATABASE_URL no está disponible; no se conecta a DATABASE_URL ni se simula una publicación/rollback.

| Gate | Estado |
| --- | --- |
| source_rights | **block** — Transfermarkt permanece review_required; no hay licencia o permiso archivado para el uso exacto. |
| scope_reconciliation | **block** — Las 12 diferencias no tienen desglose suficiente para resolverlas bajo v2. |
| identity_metadata | **pending** — Tres nombres están desambiguados por URL, pero la normalización aún no se ha materializado en una nueva versión. |
| media_rights | **pass** — 20/20 retratos del top 20 licenciados; 5 jugables usan fallback. |
| isolated_publish_rollback | **pending** — Prueba pendiente de base aislada. |

No aprobar ni publicar automáticamente. La aceptación futura requiere autorización explícita del propietario después de resolver derechos, alcance, fuente numérica y QA aislado.
