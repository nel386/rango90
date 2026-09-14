import { pool } from './db.js';
import { categories, competitions, retiredDuplicateCategorySlugs, retiredSimplifiedCategorySlugs } from './catalog.js';

export async function seedCatalog(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const competition of competitions) {
      await client.query(
        `INSERT INTO competitions (id, name, country_code, confederation, competition_type, is_whitelisted)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, country_code = EXCLUDED.country_code, confederation = EXCLUDED.confederation, competition_type = EXCLUDED.competition_type, is_whitelisted = TRUE`,
        [competition.id, competition.name, competition.countryCode ?? null, competition.confederation ?? null, competition.competitionType]
      );
    }
    for (const category of categories) {
      await client.query(
        `INSERT INTO category_definitions (id, slug, label_es, label_en, entity_type, metric_key, scope_kind, scope, ranking_direction, tie_policy, score_cap, definition_md, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'desc', 'competition', 100, $9, 'draft')
         ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, label_es = EXCLUDED.label_es, label_en = EXCLUDED.label_en,
           entity_type = EXCLUDED.entity_type, metric_key = EXCLUDED.metric_key, scope_kind = EXCLUDED.scope_kind,
           scope = EXCLUDED.scope, ranking_direction = EXCLUDED.ranking_direction, tie_policy = EXCLUDED.tie_policy,
           score_cap = EXCLUDED.score_cap, definition_md = EXCLUDED.definition_md`,
        [category.id, category.slug, category.labelEs, category.labelEn, category.entityType, category.metricKey, category.scopeKind, JSON.stringify(category.scope), category.definition]
      );
    }
    await client.query(
      `UPDATE category_definitions
       SET status = 'retired'
       WHERE slug = ANY($1::text[])
         AND status <> 'retired'`,
      [[...retiredDuplicateCategorySlugs, ...retiredSimplifiedCategorySlugs]]
    );
    await client.query('COMMIT');
    console.log(`Catálogo sembrado: ${competitions.length} competiciones, ${categories.length} categorías.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
