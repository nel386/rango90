export type EntityType = 'player' | 'club' | 'national_team';
export type CompetitionType = 'league' | 'cup' | 'continental' | 'national_team' | 'club_world' | 'supercup' | 'award';

export interface CompetitionSeed {
  id: string;
  name: string;
  countryCode?: string;
  confederation?: string;
  competitionType: CompetitionType;
}

export interface CategorySeed {
  id: string;
  slug: string;
  labelEs: string;
  labelEn: string;
  entityType: EntityType;
  metricKey: string;
  scopeKind: string;
  scope: Record<string, unknown>;
  definition: string;
}

type CompetitionTuple = [string, string, string | undefined, string | undefined, CompetitionType];

export const competitions: CompetitionSeed[] = ([
  ['premier-league', 'Premier League', 'ENG', 'UEFA', 'league'],
  ['la-liga', 'LaLiga', 'ESP', 'UEFA', 'league'],
  ['serie-a', 'Serie A', 'ITA', 'UEFA', 'league'],
  ['bundesliga', 'Bundesliga', 'DEU', 'UEFA', 'league'],
  ['ligue-1', 'Ligue 1', 'FRA', 'UEFA', 'league'],
  ['primeira-liga', 'Primeira Liga', 'PRT', 'UEFA', 'league'],
  ['european-cup-champions-league', 'European Cup / Champions League', undefined, 'UEFA', 'continental'],
  ['uefa-cup-europa-league', 'UEFA Cup / Europa League', undefined, 'UEFA', 'continental'],
  ['uefa-conference-league', 'UEFA Conference League', undefined, 'UEFA', 'continental'],
  ['copa-libertadores', 'Copa Libertadores', undefined, 'CONMEBOL', 'continental'],
  ['copa-sudamericana', 'Copa Sudamericana', undefined, 'CONMEBOL', 'continental'],
  ['recopa-sudamericana', 'Recopa Sudamericana', undefined, 'CONMEBOL', 'supercup'],
  ['world-cup', 'FIFA World Cup', undefined, 'FIFA', 'national_team'],
  ['euro', 'UEFA European Championship', undefined, 'UEFA', 'national_team'],
  ['copa-america', 'Copa América', undefined, 'CONMEBOL', 'national_team'],
  ['nations-league', 'UEFA Nations League', undefined, 'UEFA', 'national_team'],
  ['club-world-cup', 'FIFA Club World Cup', undefined, 'FIFA', 'club_world'],
  ['concacaf-champions-cup', 'Concacaf Champions Cup / Champions League', undefined, 'CONCACAF', 'continental'],
  ['caf-champions-league', 'CAF Champions League / African Cup of Champions Clubs', undefined, 'CAF', 'continental'],
  ['ofc-champions-league', 'OFC Men’s Champions League / OFC Club Championship', undefined, 'OFC', 'continental'],
  ['afc-champions-league', 'AFC Champions League / Asian Club Championship', undefined, 'AFC', 'continental'],
  ['fa-cup', 'FA Cup', 'ENG', 'UEFA', 'cup'],
  ['copa-del-rey', 'Copa del Rey', 'ESP', 'UEFA', 'cup'],
  ['coppa-italia', 'Coppa Italia', 'ITA', 'UEFA', 'cup'],
  ['dfb-pokal', 'DFB-Pokal', 'DEU', 'UEFA', 'cup'],
  ['coupe-de-france', 'Coupe de France', 'FRA', 'UEFA', 'cup'],
  ['taca-portugal', 'Taça de Portugal', 'PRT', 'UEFA', 'cup'],
  ['community-shield', 'FA Community Shield', 'ENG', 'UEFA', 'supercup'],
  ['supercopa-espana', 'Supercopa de España', 'ESP', 'UEFA', 'supercup'],
  ['supercoppa-italiana', 'Supercoppa Italiana', 'ITA', 'UEFA', 'supercup'],
  ['dfl-supercup', 'DFL-Supercup', 'DEU', 'UEFA', 'supercup'],
  ['trophee-champions', 'Trophée des Champions', 'FRA', 'UEFA', 'supercup'],
  ['supertaca-portugal', 'Supertaça Cândido de Oliveira', 'PRT', 'UEFA', 'supercup']
 ] as CompetitionTuple[]).map(([id, name, countryCode, confederation, competitionType]) => ({
  id,
  name,
  countryCode,
  confederation,
  competitionType
}));

export const categories: CategorySeed[] = [
  {
    id: 'category-uefa-champions-league-goals',
    slug: 'uefa-champions-league-goals',
    labelEs: 'Goles históricos — UEFA Champions League',
    labelEn: 'All-time goals — UEFA Champions League',
    entityType: 'player',
    metricKey: 'goals',
    scopeKind: 'competition_all_time',
    scope: { competitionId: 'european-cup-champions-league', era: '1955-56_onwards', qualificationIncluded: false, officialOnly: true, openUniverse: true, sourceRowCutoff: 200 },
    definition: 'Total de goles de cada jugador en la tabla histórica de goleadores de la Copa de Europa y UEFA Champions League desde 1955/56. El universo abierto se fija en las primeras 200 filas reales de la fuente principal; no se añaden ceros ni filas sintéticas. Las eliminatorias de clasificación quedan fuera. Los empates conservan la misma posición competitiva y el salto de posiciones posterior.'
  },
  {
    id: 'category-uefa-champions-league-assists',
    slug: 'uefa-champions-league-assists',
    labelEs: 'Asistencias históricas — UEFA Champions League',
    labelEn: 'All-time assists — UEFA Champions League',
    entityType: 'player',
    metricKey: 'assists',
    scopeKind: 'competition_all_time',
    scope: { competitionId: 'european-cup-champions-league', era: '1955-56_onwards', qualificationIncluded: false, officialOnly: true, assistDefinition: 'uefa_official' },
    definition: 'Asistencias en la clasificación histórica oficial de la UEFA para la Copa de Europa y Champions League desde 1955/56; la cobertura debe ampliarse y validarse antes de publicar.'
  },
  {
    id: 'category-uefa-champions-league-yellow-cards',
    slug: 'uefa-champions-league-yellow-cards',
    labelEs: 'Tarjetas amarillas históricas — UEFA Champions League',
    labelEn: 'All-time yellow cards — UEFA Champions League',
    entityType: 'player',
    metricKey: 'yellow_cards',
    scopeKind: 'competition_all_time',
    scope: { competitionId: 'european-cup-champions-league', era: '1955-56_onwards', qualificationIncluded: false, officialOnly: true },
    definition: 'Tarjetas amarillas en la clasificación histórica de la Copa de Europa y Champions League desde 1955/56; la cobertura debe ampliarse y validarse antes de publicar.'
  },
  {
    id: 'category-uefa-champions-league-red-cards',
    slug: 'uefa-champions-league-red-cards',
    labelEs: 'Tarjetas rojas históricas — UEFA Champions League',
    labelEn: 'All-time red cards — UEFA Champions League',
    entityType: 'player',
    metricKey: 'red_cards',
    scopeKind: 'competition_all_time',
    scope: { competitionId: 'european-cup-champions-league', era: '1955-56_onwards', qualificationIncluded: false, officialOnly: true },
    definition: 'Tarjetas rojas en la clasificación histórica oficial de la UEFA para la Copa de Europa y Champions League desde 1955/56; la cobertura debe ampliarse y validarse antes de publicar.'
  },
  {
    id: 'category-club-career-goals',
    slug: 'club-career-goals',
    labelEs: 'Goles globales en clubes (carrera)',
    labelEn: 'Global club career goals',
    entityType: 'player',
    metricKey: 'goals',
    scopeKind: 'club_career_global',
    scope: { officialOnly: true, firstTeamOnly: true, excluded: ['friendlies', 'youth', 'reserve', 'testimonial'] },
    definition: 'Todos los goles oficiales de primer equipo en competiciones de clubes registradas, agregados en una única categoría global; se excluyen amistosos, juveniles, reservas y testimoniales.'
  },
  {
    id: 'category-club-career-assists',
    slug: 'club-career-assists',
    labelEs: 'Asistencias globales en clubes (carrera)',
    labelEn: 'Global club career assists',
    entityType: 'player',
    metricKey: 'assists',
    scopeKind: 'club_career_global',
    scope: { officialOnly: true, firstTeamOnly: true, assistDefinition: 'opta_like' },
    definition: 'Asistencias en partidos oficiales de primer equipo, agregadas en una única categoría global; se exige una definición de asistencia consistente y documentada.'
  },
  {
    id: 'category-club-global-titles',
    slug: 'club-global-titles',
    labelEs: 'Títulos globales de clubes',
    labelEn: 'Global club titles',
    entityType: 'club',
    metricKey: 'titles',
    scopeKind: 'career_global',
    scope: {
      officialOnly: true,
      seniorClubCompetitions: true,
      clubRule: 'one_title_count_per_competition_and_edition',
      excluded: ['friendlies', 'youth', 'reserve', 'testimonial']
    },
    definition: 'Número de títulos oficiales de primer equipo ganados por cada club, agregado entre las competiciones de clubes importadas. Se deduplican snapshots repetidos y se conserva la evidencia de cada competición; el corte actual es provisional hasta completar todas las competiciones y épocas.'
  },
  {
    id: 'category-concacaf-champions-cup-club-titles',
    slug: 'concacaf-champions-cup-club-titles',
    labelEs: 'Títulos — Concacaf Champions Cup / Champions League (clubes)',
    labelEn: 'Titles — Concacaf Champions Cup / Champions League (clubs)',
    entityType: 'club',
    metricKey: 'titles',
    scopeKind: 'competition_all_time',
    scope: { competitionId: 'concacaf-champions-cup', closedUniverse: true, officialOnly: true, historicalFormatsIncluded: true },
    definition: 'Número de ediciones ganadas por cada club en la historia de la principal competición masculina de clubes de Concacaf, incluyendo sus formatos y denominaciones históricas hasta 2025; se excluyen subcampeonatos.'
  },
  {
    id: 'category-caf-champions-league-club-titles',
    slug: 'caf-champions-league-club-titles',
    labelEs: 'Títulos — CAF Champions League / Copa Africana de Clubes (clubes)',
    labelEn: 'Titles — CAF Champions League / African Cup of Champions Clubs (clubs)',
    entityType: 'club',
    metricKey: 'titles',
    scopeKind: 'competition_all_time',
    scope: { competitionId: 'caf-champions-league', closedUniverse: true, officialOnly: true, historicalFormatsIncluded: true },
    definition: 'Número de ediciones ganadas por cada club en la historia de la principal competición masculina de clubes de CAF, desde 1964 hasta 2025, incluyendo la African Cup of Champions Clubs y la CAF Champions League; se excluyen subcampeonatos.'
  },
  {
    id: 'category-ofc-champions-league-club-titles',
    slug: 'ofc-champions-league-club-titles',
    labelEs: 'Títulos — OFC Men’s Champions League / OFC Club Championship (clubes)',
    labelEn: 'Titles — OFC Men’s Champions League / OFC Club Championship (clubs)',
    entityType: 'club',
    metricKey: 'titles',
    scopeKind: 'competition_all_time',
    scope: { competitionId: 'ofc-champions-league', closedUniverse: true, officialOnly: true, historicalFormatsIncluded: true },
    definition: 'Número de ediciones ganadas por cada club en la historia de la principal competición masculina de clubes de OFC, incluyendo OFC Club Championship y OFC Men’s Champions League desde 1987 hasta 2026; no se cuentan temporadas canceladas o no disputadas.'
  },
  {
    id: 'category-afc-champions-league-club-titles',
    slug: 'afc-champions-league-club-titles',
    labelEs: 'Títulos — AFC Champions League / Asian Club Championship (clubes)',
    labelEn: 'Titles — AFC Champions League / Asian Club Championship (clubs)',
    entityType: 'club',
    metricKey: 'titles',
    scopeKind: 'competition_all_time',
    scope: { competitionId: 'afc-champions-league', closedUniverse: true, officialOnly: true, historicalFormatsIncluded: true },
    definition: 'Número de ediciones ganadas por cada club en la historia de la principal competición masculina de clubes de AFC, desde 1967 hasta 2026, incluyendo Asian Club Championship y AFC Champions League/Elite; se excluyen subcampeonatos.'
  },
  {
    id: 'category-club-career-titles',
    slug: 'club-career-titles',
    labelEs: 'Títulos globales en clubes (carrera)',
    labelEn: 'Global club career titles',
    entityType: 'player',
    metricKey: 'titles',
    scopeKind: 'club_career_global',
    scope: {
      officialOnly: true,
      seniorClubCompetitions: true,
      playerRule: 'provider_recorded_winner',
      includedCompetitions: ['premier-league', 'la-liga', 'bundesliga', 'serie-a', 'ligue-1', 'primeira-liga'],
      excluded: ['national_team', 'friendlies', 'youth', 'reserve', 'testimonial']
    },
    definition: 'Número de títulos de clubes registrados como Winner en los hechos importados de API-Football, agregados por jugador, competición y temporada. El corte actual solo cubre las seis competiciones de clubes importadas y no afirma todavía la carrera mundial completa.'
  },
  {
    id: 'category-player-career-titles',
    slug: 'player-career-titles',
    labelEs: 'Títulos globales en la carrera',
    labelEn: 'Global career titles',
    entityType: 'player',
    metricKey: 'titles',
    scopeKind: 'career_global',
    scope: { officialOnly: true, seniorClubCompetitions: true, seniorNationalTeamCompetitions: true, playerRule: 'registered_and_participated', excluded: ['friendlies', 'youth', 'reserve', 'testimonial'] },
    definition: 'Número total de títulos oficiales de primer equipo ganados por un jugador en clubes y selecciones absolutas, sin crear una categoría separada para cada copa o supercopa.'
  },
  {
    id: 'category-club-career-yellow-cards',
    slug: 'club-career-yellow-cards',
    labelEs: 'Tarjetas amarillas globales en clubes',
    labelEn: 'Global club career yellow cards',
    entityType: 'player',
    metricKey: 'yellow_cards',
    scopeKind: 'club_career_global',
    scope: { officialOnly: true, firstTeamOnly: true, excluded: ['friendlies', 'youth', 'reserve', 'testimonial'] },
    definition: 'Tarjetas amarillas acumuladas por un jugador en partidos oficiales de primer equipo de clubes, agregadas globalmente.'
  },
  {
    id: 'category-club-career-red-cards',
    slug: 'club-career-red-cards',
    labelEs: 'Tarjetas rojas globales en clubes',
    labelEn: 'Global club career red cards',
    entityType: 'player',
    metricKey: 'red_cards',
    scopeKind: 'club_career_global',
    scope: { officialOnly: true, firstTeamOnly: true, excluded: ['friendlies', 'youth', 'reserve', 'testimonial'] },
    definition: 'Tarjetas rojas acumuladas por un jugador en partidos oficiales de primer equipo de clubes, agregadas globalmente.'
  },
  {
    id: 'category-goalkeeper-career-clean-sheets',
    slug: 'goalkeeper-career-clean-sheets',
    labelEs: 'Porterías a cero globales en la carrera',
    labelEn: 'Global career clean sheets',
    entityType: 'player',
    metricKey: 'clean_sheets',
    scopeKind: 'club_career_global',
    scope: { officialOnly: true, firstTeamOnly: true, goalkeeperOnly: true, excluded: ['friendlies', 'youth', 'reserve', 'testimonial'] },
    definition: 'Porterías a cero registradas por porteros en partidos oficiales de primer equipo de clubes, agregadas globalmente y sin inferirlas cuando la fuente no las ofrece.'
  },
  {
    id: 'category-national-team-official-goals',
    slug: 'national-team-official-goals',
    labelEs: 'Goles oficiales con la selección',
    labelEn: 'Official national-team goals',
    entityType: 'player',
    metricKey: 'goals',
    scopeKind: 'national_team_official',
    scope: { seniorAOnly: false, recognizedSeniorRepresentation: true, officialByNationalAssociationOrRsssf: true, includeFriendlies: true, excluded: ['youth', 'reserve', 'unofficial'], historicalExceptionsDocumented: true },
    definition: 'En esta categoría, «oficial» significa un partido de selección o representación sénior que RSSSF reconoce dentro de su tabla internacional (o que reconoce la asociación nacional cuando se documenta); incluye competitivos y amistosos reconocidos. No es una definición FIFA universal: las excepciones históricas, incluidos casos de selecciones amateurs, olímpicos y representaciones que FIFA no reconoce, se conservan en las notas y evidencias RSSSF.'
  },
  {
    id: 'category-national-team-official-assists',
    slug: 'national-team-official-assists',
    labelEs: 'Asistencias oficiales con la selección',
    labelEn: 'Official national-team assists',
    entityType: 'player',
    metricKey: 'assists',
    scopeKind: 'national_team_official',
    scope: { seniorAOnly: true, fifaRecognizedAOnly: true, includeFriendlies: true, excluded: ['youth', 'reserve', 'non-FIFA', 'unofficial'], assistDefinition: 'opta_like' },
    definition: 'Asistencias en partidos reconocidos de selección absoluta tipo FIFA A, incluidos partidos competitivos y amistosos A; se excluyen partidos juveniles, reservas, no FIFA y no oficiales.'
  },
  {
    id: 'category-goalkeeper-historical-index',
    slug: 'goalkeeper-historical-index',
    labelEs: 'Índice histórico de porteros',
    labelEn: 'Historical goalkeeper index',
    entityType: 'player',
    metricKey: 'goalkeeper_index',
    scopeKind: 'global_historical',
    scope: { weights: { majorTitles: 0.30, appearancesLongevity: 0.25, awards: 0.20, cleanSheets: 0.15, nationalTeam: 0.10 }, eraAdjustment: 'neutral' },
    definition: 'Índice reproducible y ajustado por época que combina títulos, partidos, premios, porterías a cero y trayectoria internacional.'
  },
  {
    id: 'category-ballon-dor-wins',
    slug: 'ballon-dor-wins',
    labelEs: 'Balones de Oro ganados',
    labelEn: 'Ballon d’Or wins',
    entityType: 'player',
    metricKey: 'ballon_dor_wins',
    scopeKind: 'award_all_time',
    scope: { awardKey: 'ballon-dor-men', closedUniverse: true },
    definition: 'Número de victorias en el Balón de Oro masculino oficial; no incluye nominaciones ni posiciones finales.'
  }
];

// UEFA publishes edition-level EURO player tables through its official
// competition statistics service. Keep these as separate categories so an
// edition snapshot cannot overwrite another edition or be mistaken for an
// all-time total. The importer may return fewer than 200 real rows for a
// metric; it records that as a partial draft and never pads the ranking.
const uefaEuroHistoricalSeasons = [1960, 1964, 1968, 1972, 1976, 1980, 1984, 1988, 1992, 1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024] as const;
for (const season of uefaEuroHistoricalSeasons) {
  for (const metric of ['goals', 'assists'] as const) {
    const label = metric === 'goals' ? 'Goles' : 'Asistencias';
    categories.push({
      id: `category-euro-${season}-${metric}`,
      slug: `euro-${season}-${metric}`,
      labelEs: `${label} — Eurocopa ${season}`,
      labelEn: `${label} — UEFA EURO ${season}`,
      entityType: 'player',
      metricKey: metric,
      scopeKind: 'competition_edition',
      scope: {
        competitionId: 'euro',
        seasonYear: season,
        phase: 'TOURNAMENT',
        officialOnly: true,
        topN: 200
      },
      definition: `${label} registrados por UEFA en la fase final de la Eurocopa ${season}; se conservan únicamente las filas devueltas por la fuente oficial y no se completan con padding.`
    });
  }
}

categories.push({
  id: 'category-euro-goals',
  slug: 'euro-goals',
  labelEs: 'Goles globales — Eurocopa',
  labelEn: 'All-time goals — UEFA EURO',
  entityType: 'player',
  metricKey: 'goals',
  scopeKind: 'competition_all_time',
  scope: {
    competitionId: 'euro',
    editions: [...uefaEuroHistoricalSeasons],
    phase: 'TOURNAMENT',
    officialOnly: true,
    topN: 200
  },
  definition: 'Suma de los goles registrados por UEFA en todas las ediciones de fase final expuestas por su servicio histórico; cada edición se incorpora una sola vez y las identidades se resuelven antes de agregar.'
});

categories.push({
  id: 'category-euro-assists',
  slug: 'euro-assists',
  labelEs: 'Asistencias globales — Eurocopa',
  labelEn: 'All-time assists — UEFA EURO',
  entityType: 'player',
  metricKey: 'assists',
  scopeKind: 'competition_all_time',
  scope: {
    competitionId: 'euro',
    editions: [...uefaEuroHistoricalSeasons],
    phase: 'TOURNAMENT',
    officialOnly: true,
    topN: 200
  },
  definition: 'Suma de las asistencias registradas por UEFA en todas las ediciones de fase final expuestas por su servicio histórico; cada edición se incorpora una sola vez y las identidades se resuelven antes de agregar.'
});

// The UEFA importer owns the explicit Champions League slugs above. Keep the
// competition's title category generated below, but do not expose duplicate
// generated stat slugs such as european-cup-champions-league-goals.
export const retiredDuplicateCategorySlugs = [
  'european-cup-champions-league-goals',
  'european-cup-champions-league-assists',
  'european-cup-champions-league-yellow_cards',
  'european-cup-champions-league-red_cards',
  'european-cup-champions-league-clean_sheets'
] as const;

// Player competition statistics are intentionally limited to the competitions
// that add meaningful signal to the game. Domestic cups, supercups and the
// Recopa remain in the historical data layer but are not game categories.
const retainedPlayerCompetitionIds = new Set([
  'premier-league',
  'la-liga',
  'serie-a',
  'bundesliga',
  'ligue-1',
  'primeira-liga',
  'european-cup-champions-league',
  'uefa-cup-europa-league',
  'uefa-conference-league',
  'copa-libertadores',
  'copa-sudamericana',
  'world-cup',
  'euro',
  'copa-america',
  'nations-league',
  'club-world-cup'
]);

export const retiredSimplifiedCategorySlugs = competitions.flatMap((competition) => {
  const playerStats = ['goals', 'assists', 'yellow_cards', 'red_cards', 'clean_sheets']
    .filter(() => !retainedPlayerCompetitionIds.has(competition.id))
    .map((metric) => `${competition.id}-${metric}`);
  return [
    ...playerStats,
    `${competition.id}-player-titles`
  ];
}).concat(
  'recopa-sudamericana-club-titles',
  // A single final tournament has a finite player universe and cannot yield
  // a meaningful top 200. Keep the edition snapshots as source evidence for
  // the all-time EURO aggregates, but do not expose 34 impossible game
  // categories that would permanently remain below the product cut.
  uefaEuroHistoricalSeasons.flatMap((season) => [
    `euro-${season}-goals`,
    `euro-${season}-assists`
  ]),
  // These metrics currently have no homogeneous source with 200 real
  // players. Keep their snapshots as research evidence, but do not expose a
  // permanently incomplete category in the game until a compatible source
  // is acquired and validated.
  'copa-sudamericana-clean_sheets',
  'national-team-official-assists',
  'euro-red_cards',
  'club-world-cup-clean_sheets',
  'copa-america-clean_sheets',
  'uefa-conference-league-red_cards',
  'uefa-conference-league-clean_sheets',
  'copa-libertadores-clean_sheets',
  'euro-clean_sheets',
  'nations-league-clean_sheets'
);

for (const competition of competitions) {
  if (!retainedPlayerCompetitionIds.has(competition.id)) continue;
  for (const metric of ['goals', 'assists', 'yellow_cards', 'red_cards', 'clean_sheets']) {
    if (competition.id === 'european-cup-champions-league') continue;
    const label = metric === 'goals' ? 'Goles' : metric === 'assists' ? 'Asistencias' : metric === 'yellow_cards' ? 'Tarjetas amarillas' : metric === 'red_cards' ? 'Tarjetas rojas' : 'Porterías a cero';
    const isLaLigaAssists = competition.id === 'la-liga' && metric === 'assists';
    categories.push({
      id: `category-${competition.id}-${metric}`,
      slug: `${competition.id}-${metric}`,
      labelEs: `${label} históricos — ${competition.name}`,
      labelEn: `${label} all time — ${competition.name}`,
      entityType: 'player',
      metricKey: metric,
      scopeKind: 'competition_all_time',
      scope: {
        competitionId: competition.id,
        officialOnly: true,
        goalkeeperOnly: metric === 'clean_sheets',
        ...(isLaLigaAssists ? {
          era: '1928-29_onwards',
          historicalSource: 'transfermarkt_ewige_vorlagengeberliste',
          seasonParameter: 'saison_id/0',
          assistDefinition: 'transfermarkt_historical_assist_column'
        } : {}),
        ...(competition.id === 'bundesliga' && metric === 'assists' ? {
          era: '1963-64_onwards',
          assistDefinition: 'transfermarkt_historical_assist_column'
        } : {})
      },
      definition: isLaLigaAssists
        ? 'Asistencias acumuladas en la LaLiga masculina desde 1928/29 hasta la temporada vigente, según la Ewige Vorlagengeberliste histórica de Transfermarkt; el top 200 se valida con paginación completa del tramo 1–200 y evidencia por página. Los derechos de redistribución permanecen en review_required y separados de la cobertura estadística.'
        : competition.id === 'bundesliga' && metric === 'assists'
        ? 'Asistencias acumuladas en la Bundesliga masculina desde 1963/64 hasta la temporada vigente, según la columna histórica homogénea de Transfermarkt; el top 200 se conserva en draft hasta resolver derechos de redistribución y revisión editorial de la definición.'
        : `${label} acumulados en ${competition.name}; solo se publica con cobertura histórica completa y definición de proveedor documentada.`
    });
  }
}

for (const competition of competitions) {
  const titleEntityTypes = competition.competitionType === 'national_team' ? ['national_team'] as const : ['club'] as const;
  for (const entityType of titleEntityTypes) {
    const entityLabel = entityType === 'club' ? 'clubes' : entityType === 'national_team' ? 'selecciones' : 'jugadores';
    const entityLabelEn = entityType === 'club' ? 'clubs' : entityType === 'national_team' ? 'national teams' : 'players';
    categories.push({
      id: `category-${competition.id}-${entityType}-titles`,
      slug: `${competition.id}-${entityType}-titles`,
      labelEs: `Títulos — ${competition.name} (${entityLabel})`,
      labelEn: `Titles — ${competition.name} (${entityLabelEn})`,
      entityType,
      metricKey: 'titles',
      scopeKind: 'competition_all_time',
      scope: { competitionId: competition.id, closedUniverse: true },
      definition: `Número de ediciones ganadas de ${competition.name} por ${entityLabel}; se conserva como categoría de títulos del campeón del torneo.`
    });
  }
}
