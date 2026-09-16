# Decisión de alcance — world-cup-goals

> ARTIFACTO DE DECISIÓN EDITORIAL — solo lectura. Es una propuesta documentada; no es producción, no aprueba datos y no publica cambios.

Estado: **proposed_not_approved**.
Etiqueta actual: **Goles históricos — FIFA World Cup**.
Etiqueta exacta propuesta: **Goles históricos — Copa Mundial masculina (fases finales)**.

## Respuestas de alcance

- Qué mide: Goles de jugadores en las fases finales de la Copa Mundial masculina de la FIFA, sumados por edición de torneo.
- Ventana temporal: 1930–2026 inclusive; corte del dato al 2026-09-12
- Corte del snapshot: 2026-09-12 (posterior al cierre de la edición 2026)
- Fase: solo fases finales del torneo
- Género: masculino
- Regla de conteo: goles anotados en partidos de las fases finales; empates por valor exacto y ranking de competición

### Incluye

- Ediciones de la Copa Mundial masculina desde 1930 hasta 2026 inclusive.
- Futbolistas participantes en las fases finales, incluido cualquier estado de retiro.
- La edición 2026 solo hasta el cierre documentado del snapshot.

### Excluye

- Clasificatorias, repescas y partidos de preparación.
- Torneos femeninos, juveniles, olímpicos, confederativos o de clubes.
- Filas sintéticas: el top 200 es un corte de filas reales y no añade jugadores con cero goles.

## Autoridad de fuentes

- Autoridad semántica: FIFA oficial para la definición de Copa Mundial masculina y sus fases finales.
- Fuente numérica primaria actual: Transfermarkt archivado, conservado como fuente numérica primaria provisional; rightsStatus=review_required.
- Regla ante conflicto: No se sustituyen valores por coincidencia nominal; la definición adoptada debe comprobarse contra la fuente antes de aprobar.

## Trazabilidad y valores

- Ranking: `rs_7cc0d9cf795a275b93106c43`; data_version: `transfermarkt-fifa-world-cup-final-tournaments-goals-top-200-2026-09-12`; algorithm_version: `ranking-v1`; content_sha256: `7cc0d9cf795a275b93106c43eb12dc800629d29e64ee68bcdb6c6bd9f4af8a63`.
- Fuente primaria: `src_a5862ab2e594939ddfa99181`; content_sha256: `a5862ab2e594939ddfa99181bb0a5408697478685f2e6993b49c2d589418b9f8`.
- Contraste oficial: `no disponible`; content_sha256: `no disponible`.
- Top 20 comprobado: 20; coincide con la fuente primaria archivada: sí; alcance explícito en la fuente: sí. Los 20 valores coinciden con el snapshot primario archivado y su scope declara final tournaments; la referencia FIFA se conserva como autoridad semántica y contraste, no como sustitución numérica automática.

## Discrepancias abiertas

No hay discrepancias numéricas registradas.


Las clasificaciones no autorizan cambiar valores. Las discrepancias marcadas como no resolubles necesitan evidencia adicional del titular o una fuente revisada.

## Identidades abreviadas o ambiguas

| Entidad canónica | Nombre canónico | Nombre fuente | ID/URL externo | Desambiguación |
| --- | --- | --- | --- | --- |
| `transfermarkt:world-cup:player:ee353ea3ec0b143f6f5fb032` | Ronaldo | Ronaldo | [perfil](https://www.transfermarkt.com/ronaldo/profil/spieler/3140) | Perfil externo exacto de Transfermarkt; se conserva el nombre canónico del catálogo y no se resuelve por nombre libre (https://www.transfermarkt.com/ronaldo/profil/spieler/3140). |
| `transfermarkt:world-cup:player:0f03fc0cf25d0c58202b8f98` | Pelé | Pelé | [perfil](https://www.transfermarkt.com/pele/profil/spieler/17121) | Perfil externo exacto de Transfermarkt; se conserva el nombre canónico del catálogo y no se resuelve por nombre libre (https://www.transfermarkt.com/pele/profil/spieler/17121). |
| `transfermarkt:world-cup:player:3885ec2e25136d206ab6b3f2` | Neymar | Neymar | [perfil](https://www.transfermarkt.com/neymar/profil/spieler/68290) | Perfil externo exacto de Transfermarkt; se conserva el nombre canónico del catálogo y no se resuelve por nombre libre (https://www.transfermarkt.com/neymar/profil/spieler/68290). |

## Qué queda abierto

- La fuente primaria mantiene rightsStatus=review_required.
- La fuente archivada no expone una trazabilidad partido por partido en este artefacto; debe documentarse antes de aprobar.
- Las imágenes pendientes quedan fuera de esta decisión de alcance y se abordarán en el bloque de media.

## Requisitos para aprobar

- Confirmar que el corte 1930–2026 y la exclusión de clasificatorias están explícitos en la fuente adoptada.
- Conservar la definición completa en metadatos de una nueva versión draft si se modifica el snapshot.
- Resolver derechos de redistribución de la fuente numérica antes de aprobar o publicar.

Estado de derechos: **review_required**; no se ha elevado a approved.

Huella de esta decisión: 4470ddef7886d2b8d95d103a5d01687d58349a88f2723fea5a66dc68506c6577.
