import type { RankingInput } from '../imports/rankingInput.js';

const sourceRoot = 'https://www.statbunker.com';
const cleanSheetsPath = '/competitions/Top10KeepersCleanSheets';
const worldCupIndexUrl = `${sourceRoot}${cleanSheetsPath}?comp_id=727`;

const competitionConfig = {
  copa_libertadores: {
    indexUrl: `${sourceRoot}${cleanSheetsPath}?comp_id=405`,
    editionPattern: /^Copa Libertadores \d{4}$/iu,
    categorySlug: 'copa-libertadores-clean_sheets',
    sourceKey: 'statbunker-copa-libertadores-clean-sheets',
    label: 'Copa Libertadores',
    coverageComplete: false
  },
  club_world_cup: {
    indexUrl: `${sourceRoot}${cleanSheetsPath}?comp_id=775`,
    editionPattern: /^FIFA Club World Cup \d{4}$/iu,
    categorySlug: 'club-world-cup-clean_sheets',
    sourceKey: 'statbunker-club-world-cup-clean-sheets',
    label: 'FIFA Club World Cup',
    coverageComplete: false
  },
  world_cup: {
    indexUrl: worldCupIndexUrl,
    editionPattern: /^(?:\d{4} )?(?:FIFA )?World Cup(?: \d{4})?$/iu,
    categorySlug: 'world-cup-clean_sheets',
    sourceKey: 'statbunker-world-cup',
    label: 'FIFA World Cup',
    coverageComplete: false
  },
  euro: {
    indexUrl: `${sourceRoot}${cleanSheetsPath}?comp_id=291`,
    editionPattern: /^Euro \d{4}$/iu,
    categorySlug: 'euro-clean_sheets',
    sourceKey: 'statbunker-euro',
    label: 'UEFA European Championship',
    coverageComplete: false
  },
  nations_league: {
    indexUrl: `${sourceRoot}${cleanSheetsPath}?comp_id=725`,
    editionPattern: /^UEFA Nations League \d{2}\/\d{2}$/iu,
    categorySlug: 'nations-league-clean_sheets',
    sourceKey: 'statbunker-nations-league-clean-sheets',
    label: 'UEFA Nations League',
    coverageComplete: false
  },
  copa_america: {
    indexUrl: `${sourceRoot}${cleanSheetsPath}?comp_id=595`,
    editionPattern: /^Copa America \d{4}$/iu,
    categorySlug: 'copa-america-clean_sheets',
    sourceKey: 'statbunker-copa-america-clean-sheets',
    label: 'Copa América',
    coverageComplete: false
  },
  conference: {
    indexUrl: `${sourceRoot}${cleanSheetsPath}?comp_id=786`,
    editionPattern: /^UEFA Europa Conference League \d{2}\/\d{2}$/iu,
    categorySlug: 'uefa-conference-league-clean_sheets',
    sourceKey: 'statbunker-uefa-conference-league',
    label: 'UEFA Europa Conference League',
    coverageComplete: false
  },
  europa: {
    indexUrl: `${sourceRoot}${cleanSheetsPath}?comp_id=784`,
    editionPattern: /^UEFA Europa League \d{2}\/\d{2}$/iu,
    categorySlug: 'uefa-cup-europa-league-clean_sheets',
    sourceKey: 'statbunker-uefa-europa-league',
    label: 'UEFA Cup / Europa League',
    coverageComplete: false
  }
} as const;

export type StatbunkerCleanSheetsCompetition = keyof typeof competitionConfig;

export type StatbunkerCleanSheetRow = {
  providerPlayerId: number;
  name: string;
  cleanSheets: number;
  appearances: number;
  competitionId: number;
  competitionLabel: string;
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match: string, entity: string) => named[entity.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkup(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function numeric(value: string | undefined): number | null {
  const parsed = Number.parseInt((value ?? '').replace(/,/g, '').trim(), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

/** Parse the explicit goalkeeper clean-sheet table of one competition edition. */
export function parseStatbunkerCleanSheets(
  html: string,
  competitionId: number,
  competitionLabel: string
): StatbunkerCleanSheetRow[] {
  const rows: StatbunkerCleanSheetRow[] = [];
  const seen = new Set<number>();
  for (const match of html.matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/gu)) {
    const row = match[1] ?? '';
    const player = /player_id=(\d+)[^>]*>[\s\S]*?<p>\s*([^<]+?)\s*<\/p>/u.exec(row);
    if (!player) continue;
    const cells = [...row.matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/gu)]
      .map((cell) => stripMarkup(cell[1] ?? ''));
    // Player, club, nationality, CS, appearances, percentage, more.
    const cleanSheets = numeric(cells[3]);
    const appearances = numeric(cells[4]);
    const providerPlayerId = Number(player[1]);
    const name = stripMarkup(player[2] ?? '');
    if (cleanSheets === null || appearances === null || !Number.isInteger(providerPlayerId)
      || providerPlayerId < 1 || !name || seen.has(providerPlayerId)) continue;
    seen.add(providerPlayerId);
    rows.push({ providerPlayerId, name, cleanSheets, appearances, competitionId, competitionLabel });
  }
  if (rows.some((row, index) => index > 0 && row.cleanSheets > rows[index - 1]!.cleanSheets)) {
    throw new Error(`StatBunker ${competitionLabel} clean sheets: tabla fuera de orden descendente`);
  }
  return rows;
}

export function parseStatbunkerCompetitionOptions(html: string, namePattern: RegExp): Array<{ id: number; label: string }> {
  const options: Array<{ id: number; label: string }> = [];
  for (const match of html.matchAll(/<option[^>]*value=["'](\d+)["'][^>]*>([^<]+)<\/option>/giu)) {
    const id = Number(match[1]);
    const label = decodeHtml(match[2] ?? '');
    if (Number.isInteger(id) && id > 0 && namePattern.test(label)) options.push({ id, label });
    namePattern.lastIndex = 0;
  }
  return [...new Map(options.map((option) => [option.id, option])).values()];
}

async function fetchHtml(url: string): Promise<string> {
  let lastError: unknown;
  // StatBunker occasionally stalls on the canonical host for older editions.
  // The mirror serves the same public table and is used first for transport;
  // the canonical URL remains the evidence URL stored in the snapshot.
  for (const host of ['https://dr.statbunker.com', 'https://m.statbunker.com', 'https://ww.statbunker.com', sourceRoot]) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(url.replace(sourceRoot, host), {
          headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
          signal: AbortSignal.timeout(20_000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
      } catch (error) {
        lastError = error;
        if (attempt < 1) await new Promise((resolve) => setTimeout(resolve, 750));
      }
    }
  }
  throw new Error(`StatBunker clean sheets: no se pudo descargar ${url} (${String(lastError)})`);
}

async function fetchCompetitionRows(competition: StatbunkerCleanSheetsCompetition): Promise<{ rows: StatbunkerCleanSheetRow[]; competitionIds: Array<{ id: number; label: string }> }> {
  const details = competitionConfig[competition];
  const indexHtml = await fetchHtml(details.indexUrl);
  const editions = parseStatbunkerCompetitionOptions(indexHtml, details.editionPattern);
  if (editions.length === 0) throw new Error(`StatBunker ${details.label} clean sheets: no se encontraron ediciones`);
  const allRows: StatbunkerCleanSheetRow[] = [];
  for (let index = 0; index < editions.length; index += 4) {
    const batch = editions.slice(index, index + 4);
    const pages = await Promise.all(batch.map(async (edition) => {
      const html = await fetchHtml(`${sourceRoot}${cleanSheetsPath}?comp_id=${edition.id}`);
      return parseStatbunkerCleanSheets(html, edition.id, edition.label);
    }));
    allRows.push(...pages.flat());
  }
  return { rows: allRows, competitionIds: editions };
}

async function buildCompetitionRanking(competition: StatbunkerCleanSheetsCompetition): Promise<RankingInput> {
  const details = competitionConfig[competition];
  const { rows, competitionIds } = await fetchCompetitionRows(competition);
  const totals = new Map<number, { name: string; value: number; editions: number[]; appearances: number }>();
  for (const row of rows) {
    const current = totals.get(row.providerPlayerId);
    if (current) {
      current.value += row.cleanSheets;
      current.appearances += row.appearances;
      current.editions.push(row.competitionId);
    } else {
      totals.set(row.providerPlayerId, {
        name: row.name,
        value: row.cleanSheets,
        editions: [row.competitionId],
        appearances: row.appearances
      });
    }
  }
  const ranking = [...totals.entries()]
    .sort((left, right) => right[1].value - left[1].value || left[1].name.localeCompare(right[1].name, 'es'))
    .slice(0, 200);
  if (ranking.length === 0) {
    throw new Error(`StatBunker ${details.label} clean sheets: universo insuficiente (${ranking.length} porteros)`);
  }
  const sourceUrl = `${sourceRoot}${cleanSheetsPath}`;
  return {
    categorySlug: details.categorySlug,
    source: {
      key: details.sourceKey,
      name: `StatBunker ${details.label} clean sheets by edition`,
      sourceType: 'reference',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `statbunker-${competition}-clean-sheets-top-200-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: details.coverageComplete,
    allowPartialDraft: true,
    partialDraftReason: `Agregado por ediciones históricas disponibles en StatBunker (${ranking.length} porteros únicos recuperables); requiere contraste con la fuente oficial de ${details.label}, confirmación del alcance histórico y revisión de derechos antes de publicar.`,
    reviewed: false,
    entries: ranking.map(([providerPlayerId, row], index) => ({
      entityId: `statbunker:${competition}:player:${providerPlayerId}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.value,
      evidence: {
        sourceRank: index + 1,
        providerPlayerId,
        position: 'G',
        isGoalkeeper: true,
        competitionIds: competitionIds.map((edition) => edition.id),
        competitionEditions: competitionIds.map((edition) => ({ id: edition.id, label: edition.label })),
        editionsWithPlayer: row.editions,
        appearances: row.appearances,
        sourceUrl,
        scope: `${details.label} masculino; porterías a cero explícitas de cada edición disponible, sumadas por ID de jugador; ceros solo se conservan cuando los devuelve la tabla de la edición; pendiente de validación cruzada y derechos`
      }
    }))
  };
}

export function fetchStatbunkerWorldCupCleanSheets(): Promise<RankingInput> {
  return buildCompetitionRanking('world_cup');
}

export function fetchStatbunkerClubWorldCupCleanSheets(): Promise<RankingInput> {
  return buildCompetitionRanking('club_world_cup');
}

export function fetchStatbunkerCopaLibertadoresCleanSheets(): Promise<RankingInput> {
  return buildCompetitionRanking('copa_libertadores');
}

export function fetchStatbunkerEuroCleanSheets(): Promise<RankingInput> {
  return buildCompetitionRanking('euro');
}

export function fetchStatbunkerNationsLeagueCleanSheets(): Promise<RankingInput> {
  return buildCompetitionRanking('nations_league');
}

export function fetchStatbunkerCopaAmericaCleanSheets(): Promise<RankingInput> {
  return buildCompetitionRanking('copa_america');
}

export function fetchStatbunkerConferenceCleanSheets(): Promise<RankingInput> {
  return buildCompetitionRanking('conference');
}

export function fetchStatbunkerEuropaCleanSheets(): Promise<RankingInput> {
  return buildCompetitionRanking('europa');
}
