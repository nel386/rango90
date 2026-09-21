export type RankingCatalogStatus =
  | 'available_lab'
  | 'provisional_lab'
  | 'partial_scope'
  | 'ranking_not_available'
  | 'candidate_not_sufficient'
  | 'official_not_ready'
  | 'quota_insufficient'
  | 'provider_unavailable';

export type RankingCatalogScopeKey = 'historical' | 'active' | 'official';

export type RankingCatalogScope = {
  status: RankingCatalogStatus;
  available: boolean;
  scope: string;
  snapshotId: string | null;
  lastUpdated: string | null;
  factCount: number | null;
  players: number | null;
  source: string | null;
  provisional: boolean;
  reason: string | null;
};

export type RankingCatalogCategory = {
  slug: string;
  labelEs: string;
  labelEn: string;
  descriptionEs: string;
  descriptionEn: string;
  metric: 'goals' | 'assists' | 'yellow_cards' | 'red_cards' | 'titles';
  scope: string;
  status: RankingCatalogStatus;
  availableScopes: RankingCatalogScopeKey[];
  lastUpdated: string | null;
  factCount: number | null;
  players: number | null;
  source: string | null;
  provisional: boolean;
  blockReason: string | null;
  allowsHistorical: boolean;
  allowsActiveSeason: boolean;
  allowsOfficial: boolean;
  historical: RankingCatalogScope;
  active: RankingCatalogScope;
  official: RankingCatalogScope;
  scopeDetails?: Record<string, unknown>;
};

export const RANKING_CATALOG_DEFINITIONS = [
  {
    slug: 'uefa-champions-league-goals',
    labelEs: 'Champions — goles',
    labelEn: 'Champions — goals',
    descriptionEs: 'Copa de Europa y UEFA Champions League, sin rondas clasificatorias.',
    descriptionEn: 'European Cup and UEFA Champions League, excluding qualifying rounds.',
    metric: 'goals' as const,
    scope: '1955/56–temporada activa; competición principal',
  },
  {
    slug: 'world-cup-goals',
    labelEs: 'Mundial — goles',
    labelEn: 'World Cup — goals',
    descriptionEs: 'Fases finales masculinas del Mundial; sin clasificatorias ni tandas.',
    descriptionEn: 'Men’s final tournaments; excluding qualifiers and shootouts.',
    metric: 'goals' as const,
    scope: '1930–edición activa; fases finales masculinas',
  },
  {
    slug: 'uefa-champions-league-assists',
    labelEs: 'Champions — asistencias',
    labelEn: 'Champions — assists',
    descriptionEs: 'Asistencias explícitas de la temporada activa; el histórico no tiene cobertura suficiente.',
    descriptionEn: 'Explicit assists for the active season; historical coverage is insufficient.',
    metric: 'assists' as const,
    scope: 'Temporada activa provisional; histórico candidate_not_sufficient',
  },
  {
    slug: 'club-career-goals',
    labelEs: 'Goles globales en clubes',
    labelEn: 'Global club goals',
    descriptionEs: 'Solo competiciones y temporadas observadas; no representa una carrera mundial completa.',
    descriptionEn: 'Observed competitions and seasons only; not a complete worldwide career.',
    metric: 'goals' as const,
    scope: 'Alcance observado de clubes; histórico candidate_not_sufficient',
  },
  {
    slug: 'club-career-yellow-cards',
    labelEs: 'Tarjetas amarillas en clubes',
    labelEn: 'Club yellow cards',
    descriptionEs: 'Premier League, La Liga y Serie A completas; tres competiciones pendientes por cuota.',
    descriptionEn: 'Complete Premier League, La Liga and Serie A; three competitions pending quota.',
    metric: 'yellow_cards' as const,
    scope: 'Complete scope observado: 3 de 6 competiciones',
  },
  {
    slug: 'club-career-red-cards',
    labelEs: 'Tarjetas rojas en clubes',
    labelEn: 'Club red cards',
    descriptionEs: 'Premier League, La Liga y Serie A completas; tres competiciones pendientes por cuota.',
    descriptionEn: 'Complete Premier League, La Liga and Serie A; three competitions pending quota.',
    metric: 'red_cards' as const,
    scope: 'Complete scope observado: 3 de 6 competiciones',
  },
  {
    slug: 'club-global-titles',
    labelEs: 'Títulos globales en clubes',
    labelEn: 'Global club titles',
    descriptionEs: 'Todavía no hay hechos trazables suficientes para mostrar este ranking.',
    descriptionEn: 'There are not yet enough traceable facts to show this ranking.',
    metric: 'titles' as const,
    scope: 'Sin ranking disponible',
  },
] as const;

export const RANKING_CATALOG_SLUGS = new Set(RANKING_CATALOG_DEFINITIONS.map((definition) => definition.slug));
