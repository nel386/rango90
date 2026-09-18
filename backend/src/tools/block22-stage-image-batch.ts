import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { parseCsv, validateImageRow } from '../block22ImageCandidates.js';

const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';
const runtimeMode = process.env.RANGO90_RUNTIME_MODE?.trim();
const inputFile = resolve(process.env.BLOCK22_IMAGE_BATCH_FILE?.trim() || 'audits/block22/BLOCK22_IMAGE_REVIEW_TEMPLATE.csv');
const outputFile = resolve(process.env.BLOCK22_IMAGE_BATCH_REPORT?.trim() || 'audits/block22/BLOCK22_IMAGE_BATCH_REPORT.json');
const batchId = (process.env.BLOCK22_BATCH_ID?.trim() || `block22-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`).replace(/[^a-zA-Z0-9_-]/g, '-');

function assertIsolatedDatabase(value: string): void {
  if (!value || !['lab', 'test'].includes(runtimeMode ?? '')) throw new Error('BLOQUE 22 solo permite cargar candidatos con DATABASE_URL en lab/test');
  const parsed = new URL(value);
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) throw new Error('BLOQUE 22 solo acepta PostgreSQL aislado en localhost');
}

async function headUrl(url: string): Promise<{ ok: boolean; status: number; finalUrl: string | null; contentType: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'Rango90-manual-image-review/1.0' } });
    return { ok: response.status >= 200 && response.status < 400, status: response.status, finalUrl: response.url || null, contentType: response.headers.get('content-type') };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: null, contentType: error instanceof Error ? error.name : 'request_failed' };
  } finally { clearTimeout(timeout); }
}

assertIsolatedDatabase(databaseUrl);
const rows = parseCsv(await readFile(inputFile, 'utf8'));
const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
const results: Array<Record<string, unknown>> = [];
const seen = new Set<string>();
try {
  await pool.query('BEGIN');
  for (const row of rows) {
    const key = `${row.entityId}|${row.proposedUrl}`;
    const issues = validateImageRow(row);
    if (!row.proposedUrl && row.status === 'needs_source') {
      results.push({ entityId: row.entityId, canonicalName: row.canonicalName, status: 'needs_source', inserted: false, issues: [] });
      continue;
    }
    if (seen.has(key)) issues.push('duplicate_in_batch');
    seen.add(key);
    if (issues.length) { results.push({ entityId: row.entityId, canonicalName: row.canonicalName, status: 'rejected', inserted: false, issues }); continue; }
    const entity = await pool.query<{ id: string; entity_type: string }>('SELECT id, entity_type FROM entities WHERE id = $1', [row.entityId]);
    if (!entity.rows[0]) { results.push({ entityId: row.entityId, canonicalName: row.canonicalName, status: 'rejected', inserted: false, issues: ['entity_not_found'] }); continue; }
    if (entity.rows[0].entity_type !== 'player') { results.push({ entityId: row.entityId, canonicalName: row.canonicalName, status: 'rejected', inserted: false, issues: ['entity_is_not_player'] }); continue; }
    const existing = await pool.query<{ id: string }>('SELECT id FROM media_image_candidates WHERE entity_id = $1 AND proposed_url = $2 UNION ALL SELECT id FROM image_assets WHERE entity_id = $1 AND source_url = $2 LIMIT 1', [row.entityId, row.proposedUrl]);
    if (existing.rows[0]) { results.push({ entityId: row.entityId, canonicalName: row.canonicalName, status: 'duplicate', inserted: false, issues: ['duplicate_existing_candidate_or_asset'] }); continue; }
    const accessibility = await headUrl(row.proposedUrl);
    if (!accessibility.ok) { results.push({ entityId: row.entityId, canonicalName: row.canonicalName, status: 'rejected', inserted: false, issues: ['url_not_accessible'], accessibility }); continue; }
    const id = `mic_${createHash('sha256').update(`${batchId}:${row.entityId}:${row.proposedUrl}`).digest('hex').slice(0, 24)}`;
    await pool.query(`INSERT INTO media_image_candidates (id,entity_id,category_slug,asset_kind,proposed_url,author,license_name,license_url,attribution_text,review_date,resource_sha256,identity_evidence_url,rights_evidence_url,status,observations,validation,batch_id) VALUES ($1,$2,$3,'portrait',$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending_review',$13,$14,$15)`, [id, row.entityId, row.category, row.proposedUrl, row.author, row.license, row.licenseUrl || null, row.attribution, row.reviewDate, row.resourceSha256.toLowerCase(), row.identityEvidenceUrl, row.rightsEvidenceUrl || null, row.observations, { urlAccessible: true, urlStatus: accessibility.status, finalUrl: accessibility.finalUrl, contentType: accessibility.contentType, playerIdentity: 'manual_assertion_required', rightsApproval: 'not_granted', imageDownloaded: false }, batchId]);
    results.push({ entityId: row.entityId, canonicalName: row.canonicalName, status: 'pending_review', inserted: true, candidateId: id, accessibility });
  }
  await pool.query('COMMIT');
} catch (error) { await pool.query('ROLLBACK').catch(() => undefined); throw error; } finally { await pool.end(); }

const report = { status: results.some((result) => result.status === 'rejected') ? 'completed_with_rejections' : 'passed', batchId, rows: results.length, stagedPendingReview: results.filter((result) => result.status === 'pending_review').length, rejected: results.filter((result) => result.status === 'rejected').length, duplicates: results.filter((result) => result.status === 'duplicate').length, needsSource: results.filter((result) => result.status === 'needs_source').length, imagesDownloaded: false, approvals: 0, rightsChanged: false, snapshotChanged: false, results };
await writeFile(outputFile, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));
