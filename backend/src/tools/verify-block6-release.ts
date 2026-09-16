import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { config } from '../config.js';
import { evaluateBlock6Release, type Block6Evidence } from '../block6ReleaseGate.js';

const outputDirectory = resolve(config.auditOutputRoot, 'block6');
const runId = process.env.RANGO90_BLOCK6_RUN_ID?.trim() || `block6-${randomUUID()}`;
const timestamp = process.env.RANGO90_BLOCK6_TIMESTAMP?.trim() || new Date().toISOString();
const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();
const isolatedSafe = Boolean(isolatedUrl && isolatedUrl !== databaseUrl);
const existingArtifacts = [
  resolve(config.auditOutputRoot, 'ranking-truth/ranking-truth.json'),
  resolve(config.auditOutputRoot, 'ranking-scope/ranking-scope-decisions.json'),
  resolve(config.auditOutputRoot, 'media/playable-media-audit.json'),
  resolve(outputDirectory, 'public-readonly.json')
];
const artifactHashes: Record<string, string> = {};
let publicAudit: { status: 'passed' | 'failed'; detail: string } | null = null;
for (const artifact of existingArtifacts) {
  try {
    const content = await readFile(artifact);
    artifactHashes[artifact] = createHash('sha256').update(content).digest('hex');
    if (artifact.endsWith('/public-readonly.json')) {
      const parsed = JSON.parse(content.toString()) as { status?: 'passed' | 'failed'; runId?: string };
      if (parsed.runId === runId && (parsed.status === 'passed' || parsed.status === 'failed')) {
        publicAudit = { status: parsed.status, detail: `Auditoría pública de solo lectura: ${parsed.status}.` };
      }
    }
  } catch {
    // Missing audit artifacts are represented by an empty hash map entry set.
  }
}

async function getIsolatedFingerprint(): Promise<{ databaseName: string | null; fingerprintSha256: string | null }> {
  if (!isolatedSafe || !isolatedUrl) return { databaseName: null, fingerprintSha256: null };
  const isolatedPool = new pg.Pool({ connectionString: isolatedUrl, max: 1, connectionTimeoutMillis: 5_000 });
  try {
    const result = await isolatedPool.query(`
      SELECT current_database() AS database_name,
             current_user AS database_user,
             (SELECT COUNT(*)::int FROM rango90_schema_migrations) AS migration_count,
             (SELECT COALESCE(jsonb_agg(to_jsonb(snapshot_row) ORDER BY snapshot_row.id), '[]'::jsonb)
                FROM (SELECT id, status, data_version, algorithm_version, content_sha256 FROM ranking_snapshots) snapshot_row) AS snapshots,
             (SELECT COALESCE(jsonb_agg(to_jsonb(challenge_row) ORDER BY challenge_row.id), '[]'::jsonb)
                FROM (SELECT id, status, challenge_sha256 FROM game_challenges) challenge_row) AS challenges`);
    const row = result.rows[0] as Record<string, unknown>;
    return {
      databaseName: String(row.database_name),
      fingerprintSha256: createHash('sha256').update(JSON.stringify(row)).digest('hex')
    };
  } catch {
    return { databaseName: null, fingerprintSha256: null };
  } finally {
    await isolatedPool.end();
  }
}

const isolatedFingerprint = await getIsolatedFingerprint();
const run = {
  runId,
  timestamp,
  runtimeMode: config.runtimeMode,
  isolatedDatabase: {
    configured: Boolean(isolatedUrl),
    distinctFromDatabaseUrl: isolatedSafe,
    databaseName: isolatedFingerprint.databaseName,
    fingerprintSha256: isolatedFingerprint.fingerprintSha256
  }
};

const evidence: Block6Evidence = {
  isolatedIntegration: isolatedSafe && process.env.RANGO90_ISOLATED_INTEGRATION_RESULT === 'passed'
    ? { status: 'passed', detail: 'La suite de integración se ejecutó contra la URL aislada declarada.' }
    : isolatedSafe && process.env.RANGO90_ISOLATED_INTEGRATION_RESULT === 'failed'
      ? { status: 'failed', detail: 'La suite de integración aislada falló.' }
      : isolatedSafe
        ? { status: 'not_run', detail: 'URL aislada disponible; la suite debe ejecutarse explícitamente contra ella.' }
    : { status: 'integration_pending', detail: 'Falta RANGO90_ISOLATED_DATABASE_URL o coincide con DATABASE_URL; no se usa la base real.' },
  mobileAudit: { status: 'not_run', p0: 0, p1: 0, detail: 'No hay navegador/capturador disponible en esta sesión; no se han inventado capturas.' },
  publicReadOnlyAudit: publicAudit ?? { status: 'not_run', detail: 'No hay una auditoría pública de solo lectura con el mismo runId.' },
  officialPublication: process.env.RANGO90_OFFICIAL_FIXTURE_RESULT === 'passed'
    ? { status: 'passed', detail: 'Fixture oficial sintética aislada verificada; no se publicó ningún dato productivo.' }
    : { status: 'not_run', detail: 'Falta evidencia de fixture oficial sintética aislada en este run.' },
  artifactHashes,
  run
};
const result = evaluateBlock6Release(evidence);
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, 'block6-release-gate.json'), JSON.stringify(result, null, 2) + '\n');
await writeFile(resolve(outputDirectory, 'block6-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
await writeFile(resolve(outputDirectory, 'block6-report.md'), [
  '# Auditoría BLOQUE 6A',
  '',
  `- runId: \`${run.runId}\``,
  `- timestamp: \`${run.timestamp}\``,
  `- runtimeMode: \`${run.runtimeMode}\``,
  `- base aislada: \`${run.isolatedDatabase.databaseName ?? 'not available'}\``,
  `- huella de base aislada: \`${run.isolatedDatabase.fingerprintSha256 ?? 'not available'}\``,
  `- readyForRelease: \`${result.readyForRelease}\``,
  `- blockingReasons: ${result.blockingReasons.length > 0 ? result.blockingReasons.map((reason) => `\`${reason}\``).join(', ') : 'none'}`,
  '',
  'La evidencia JSON y la puerta se generaron en esta misma ejecución.'
].join('\n') + '\n');
console.log(JSON.stringify({ ...result, status: result.readyForRelease ? 'ready' : evidence.isolatedIntegration.status === 'integration_pending' ? 'integration_pending' : 'blocked' }, null, 2));
if (!result.readyForRelease) process.exitCode = 1;
