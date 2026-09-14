/**
 * Product-selected daily matrix. Keep this list in one module so the
 * materializer and the release audit cannot silently validate different
 * category sets.
 */
export const SELECTED_DAILY_CATEGORY_SLUGS = [
  'club-career-yellow-cards',
  'club-career-red-cards',
  'club-career-titles',
  'world-cup-goals',
  'player-career-goals',
  'national-league-club-titles',
  'european-cup-champions-league-club-titles'
] as const;

export const SELECTED_DAILY_CATEGORY_COUNTS = {
  player: 5,
  club: 2,
  national_team: 0
} as const;
