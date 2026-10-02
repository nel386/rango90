import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import type { ContractDatabase } from '../game-contract.js';

const snapshot = {
  id: 'club-cards-yellow-snapshot-a17ece340d31a31960c00624c9078866',
  category_slug: 'club-career-yellow-cards', card_kind: 'yellow', dataset: 'active_weekly',
  season_start: 2026, season_end: 2026, scope_version: 'club-cards-facts-v1',
  content_sha256: 'a17ece340d31a31960c00624c90788665c77fe12f7a248ca1a4d763fe9506fa4',
  generated_at: '2026-09-21T16:58:04.505Z', coverage_complete: true,
  competition_filter: 'complete_scope', metadata: {
    activeSeasonStatus: 'complete_scope', seasonInProgress: true,
    observedFacts: 1247, factCount: 1247, redTypesDifferentiated: true,
  },
};

const fakeDb = {
  query: async (sql: string, values: unknown[] = []) => {
    if (sql.includes('FROM club_card_ranking_snapshots rs') && sql.includes('SELECT rs.*') && values[0] === 'club-career-yellow-cards' && values[1] === 'yellow' && values[2] === 'active_weekly') return { rows: [snapshot] };
    if (sql.includes('FROM club_card_ranking_snapshots rs') && sql.includes('AS "generatedAt"') && values[0] === 'club-career-yellow-cards' && values[1] === 'active_weekly') return { rows: [{ ...snapshot, generatedAt: snapshot.generated_at, contentSha256: snapshot.content_sha256, factCount: 1247, players: 350, source: 'api-football' }] };
    if (sql.includes('SELECT COUNT(*)::int AS count FROM club_card_ranking_entries')) return { rows: [{ count: 350 }] };
    if (sql.includes('FROM club_card_ranking_entries re')) return { rows: [{
      entity_id: 'clubcards:api-football:player:2278', canonical_name: 'Marcos Alonso',
      short_name: 'M. Alonso', entity_type: 'player', raw_value: 2, rank: 19,
      tie_group: 3, playable: false, sources: [],
    }] };
    return { rows: [] };
  },
};

const app = buildApp({ gameDb: fakeDb as unknown as ContractDatabase, runtimeMode: 'lab' });
try {
  const response = await app.inject({
    method: 'GET',
    url: '/v1/rankings/club-career-yellow-cards?limit=200&dataset=active_season_weekly&competition=complete_scope',
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.categoryLabelEs, 'Tarjetas amarillas — temporada activa (alcance observado)');
  assert.equal(body.categoryLabelEn, 'Yellow cards — active season (observed scope)');
  assert.equal(body.scopeKind, 'club_active_season_observed');
  assert.deepEqual(body.scopeDescriptor, {
    kind: 'active_season_observed', season: 2026, competitionFilter: 'complete_scope',
    includedCompetitionIds: ['39', '140', '135'], excludedCompetitionIds: ['78', '61', '94'],
    careerComplete: false,
  });
  assert.equal(body.snapshotId, snapshot.id);
  assert.equal(body.season, 2026);
  assert.equal(body.generatedAt, snapshot.generated_at);
  assert.equal(body.updateDate, snapshot.generated_at);
  assert.deepEqual(body.includedCompetitions, ['39', '140', '135']);
  assert.deepEqual(body.excludedCompetitions, ['78', '61', '94']);
  assert.match(body.scopeLabelEs, /3 competiciones completas/u);
  assert.equal(body.entries[0].canonical_name, 'Marcos Alonso');
  assert.equal(body.entries[0].rank, 19);
  assert.equal(body.entries[0].raw_value, 2);
  assert.doesNotMatch(body.categoryLabelEs, /global|carrera|histórico/iu);

  const catalogResponse = await app.inject({ method: 'GET', url: '/v1/rankings/catalog?season=2026' });
  assert.equal(catalogResponse.statusCode, 200);
  const catalogYellow = catalogResponse.json().categories.find((item: { slug: string }) => item.slug === 'club-career-yellow-cards');
  assert.equal(catalogYellow.labelEs, body.categoryLabelEs);
  assert.equal(catalogYellow.labelEn, body.categoryLabelEn);
  assert.equal(catalogYellow.scopeKind, body.scopeKind);
  assert.equal(catalogYellow.active.snapshotId, body.snapshotId);
  assert.equal(catalogYellow.active.lastUpdated, body.generatedAt);
  console.log(JSON.stringify({ status: 'passed', snapshotId: body.snapshotId, scopeKind: body.scopeKind, generatedAt: body.generatedAt }));
} finally {
  await app.close();
}
