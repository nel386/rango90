import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL ?? '';
const runId = process.env.BLOCK15A_RUN_ID?.trim() || 'local';
const action = process.argv[2] ?? 'seed';
if (!databaseUrl) throw new Error('DATABASE_URL es obligatoria para el fixture Block 15A');
const parsed = new URL(databaseUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) || !/rango90_qa_block15[ab]/u.test(parsed.pathname) || process.env.NODE_ENV === 'production') {
  throw new Error('El fixture Block 15 solo admite PostgreSQL efímero local');
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const sourceKey = `block15a-qa-${runId}`;
const entityId = `block15a-qa-player-${runId}`;
const editionId = `champions:1955/56`;
try {
  if (action === 'seed') {
    await pool.query('BEGIN');
    await pool.query(`INSERT INTO sources (key, name, source_type, rights_status) VALUES ($1, 'Block 15A isolated fixture', 'manual', 'review_required') ON CONFLICT DO NOTHING`, [sourceKey]);
    await pool.query(`INSERT INTO entities (id, entity_type, canonical_name, catalog_status) VALUES ($1, 'player', 'Block 15A Fixture Player', 'excluded_from_game') ON CONFLICT DO NOTHING`, [entityId]);
    await pool.query(`INSERT INTO champions_editions (id, season_start, season_end, season_label, era, competition_name, include_qualifying, scope_version) VALUES ($1, 1955, 1956, '1955/56', 'european_cup', 'Copa de Europa', FALSE, 'uefa-champions-league-goals-facts-v1') ON CONFLICT DO NOTHING`, [editionId]);
    await pool.query('COMMIT');
    console.log(JSON.stringify({ action, sourceKey, entityId, editionId }));
  } else if (action === 'cleanup') {
    await pool.query('BEGIN');
    await pool.query('DELETE FROM champions_goal_facts WHERE source_key = $1', [sourceKey]);
    await pool.query('DELETE FROM champions_source_captures WHERE source_key = $1', [sourceKey]);
    await pool.query('DELETE FROM entities WHERE id = $1', [entityId]);
    await pool.query('DELETE FROM sources WHERE key = $1', [sourceKey]);
    await pool.query('COMMIT');
    console.log(JSON.stringify({ action, sourceKey, cleaned: true }));
  } else {
    throw new Error('Acción de fixture desconocida');
  }
} catch (error) {
  await pool.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await pool.end();
}
