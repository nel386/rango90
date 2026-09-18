import assert from 'node:assert/strict';
import { BLOCK22_IMAGE_HEADERS, parseCsv, serializeCsv, validateImageRow, type Block22ImageRow } from '../block22ImageCandidates.js';

const empty: Block22ImageRow = Object.fromEntries(BLOCK22_IMAGE_HEADERS.map((header) => [header, ''])) as Block22ImageRow;
const templateRow = { ...empty, entityId: 'world-cup:player:example', canonicalName: 'Example Player', category: 'world-cup-goals', currentImage: 'monogram', status: 'needs_source' };
assert.deepEqual(parseCsv(serializeCsv([templateRow]))[0], templateRow);
assert.deepEqual(validateImageRow(templateRow), []);
const candidate = { ...templateRow, proposedUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg', author: 'Author', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', attribution: 'Author / Wikimedia Commons', reviewDate: '2026-09-18', status: 'pending_review', resourceSha256: 'a'.repeat(64), identityVerified: 'yes', identityEvidenceUrl: 'https://example.test/player', licenseVerified: 'yes', attributionVerified: 'yes', rightsEvidenceUrl: 'https://creativecommons.org/licenses/by/4.0/' };
assert.deepEqual(validateImageRow(candidate), []);
assert.match(validateImageRow({ ...candidate, status: 'approved' })[0] ?? '', /automatic_approval_forbidden/u);
assert.match(validateImageRow({ ...candidate, resourceSha256: 'not-a-hash' })[0] ?? '', /resourceSha256_must_be_sha256/u);
console.log('block22 image candidate tests passed');
