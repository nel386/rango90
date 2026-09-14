import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { config } from './config.js';

const migrationsDirectory = resolve(process.cwd(), 'migrations');
const migrationTable = 'rango90_schema_migrations';

async function main(): Promise<void> {
  if (!config.databaseUrl) throw new Error('DATABASE_URL es obligatoria para ejecutar migraciones');

  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  try {
    await client.query(`SELECT pg_advisory_lock(hashtext('rango90-schema-migrations'))`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${migrationTable} (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const filenames = (await readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith('.sql'))
      .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));

    for (const filename of filenames) {
      const applied = await client.query(`SELECT 1 FROM ${migrationTable} WHERE filename = $1`, [filename]);
      if (applied.rowCount) continue;

      console.log(`Aplicando migración ${filename}`);
      const sql = await readFile(resolve(migrationsDirectory, filename), 'utf8');
      await client.query(sql);
      await client.query(`INSERT INTO ${migrationTable} (filename) VALUES ($1)`, [filename]);
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
