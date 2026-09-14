import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDb, pool } from '../db.js';
import { config } from '../config.js';

type PlayerTarget = {
  entity_id: string;
  canonical_name: string;
  aliases: string[];
  best_rank: number;
};

type SearchItem = { id?: string; label?: string; description?: string };
type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };
type WikidataEntity = {
  claims?: Record<string, Claim[]>;
  labels?: Record<string, { value?: string }>;
  descriptions?: Record<string, { value?: string }>;
};

const FOOTBALL_DESCRIPTION = /(football|soccer|futsal|goalkeeper|midfielder|defender|forward|striker|sportsperson)/iu;
const wait = (milliseconds: number) => new Promise<void>((resolveWait) => setTimeout(resolveWait, milliseconds));

function argument(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim().replace(/\s+/gu, ' ');
}

async function wikidataJson(url: URL): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { 'User-Agent': config.mediaUserAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(config.mediaDiscoveryRequestTimeoutMs)
    });
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) throw new Error(`Wikidata API ${response.status}`);
    await wait(Math.min(30_000, 5_000 * (attempt + 1)));
  }
  throw new Error('Wikidata API rate limit after bounded retries');
}

async function searchExactPlayer(target: PlayerTarget): Promise<{ qid: string; label: string; description: string } | null> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbsearchentities');
  url.searchParams.set('search', target.canonical_name);
  url.searchParams.set('language', 'en');
  url.searchParams.set('uselang', 'en');
  url.searchParams.set('type', 'item');
  url.searchParams.set('limit', '10');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  const payload = await wikidataJson(url) as { search?: SearchItem[] };
  const labels = new Set([target.canonical_name, ...target.aliases].map(normalize).filter(Boolean));
  const matches = (payload.search ?? []).filter((item) => {
    const label = normalize(item.label ?? '');
    return Boolean(item.id && labels.has(label) && FOOTBALL_DESCRIPTION.test(item.description ?? ''));
  });
  const unique = [...new Map(matches.map((item) => [item.id, item])).values()];
  if (unique.length !== 1 || !unique[0]?.id) return null;
  return { qid: unique[0].id, label: unique[0].label ?? target.canonical_name, description: unique[0].description ?? '' };
}

function fullBirthDate(entity: WikidataEntity | undefined): string | null {
  const value = entity?.claims?.P569?.map((claim) => claim.mainsnak?.datavalue?.value)
    .find((candidate): candidate is { time?: string; precision?: number } => Boolean(candidate && typeof candidate === 'object' && typeof (candidate as { time?: unknown }).time === 'string'));
  const time = value?.time;
  const match = time?.match(/^[+]?(\d{4})-(\d{2})-(\d{2})T/u);
  if (!match || match[2] === '00' || match[3] === '00') return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed > new Date() || Number(match[1]) < 1800) return null;
  return date;
}

async function claimsFor(qid: string): Promise<{ birthDate: string | null; raw: WikidataEntity | undefined }> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', qid);
  url.searchParams.set('props', 'claims|labels|descriptions');
  url.searchParams.set('languages', 'en');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  const payload = await wikidataJson(url) as { entities?: Record<string, WikidataEntity> };
  const raw = payload.entities?.[qid];
  return { birthDate: fullBirthDate(raw), raw };
}

async function main(): Promise<void> {
  const category = argument('category', 'world-cup-goals')!;
  const limit = Number(argument('limit', '30'));
  const offset = Number(argument('offset', '0'));
  const apply = hasFlag('apply');
  const explicitQid = argument('qid');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    throw new Error('--limit debe estar entre 1 y 100 y --offset debe ser >= 0');
  }
  if (offset !== 0) {
    throw new Error('Esta cola se reduce al aplicar fechas: usa siempre --offset 0 para no saltarte jugadores pendientes.');
  }
  const targets = await pool.query<PlayerTarget>(
    `WITH RECURSIVE identity_walk AS (
       SELECT source_entity_id, canonical_entity_id, ARRAY[source_entity_id, canonical_entity_id]::text[] path
       FROM entity_identity_links
       UNION ALL
       SELECT iw.source_entity_id, link.canonical_entity_id, iw.path || link.canonical_entity_id
       FROM identity_walk iw
       JOIN entity_identity_links link ON link.source_entity_id = iw.canonical_entity_id
       WHERE NOT link.canonical_entity_id = ANY(iw.path)
     ), resolved AS (
       SELECT DISTINCT ON (source_entity_id) source_entity_id, canonical_entity_id
       FROM identity_walk
       ORDER BY source_entity_id, cardinality(path) DESC
     ), ranked AS (
       SELECT COALESCE(resolved.canonical_entity_id, re.entity_id) entity_id,
              MIN(re.rank)::int best_rank
       FROM ranking_entries re
       JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
       JOIN category_definitions c ON c.id = rs.category_id AND c.slug = $1
       JOIN entities source_entity ON source_entity.id = re.entity_id AND source_entity.entity_type = 'player'
       LEFT JOIN resolved ON resolved.source_entity_id = re.entity_id
       WHERE re.rank <= 200
       GROUP BY COALESCE(resolved.canonical_entity_id, re.entity_id)
     )
     SELECT ranked.entity_id, e.canonical_name,
            COALESCE(array_agg(alias.alias) FILTER (WHERE alias.alias IS NOT NULL), '{}') aliases,
            ranked.best_rank
     FROM ranked
     JOIN entities e ON e.id = ranked.entity_id
       AND e.entity_type = 'player'
       AND e.catalog_status = 'active'
       AND e.birth_date IS NULL
     LEFT JOIN entity_aliases alias ON alias.entity_id = e.id
     GROUP BY ranked.entity_id, e.canonical_name, ranked.best_rank
     ORDER BY ranked.best_rank, e.canonical_name, ranked.entity_id
     LIMIT $2 OFFSET $3`,
    [category, limit, offset]
  );
  if (targets.rows.length === 0) throw new Error(`No hay jugadores sin fecha de nacimiento en ${category} para ese tramo`);

  const results: Array<Record<string, unknown>> = [];
  for (const [index, target] of targets.rows.entries()) {
    try {
      let match = explicitQid && index === 0 ? null : await searchExactPlayer(target);
      if (explicitQid && index === 0) {
        const explicit = await claimsFor(explicitQid);
        const explicitLabel = explicit.raw?.labels?.en?.value ?? '';
        const explicitDescription = explicit.raw?.descriptions?.en?.value ?? '';
        const acceptedLabels = new Set([target.canonical_name, ...target.aliases].map(normalize).filter(Boolean));
        const explicitNormalizedLabel = normalize(explicitLabel);
        const labelMatchesTarget = [...acceptedLabels].some((label) =>
          explicitNormalizedLabel === label || explicitNormalizedLabel.startsWith(`${label} `)
        );
        if (!labelMatchesTarget || !FOOTBALL_DESCRIPTION.test(explicitDescription)) {
          throw new Error(`El QID explícito ${explicitQid} no coincide con el jugador futbolístico ${target.canonical_name}`);
        }
        match = { qid: explicitQid, label: explicitLabel || target.canonical_name, description: explicitDescription };
      }
      await wait(2_000);
      if (!match) {
        results.push({ ...target, status: 'unresolved', reason: 'No existe una única coincidencia exacta futbolística en Wikidata.' });
      } else {
        const claims = await claimsFor(match.qid);
        results.push({ ...target, status: claims.birthDate ? 'matched' : 'no_full_birth_date', qid: match.qid, wikidataLabel: match.label, description: match.description, birthDate: claims.birthDate, claims: claims.raw?.claims ?? {} });
      }
    } catch (error) {
      results.push({ ...target, status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
    if (index < targets.rows.length - 1) await wait(2_000);
  }

  const retrievedAt = new Date().toISOString();
  const rawContent = JSON.stringify({ source: 'wikidata', endpoint: 'wbsearchentities+wbgetentities', category, offset, limit, retrievedAt, results });
  const hash = createHash('sha256').update(rawContent).digest('hex');
  const snapshotId = `src_${hash.slice(0, 24)}`;
  const snapshotPath = resolve(config.snapshotRoot, `${snapshotId}.json`);
  await mkdir(resolve(config.snapshotRoot), { recursive: true });
  await writeFile(snapshotPath, rawContent, { encoding: 'utf8', flag: 'wx' }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST') throw error;
  });

  const matched = results.filter((result) => result.status === 'matched' && typeof result.birthDate === 'string');
  if (apply && matched.length > 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO sources (key, name, source_type, base_url, rights_status)
         VALUES ('wikidata', 'Wikidata', 'reference', 'https://www.wikidata.org/', 'review_required')
         ON CONFLICT (key) DO NOTHING`
      );
      await client.query(
        `INSERT INTO source_snapshots (id, source_key, retrieved_at, content_type, storage_uri, content_sha256, metadata)
         VALUES ($1, 'wikidata', $2, 'application/json', $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [snapshotId, retrievedAt, `storage/source-snapshots/${snapshotId}.json`, hash, JSON.stringify({ importer: 'enrich-wikidata-birth-dates', category, offset, limit, matched: matched.length })]
      );
      for (const result of matched) {
        await client.query(
          `UPDATE entities
              SET birth_date = $2,
                  metadata = metadata || $3::jsonb,
                  updated_at = NOW()
            WHERE id = $1 AND birth_date IS NULL`,
          [result.entity_id, result.birthDate, JSON.stringify({ birthDateEvidence: { source: 'wikidata', qid: result.qid, sourceSnapshotId: snapshotId, retrievedAt } })]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  const outputPath = resolve(config.mediaCandidateRoot, `wikidata-birth-dates-${category}-${offset}-${limit}-${Date.now()}.json`);
  await mkdir(resolve(config.mediaCandidateRoot), { recursive: true });
  await writeFile(outputPath, JSON.stringify({ source: 'wikidata', category, offset, limit, apply, snapshotId, results }, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ category, offset, limit, apply, snapshotId, outputPath, selected: results.length, matched: matched.length, unresolved: results.filter((result) => result.status === 'unresolved').length, noFullBirthDate: results.filter((result) => result.status === 'no_full_birth_date').length, errors: results.filter((result) => result.status === 'error').length }, null, 2));
}

main().finally(() => closeDb());
