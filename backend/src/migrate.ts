import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { config } from './config.js';

const migrationsDirectory = resolve(process.cwd(), 'migrations');
const migrationTable = 'rango90_schema_migrations';

// These historical identity/media fixes assume that the corresponding
// imported catalogue rows already exist. A clean Render database must still
// be able to bootstrap its schema; keep these migrations pending until their
// source data is loaded instead of aborting the web service on a foreign-key
// violation.
const dataDependentMigrations = new Set([
  '012_clarify_uefa_torres_identity.sql',
  '014_clarify_uefa_short_names.sql',
  '015_clarify_puskas_identity.sql',
  '016_clarify_uefa_player_labels.sql',
  '017_clarify_lisandro_lopez.sql',
  '018_clarify_uefa_conference_player_names.sql',
  '021_clarify_uefa_champions_short_player_names.sql',
  '022_clarify_jose_augusto_identity.sql',
  '023_rsssf_international_player_aliases.sql',
  '029_clarify_rodri_identity.sql',
  '029_phase5_premier_league_club_titles.sql',
  '031_repair_bdfutbol_muller_identity.sql',
  '035_backfill_provider_player_aliases.sql',
  '036_clarify_sergio_ramos_identity.sql',
  '037_add_reviewed_player_aliases_for_media_search.sql',
  '038_split_bdfutbol_player_collisions.sql',
  '039_split_remaining_bdfutbol_player_collisions.sql',
  '040_add_reviewed_uefa_player_aliases.sql',
  '044_add_hanno_behrens_alias.sql',
  '045_add_franko_kovacevic_alias.sql',
  '047_reject_wrong_kevin_campbell_portrait.sql',
  '048_reject_wrong_luis_suarez_portrait.sql',
  '049_split_bdfutbol_rodri_collision.sql',
  '050_backfill_audited_media_player_aliases.sql',
  '051_add_reviewed_missing_player_aliases.sql',
  '052_add_uefa_conference_player_aliases.sql',
  '055_link_exact_approved_portrait_duplicates.sql',
  '060_add_api_football_full_name_aliases.sql',
  '062_reconcile_thesportsdb_cc_rights.sql',
  '063_repair_historical_icon_identities.sql',
  '064_reject_thesportsdb_explicit_no_assets.sql',
  '065_exclude_non_iconic_historical_players_from_game_catalog.sql',
  '066_admit_modern_top200_players.sql',
  '067_exclude_all_non_iconic_pre1960_players.sql',
  '068_close_champions_goals_data_candidate.sql',
  '069_reopen_modern_players_after_birth_date_verification.sql',
  '070_remove_pre1930_game_exceptions.sql',
  '071_flatten_reviewed_zaniolo_identity_chain.sql'
]);

async function main(): Promise<void> {
  if (!config.databaseUrl) throw new Error('DATABASE_URL es obligatoria para ejecutar migraciones');

  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  try {
    await client.query(`SELECT pg_advisory_lock(hashtext('rango90-schema-migrations'))`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${migrationTable} (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status TEXT NOT NULL DEFAULT 'applied',
        last_error TEXT
      )
    `);
    await client.query(`ALTER TABLE ${migrationTable} ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'applied'`);
    await client.query(`ALTER TABLE ${migrationTable} ADD COLUMN IF NOT EXISTS last_error TEXT`);

    const filenames = (await readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith('.sql'))
      .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));

    for (const filename of filenames) {
      const applied = await client.query<{ status: string }>(`SELECT status FROM ${migrationTable} WHERE filename = $1`, [filename]);
      if (applied.rows[0]?.status === 'applied') continue;

      console.log(`Aplicando migración ${filename}`);
      const sql = await readFile(resolve(migrationsDirectory, filename), 'utf8');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO ${migrationTable} (filename, status, last_error)
           VALUES ($1, 'applied', NULL)
           ON CONFLICT (filename) DO UPDATE SET status = 'applied', applied_at = NOW(), last_error = NULL`,
          [filename]
        );
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== '23503' || !dataDependentMigrations.has(filename)) throw error;

        // A migration may have opened its own transaction. Roll it back
        // before recording the deferred state and continuing with bootstrap.
        await client.query('ROLLBACK').catch(() => undefined);
        const message = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
        await client.query(
          `INSERT INTO ${migrationTable} (filename, status, last_error)
           VALUES ($1, 'deferred', $2)
           ON CONFLICT (filename) DO UPDATE SET status = 'deferred', applied_at = NOW(), last_error = EXCLUDED.last_error`,
          [filename, message]
        );
        console.warn(`Migración aplazada hasta cargar sus datos: ${filename}`);
      }
    }

    console.log(`Migraciones comprobadas: ${filenames.length}`);
  } finally {
    await client.query(`SELECT pg_advisory_unlock(hashtext('rango90-schema-migrations'))`).catch(() => undefined);
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
