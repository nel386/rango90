import assert from 'node:assert/strict';
import {
  buildNationalTeamOfficialAssistsRanking,
  fetchNationalTeamOfficialAssists,
  nationalTeamAssistsCategorySlug,
  nationalTeamAssistsDefinition,
  nationalTeamAssistSourceAssessment,
  nationalTeamAssistsScope,
  nationalTeamAssistsTargetSize,
  parseNationalTeamOfficialAssistsPage
} from '../providers/nationalTeamAssistsClient.js';

const fixture = `<html><body><table>
<tr><td></td><td>BEST&nbsp;&nbsp;ASSISTANTS</td><td>NATIONAL</td><td>TEAMS</td></tr>
<tr><td></td><td>Player</td><td>Team(s)</td><td>Career</td><td>Assists</td><td>Games</td></tr>
<tr><td>1</td><td>Lionel Messi</td><td>Argentina</td><td>2005-</td><td>60</td><td>195</td></tr>
<tr><td>2</td><td>Neymar</td><td>Brazil</td><td>2010-</td><td>58</td><td>128</td></tr>
<tr><td>3</td><td>Landon Donovan</td><td>USA</td><td>2000-2014</td><td>58</td><td>157</td></tr>
</table></body></html>`;

const payloadResponse = (html: string): Response => new Response(html, { status: 200 });

const parsed = parseNationalTeamOfficialAssistsPage(fixture);
assert.equal(parsed.length, 3);
assert.deepEqual(parsed.map((row) => [row.sourceRank, row.name, row.team, row.assists, row.games]), [
  [1, 'Lionel Messi', 'Argentina', 60, 195],
  [2, 'Neymar', 'Brazil', 58, 128],
  [3, 'Landon Donovan', 'USA', 58, 157]
]);
assert.match(parsed[0]?.externalId ?? '', /^iffhs-national-assists:[0-9a-f]{24}$/);

assert.equal(nationalTeamAssistSourceAssessment.some((source) => source.usableForTop200), false);
assert.ok(nationalTeamAssistSourceAssessment.some((source) => source.source === 'IFFHS' && source.coverage.includes('5')));
assert.ok(nationalTeamAssistSourceAssessment.some((source) => source.source === 'API-Football / API-Sports' && source.coverage.includes('selección')));

const built = buildNationalTeamOfficialAssistsRanking(parsed, {
  contentSha256: 'a'.repeat(64),
  allowPartialDraft: true,
  partialDraftReason: 'Fuente pública reconocida sin posiciones 6–200; se conserva únicamente el contenido verificable.'
});
assert.equal(built.entries.length, 3);
assert.equal(built.coverageComplete, false);
assert.equal(built.source.rightsStatus, 'review_required');
assert.equal(built.dataVersion, `iffhs-national-team-assists-${'a'.repeat(24)}`);
assert.equal(built.entries[0]?.evidence?.sourceContentSha256, 'a'.repeat(64));
assert.equal(Array.isArray(built.entries[0]?.evidence?.sourceAssessment), true);

assert.throws(
  () => buildNationalTeamOfficialAssistsRanking(parsed, { contentSha256: 'a'.repeat(64), coverageComplete: true }),
  /declara cobertura completa, pero solo contiene 3\/200/
);

assert.throws(
  () => buildNationalTeamOfficialAssistsRanking(parsed, { contentSha256: 'not-a-sha256' }),
  /cobertura insuficiente \(3\/200\)/
);

assert.throws(
  () => buildNationalTeamOfficialAssistsRanking(parsed, { contentSha256: 'a'.repeat(63), allowPartialDraft: true }),
  /contentSha256 debe ser un SHA-256/
);

await assert.rejects(
  () => fetchNationalTeamOfficialAssists({ fetchImpl: async () => payloadResponse(fixture) }),
  new RegExp(`cobertura insuficiente \\(3/${nationalTeamAssistsTargetSize}\\)`)
);

const partial = await fetchNationalTeamOfficialAssists({
  allowPartialDraft: true,
  fetchImpl: async () => payloadResponse(fixture)
});
assert.equal(partial.categorySlug, nationalTeamAssistsCategorySlug);
assert.equal(partial.source.key, 'iffhs-national-team-assists');
assert.equal(partial.source.sourceType, 'reference');
assert.equal(partial.coverageComplete, false);
assert.equal(partial.allowPartialDraft, true);
assert.equal(partial.entries.length, 3);
assert.equal(partial.entries[0]?.rawValue, 60);
assert.equal(partial.entries[0]?.evidence?.scope, nationalTeamAssistsScope);
assert.equal(partial.entries[0]?.evidence?.assistDefinition, nationalTeamAssistsDefinition);
assert.equal(partial.entries[0]?.evidence?.sourceRank, 1);

await assert.rejects(
  async () => parseNationalTeamOfficialAssistsPage(fixture.replace('58</td><td>128', '61</td><td>128')),
  /asistencias fuera de orden/
);
await assert.rejects(
  async () => parseNationalTeamOfficialAssistsPage(fixture.replace('<td>3</td><td>Landon Donovan', '<td>2</td><td>Landon Donovan')),
  /rango repetido o fuera de orden/
);
await assert.rejects(
  async () => parseNationalTeamOfficialAssistsPage('<table><tr><td>Player</td></tr></table>'),
  /no se encontró la tabla nacional publicada/
);

console.log('national-team-assists provider tests passed');
