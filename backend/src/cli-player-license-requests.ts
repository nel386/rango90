import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDb, pool } from './db.js';
import { config } from './config.js';

type PlayerRequest = {
  playerId: string;
  playerName: string;
  shortName: string | null;
  countryCode: string | null;
  bestRank: number;
  rankingCount: number;
  rankings: string[];
  requiredPermissionScope: string[];
  status: 'portrait_missing_legal_asset';
};

const outputVersion = 'player-portrait-license-requests-v1';
const permissionScope = [
  'commercial football game and gameplay',
  'web and PWA',
  'Android application',
  'backend storage and CDN/cache delivery',
  'resize/crop/convert to 512x512 WebP',
  'retention in immutable historical ranking snapshots',
  'worldwide distribution for the licence term',
  'player likeness/headshot publication clearance'
];

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function markdownCell(value: unknown): string {
  return String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

async function main(): Promise<void> {
  const outputDirectory = resolve(arg('output-dir') ?? config.mediaCandidateRoot);
  const outputBase = arg('output-base') ?? outputVersion;
  const requestedLimit = arg('limit');
  const limit = requestedLimit === undefined ? null : Number(requestedLimit);
  const priority = arg('priority') ?? 'rank';
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 10_000)) {
    throw new Error('--limit debe ser un entero entre 1 y 10000');
  }
  if (!['rank', 'reuse'].includes(priority)) {
    throw new Error('--priority debe ser rank o reuse');
  }
  const orderBy = priority === 'reuse'
    ? 'COUNT(DISTINCT rp.slug) DESC, MIN(rp.rank), e.canonical_name, e.id'
    : 'MIN(rp.rank), e.canonical_name, e.id';
  await mkdir(outputDirectory, { recursive: true });

  const result = await pool.query<{
    player_id: string;
    player_name: string;
    short_name: string | null;
    country_code: string | null;
    best_rank: number;
    ranking_count: number;
    rankings: string[];
  }>(
    `WITH RECURSIVE identity_walk AS (
       SELECT eil.source_entity_id, eil.canonical_entity_id,
              ARRAY[eil.source_entity_id, eil.canonical_entity_id]::text[] AS path
       FROM entity_identity_links eil
       UNION ALL
       SELECT iw.source_entity_id, eil.canonical_entity_id,
              iw.path || eil.canonical_entity_id
       FROM identity_walk iw
       JOIN entity_identity_links eil ON eil.source_entity_id = iw.canonical_entity_id
       WHERE NOT eil.canonical_entity_id = ANY(iw.path)
         AND cardinality(iw.path) < 20
     ), resolved_identity AS (
       SELECT DISTINCT ON (source_entity_id) source_entity_id, canonical_entity_id
       FROM identity_walk
       ORDER BY source_entity_id, cardinality(path) DESC
     ), latest AS (
       SELECT DISTINCT ON (rs.category_id)
              rs.id, c.slug
       FROM ranking_snapshots rs
       JOIN category_definitions c ON c.id = rs.category_id
       WHERE rs.status <> 'superseded' AND c.status <> 'retired'
       ORDER BY rs.category_id, rs.coverage_complete DESC, rs.generated_at DESC, rs.id DESC
     ), playable AS (
       SELECT DISTINCT COALESCE(ri.canonical_entity_id, egp.entity_id) AS entity_id
       FROM entity_game_profiles egp
       JOIN entities profile_entity ON profile_entity.id = egp.entity_id
       LEFT JOIN resolved_identity ri ON ri.source_entity_id = egp.entity_id
       WHERE profile_entity.entity_type = 'player' AND egp.playable_default = TRUE
     ), ranked_playable AS (
       SELECT COALESCE(ri.canonical_entity_id, re.entity_id) AS player_id,
              re.rank,
              latest.slug
       FROM latest
       JOIN ranking_entries re ON re.snapshot_id = latest.id AND re.rank <= 200
       JOIN entities source_entity ON source_entity.id = re.entity_id AND source_entity.entity_type = 'player'
       LEFT JOIN resolved_identity ri ON ri.source_entity_id = re.entity_id
       JOIN playable ON playable.entity_id = COALESCE(ri.canonical_entity_id, re.entity_id)
     ), legal_portraits AS (
       SELECT DISTINCT COALESCE(ri.canonical_entity_id, ia.entity_id) AS player_id
       FROM image_assets ia
       JOIN entities asset_entity ON asset_entity.id = ia.entity_id AND asset_entity.entity_type = 'player'
       LEFT JOIN resolved_identity ri ON ri.source_entity_id = ia.entity_id
       WHERE ia.asset_kind = 'portrait'
         AND ia.is_primary = TRUE
         AND ia.review_status = 'approved'
         AND ia.rights_basis <> 'unknown'
         AND ia.commercial_use = TRUE
         AND ia.rights_verified_at IS NOT NULL
         AND ia.rights_evidence_url IS NOT NULL
         AND jsonb_array_length(ia.usage_scope) > 0
         AND (ia.attribution_required = FALSE OR NULLIF(ia.attribution_text, '') IS NOT NULL)
     )
     SELECT e.id AS player_id,
            e.canonical_name AS player_name,
            e.short_name,
            e.country_code,
            MIN(rp.rank)::int AS best_rank,
            COUNT(DISTINCT rp.slug)::int AS ranking_count,
            ARRAY_AGG(DISTINCT rp.slug ORDER BY rp.slug) AS rankings
     FROM ranked_playable rp
     JOIN entities e ON e.id = rp.player_id AND e.catalog_status = 'active'
     LEFT JOIN legal_portraits lp ON lp.player_id = e.id
     WHERE lp.player_id IS NULL
     GROUP BY e.id, e.canonical_name, e.short_name, e.country_code
     ORDER BY ${orderBy}
     ${limit === null ? '' : 'LIMIT $1'}`,
    limit === null ? [] : [limit]
  );

  const players: PlayerRequest[] = result.rows.map((row) => ({
    playerId: row.player_id,
    playerName: row.player_name,
    shortName: row.short_name,
    countryCode: row.country_code,
    bestRank: row.best_rank,
    rankingCount: row.ranking_count,
    rankings: row.rankings,
    requiredPermissionScope: permissionScope,
    status: 'portrait_missing_legal_asset'
  }));

  const manifest = {
    version: outputVersion,
    generatedAt: new Date().toISOString(),
    purpose: 'Paquete exacto para solicitar una licencia de retratos de los jugadores jugables sin asset legal.',
    sourceQuery: `active non-superseded ranking entries rank <= 200 + playable profiles - approved publishable primary portraits; priority=${priority}${limit === null ? '' : `; limit=${limit}`}`,
    selectionRule: 'Una fila por jugador canónico; se conserva la mejor posición y la lista completa de rankings activos en los que aparece.',
    legalSafety: [
      'No modifica entidades, rankings ni image_assets.',
      'No aprueba ni descarga retratos.',
      'La lista no concede derechos: el proveedor debe identificar los IDs y conceder por escrito el alcance solicitado.',
      'Los rankings y el pool se resuelven por identidad canónica; no se duplican jugadores por proveedor.'
    ],
    count: players.length,
    priority,
    limit,
    permissionScope,
    players
  };

  const jsonPath = resolve(outputDirectory, `${outputBase}.json`);
  const csvPath = resolve(outputDirectory, `${outputBase}.csv`);
  const markdownPath = resolve(outputDirectory, `${outputBase}.md`);
  await writeFile(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const csvHeader = ['player_id', 'player_name', 'short_name', 'country_code', 'best_rank', 'ranking_count', 'rankings', 'status'].join(',');
  const csvRows = players.map((player) => [
    player.playerId,
    player.playerName,
    player.shortName,
    player.countryCode,
    player.bestRank,
    player.rankingCount,
    player.rankings.join(';'),
    player.status
  ].map(csvCell).join(','));
  await writeFile(csvPath, `${csvHeader}\n${csvRows.join('\n')}\n`, 'utf8');
  const markdownRows = players.map((player) => `| ${markdownCell(player.playerName)} | ${markdownCell(player.countryCode)} | ${player.bestRank} | ${player.rankingCount} | ${markdownCell(player.rankings.join(', '))} | ${player.playerId} |`);
  await writeFile(markdownPath, [
    `# ${outputVersion}`,
    '',
    `Generado: ${manifest.generatedAt}`,
    '',
    `Jugadores: **${players.length}**`,
    '',
    'Este expediente se genera desde PostgreSQL y sirve para solicitar una licencia de retratos. No modifica la base ni implica que exista autorización de publicación.',
    '',
    'Alcance que debe constar en el contrato:',
    '',
    ...permissionScope.map((item) => `- ${item}`),
    '',
    '| Jugador | País | Mejor posición | Rankings | Rankings activos | ID canónico |',
    '| --- | --- | ---: | ---: | --- | --- |',
    ...markdownRows,
    ''
  ].join('\n'), 'utf8');

  console.log(JSON.stringify({ outputVersion, generatedAt: manifest.generatedAt, count: players.length, jsonPath, csvPath, markdownPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => closeDb());
