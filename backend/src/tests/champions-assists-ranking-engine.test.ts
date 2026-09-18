import assert from 'node:assert/strict';
import {
  adaptApiFootballChampionsAssists,
  buildChampionsAssistsRanking,
  buildChampionsAssistsSnapshot,
  compareChampionsAssistsRankings,
  createChampionsAssistFact,
  importChampionsAssistsIdempotently,
  rollbackChampionsAssistsSnapshot
} from '../championsAssistsRankingEngine.js';
import { resolvePlayerIdentity, editionForSeason } from '../championsRankingEngine.js';
import type { ChampionsAssistFact } from '../championsAssistsRankingEngine.js';

const resolver = { sourceIds: { 'history:10': 'player:shared', 'api-football:20': 'player:shared', 'api-football:30': 'player:tie', 'api-football:31': 'player:second' }, displayNames: { 'player:shared': 'Shared Player', 'player:tie': 'Tie Player' } };
function fact(input: { season: number; sourceId: string; name: string; playerId?: string; phase?: ChampionsAssistFact['phase']; value?: number; record?: string }): ChampionsAssistFact {
  const player = resolvePlayerIdentity({ sourceKey: input.season < 1992 ? 'history' : 'api-football', sourcePlayerId: input.sourceId, displayName: input.name }, resolver);
  return createChampionsAssistFact({ edition: editionForSeason(input.season), player, match: { id: `match:${input.record ?? input.season}:${input.sourceId}`, date: `${input.season}-10-01`, homeTeam: 'Home', awayTeam: 'Away' }, eventId: `event:${input.record ?? input.season}:${input.sourceId}`, phase: input.phase ?? 'group', assists: input.value ?? 1, sourceKey: player.sourceKey.split(':')[0]!, sourceCaptureId: `capture:${input.season}`, sourceRecordId: input.record ?? `record:${input.season}:${input.sourceId}`, sourceType: 'primary', verificationStatus: 'confirmed', evidence: { sourceUrl: `https://fixture.example/${input.season}`, locator: `match=${input.season}` }, capturedAt: '2026-09-18T00:00:00Z' });
}

const facts = [
  fact({ season: 1955, sourceId: '10', name: 'Shared Player' }),
  fact({ season: 2025, sourceId: '20', name: 'Different Spelling' }),
  fact({ season: 2025, sourceId: '30', name: 'Tie Player', playerId: 'player:tie' }),
  fact({ season: 2025, sourceId: '31', name: 'Second Tie Player', playerId: 'player:second' }),
  fact({ season: 2025, sourceId: '32', name: 'Qualifier', phase: 'qualifying' }),
  fact({ season: 2025, sourceId: '33', name: 'Unknown Phase', phase: 'unknown' }),
  fact({ season: 2025, sourceId: '34', name: 'Unresolved Identity' })
];
const ranking = buildChampionsAssistsRanking({ facts, startSeason: 1955, endSeason: 2025, coverage: [{ sourceKey: 'fixture', coveredSeasons: [1955, 2025], missingSeasons: [], complete: true, reason: 'fixture' }] });
assert.equal(ranking.entries.find((entry) => entry.canonicalPlayerId === 'player:shared')?.rawValue, 2);
assert.equal(ranking.entries.filter((entry) => entry.rawValue === 1).length, 2);
assert.equal(ranking.excludedQualifyingFacts.length, 1);
assert.equal(ranking.excludedUnknownPhaseFacts.length, 1);
assert.equal(ranking.unresolvedIdentityFacts.length, 1);
assert.equal(ranking.conflicts.length, 0);

const imported = importChampionsAssistsIdempotently([], facts);
const repeated = importChampionsAssistsIdempotently(imported.facts, facts);
assert.equal(imported.added.length, facts.length);
assert.equal(repeated.added.length, 0);
assert.equal(repeated.skipped.length, facts.length);

const activeBefore = buildChampionsAssistsRanking({ facts: facts.filter((item) => item.edition.seasonStart === 2025).slice(0, 2), startSeason: 2025, endSeason: 2025, coverage: [{ sourceKey: 'fixture', coveredSeasons: [2025], missingSeasons: [], complete: true, reason: 'fixture' }] });
const activeAfter = buildChampionsAssistsRanking({ facts: facts.filter((item) => item.edition.seasonStart === 2025), startSeason: 2025, endSeason: 2025, coverage: [{ sourceKey: 'fixture', coveredSeasons: [2025], missingSeasons: [], complete: true, reason: 'fixture' }] });
assert.ok(compareChampionsAssistsRankings(activeBefore.entries, activeAfter.entries).length > 0);

const snapshot = buildChampionsAssistsSnapshot({ facts: facts.filter((item) => item.edition.seasonStart === 2025 && item.phase === 'group' && item.player.resolution !== 'normalized_name'), dataset: 'active_season_weekly', seasonStart: 2025, seasonEnd: 2025, coverage: [{ sourceKey: 'fixture', coveredSeasons: [2025], missingSeasons: [], complete: true, reason: 'fixture' }] });
assert.equal(snapshot.metadata.candidateStatus, 'candidate');
const rollback = rollbackChampionsAssistsSnapshot({ target: snapshot, parentSnapshotId: 'prior-snapshot', reason: 'test' });
assert.equal(rollback.snapshot.status, 'rolled_back');
assert.equal(rollback.snapshot.rollbackOf, snapshot.id);

const adaptation = adaptApiFootballChampionsAssists({ sourceCaptureId: 'api-capture', capturedAt: '2026-09-18T00:00:00Z', sourceUrl: 'https://fixture.example/api', matches: [{ fixture: { id: 1, date: '2026-09-01T20:00:00Z' }, league: { season: 2025, round: 'Group Stage' }, teams: { home: { name: 'Home' }, away: { name: 'Away' } }, events: [{ type: 'Goal', player: { id: 5, name: 'Scorer' }, assist: { id: 20, name: 'Different Spelling' } }, { type: 'Goal', detail: 'Own Goal', player: { id: 6, name: 'Defender' }, assist: { id: 20, name: 'Different Spelling' } }, { type: 'Goal', player: { id: 7, name: 'Uncredited' }, assist: null }] }] });
assert.equal(adaptation.facts.length, 1);
assert.equal(adaptation.uncreditedGoalEvents, 1);

console.log(JSON.stringify({ status: 'passed', test: 'champions-assists-ranking-engine', facts: facts.length, idempotent: repeated.added.length === 0, rollback: rollback.snapshot.status, apiFacts: adaptation.facts.length }, null, 2));
