import assert from 'node:assert/strict';
import { buildYellowCardSnapshots, deduplicateYellowFacts, type YellowCardFact } from '../clubYellowCardsCareerRankingEngine.js';

const fact = (id: string, name: string, player: string, season: number, yellow: number, appearances = 20, league = 39): YellowCardFact => ({
  id, sourcePlayerId: player, playerNameOriginal: name, canonicalPlayerId: `api-football:player:${player}`, canonicalName: name, clubProviderId: 10, clubName: 'Fixture FC', competitionProviderId: league, competitionName: 'Premier League', competitionType: 'official_club_competition', eligibilityMajorLeagueId: league, seasonStart: season, appearances, minutes: appearances * 90, yellowCards: yellow, sourceKey: 'api-football', sourceUrl: `https://v3.football.api-sports.io/players?league=${league}&season=${season}&page=1`, sourcePage: 1, locator: `fixture.${id}`, responseSha256: `hash-${id}`, capturedAt: '2026-09-22T00:00:00.000Z', sourceType: 'primary', verificationStatus: 'confirmed', coverageStatus: 'coverage_partial'
});

const facts = [
  fact('marcos-2010', 'Marcos Alonso', '1', 2010, 10), fact('marcos-2026', 'Marcos Alonso', '1', 2026, 2),
  fact('raul-2010', 'Raúl García', '2', 2010, 8), fact('raul-2026', 'Raúl García', '2', 2026, 3),
  fact('lopo-2010', 'Alberto Lopo', '3', 2010, 7), fact('lopo-2011', 'Alberto Lopo', '3', 2011, 6),
  fact('ramos-2010', 'Sergio Ramos', '4', 2010, 5), fact('ramos-2026', 'Sergio Ramos', '4', 2026, 1),
  fact('busquets-2010', 'Sergio Busquets', '5', 2010, 4), fact('busquets-2026', 'Sergio Busquets', '5', 2026, 2),
  fact('parejo-2010', 'Dani Parejo', '6', 2010, 3), fact('parejo-2026', 'Dani Parejo', '6', 2026, 2),
  fact('single-season', 'Single Season', '7', 2026, 99),
  fact('split-2010', 'Split League Player', '8', 2010, 20, 20, 39), fact('split-2011', 'Split League Player', '8', 2011, 20, 20, 140),
  fact('marcos-2026', 'Marcos Alonso', '1', 2026, 2)
];

const deduped = deduplicateYellowFacts(facts);
assert.equal(deduped.duplicates, 1);
assert.equal(deduped.conflicts.length, 0);

const result = buildYellowCardSnapshots({ facts, activeSeason: 2026, requestedSeasons: [2010, 2011, 2026], coverageScope: 'fixture five major leagues' });
const marcosCareer = result.snapshots.career.ranking.find((entry) => entry.playerName === 'Marcos Alonso');
const marcosActive = result.snapshots.active_season.ranking.find((entry) => entry.playerName === 'Marcos Alonso');
const marcosActiveCareer = result.snapshots.active_players_career.ranking.find((entry) => entry.playerName === 'Marcos Alonso');
if (!marcosCareer || !marcosActive || !marcosActiveCareer) throw new Error('Marcos Alonso fixture missing from expected snapshots');
assert.equal(marcosCareer.rawValue, 12);
assert.equal(marcosActive.rawValue, 2);
assert.equal(result.snapshots.career.ranking.some((entry) => entry.playerName === 'Single Season'), false);
assert.equal(marcosActiveCareer.isCurrentPlayer, true);
assert.equal(result.snapshots.career.metadata.candidateStatus, 'candidate_not_sufficient');
assert.equal(result.snapshots.active_season.ranking.find((entry) => entry.playerName === 'Single Season')?.rawValue, 99);
assert.equal(result.snapshots.career.ranking.some((entry) => entry.playerName === 'Split League Player'), false);
const marcosControl = result.controls['Marcos Alonso'];
if (!marcosControl) throw new Error('Marcos Alonso control case missing');
assert.equal(marcosControl.careerTotal, 12);
assert.equal(marcosControl.activeSeasonTotal, 2);
assert.deepEqual(marcosControl.seasonsAvailable, [2010, 2026]);
assert.equal(result.snapshots.career.contentSha256, result.snapshots.career.contentSha256);
assert.notEqual(result.snapshots.career.id, result.snapshots.active_season.id);
console.log('BLOQUE 45 engine fixtures passed');
