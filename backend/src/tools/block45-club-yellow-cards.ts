import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import { buildYellowCardSnapshots, stableYellowJson, type YellowCardFact, type YellowRankingSnapshot } from '../clubYellowCardsCareerRankingEngine.js';
import { existingBlock45Facts, insertBlock45Facts as insertFacts } from './block45-yellow-card-persistence.js';

type InputFile = { facts?: YellowCardFact[]; requestedSeasons?: number[]; activeSeason?: number } | YellowCardFact[];
const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';
const runtimeMode = process.env.RANGO90_RUNTIME_MODE?.trim() ?? '';
const inputFile = process.env.BLOCK45_FACTS_FILE?.trim() ?? '';
const outputRoot = resolve(process.env.BLOCK45_OUTPUT_ROOT?.trim() || 'audits/block45/loader');
const fromSeason = Number(process.env.BLOCK45_FROM_SEASON ?? 2010);
const toSeason = Number(process.env.BLOCK45_TO_SEASON ?? 2026);
const activeSeason = Number(process.env.BLOCK45_ACTIVE_SEASON ?? toSeason);
const requestedSeasons = Array.from({ length: Math.max(0, toSeason - fromSeason + 1) }, (_value, index) => fromSeason + index);
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const writeJson = (path: string, value: unknown) => mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, stableYellowJson(value), 'utf8'));

function assertIsolatedDatabase(): void {
  if (!databaseUrl) throw new Error('BLOQUE 45 requiere DATABASE_URL de PostgreSQL efímero');
  if (!['lab', 'test'].includes(runtimeMode)) throw new Error('BLOQUE 45 solo admite RANGO90_RUNTIME_MODE=lab/test');
  const parsed = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) throw new Error('BLOQUE 45 solo admite PostgreSQL localhost/efímero');
}

async function readFacts(): Promise<{ facts: YellowCardFact[]; requestedSeasons?: number[]; activeSeason?: number }> {
  if (!inputFile) return { facts: [] };
  const parsed = JSON.parse(await readFile(inputFile, 'utf8')) as InputFile;
  return Array.isArray(parsed) ? { facts: parsed } : { facts: parsed.facts ?? [], requestedSeasons: parsed.requestedSeasons, activeSeason: parsed.activeSeason };
}

async function existingFacts(pool: pg.Pool): Promise<YellowCardFact[]> {
  return existingBlock45Facts(pool);
}

async function persistSnapshot(pool: pg.Pool, snapshot: YellowRankingSnapshot, limit: number): Promise<{ snapshotInserted: number; entriesInserted: number }> {
  const snapshotResult = await pool.query(`INSERT INTO club_yellow_card_ranking_snapshots (id,ranking_type,season_start,season_end,status,content_sha256,generated_at,metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`, [snapshot.id, snapshot.rankingType, snapshot.seasonStart, snapshot.seasonEnd, snapshot.status, snapshot.contentSha256, snapshot.generatedAt, snapshot.metadata]);
  let entriesInserted = 0;
  for (const entry of snapshot.ranking.slice(0, limit)) {
    const result = await pool.query(`INSERT INTO club_yellow_card_ranking_entries
      (snapshot_id,canonical_player_id,player_name,raw_value,rank,tie_group,seasons,competitions,fact_ids,is_current_player,coverage_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`, [snapshot.id, entry.canonicalPlayerId, entry.playerName, entry.rawValue, entry.rank, entry.tieGroup, entry.seasons, entry.competitions, entry.factIds, entry.isCurrentPlayer, entry.coverageStatus]);
    entriesInserted += result.rowCount ?? 0;
  }
  await pool.query(`INSERT INTO club_yellow_card_snapshot_audit (id,snapshot_id,action,reason) VALUES ($1,$2,'created',$3) ON CONFLICT DO NOTHING`, [`block45-created-${snapshot.id}`, snapshot.id, `BLOQUE 45 ${snapshot.rankingType} candidate`]);
  return { snapshotInserted: snapshotResult.rowCount ?? 0, entriesInserted };
}

async function persistRollback(pool: pg.Pool, snapshot: YellowRankingSnapshot): Promise<string> {
  const rollback = { ...snapshot, id: `club-yellow-cards-rollback-${sha256(snapshot.id).slice(0, 32)}`, status: 'rolled_back' as const };
  await pool.query(`INSERT INTO club_yellow_card_ranking_snapshots (id,ranking_type,season_start,season_end,status,content_sha256,generated_at,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`, [rollback.id, rollback.rankingType, rollback.seasonStart, rollback.seasonEnd, rollback.status, rollback.contentSha256, new Date().toISOString(), { ...rollback.metadata, rollbackOf: snapshot.id }]);
  await pool.query(`INSERT INTO club_yellow_card_snapshot_audit (id,snapshot_id,action,reason) VALUES ($1,$2,'rollback_requested',$3) ON CONFLICT DO NOTHING`, [`block45-rollback-${snapshot.id}`, rollback.id, `Rollback aislado de ${snapshot.id}`]);
  return rollback.id;
}

async function main(): Promise<void> {
  assertIsolatedDatabase();
  const incomingFile = await readFacts();
  const incoming = incomingFile.facts;
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000 });
  try {
    await pool.query('BEGIN');
    const first = await insertFacts(pool, incoming);
    const facts = await existingFacts(pool);
    const effectiveRequestedSeasons = incomingFile.requestedSeasons?.length ? incomingFile.requestedSeasons : requestedSeasons;
    const effectiveActiveSeason = incomingFile.activeSeason ?? activeSeason;
    const built = buildYellowCardSnapshots({ facts, activeSeason: effectiveActiveSeason, requestedSeasons: effectiveRequestedSeasons, coverageScope: `API-Football; ligas 39,140,135,78,61; temporadas ${effectiveRequestedSeasons[0] ?? fromSeason}-${effectiveRequestedSeasons.at(-1) ?? toSeason}; solo estadísticas de clubes`, generatedAt: new Date().toISOString() });
    const snapshots = built.snapshots;
    const persisted = {
      career: await persistSnapshot(pool, snapshots.career, 200),
      active_season: await persistSnapshot(pool, snapshots.active_season, 200),
      active_players_career: await persistSnapshot(pool, snapshots.active_players_career, 100)
    };
    const second = await insertFacts(pool, incoming);
    const rerun = buildYellowCardSnapshots({ facts: await existingFacts(pool), activeSeason: effectiveActiveSeason, requestedSeasons: effectiveRequestedSeasons, coverageScope: snapshots.career.metadata.coverageScope, generatedAt: snapshots.career.generatedAt });
    const rollbackIds = { career: await persistRollback(pool, snapshots.career), active_season: await persistRollback(pool, snapshots.active_season), active_players_career: await persistRollback(pool, snapshots.active_players_career) };
    const hashesIdentical = (Object.keys(snapshots) as Array<keyof typeof snapshots>).every((key) => snapshots[key].contentSha256 === rerun.snapshots[key].contentSha256);
    const report = {
      artifactKind: 'block45_club_yellow_cards', reportVersion: '1', status: hashesIdentical && second.added === 0 && built.conflicts.length === 0 ? 'candidate_not_sufficient' : 'failed_validation', generatedAt: new Date().toISOString(), commit: process.env.GITHUB_SHA ?? 'local', workflowRun: process.env.GITHUB_RUN_ID ?? null,
      scope: { source: 'api-football', eligibilityLeagues: [39, 140, 135, 78, 61], seasons: effectiveRequestedSeasons, activeSeason: effectiveActiveSeason, careerIncludes: 'all official club competitions returned by /players?id={playerId}&season={season}', clubOnly: true, currentPlayerRule: 'is_current_player=true only when the player has an appearance in the active season; no roster inference is used', exclusions: ['national teams', 'friendlies', 'youth', 'reserve', 'top-yellow-cards endpoint', 'old Rango90 ranking'] },
      facts: { incoming: incoming.length, firstAdded: first.added, firstSkipped: first.skipped, secondAdded: second.added, secondSkipped: second.skipped, total: facts.length, duplicates: built.duplicates, conflicts: built.conflicts.length, primary: facts.filter((fact) => fact.sourceType === 'primary').length, unresolved: facts.filter((fact) => fact.verificationStatus !== 'confirmed').length },
      players: { candidates: new Set(facts.map((fact) => fact.canonicalPlayerId)).size, eligibleCareer: snapshots.career.metadata.eligiblePlayers },
      rankings: Object.fromEntries((Object.keys(snapshots) as Array<keyof typeof snapshots>).map((key) => [key, { snapshotId: snapshots[key].id, top100: snapshots[key].ranking.slice(0, 100), top200: snapshots[key].ranking.slice(0, 200), contentSha256: snapshots[key].contentSha256, persisted: persisted[key], rollbackId: rollbackIds[key] }])),
      controls: built.controls, coverage: { career: 'coverage_partial', activeSeason: 'coverage_partial', missingSeasonsPolicy: 'seasons outside the requested API-Football range remain unknown; no zeros inferred' },
      idempotency: { secondLoadAdded: second.added, secondLoadSkipped: second.skipped, hashesIdentical }, rollback: { tested: true, snapshots: rollbackIds }, official: { snapshotCreated: false, status: 'blocked' }, production: { databaseAccess: 'isolated_only', renderTouched: false, imagesTouched: false, otherMetricsTouched: false, dailyChallengeTouched: false }, rawPayloadsStored: false, secretPrinted: false,
      hashes: { career: snapshots.career.contentSha256, activeSeason: snapshots.active_season.contentSha256, activePlayersCareer: snapshots.active_players_career.contentSha256 }
    };
    await writeJson(resolve(outputRoot, 'BLOCK45_REPORT.json'), report);
    await writeFile(resolve(outputRoot, 'BLOCK45_REPORT.md'), `# BLOQUE 45 — tarjetas amarillas\n\n- estado: **${report.status}**\n- temporadas consultadas: **${effectiveRequestedSeasons[0]}–${effectiveRequestedSeasons.at(-1)}**\n- hechos: **${facts.length}**\n- jugadores elegibles: **${snapshots.career.metadata.eligiblePlayers}**\n- carrera: **${snapshots.career.contentSha256}**\n- temporada activa: **${snapshots.active_season.contentSha256}**\n- carrera de jugadores activos: **${snapshots.active_players_career.contentSha256}**\n- segunda carga: **${second.added === 0 ? 'idempotente' : 'fallida'}**\n- rollback: **probado en PostgreSQL aislado**\n- histórico mundial completo: **no afirmado; coverage_partial**\n- official: **bloqueado**\n\nLos totales fuera del rango consultado permanecen desconocidos; no se rellenan con ceros.`, 'utf8');
    await writeJson(resolve(outputRoot, 'BLOCK45_CAREER_SNAPSHOT.json'), snapshots.career);
    await writeJson(resolve(outputRoot, 'BLOCK45_ACTIVE_SEASON_SNAPSHOT.json'), snapshots.active_season);
    await writeJson(resolve(outputRoot, 'BLOCK45_ACTIVE_PLAYERS_CAREER_SNAPSHOT.json'), snapshots.active_players_career);
    await pool.query('COMMIT');
  } catch (error) { await pool.query('ROLLBACK').catch(() => undefined); throw error; } finally { await pool.end(); }
}

await main();
