import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const sourceFile = process.env.BLOCK45_SEASON_SIX_SOURCE_FILE;
const sourceReportFile = process.env.BLOCK45_SEASON_SIX_SOURCE_REPORT_FILE;
assert.ok(sourceFile && sourceReportFile, 'source checkpoint artifact paths are required for the isolated runner test');
const calls: string[] = [];
const server = createServer((request, response) => {
  calls.push(request.url ?? '');
  response.setHeader('content-type', 'application/json');
  response.setHeader('x-ratelimit-requests-limit', '7500');
  response.setHeader('x-ratelimit-requests-remaining', String(7500 - calls.length));
  response.setHeader('X-RateLimit-Limit', '600');
  response.setHeader('X-RateLimit-Remaining', String(600 - calls.length));
  if (request.url === '/status') {
    response.end(JSON.stringify({ errors: [], results: 0, response: [], paging: { current: 0, total: 0 } }));
    return;
  }
  if (request.url === '/players?league=94&season=2026&page=1') {
    response.end(JSON.stringify({ errors: [], results: 1, response: [{ player: { id: 990001, name: 'Portugal Fixture' }, statistics: [{ league: { id: 94, name: 'Primeira Liga', type: 'League', season: 2026 }, team: { id: 990, name: 'Porto Fixture' }, games: { appearences: 2 }, cards: { yellow: 3 } }] }], paging: { current: 1, total: 1 } }));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ errors: { route: 'unexpected' }, results: 0, response: [], paging: { current: 0, total: 0 } }));
});
await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
assert.ok(address && typeof address === 'object');
const tempOutput = await mkdtemp(join(tmpdir(), 'block45-season-six-runner-'));
try {
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/tools/block45-active-season-six.ts'], {
      cwd: resolve(process.cwd()),
      env: { ...process.env, API_FOOTBALL_KEY: 'mock-only-key', API_FOOTBALL_BASE_URL: `http://127.0.0.1:${address.port}`, BLOCK45_SEASON_SIX_TEST_ONLY: '', BLOCK45_SEASON_SIX_SOURCE_FILE: sourceFile, BLOCK45_SEASON_SIX_SOURCE_REPORT_FILE: sourceReportFile, BLOCK45_SEASON_SIX_SOURCE_RUN_ID: '36574961077', BLOCK45_SEASON_SIX_OUTPUT_ROOT: tempOutput, BLOCK45_SEASON_SIX_MAX_REQUESTS: '2', BLOCK45_SEASON_SIX_RESUME_FILE: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (part: string) => { stdout += part; });
    child.stderr.setEncoding('utf8').on('data', (part: string) => { stderr += part; });
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun({ code, stdout, stderr }));
  });
  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(await readFile(join(tempOutput, 'BLOCK45_ACTIVE_SEASON_SIX_REPORT.json'), 'utf8'));
  assert.equal(report.status, 'ready_for_isolated_validation', JSON.stringify(report));
  assert.deepEqual(calls, ['/status', '/players?league=94&season=2026&page=1'], 'one preflight then one missing page; no retry or repeated saved page');
  const candidate = JSON.parse(await readFile(join(tempOutput, 'BLOCK45_ACTIVE_SEASON_SIX_RANKING.json'), 'utf8'));
  assert.equal(report.oldCheckpointReconciliation.fiveLeagueFacts, 2586);
  assert.equal(report.oldCheckpointReconciliation.threeLeagueFacts, 1692);
  assert.equal(report.oldCheckpointReconciliation.otherTwoLeagueFacts, 894);
  assert.equal(report.pendingPrimeiraPages, 0);
  assert.equal(report.apiCallAttempts, 2);
  assert.equal(report.retryAttempts, 0);
  assert.equal(candidate.rankings.length, 6);
  assert.equal(candidate.rankings.find((league: { leagueId: number }) => league.leagueId === 94).rows[0].playerName, 'Portugal Fixture');
  assert.equal(candidate.rankings.find((league: { leagueId: number }) => league.leagueId === 94).rows[0].rank, 1);
  console.log('block45 active season six runner test passed');
} finally {
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  await rm(tempOutput, { recursive: true, force: true });
}
