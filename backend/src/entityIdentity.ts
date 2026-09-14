import type { PoolClient } from 'pg';

export type IdentityEntityType = 'player' | 'club' | 'national_team';

type Candidate = {
  id: string;
  canonical_name: string;
  birth_date: string | null;
  aliases: string[];
};

// Candidate entities do not change during one consolidation transaction.
// Cache the expensive catalog scan once per entity type/prefix; identity links
// are still read on every call because the loop may add links.
const candidatePoolCache = new Map<string, Promise<Candidate[]>>();

export function normalizeIdentityName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeIdentityBirthDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export async function resolveCanonicalEntityId(client: PoolClient, entityId: string): Promise<string> {
  let current = entityId;
  const visited = new Set<string>();
  for (let depth = 0; depth < 5; depth += 1) {
    if (visited.has(current)) {
      throw new Error(`Ciclo de identidades detectado para ${entityId}`);
    }
    visited.add(current);
    const result = await client.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [current]
    );
    const next = result.rows[0]?.canonical_entity_id;
    if (!next || next === current) return current;
    current = next;
  }
  throw new Error(`Cadena de identidades demasiado larga para ${entityId}`);
}

export async function findUniqueCanonicalEntity(
  client: PoolClient,
  entityType: IdentityEntityType,
  providerEntityPrefix: string,
  name: string,
  birthDate?: string | null,
  preferredEntityPrefix?: string
): Promise<string | null> {
  const normalizedName = normalizeIdentityName(name);
  if (!normalizedName) return null;

  const candidatePoolKey = `${entityType}:${providerEntityPrefix}`;
  let candidatePool = candidatePoolCache.get(candidatePoolKey);
  if (!candidatePool) {
    candidatePool = client.query<Candidate>(
      `SELECT e.id, e.canonical_name, e.birth_date,
              COALESCE(array_agg(a.alias) FILTER (WHERE a.alias IS NOT NULL), '{}') AS aliases
       FROM entities e
       LEFT JOIN entity_aliases a ON a.entity_id = e.id
       WHERE e.entity_type = $1 AND e.id NOT LIKE $2
       GROUP BY e.id, e.canonical_name, e.birth_date`,
      [entityType, `${providerEntityPrefix}%`]
    ).then((result) => result.rows);
    candidatePoolCache.set(candidatePoolKey, candidatePool);
  }
  const candidates = await candidatePool;
  const comparableBirthDate = normalizeIdentityBirthDate(birthDate);
  const matches = candidates.filter((candidate) => {
    const names = [candidate.canonical_name, ...(candidate.aliases ?? [])];
    if (!names.some((candidateName) => normalizeIdentityName(candidateName) === normalizedName)) return false;
    const candidateBirthDate = normalizeIdentityBirthDate(candidate.birth_date);
    if (comparableBirthDate && candidateBirthDate) {
      return comparableBirthDate === candidateBirthDate;
    }
    return true;
  });
  if (matches.length === 0) return null;

  // A provider can already have been consolidated into another provider's
  // canonical record. Compare resolved identities, not raw rows: otherwise a
  // source row plus its already-linked alias makes an unambiguous person look
  // like a homonym and prevents the next provider from being linked. This was
  // observable with StatBunker Messi (StatBunker + RSSSF + France Football).
  const links = await client.query<{ source_entity_id: string; canonical_entity_id: string }>(
    'SELECT source_entity_id, canonical_entity_id FROM entity_identity_links WHERE source_entity_id = ANY($1::text[])',
    [matches.map((candidate) => candidate.id)]
  );
  const linkedBySource = new Map(links.rows.map((link) => [link.source_entity_id, link.canonical_entity_id]));
  const resolvedIds = new Map(matches.map((candidate) => [candidate.id, linkedBySource.get(candidate.id) ?? candidate.id]));
  const preferredMatches = preferredEntityPrefix
    ? [...new Set(matches
      .filter((candidate) => candidate.id.startsWith(preferredEntityPrefix))
      .map((candidate) => resolvedIds.get(candidate.id) ?? candidate.id))]
    : [];
  if (preferredMatches.length === 1) return preferredMatches[0] ?? null;

  const uniqueResolvedIds = [...new Set(resolvedIds.values())];
  return uniqueResolvedIds.length === 1 ? uniqueResolvedIds[0] ?? null : null;
}

export async function recordIdentityLink(
  client: PoolClient,
  sourceEntityId: string,
  canonicalEntityId: string,
  sourceKey: string,
  reason: string,
  sourceSnapshotId?: string | null
): Promise<void> {
  if (sourceEntityId === canonicalEntityId) return;
  const resolvedCanonicalEntityId = await resolveCanonicalEntityId(client, canonicalEntityId);
  if (resolvedCanonicalEntityId === sourceEntityId) {
    throw new Error(`El enlace de identidad crearía un ciclo: ${sourceEntityId} -> ${canonicalEntityId}`);
  }
  await client.query(
    `INSERT INTO entity_identity_links
       (source_entity_id, canonical_entity_id, confidence, reason, source_key, source_snapshot_id)
     VALUES ($1, $2, 'high', $3, $4, $5)
     ON CONFLICT (source_entity_id) DO UPDATE SET
       canonical_entity_id = EXCLUDED.canonical_entity_id,
       confidence = EXCLUDED.confidence,
       reason = EXCLUDED.reason,
       source_key = EXCLUDED.source_key,
       source_snapshot_id = EXCLUDED.source_snapshot_id,
       updated_at = NOW()`,
    [sourceEntityId, resolvedCanonicalEntityId, reason, sourceKey, sourceSnapshotId ?? null]
  );
}

type SeasonStat = {
  competition_id: string;
  season_year: number;
  provider_team_id: number;
  team_entity_id: string | null;
  appearances: number | null;
  minutes: number | null;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  clean_sheets: number | null;
  goals_conceded: number | null;
  source_key: string;
  source_snapshot_id: string;
  metadata: Record<string, unknown>;
};

export async function moveEntityDataToCanonical(
  client: PoolClient,
  sourceEntityId: string,
  canonicalEntityId: string
): Promise<{
  stats: number;
  assets: number;
  aliases: number;
  externalIds: number;
  profiles: number;
  rankings: number;
  facts: number;
  honours: number;
  awards: number;
  challengeItems: number;
  matchStats: number;
  matches: number;
}> {
  const rankingRows = await client.query<{
    snapshot_id: string;
    raw_value: string;
    rank: number;
    score_value: number;
    tie_group: number;
    source_rank: number | null;
    ranking_position: number | null;
    entry_order: number | null;
    evidence: Record<string, unknown>;
  }>(
    `SELECT snapshot_id, raw_value, rank, score_value, tie_group,
            source_rank, ranking_position, entry_order, evidence
     FROM ranking_entries WHERE entity_id = $1`,
    [sourceEntityId]
  );
  for (const ranking of rankingRows.rows) {
    const conflict = await client.query(
      `SELECT 1 FROM ranking_entries
       WHERE snapshot_id = $1 AND entity_id = $2
         AND (raw_value <> $3 OR rank <> $4 OR score_value <> $5 OR tie_group <> $6 OR evidence <> $7::jsonb)`,
      [ranking.snapshot_id, canonicalEntityId, ranking.raw_value, ranking.rank, ranking.score_value, ranking.tie_group, JSON.stringify(ranking.evidence)]
    );
    if (conflict.rows[0]) throw new Error(`Conflicto de ranking al consolidar ${sourceEntityId} en ${canonicalEntityId} (${ranking.snapshot_id})`);
    await client.query(
      `DELETE FROM ranking_entries
       WHERE snapshot_id = $1 AND entity_id = $2`,
      [ranking.snapshot_id, sourceEntityId]
    );
    await client.query(
      `INSERT INTO ranking_entries
         (snapshot_id, entity_id, raw_value, rank, score_value, tie_group, evidence,
          source_rank, ranking_position, entry_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (snapshot_id, entity_id) DO NOTHING`,
      [ranking.snapshot_id, canonicalEntityId, ranking.raw_value, ranking.rank, ranking.score_value, ranking.tie_group, JSON.stringify(ranking.evidence), ranking.source_rank, ranking.ranking_position, ranking.entry_order]
    );
  }

  const facts = await client.query(
    `UPDATE fact_assertions SET subject_entity_id = $2
     WHERE subject_entity_id = $1`,
    [sourceEntityId, canonicalEntityId]
  );
  const honours = await client.query(
    `UPDATE honours SET winner_entity_id = $2
     WHERE winner_entity_id = $1`,
    [sourceEntityId, canonicalEntityId]
  );

  const awards = await client.query<{ id: string; award_key: string; award_year: number }>(
    `SELECT id, award_key, award_year FROM awards WHERE winner_entity_id = $1`,
    [sourceEntityId]
  );
  for (const award of awards.rows) {
    const conflict = await client.query<{ winner_entity_id: string }>(
      `SELECT winner_entity_id FROM awards
       WHERE award_key = $1 AND award_year = $2 AND id <> $3`,
      [award.award_key, award.award_year, award.id]
    );
    if (conflict.rows[0] && conflict.rows[0].winner_entity_id !== canonicalEntityId) {
      throw new Error(`Conflicto de premio al consolidar ${sourceEntityId} en ${canonicalEntityId}`);
    }
    if (conflict.rows[0]) await client.query('DELETE FROM awards WHERE id = $1', [award.id]);
    else await client.query('UPDATE awards SET winner_entity_id = $2 WHERE id = $1', [award.id, canonicalEntityId]);
  }

  const challengeItems = await client.query<{ challenge_id: string; ordinal: number; correct_rank: number; score_value: number }>(
    `SELECT challenge_id, ordinal, correct_rank, score_value
     FROM challenge_items WHERE entity_id = $1`,
    [sourceEntityId]
  );
  for (const item of challengeItems.rows) {
    const conflict = await client.query<{ correct_rank: number; score_value: number }>(
      `SELECT correct_rank, score_value FROM challenge_items
       WHERE challenge_id = $1 AND entity_id = $2`,
      [item.challenge_id, canonicalEntityId]
    );
    if (conflict.rows[0] && (conflict.rows[0].correct_rank !== item.correct_rank || conflict.rows[0].score_value !== item.score_value)) {
      throw new Error(`Conflicto de reto al consolidar ${sourceEntityId} en ${canonicalEntityId}`);
    }
    if (conflict.rows[0]) await client.query('DELETE FROM challenge_items WHERE challenge_id = $1 AND entity_id = $2', [item.challenge_id, sourceEntityId]);
    else await client.query('UPDATE challenge_items SET entity_id = $2 WHERE challenge_id = $1 AND entity_id = $3', [item.challenge_id, canonicalEntityId, sourceEntityId]);
  }

  const matchStats = await client.query<Record<string, unknown>>(
    `SELECT * FROM match_player_stats WHERE player_id = $1`,
    [sourceEntityId]
  );
  for (const stat of matchStats.rows) {
    const conflict = await client.query<Record<string, unknown>>(
      `SELECT match_id, team_id, started, minutes, goals, assists, yellow_cards, second_yellows,
              direct_red_cards, clean_sheet, goals_conceded, is_goalkeeper, source_key,
              source_snapshot_id, metadata
       FROM match_player_stats WHERE match_id = $1 AND player_id = $2`,
      [stat.match_id, canonicalEntityId]
    );
    const comparable = ['team_id', 'started', 'minutes', 'goals', 'assists', 'yellow_cards', 'second_yellows', 'direct_red_cards', 'clean_sheet', 'goals_conceded', 'is_goalkeeper', 'source_key', 'source_snapshot_id', 'metadata'];
    const existingMatchStat = conflict.rows[0];
    if (existingMatchStat && comparable.some((field) => JSON.stringify(existingMatchStat[field]) !== JSON.stringify(stat[field]))) {
      throw new Error(`Conflicto de estadísticas de partido al consolidar ${sourceEntityId} en ${canonicalEntityId}`);
    }
    if (existingMatchStat) await client.query('DELETE FROM match_player_stats WHERE match_id = $1 AND player_id = $2', [stat.match_id, sourceEntityId]);
    else await client.query('UPDATE match_player_stats SET player_id = $2 WHERE match_id = $1 AND player_id = $3', [stat.match_id, canonicalEntityId, sourceEntityId]);
  }

  const matches = await client.query(
    `UPDATE matches
     SET home_entity_id = CASE WHEN home_entity_id = $1 THEN $2 ELSE home_entity_id END,
         away_entity_id = CASE WHEN away_entity_id = $1 THEN $2 ELSE away_entity_id END
     WHERE home_entity_id = $1 OR away_entity_id = $1`,
    [sourceEntityId, canonicalEntityId]
  );

  const stats = await client.query<SeasonStat>(
    `SELECT competition_id, season_year, provider_team_id, team_entity_id, appearances, minutes,
            goals, assists, yellow_cards, red_cards, clean_sheets, goals_conceded,
            source_key, source_snapshot_id, metadata
     FROM player_season_stats WHERE entity_id = $1`,
    [sourceEntityId]
  );
  for (const stat of stats.rows) {
    const conflict = await client.query<SeasonStat>(
      `SELECT competition_id, season_year, provider_team_id, team_entity_id, appearances, minutes,
              goals, assists, yellow_cards, red_cards, clean_sheets, goals_conceded,
              source_key, source_snapshot_id, metadata
       FROM player_season_stats
       WHERE entity_id = $1 AND competition_id = $2 AND season_year = $3 AND provider_team_id = $4`,
      [canonicalEntityId, stat.competition_id, stat.season_year, stat.provider_team_id]
    );
    if (conflict.rows[0]) {
      const existing = conflict.rows[0];
      const sameFacts = ['appearances', 'minutes', 'goals', 'assists', 'yellow_cards', 'red_cards', 'clean_sheets', 'goals_conceded']
        .every((field) => existing[field as keyof SeasonStat] === stat[field as keyof SeasonStat]);
      if (!sameFacts) throw new Error(`Conflicto de estadísticas al consolidar ${sourceEntityId} en ${canonicalEntityId}`);
      await client.query(
        `DELETE FROM player_season_stats
         WHERE entity_id = $1 AND competition_id = $2 AND season_year = $3 AND provider_team_id = $4`,
        [sourceEntityId, stat.competition_id, stat.season_year, stat.provider_team_id]
      );
    } else {
      await client.query(
        `UPDATE player_season_stats SET entity_id = $2
         WHERE entity_id = $1 AND competition_id = $3 AND season_year = $4 AND provider_team_id = $5`,
        [sourceEntityId, canonicalEntityId, stat.competition_id, stat.season_year, stat.provider_team_id]
      );
    }
  }
  await client.query(
    `UPDATE player_season_stats p
     SET team_entity_id = l.canonical_entity_id
     FROM entity_identity_links l
     WHERE p.entity_id = $1 AND p.team_entity_id = l.source_entity_id`,
    [canonicalEntityId]
  );

  const externalIds = await client.query<{ source_key: string; entity_type: IdentityEntityType; external_id: string }>(
    `SELECT source_key, entity_type, external_id FROM entity_external_ids WHERE entity_id = $1`,
    [sourceEntityId]
  );
  for (const external of externalIds.rows) {
    const conflict = await client.query(
      `SELECT entity_id FROM entity_external_ids
       WHERE source_key = $1 AND entity_type = $2 AND external_id = $3 AND entity_id <> $4`,
      [external.source_key, external.entity_type, external.external_id, sourceEntityId]
    );
    if (conflict.rows[0] && conflict.rows[0].entity_id !== canonicalEntityId) {
      throw new Error(`Conflicto de identificador externo al consolidar ${sourceEntityId}: ${external.source_key}/${external.external_id}`);
    }
    if (conflict.rows[0]?.entity_id === canonicalEntityId) {
      await client.query(
        `DELETE FROM entity_external_ids
         WHERE entity_id = $1 AND source_key = $2 AND entity_type = $3 AND external_id = $4`,
        [sourceEntityId, external.source_key, external.entity_type, external.external_id]
      );
      continue;
    }
    await client.query(
      `UPDATE entity_external_ids SET entity_id = $2, updated_at = NOW()
       WHERE entity_id = $1 AND source_key = $3 AND entity_type = $4 AND external_id = $5`,
      [sourceEntityId, canonicalEntityId, external.source_key, external.entity_type, external.external_id]
    );
  }

  const aliases = await client.query<{ alias: string; source_key: string | null }>(
    'SELECT alias, source_key FROM entity_aliases WHERE entity_id = $1', [sourceEntityId]
  );
  for (const alias of aliases.rows) {
    await client.query(
      `INSERT INTO entity_aliases (entity_id, alias, source_key) VALUES ($1, $2, $3)
       ON CONFLICT (entity_id, alias) DO NOTHING`,
      [canonicalEntityId, alias.alias, alias.source_key]
    );
  }
  await client.query('DELETE FROM entity_aliases WHERE entity_id = $1', [sourceEntityId]);

  const profile = await client.query('SELECT 1 FROM entity_game_profiles WHERE entity_id = $1', [sourceEntityId]);
  if (profile.rows[0]) {
    const targetProfile = await client.query('SELECT 1 FROM entity_game_profiles WHERE entity_id = $1', [canonicalEntityId]);
    if (targetProfile.rows[0]) await client.query('DELETE FROM entity_game_profiles WHERE entity_id = $1', [sourceEntityId]);
    else await client.query('UPDATE entity_game_profiles SET entity_id = $2 WHERE entity_id = $1', [sourceEntityId, canonicalEntityId]);
  }

  const assets = await client.query<{ id: string; is_primary: boolean }>('SELECT id, is_primary FROM image_assets WHERE entity_id = $1', [sourceEntityId]);
  for (const asset of assets.rows) {
    if (asset.is_primary) {
      const targetPrimary = await client.query('SELECT 1 FROM image_assets WHERE entity_id = $1 AND is_primary = TRUE', [canonicalEntityId]);
      if (targetPrimary.rows[0]) await client.query('UPDATE image_assets SET is_primary = FALSE WHERE id = $1', [asset.id]);
    }
    await client.query('UPDATE image_assets SET entity_id = $2 WHERE id = $1', [asset.id, canonicalEntityId]);
  }

  await client.query(
    `UPDATE entities SET metadata = metadata || jsonb_build_object('identityStatus', 'redirect', 'canonicalEntityId', $2::text), updated_at = NOW()
     WHERE id = $1`, [sourceEntityId, canonicalEntityId]
  );
  return {
    stats: stats.rowCount ?? 0,
    assets: assets.rowCount ?? 0,
    aliases: aliases.rowCount ?? 0,
    externalIds: externalIds.rowCount ?? 0,
    profiles: profile.rowCount ?? 0,
    rankings: rankingRows.rowCount ?? 0,
    facts: facts.rowCount ?? 0,
    honours: honours.rowCount ?? 0,
    awards: awards.rowCount ?? 0,
    challengeItems: challengeItems.rowCount ?? 0,
    matchStats: matchStats.rowCount ?? 0,
    matches: matches.rowCount ?? 0
  };
}
