import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildLiveValidation, makeQuery, pendingChampionsApiValidation, renderChampionsApiValidationMarkdown, sha256, stableJson, type ApiQuery, type ChampionsApiValidation } from '../championsApiValidation.js';

type JsonRecord = Record<string, unknown>;
const root = resolve(process.cwd());
const outputRoot = resolve(root, 'audits/block7e');
const dossier = JSON.parse(await readFile(resolve(root, 'audits/block7b/champions-approval-dossier.json'), 'utf8')) as JsonRecord;
const ranking = dossier.rankingChecks && typeof dossier.rankingChecks === 'object' ? dossier.rankingChecks as JsonRecord : {};
const baselineSnapshotId = typeof ranking.snapshotId === 'string' ? ranking.snapshotId : 'rs_870f1dff967bb160f2d132cc';
const baselineContentSha256 = typeof ranking.contentSha256 === 'string' ? ranking.contentSha256 : '870f1dff967bb160f2d132cc7d9ca1f2483b26d32681e6a55985efc744cc718b';
const apiKey = process.env.API_FOOTBALL_KEY?.trim() ?? '';
const baseUrl = (process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io').replace(/\/$/, '');
const timeoutMs = Math.min(Math.max(Number(process.env.API_FOOTBALL_TIMEOUT_MS ?? 15_000) || 15_000, 1_000), 60_000);

function objectValue(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function numberValue(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function stringValue(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }

async function request(path: string): Promise<{ response: Response; body: JsonRecord }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, { headers: { 'x-apisports-key': apiKey, accept: 'application/json' }, signal: controller.signal });
    return { response, body: objectValue(await response.json()) };
  } finally {
    clearTimeout(timer);
  }
}

function playersFrom(body: JsonRecord): ApiQuery['players'] {
  return arrayValue(body.response).slice(0, 20).flatMap((row) => {
    const item = objectValue(row);
    const player = objectValue(item.player);
    const statistics = arrayValue(item.statistics).map(objectValue)[0] ?? {};
    const goals = objectValue(statistics.goals);
    const playerId = numberValue(player.id);
    const playerName = stringValue(player.name);
    const goalCount = numberValue(goals.total);
    return playerId !== undefined && playerName && goalCount !== undefined ? [{ playerId, playerName, goals: goalCount }] : [];
  });
}

async function run(): Promise<ChampionsApiValidation> {
  if (!apiKey) return pendingChampionsApiValidation({ baselineSnapshotId, baselineContentSha256 });
  const queries: ApiQuery[] = [];
  const leaguePath = '/leagues?id=2';
  try {
    const league = await request(leaguePath);
    const rows = arrayValue(league.body.response);
    const leagueRow = objectValue(rows[0]);
    const seasons = arrayValue(leagueRow.seasons).map(objectValue).map((season) => numberValue(season.year)).filter((year): year is number => year !== undefined).sort((a, b) => a - b);
    queries.push(makeQuery({ endpoint: leaguePath, response: league.response, body: league.body, rawResponseForHash: { status: league.response.status, results: league.body.results, seasons } , seasons }));
    const samples = [...new Set([seasons[0], seasons.at(-1)])].filter((season): season is number => season !== undefined);
    for (const season of samples) {
      const path = `/players/topscorers?league=2&season=${season}`;
      const result = await request(path);
      queries.push(makeQuery({ endpoint: path, response: result.response, body: result.body, rawResponseForHash: { status: result.response.status, season, results: result.body.results, players: playersFrom(result.body) }, players: playersFrom(result.body) }));
    }
    return buildLiveValidation({ queries, baselineSnapshotId, baselineContentSha256 });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'api_request_timeout' : 'api_request_failed';
    return buildLiveValidation({ queries: [...queries, { endpoint: 'request', httpStatus: null, ok: false, resultCount: null, errorCount: 1, responseSha256: null, dailyLimit: null, dailyRemaining: null, minuteLimit: null, minuteRemaining: null, seasons: [], players: [], errorCode: message }], baselineSnapshotId, baselineContentSha256 });
  }
}

const report = await run();
await mkdir(outputRoot, { recursive: true });
const json = stableJson(report);
await writeFile(resolve(outputRoot, 'champions-api-validation.json'), json, 'utf8');
await writeFile(resolve(outputRoot, 'champions-api-validation.md'), renderChampionsApiValidationMarkdown(report), 'utf8');
console.log(JSON.stringify({ status: report.status, networkRequests: report.networkRequests, seasons: report.seasonsAvailable.length, historicalWindowAssessment: report.historicalWindowAssessment, fullRankingReconstruction: report.fullRankingReconstruction, plan: report.plan.status, readyForApproval: report.readyForApproval, reportSha256: sha256(json), outputRoot }, null, 2));
