import assert from 'node:assert/strict';
import { isValidCommonsCandidate, type CommonsImageCandidate } from '../providers/commonsClient.js';

const base = (overrides: Partial<CommonsImageCandidate> = {}): CommonsImageCandidate => ({
  title: 'File:Pedro González footballer.jpg',
  descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Pedro_Gonzalez_footballer.jpg',
  fileUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Pedro_Gonzalez_footballer.jpg',
  width: 1200,
  height: 1600,
  mimeType: 'image/jpeg',
  licenseName: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  rightsClass: 'share_alike',
  reviewRequired: true,
  ...overrides
});

assert.equal(isValidCommonsCandidate(base(), 'portrait', 'P. González', ['Pedro González']), true);
assert.equal(isValidCommonsCandidate(base({ title: 'File:Fabio Fehring footballer.jpg' }), 'portrait', 'Fabio Fehr'), false);
assert.equal(isValidCommonsCandidate(base({ title: 'File:Pedro González team photo.jpg' }), 'portrait', 'Pedro González'), false);
assert.equal(isValidCommonsCandidate(base({ title: 'File:Fabio Santos vs Chelsea 2012 FIFA Club World Cup (cropped).jpg', description: 'Fernando Torres of Chelsea' }), 'portrait', 'Fábio Santos', ['Fábio Santos Romeu']), false);
assert.equal(isValidCommonsCandidate(base({ description: 'Pedro González playing for Atlético.' }), 'portrait', 'Pedro González'), true);
assert.equal(isValidCommonsCandidate(base({ fileUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Pedro.svg', mimeType: 'image/svg+xml' }), 'portrait', 'Pedro González'), false);
assert.equal(isValidCommonsCandidate(base({ title: 'File:Celtic F.C. badge.svg', description: 'A football club and its current crest.', descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Celtic_F.C._badge.svg', fileUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Celtic_F.C._badge.svg', mimeType: 'image/svg+xml', width: 500, height: 500 }), 'badge', 'Celtic F.C.'), true);
assert.equal(isValidCommonsCandidate(base({ title: 'File:Arsenal and Celtic logos.svg', descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Arsenal_and_Celtic_logos.svg', fileUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Arsenal_and_Celtic_logos.svg', mimeType: 'image/svg+xml', width: 500, height: 500 }), 'badge', 'Celtic'), false);
assert.equal(isValidCommonsCandidate(base({ title: 'File:Stone sculpture of celtic hero.jpg', description: 'Stone sculpture of Celtic hero.', descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Stone_sculpture_of_celtic_hero.jpg', fileUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Stone_sculpture_of_celtic_hero.jpg', mimeType: 'image/jpeg', width: 1000, height: 1200 }), 'badge', 'Celtic F.C.'), false);
assert.equal(isValidCommonsCandidate(base({ licenseName: undefined }), 'portrait', 'Pedro González'), false);

console.log('commons candidate validation tests passed');
