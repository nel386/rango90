import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildPendingApiFootballProbe, sha256, stableJson, type ChampionsApiProbe } from '../championsSourceSelection.js';

type JsonRecord = Record<string, unknown>;
const root = resolve(process.cwd());
const outputRoot = resolve(root, 'audits/block7d');
const baseline = JSON.parse(await readFile(resolve(root, 'audits/block7b/champions-approval-dossier.json'), 'utf8')) as JsonRecord;
const ranking = (baseline.rankingChecks && typeof baseline.rankingChecks === 'object' ? baseline.rankingChecks : {}) as JsonRecord;
const baselineSnapshotId = typeof ranking.snapshotId === 'string' ? ranking.snapshotId : 'rs_870f1dff967bb160f2d132cc';
const baselineContentSha256 = typeof ranking.contentSha256 === 'string' ? ranking.contentSha256 : '870f1dff967bb160f2d132cc7d9ca1f2483b26d32681e6a55985efc744cc718b';
const apiKey = process.env.API_FOOTBALL_KEY?.trim() ?? '';
const baseUrl = (process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io').replace(/\/$/, '');
const timeoutMs = Math.min(Math.max(Number(process.env.API_FOOTBALL_TIMEOUT_MS ?? 15_000) || 15_000, 1_000), 60_000);

function digest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function objectValue(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function numberValue(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function stringValue(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }

async function get(path: string): Promise<{ status: number; body: JsonRecord }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, { headers: { 'x-apisports-key': apiKey, accept: 'application/json' }, signal: controller.signal });
    const body = await response.json() as unknown;
    return { status: response.status, body: objectValue(body) };
  } finally {
    clearTimeout(timeout);
  }
}

async function run(): Promise<ChampionsApiProbe> {
  if (!apiKey) return buildPendingApiFootballProbe({ baselineSnapshotId, baselineContentSha256 });
  const endpoints = ['/leagues?id=2'];
  try {
    const leagueResponse = await get('/leagues?id=2');
    const leagueRows = arrayValue(leagueResponse.body.response);
    const league = objectValue(leagueRows[0]);
    const seasons = arrayValue(league.seasons).map(objectValue).map((season) => numberValue(season.year)).filter((year): year is number => year !== undefined).sort((a, b) => a - b);
    const selectedSeasons = [...new Set([seasons[0], seasons.at(-1)])].filter((season): season is number => season !== undefined);
    const evidence: ChampionsApiProbe['responseEvidence'] = [{ endpoint: '/leagues?id=2', httpStatus: leagueResponse.status, responseSha256: digest({ responseCount: leagueRows.length, seasonYears: seasons }), rowCount: leagueRows.length }];
    const sample: ChampionsApiProbe['sample'] = [];
    for (const season of selectedSeasons) {
      const endpoint = `/players/topscorers?league=2&season=${season}`;
      endpoints.push(endpoint);
      const response = await get(endpoint);
      const rows = arrayValue(response.body.response);
      evidence.push({ endpoint, httpStatus: response.status, responseSha256: digest({ responseCount: rows.length, season }), rowCount: rows.length });
      for (const row of rows.slice(0, 20)) {
        const item = objectValue(row);
        const player = objectValue(item.player);
        const statistics = objectValue(arrayValue(item.statistics)[0]);
        const goals = objectValue(statistics.goals);
        const playerId = numberValue(player.id);
        const playerName = stringValue(player.name);
        const goalCount = numberValue(goals.total);
        if (playerId !== undefined && playerName && goalCount !== undefined) sample.push({ season, playerId, playerName, goals: goalCount });
      }
    }
    const base = {
      artifactKind: 'api_football_champions_probe' as const,
      reportVersion: '1' as const,
      provider: 'API-Football / API-Sports' as const,
      competition: { leagueId: 2 as const, slug: 'uefa-champions-league' as const, queriedOnly: true as const },
      status: 'passed' as const,
      reason: 'Prueba limitada completada; se consultó únicamente la competición Champions League. La muestra no certifica por sí sola la reconstrucción histórica completa ni derechos de publicación.',
      networkRequests: endpoints.length,
      databaseAccess: 'none' as const,
      mutationCount: 0 as const,
      imagesQueried: false as const,
      rawDataStored: false as const,
      planStatus: 'not_verified' as const,
      coverageAssessment: 'insufficient' as const,
      requestedEndpoints: endpoints,
      sample,
      comparison: { baselineSnapshotId, baselineContentSha256, status: 'completed' as const, differences: [{ playerName: 'all', detail: 'Comparación diferida: la muestra por temporada no es un ranking histórico acumulado equivalente al snapshot v2.' }] },
      responseEvidence: evidence,
      readyForApproval: false as const
    };
    return { ...base, sha256: sha256(stableJson(base)) };
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'api_request_timeout' : 'api_request_failed';
    const base = {
      artifactKind: 'api_football_champions_probe' as const,
      reportVersion: '1' as const,
      provider: 'API-Football / API-Sports' as const,
      competition: { leagueId: 2 as const, slug: 'uefa-champions-league' as const, queriedOnly: true as const },
      status: 'failed' as const,
      reason,
      networkRequests: endpoints.length,
      databaseAccess: 'none' as const,
      mutationCount: 0 as const,
      imagesQueried: false as const,
      rawDataStored: false as const,
      planStatus: 'not_verified' as const,
      coverageAssessment: 'failed' as const,
      requestedEndpoints: endpoints,
      sample: [],
      comparison: { baselineSnapshotId, baselineContentSha256, status: 'failed' as const, differences: [] },
      responseEvidence: [],
      readyForApproval: false as const
    };
    return { ...base, sha256: sha256(stableJson(base)) };
  }
}

const probe = await run();
await mkdir(outputRoot, { recursive: true });
const output = stableJson(probe);
await writeFile(resolve(outputRoot, 'api-football-champions-probe.json'), output, 'utf8');
console.log(JSON.stringify({ status: probe.status, networkRequests: probe.networkRequests, coverageAssessment: probe.coverageAssessment, readyForApproval: probe.readyForApproval, artifactSha256: sha256(output), output: 'audits/block7d/api-football-champions-probe.json' }, null, 2));
