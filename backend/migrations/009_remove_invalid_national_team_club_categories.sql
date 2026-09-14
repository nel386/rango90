-- Las competiciones de selecciones no tienen clubes campeones.
-- Solo se eliminan categorías de catálogo sin snapshots ni retos, por lo que
-- esta limpieza no puede alterar contenido histórico publicado.
DELETE FROM category_definitions c
WHERE c.slug IN (
  'world-cup-club-titles',
  'euro-club-titles',
  'copa-america-club-titles',
  'nations-league-club-titles'
)
AND NOT EXISTS (
  SELECT 1 FROM ranking_snapshots rs WHERE rs.category_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM challenges ch WHERE ch.category_id = c.id
);
