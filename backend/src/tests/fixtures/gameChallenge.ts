import type { PublishedGameChallenge } from '../../game-engine.js';

export const gameChallengeFixture: PublishedGameChallenge = {
  id: 'fixture-challenge-01',
  sourceVersion: 'fixture-ranking-snapshot-v1',
  challengeSha256: 'c'.repeat(64),
  timeLimitSeconds: 10,
  scoreCap: 100,
  categories: [
    { slug: 'career-goals' },
    { slug: 'ballon-dor' },
    { slug: 'champions-titles' }
  ],
  decisions: [
    {
      ordinal: 0,
      entityId: 'player-a',
      scoreByCategory: { 'career-goals': 1, 'ballon-dor': 3, 'champions-titles': 7 }
    },
    {
      ordinal: 1,
      entityId: 'player-b',
      scoreByCategory: { 'career-goals': 2, 'ballon-dor': 1, 'champions-titles': 5 }
    },
    {
      ordinal: 2,
      entityId: 'player-c',
      scoreByCategory: { 'career-goals': 5, 'ballon-dor': 4, 'champions-titles': 2 }
    }
  ]
};
