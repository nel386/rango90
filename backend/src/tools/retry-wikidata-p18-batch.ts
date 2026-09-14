import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDb, pool } from '../db.js';
import { config } from '../config.js';
import { fetchCommonsFileRest, isValidCommonsCandidate } from '../providers/commonsClient.js';

type ManifestEntry = {
  entity_id: string;
  canonical_name: string;
  best_rank: number;
  ranking_count: number;
  source_team_name: string | null;
  aliases: string[];
  error?: string;
};

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim();
}

const wait = (ms: number) => new Promise<void>((resolveWait) => setTimeout(resolveWait, ms));

async function wikidata(url: URL): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { 'User-Agent': config.mediaUserAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(config.mediaDiscoveryRequestTimeoutMs)
    });
    if (response.ok) return await response.json() as unknown;
    if (response.status !== 429 && response.status < 500) throw new Error(`Wikidata API ${response.status}`);
    await wait(Math.min(10_000, 5_000 * (attempt + 1)));
  }
  throw new Error('Wikidata API rate limit after bounded retries');
}

async function main(): Promise<void> {
  const sourceManifest = process.argv[process.argv.indexOf('--manifest') + 1];
  if (!sourceManifest) throw new Error('Falta --manifest');
  const source = JSON.parse(await readFile(resolve(sourceManifest), 'utf8')) as { entries?: ManifestEntry[] };
  const sourceEntries = (source.entries ?? []).filter((entry) => Boolean(entry.error));
  if (sourceEntries.length === 0) throw new Error('El manifiesto no contiene entradas con error para reintentar');

  // Re-check the media exclusion in PostgreSQL immediately before any external
  // request. Identity members are included so a source-provider entity cannot
  // bypass the approved/pending/rejected guard.
  const eligibility = await pool.query<{ entity_id: string; canonical_name: string; has_portrait: boolean }>(
    `WITH identity_members AS (
       SELECT e.id AS canonical_id, e.id AS member_id FROM entities e WHERE e.entity_type = 'player'
       UNION
       SELECT eil.canonical_entity_id, eil.source_entity_id
       FROM entity_identity_links eil
       JOIN entities e ON e.id = eil.canonical_entity_id AND e.entity_type = 'player'
     )
     SELECT e.id AS entity_id, e.canonical_name,
            EXISTS (
              SELECT 1 FROM identity_members im
              JOIN image_assets ia ON ia.entity_id = im.member_id
              WHERE im.canonical_id = e.id AND ia.asset_kind = 'portrait'
            ) AS has_portrait
     FROM entities e
     WHERE e.id = ANY($1::text[]) AND e.entity_type = 'player'`,
    [sourceEntries.map((entry) => entry.entity_id)]
  );
  const eligibleIds = new Set(eligibility.rows.filter((row) => !row.has_portrait).map((row) => row.entity_id));
  const entries = sourceEntries.filter((entry) => eligibleIds.has(entry.entity_id));

  const searchResults = new Map<string, string>();
  const unresolved: Array<{ entityId: string; name: string; reason: string }> = [];
  for (const [index, entry] of entries.entries()) {
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action', 'wbsearchentities');
    url.searchParams.set('search', entry.canonical_name);
    url.searchParams.set('language', 'en');
    url.searchParams.set('uselang', 'en');
    url.searchParams.set('type', 'item');
    url.searchParams.set('limit', '10');
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');
    try {
      const payload = await wikidata(url) as { search?: Array<{ id?: string; label?: string; description?: string }> };
      const candidate = (payload.search ?? []).find((item) => item.id
        && normalize(item.label ?? '') === normalize(entry.canonical_name)
        && /(football|soccer|futsal|goalkeeper|midfielder|defender|forward|striker|sportsperson)/iu.test(item.description ?? ''));
      if (candidate?.id) searchResults.set(entry.entity_id, candidate.id);
      else unresolved.push({ entityId: entry.entity_id, name: entry.canonical_name, reason: 'No se encontró un ítem futbolístico con etiqueta exacta.' });
    } catch (error) {
      unresolved.push({ entityId: entry.entity_id, name: entry.canonical_name, reason: error instanceof Error ? error.message : String(error) });
    }
    if (index < entries.length - 1) await wait(5_000);
  }

  const qids = [...searchResults.values()];
  const claims = new Map<string, string>();
  if (qids.length > 0) {
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action', 'wbgetentities');
    url.searchParams.set('ids', qids.join('|'));
    url.searchParams.set('props', 'claims');
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');
    const payload = await wikidata(url) as { entities?: Record<string, { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>> }> };
    for (const [entityId, qid] of searchResults.entries()) {
      const fileName = payload.entities?.[qid]?.claims?.P18
        ?.map((claim) => claim.mainsnak?.datavalue?.value)
        .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
      if (fileName) claims.set(entityId, fileName);
      else unresolved.push({ entityId, name: entries.find((entry) => entry.entity_id === entityId)?.canonical_name ?? entityId, reason: `Wikidata ${qid} no declara P18.` });
    }
  }

  const outputEntries: Array<Record<string, unknown>> = [];
  for (const entry of entries) {
    const fileName = claims.get(entry.entity_id);
    if (!fileName) {
      const failure = unresolved.find((item) => item.entityId === entry.entity_id);
      outputEntries.push({ ...entry, candidates: [], discarded: [{ reason: failure?.reason ?? 'No se encontró P18 exacto.' }] });
      continue;
    }
    try {
      const raw = await fetchCommonsFileRest(`File:${fileName}`);
      const candidate = raw ? { ...raw, wikidataEntityId: searchResults.get(entry.entity_id), wikidataP18: true as const } : null;
      if (!candidate) {
        outputEntries.push({ ...entry, candidates: [], discarded: [{ title: `File:${fileName}`, reason: 'El archivo P18 no existe o no devolvió metadatos Commons.' }] });
      } else if (!isValidCommonsCandidate(candidate, 'portrait', entry.canonical_name, entry.aliases, entry.source_team_name ?? undefined)) {
        outputEntries.push({ ...entry, candidates: [], discarded: [{ title: candidate.title, sourceUrl: candidate.descriptionUrl, reason: 'El archivo P18 no supera dimensiones, formato, identidad o licencia explícita.' }] });
      } else {
        outputEntries.push({ ...entry, candidates: [candidate], discarded: [] });
      }
    } catch (error) {
      outputEntries.push({ ...entry, candidates: [], discarded: [{ title: `File:${fileName}`, reason: error instanceof Error ? error.message : String(error) }] });
    }
    await wait(1_000);
  }

  const outputPath = resolve(config.mediaCandidateRoot, `players-portrait-${Date.now()}-strict-p18-retry.json`);
  await mkdir(resolve(config.mediaCandidateRoot), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({
    kind: 'portrait', generatedAt: new Date().toISOString(),
    selection: { sourceManifest, rule: 'Reintento solo de errores 429; exclusión PostgreSQL de cualquier portrait approved/pending/rejected por grupo de identidad.', discovery: 'Wikidata exact label + P18 -> Wikimedia Commons', reviewStatus: 'pending only; no automatic approval' },
    entries: outputEntries, excludedFromRetry: sourceEntries.filter((entry) => !eligibleIds.has(entry.entity_id)).map((entry) => ({ entityId: entry.entity_id, reason: 'Tiene retrato registrado en algún estado dentro del grupo de identidad.' })),
    complete: outputEntries.length === entries.length
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath, selected: entries.length, candidates: outputEntries.filter((entry) => Array.isArray(entry.candidates) && entry.candidates.length > 0).length, discarded: outputEntries.reduce((total, entry) => total + ((entry.discarded as unknown[])?.length ?? 0), 0), excluded: sourceEntries.length - entries.length }));
}

main().finally(() => closeDb());
