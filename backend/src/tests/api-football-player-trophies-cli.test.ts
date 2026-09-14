import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const cliPath = resolve(process.cwd(), 'src/cli.ts');

function runWithOffset(offset: string) {
  return spawnSync(process.execPath, ['--import', 'tsx', cliPath, 'import-api-football-player-trophies', '--limit', '400', '--offset', offset], {
    encoding: 'utf8'
  });
}

const negativeOffset = runWithOffset('-1');
assert.notEqual(negativeOffset.status, 0);
assert.match(`${negativeOffset.stdout}\n${negativeOffset.stderr}`, /--offset >=0/);

const fractionalOffset = runWithOffset('1.5');
assert.notEqual(fractionalOffset.status, 0);
assert.match(`${fractionalOffset.stdout}\n${fractionalOffset.stderr}`, /--offset >=0/);

console.log('api-football player trophies CLI option tests passed');
