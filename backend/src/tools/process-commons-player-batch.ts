import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDb, pool } from '../db.js';
import { config } from '../config.js';
import { fetchCommonsFileRest, isValidCommonsCandidate, searchWikidataLinkedPortraits, type CommonsImageCandidate } from '../providers/commonsClient.js';

const excludedNames = [
  'Alberto López Fernández',
  'David Ospina',
  'Ivano Bordon',
  'Pantelis Hatzidiakos',
  'Pote',
  'Karim Adeyemi',
  'Ousmane Dembélé',
  'Dani Parejo',
  'Santiago Cañizares'
];

type PlayerRow = {
  entity_id: string;
  canonical_name: string;
  best_rank: number;
  ranking_count: number;
  source_team_name: string | null;
  aliases: string[];
};

type BatchEntry = PlayerRow & {
  candidates: CommonsImageCandidate[];
  discarded: Array<{ title?: string; reason: string; sourceUrl?: string }>;
  error?: string;
};

function normalized(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim();
}

async function fetchWikidataJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': config.mediaUserAgent, Accept: 'application/json' },
    signal: AbortSignal.timeout(config.mediaDiscoveryRequestTimeoutMs)
  });
  if (!response.ok) throw new Error(`Wikidata API ${response.status}`);
  return await response.json() as unknown;
}

/** A bounded fallback for a rate-limited batch: one exact-name search, one
 * claims request, and one Commons metadata request per player. */
async function searchSingleExactP18(player: PlayerRow): Promise<CommonsImageCandidate[]> {
  const searchUrl = new URL('https://www.wikidata.org/w/api.php');
  searchUrl.searchParams.set('action', 'wbsearchentities');
  searchUrl.searchParams.set('search', player.canonical_name);
  searchUrl.searchParams.set('language', 'en');
  searchUrl.searchParams.set('uselang', 'en');
  searchUrl.searchParams.set('type', 'item');
  searchUrl.searchParams.set('limit', '10');
  searchUrl.searchParams.set('format', 'json');
  searchUrl.searchParams.set('formatversion', '2');
  const searchPayload = await fetchWikidataJson(searchUrl) as { search?: Array<{ id?: string; label?: string; description?: string }> };
  const name = normalized(player.canonical_name);
  const match = (searchPayload.search ?? []).find((item) => item.id
    && normalized(item.label ?? '') === name
    && /(football|soccer|futsal|goalkeeper|midfielder|defender|forward|striker|sportsperson)/iu.test(item.description ?? ''));
  if (!match?.id) return [];

  const entityUrl = new URL('https://www.wikidata.org/w/api.php');
  entityUrl.searchParams.set('action', 'wbgetentities');
  entityUrl.searchParams.set('ids', match.id);
  entityUrl.searchParams.set('props', 'claims');
  entityUrl.searchParams.set('format', 'json');
  entityUrl.searchParams.set('formatversion', '2');
  const entityPayload = await fetchWikidataJson(entityUrl) as { entities?: Record<string, { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>> }> };
  const fileName = entityPayload.entities?.[match.id]?.claims?.P18
    ?.map((claim) => claim.mainsnak?.datavalue?.value)
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (!fileName) return [];
  const candidate = await fetchCommonsFileRest(`File:${fileName}`);
  if (!candidate || !isValidCommonsCandidate(candidate, 'portrait', player.canonical_name, player.aliases, player.source_team_name ?? undefined)) return [];
  return [{ ...candidate, wikidataEntityId: match.id, wikidataP18: true }];
}

async function main(): Promise<void> {
  const result = await pool.query<PlayerRow>(
    `WITH identity_members AS (
       SELECT e.id AS canonical_id, e.id AS member_id
       FROM entities e
       WHERE e.entity_type = 'player'
       UNION
       SELECT eil.canonical_entity_id, eil.source_entity_id
       FROM entity_identity_links eil
       JOIN entities canonical ON canonical.id = eil.canonical_entity_id
       WHERE canonical.entity_type = 'player'
     ), ranked AS (
       SELECT COALESCE(eil.canonical_entity_id, re.entity_id) AS entity_id,
              MIN(re.rank)::int AS best_rank,
              COUNT(DISTINCT rs.category_id)::int AS ranking_count
       FROM ranking_entries re
       JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
       JOIN entities source_entity ON source_entity.id = re.entity_id AND source_entity.entity_type = 'player'
       LEFT JOIN entity_identity_links eil ON eil.source_entity_id = re.entity_id
       WHERE re.rank <= 200
       GROUP BY COALESCE(eil.canonical_entity_id, re.entity_id)
     ), playable AS (
       SELECT DISTINCT COALESCE(eil.canonical_entity_id, egp.entity_id) AS entity_id
       FROM entity_game_profiles egp
       JOIN entities profile_entity ON profile_entity.id = egp.entity_id AND profile_entity.entity_type = 'player'
       LEFT JOIN entity_identity_links eil ON eil.source_entity_id = egp.entity_id
       WHERE egp.playable_default = TRUE
     )
     SELECT ranked.entity_id, e.canonical_name, ranked.best_rank, ranked.ranking_count,
            e.metadata->>'sourceTeamName' AS source_team_name,
            COALESCE(array_agg(DISTINCT aliases.alias) FILTER (WHERE aliases.alias IS NOT NULL), '{}') AS aliases
     FROM ranked
     JOIN playable ON playable.entity_id = ranked.entity_id
     JOIN entities e ON e.id = ranked.entity_id
       AND e.entity_type = 'player'
       AND e.catalog_status = 'active'
     LEFT JOIN identity_members ON identity_members.canonical_id = ranked.entity_id
     LEFT JOIN entity_aliases aliases ON aliases.entity_id = identity_members.member_id
     WHERE e.canonical_name <> ALL($1::text[])
       AND NOT EXISTS (
         SELECT 1
         FROM identity_members
         JOIN image_assets ia ON ia.entity_id = identity_members.member_id
         WHERE identity_members.canonical_id = ranked.entity_id
           AND ia.asset_kind = 'portrait'
           AND ia.review_status IN ('approved', 'pending', 'rejected')
       )
     GROUP BY ranked.entity_id, e.canonical_name, ranked.best_rank, ranked.ranking_count, e.metadata->>'sourceTeamName'
     ORDER BY ranked.ranking_count DESC, ranked.best_rank, e.canonical_name, ranked.entity_id
     LIMIT 20`,
    [excludedNames]
  );

  const retryManifestPath = process.argv.includes('--retry-manifest')
    ? process.argv[process.argv.indexOf('--retry-manifest') + 1]
    : undefined;
  let selectedRows = result.rows;
  if (retryManifestPath) {
    const retryManifest = JSON.parse(await readFile(resolve(retryManifestPath), 'utf8')) as {
      entries?: Array<{ entity_id?: string; error?: string }>;
    };
    const retryIds = new Set((retryManifest.entries ?? [])
      .filter((entry) => Boolean(entry.error) && entry.entity_id)
      .map((entry) => entry.entity_id as string));
    selectedRows = result.rows.filter((player) => retryIds.has(player.entity_id));
  }

  const entries: BatchEntry[] = [];
  for (const player of selectedRows) {
    try {
      let discovered: CommonsImageCandidate[];
      try {
        discovered = await searchWikidataLinkedPortraits(player.canonical_name, player.aliases, player.source_team_name ?? undefined, 5);
      } catch (error) {
        if (!retryManifestPath || !/rate limit|429|5\d\d/i.test(error instanceof Error ? error.message : String(error))) throw error;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000));
        discovered = await searchSingleExactP18(player);
      }
      const candidates = discovered.filter((candidate) => candidate.wikidataP18 === true
        && isValidCommonsCandidate(candidate, 'portrait', player.canonical_name, player.aliases, player.source_team_name ?? undefined));
      const discarded = discovered
        .filter((candidate) => !candidates.includes(candidate))
        .map((candidate) => ({
          title: candidate.title,
          sourceUrl: candidate.descriptionUrl,
          reason: candidate.wikidataP18 !== true
            ? 'No procede de una declaración P18 exacta de Wikidata.'
            : 'No supera la validación de retrato raster, dimensiones, URL, identidad o licencia explícita.'
        }));
      entries.push({ ...player, candidates, discarded });
    } catch (error) {
      entries.push({
        ...player,
        candidates: [],
        discarded: [],
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const outputPath = resolve(config.mediaCandidateRoot, `players-portrait-${Date.now()}-strict-batch.json`);
  await mkdir(resolve(config.mediaCandidateRoot), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({
    kind: 'portrait',
    generatedAt: new Date().toISOString(),
    selection: {
      maxEntries: 20,
      actualEntries: entries.length,
      rule: 'Jugadores jugables únicos en rankings activos (rank <= 200), sin ningún retrato approved/pending/rejected en su grupo de identidad.',
      excludedNames,
      discovery: 'Wikidata P18 exacto -> Wikimedia Commons',
      reviewStatus: 'pending only; no automatic approval'
    },
    entries,
    complete: entries.length === result.rows.length
  }, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    outputPath,
    selected: entries.length,
    candidates: entries.reduce((total, entry) => total + entry.candidates.length, 0),
    errors: entries.filter((entry) => entry.error).length,
    discarded: entries.reduce((total, entry) => total + entry.discarded.length, 0),
    players: entries.map((entry) => ({ entityId: entry.entity_id, name: entry.canonical_name, candidates: entry.candidates.length, error: entry.error }))
  }, null, 2));
}

main().finally(() => closeDb());
