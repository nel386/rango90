import assert from 'node:assert/strict';
import { assertRuntimeModeDoesNotChange, officialNotReadyDetails, runtimeAllowsChallenge, validateOfficialChallenge, type OfficialChallengeCheck } from '../publicationGuard.js';
import { getConfiguredRuntimeMode, parseRuntimeMode, runtimeConfigPayload } from '../runtimeMode.js';

const category = (overrides: Partial<OfficialChallengeCheck['categories'][number]> = {}) => ({
  slug: 'ranking-a', snapshotId: 'snapshot-a', categoryStatus: 'approved', snapshotStatus: 'published', coverageComplete: true,
  unresolvedConflicts: 0, rightsStatus: 'approved', scoreMismatches: 0, imagePolicyRequired: false, nonPublishableImages: 0, ...overrides
});

function validChallenge(overrides: Partial<OfficialChallengeCheck> = {}): OfficialChallengeCheck {
  const categories = Array.from({ length: 7 }, (_, index) => category({ slug: `ranking-${index}`, snapshotId: `snapshot-${index}` }));
  return { challengeId: 'daily-1', status: 'published', testOnly: false, categories, decisionCount: 7, answerCount: 49, entityNotPlayable: 0, ...overrides };
}

assert.equal(parseRuntimeMode('lab'), 'lab');
assert.equal(parseRuntimeMode('official'), 'official');
assert.throws(() => parseRuntimeMode('localhost'), /lab u official/u);
assert.throws(() => getConfiguredRuntimeMode({ NODE_ENV: 'development' }), /obligatoria/u);
assert.throws(() => getConfiguredRuntimeMode({ NODE_ENV: 'production' }), /obligatoria/u);
assert.equal(getConfiguredRuntimeMode({ NODE_ENV: 'development', RANGO90_RUNTIME_MODE: 'lab' }), 'lab');
assert.equal(getConfiguredRuntimeMode({ NODE_ENV: 'test', RANGO90_RUNTIME_MODE: 'official' }), 'official');
assert.equal(getConfiguredRuntimeMode({ NODE_ENV: 'production', RANGO90_RUNTIME_MODE: 'lab' }), 'lab');
assert.equal(getConfiguredRuntimeMode({ NODE_ENV: 'production', RANGO90_RUNTIME_MODE: 'official' }), 'official');
assert.throws(() => getConfiguredRuntimeMode({ NODE_ENV: 'development', RANGO90_RUNTIME_MODE: 'preview' }), /lab u official/u);
assert.deepEqual(runtimeConfigPayload('lab'), { runtimeMode: 'lab', modeLabel: 'Modo beta / laboratorio', provisionalDataAllowed: true, officialPublicationOnly: false });
assert.deepEqual(runtimeConfigPayload('official'), { runtimeMode: 'official', modeLabel: 'Modo beta / laboratorio', provisionalDataAllowed: true, officialPublicationOnly: false });

assert.equal(runtimeAllowsChallenge('lab', 'draft', true), true);
assert.equal(runtimeAllowsChallenge('official', 'draft', true), true);
assert.equal(runtimeAllowsChallenge('official', 'published', true), true);
assert.equal(runtimeAllowsChallenge('official', 'published', false), true);
assert.doesNotThrow(() => assertRuntimeModeDoesNotChange('lab', 'lab'));
assert.throws(() => assertRuntimeModeDoesNotChange('lab', 'official'), /no puede cambiar/u);

assert.deepEqual(validateOfficialChallenge(validChallenge()), []);
assert.ok(validateOfficialChallenge(validChallenge({ testOnly: true })).some((blocker) => blocker.code === 'test_only'));
assert.ok(validateOfficialChallenge(validChallenge({ categories: [category({ snapshotStatus: 'superseded' }), ...validChallenge().categories.slice(1)] })).some((blocker) => blocker.code === 'snapshot_status'));
assert.ok(validateOfficialChallenge(validChallenge({ categories: [category({ rightsStatus: 'review_required' }), ...validChallenge().categories.slice(1)] })).some((blocker) => blocker.code === 'source_rights'));
assert.ok(validateOfficialChallenge(validChallenge({ categories: [category({ coverageComplete: false }), ...validChallenge().categories.slice(1)] })).some((blocker) => blocker.code === 'coverage_incomplete'));
assert.ok(validateOfficialChallenge(validChallenge({ categories: [category({ scoreMismatches: 1 }), ...validChallenge().categories.slice(1)] })).some((blocker) => blocker.code === 'score_mismatch'));

const first = officialNotReadyDetails('daily-1', validateOfficialChallenge(validChallenge({ testOnly: true })));
const second = officialNotReadyDetails('daily-1', validateOfficialChallenge(validChallenge({ testOnly: true })));
assert.deepEqual(first, second);
assert.match(first.reason, /daily-1/u);
assert.match(first.snapshotRequired, /snapshot publicado/u);

console.log('runtime modes tests passed');
