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
  'uefa-champions-league-assists',
  'uefa-champions-league-goals'
] as const;

export const SELECTED_DAILY_CATEGORY_COUNTS = {
  player: 7,
  club: 0,
  national_team: 0
} as const;

export const SELECTED_DAILY_PLAYER_CATEGORY_SLUGS = [...SELECTED_DAILY_CATEGORY_SLUGS];
