-- Production data candidate audit for the first open 200-row category.
-- This migration deliberately leaves the category and all snapshots in draft:
-- data completeness is not a redistribution licence, and the official
-- contrast still contains unresolved value discrepancies.
UPDATE category_definitions
SET definition_version = 2,
    definition_md = 'Total de goles de cada jugador en la tabla histórica de goleadores de la Copa de Europa y UEFA Champions League desde 1955/56. El universo abierto se fija en las primeras 200 filas reales de la fuente principal; no se añaden ceros ni filas sintéticas. Las eliminatorias de clasificación quedan fuera. Los empates conservan la misma posición competitiva y el salto de posiciones posterior.',
    status = CASE WHEN status = 'retired' THEN status ELSE 'draft' END
WHERE slug = 'uefa-champions-league-goals';

INSERT INTO sources (key, name, source_type, base_url, rights_status, usage_notes)
VALUES (
  'transfermarkt-european-cup-champions-league-historical-goals',
  'Transfermarkt — historical European Cup / Champions League top scorers',
  'reference',
  'https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0',
  'review_required',
  'Principal de valores para el snapshot reproducible de 200 filas; no se presume licencia de redistribución comercial. Contraste UEFA archivado por separado.'
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  rights_status = 'review_required',
  usage_notes = EXCLUDED.usage_notes;

-- If a snapshot already exists when this migration is applied, preserve the
-- audit decision in its metadata without changing its data or promoting it.
UPDATE ranking_snapshots rs
SET status = CASE WHEN rs.status IN ('approved', 'published') THEN rs.status ELSE 'draft' END,
    metadata = rs.metadata || jsonb_build_object(
      'productionCandidate', true,
      'auditArtifact', 'data/evidence/uefa-champions-league-goals-2026-09-12',
      'contrastDecision', '12_value_discrepancies_unresolved',
      'rightsDecision', 'redistribution_not_granted'
    )
FROM category_definitions c
WHERE rs.category_id = c.id
  AND c.slug = 'uefa-champions-league-goals'
  AND rs.status NOT IN ('superseded');
