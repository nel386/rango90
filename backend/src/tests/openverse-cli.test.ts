import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const cliPath = resolve(process.cwd(), 'src/cli.ts');
const env = {
  ...process.env,
  OPENVERSE_CLIENT_ID: '',
  OPENVERSE_CLIENT_SECRET: ''
};

function run(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', cliPath, 'stage-openverse-playable-portraits', ...args], {
    encoding: 'utf8',
    env
  });
}

const oversizedAnonymousBatch = run(['--limit', '21', '--concurrency', '1']);
assert.notEqual(oversizedAnonymousBatch.status, 0);
assert.match(`${oversizedAnonymousBatch.stdout}\n${oversizedAnonymousBatch.stderr}`, /máximo 20 jugadores/u);

const concurrentAnonymousBatch = run(['--limit', '20', '--concurrency', '2']);
assert.notEqual(concurrentAnonymousBatch.status, 0);
assert.match(`${concurrentAnonymousBatch.stdout}\n${concurrentAnonymousBatch.stderr}`, /concurrencia de 1/u);

console.log('openverse anonymous CLI guard tests passed');
