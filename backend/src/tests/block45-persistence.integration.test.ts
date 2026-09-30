import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import type { YellowCardFact } from '../clubYellowCardsCareerRankingEngine.js';
import { existingBlock45Facts, insertBlock45Facts } from '../tools/block45-yellow-card-persistence.js';

const isolatedUrl = process.env.RANGO90_ISOLATED_DATABASE_URL?.trim();
if (!isolatedUrl) throw new Error('RANGO90_ISOLATED_DATABASE_URL debe apuntar a PostgreSQL efímera para esta prueba');
const parsedUrl = new URL(isolatedUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname) || !/block45/iu.test(parsedUrl.pathname)) {
  throw new Error('Prueba BLOQUE 45 rechazada: la base debe ser local y tener block45 en el nombre');
}

const client = new pg.Pool({ connectionString: isolatedUrl, max: 1, ssl: false });
const schema = `block45f_test_${process.pid}`;

try {
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}, public`);
  for (const filename of ['093_club_yellow_cards_career_engine.sql', '094_club_yellow_cards_coverage_fields.sql']) {
    await client.query(await readFile(resolve(process.cwd(), 'migrations', filename), 'utf8'));
  }

  // Simulate a previously stored fact before migration 095. The migration and
  // reader must leave it readable with absent new card/evidence fields as NULL/undefined.
  await client.query(`INSERT INTO club_yellow_card_facts
    (id,source_player_id,player_name_original,canonical_player_id,canonical_name,club_provider_id,club_name,competition_provider_id,competition_name,season_start,yellow_cards,source_key,source_url,source_page,locator,response_sha256,captured_at,evidence)
    VALUES ('existing-row','10','Existing Player','api-football:player:10','Existing Player',20,'Old FC',140,'La Liga',2011,3,'api-football','https://example.test/old',1,'old.locator',repeat('a',64),'2026-01-01T00:00:00Z','{"rawPayloadStored":false}'::jsonb)`);
  await client.query(await readFile(resolve(process.cwd(), 'migrations', '095_club_yellow_card_types.sql'), 'utf8'));

  const attribution: NonNullable<YellowCardFact['competitionAttribution']> = {
    method: 'block45e_exact_case_evidence', caseId: 'ramos-2007', sourceCompetitionId: 0,
    attributedCompetitionId: 140, independentSource: 'https://reference.example/ramos',
    auditArtifact: 'BLOCK45E_LEAGUE_ZERO_VALIDATION.json',
    auditReportSha256: 'b'.repeat(64), auditResponseSha256: 'c'.repeat(64)
  };
  const attributedFact: YellowCardFact = {
    id: 'attributed-row', sourcePlayerId: '738', playerNameOriginal: 'Sergio Ramos',
    canonicalPlayerId: 'api-football:player:738', canonicalName: 'Sergio Ramos',
    clubProviderId: 541, clubName: 'Real Madrid', competitionProviderId: 140,
    competitionName: 'La Liga', competitionType: 'official_club_competition',
    eligibilityMajorLeagueId: 140, seasonStart: 2007, appearances: 33, minutes: 2900,
    yellowCards: 14, redCards: 1, yellowRedCards: 2, sourceKey: 'api-football',
    sourceUrl: 'https://v3.football.api-sports.io/players?id=738&season=2007',
    sourcePage: 1, locator: 'response.player.id=738.cards', responseSha256: 'd'.repeat(64),
    capturedAt: '2026-09-30T00:00:00.000Z', sourceType: 'primary',
    verificationStatus: 'confirmed', coverageStatus: 'coverage_partial',
    competitionAttribution: attribution
  };
  assert.deepEqual(await existingBlock45Facts(client), [assertExistingRow()]);
  assert.deepEqual(await insertBlock45Facts(client, [attributedFact]), { added: 1, skipped: 0 });

  const stored = await existingBlock45Facts(client);
  const oldFact = stored.find((fact) => fact.id === 'existing-row');
  const roundTripped = stored.find((fact) => fact.id === 'attributed-row');
  assert.ok(oldFact, 'pre-migration fact remains readable');
  assert.equal(oldFact.redCards, null);
  assert.equal(oldFact.yellowRedCards, null);
  assert.equal(oldFact.competitionAttribution, undefined);
  assert.ok(roundTripped);
  assert.deepEqual(roundTripped.competitionAttribution, attribution);
  assert.equal(roundTripped.redCards, 1);
  assert.equal(roundTripped.yellowRedCards, 2);
  const evidenceResult = await client.query('SELECT evidence FROM club_yellow_card_facts WHERE id = $1', ['attributed-row']);
  assert.deepEqual(evidenceResult.rows[0]?.evidence.competitionAttribution, attribution);
  console.log('BLOQUE 45 PostgreSQL migration and attribution round-trip passed');
} finally {
  await client.query('SET search_path TO public').catch(() => undefined);
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => undefined);
  await client.end();
}

function assertExistingRow(): YellowCardFact {
  return {
    id: 'existing-row', sourcePlayerId: '10', playerNameOriginal: 'Existing Player',
    canonicalPlayerId: 'api-football:player:10', canonicalName: 'Existing Player',
    clubProviderId: 20, clubName: 'Old FC', competitionProviderId: 140,
    competitionName: 'La Liga', competitionType: 'official_club_competition',
    eligibilityMajorLeagueId: null, seasonStart: 2011, appearances: null, minutes: null,
    yellowCards: 3, redCards: null, yellowRedCards: null, sourceKey: 'api-football',
    sourceUrl: 'https://example.test/old', sourcePage: 1, locator: 'old.locator',
    responseSha256: 'a'.repeat(64), capturedAt: '2026-01-01T00:00:00.000Z',
    sourceType: 'primary', verificationStatus: 'confirmed', coverageStatus: 'coverage_partial'
  };
}
