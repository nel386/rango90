import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

/**
 * IFFHS's published national-team assist table is the strongest public source
 * currently available for this category. It is a real historical table, but
 * it contains only the five leaders. The provider therefore refuses to
 * manufacture a top 200. Callers may explicitly request a partial draft to
 * preserve those five source rows for review.
 *
 * A public FIFA/Opta table is not a substitute here: FIFA publishes assists
 * for individual competitions (for example, the World Cup), while this
 * category needs the aggregate of senior national-team matches. Federation
 * pages are authoritative for one country only, and licensed Opta/Stats
 * Perform exports are not public. Those sources must not be silently mixed,
 * because their assist definitions and historical coverage differ.
 */
export const nationalTeamAssistsSourceUrl = 'https://mail.iffhs.com/posts/4683';
export const nationalTeamAssistsCanonicalSourceUrl = 'https://iffhs.com/en/news/lionel-messis-new-record-4683';
export const nationalTeamAssistsCategorySlug = 'national-team-official-assists';
export const nationalTeamAssistsTargetSize = 200;
export const nationalTeamAssistsScope = 'Selecciones masculinas absolutas; líderes históricos publicados por IFFHS; se excluyen categorías juveniles, clubes y selecciones no absolutas.';
export const nationalTeamAssistsDefinition = 'Asistencia de gol según la investigación histórica de IFFHS. La fuente incluye partidos internacionales A que contabiliza como partidos de selección, incluidos amistosos A, pero no publica un desglose partido a partido ni una definición Opta completa; por eso el snapshot es provisional y no publicable sin revisión.';

export type NationalTeamAssistSourceAssessment = {
  source: string;
  url: string;
  coverage: string;
  usableForTop200: boolean;
  reason: string;
};

/**
 * Evidence register kept next to the importer so a future data refresh does
 * not accidentally turn a competition ranking into a career ranking.
 */
export const nationalTeamAssistSourceAssessment: readonly NationalTeamAssistSourceAssessment[] = [
  {
    source: 'IFFHS',
    url: nationalTeamAssistsCanonicalSourceUrl,
    coverage: '5 líderes históricos de selecciones absolutas',
    usableForTop200: false,
    reason: 'Es la única tabla pública global localizada, pero no publica las posiciones 6–200.'
  },
  {
    source: 'FIFA / Opta',
    url: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/most-assists-top-assisters',
    coverage: 'Asistencias del Mundial por competición',
    usableForTop200: false,
    reason: 'Cubre un torneo, no el acumulado histórico de selecciones absolutas.'
  },
  {
    source: 'Federaciones nacionales',
    url: 'https://www.ussoccer.com/players/d/landon-donovan',
    coverage: 'Fichas históricas de una federación concreta',
    usableForTop200: false,
    reason: 'Puede validar jugadores individuales, pero no proporciona un ranking mundial homogéneo.'
  },
  {
    source: 'Opta / Stats Perform',
    url: 'https://www.statsperform.com/opta/',
    coverage: 'Base de eventos licenciada',
    usableForTop200: false,
    reason: 'La fuente reconocida existe, pero el dataset histórico agregado no es público; requiere export licenciado.'
  },
  {
    source: 'API-Football / API-Sports',
    url: 'https://www.api-football.com/documentation-v3#tag/Players/operation/get-players',
    coverage: 'Estadísticas por selección y temporada; eventos de cada partido',
    usableForTop200: false,
    reason: 'No ofrece un endpoint de asistencias internacionales históricas agregadas. Se podría recorrer equipo/temporada/partido, pero la cobertura histórica no se declara completa y sus términos no conceden por sí solos licencia de redistribución comercial.'
  }
] as const;

const requestUserAgent = 'Rango90-data-import/0.1 (contact required)';

export type NationalTeamOfficialAssistRow = {
  sourceRank: number;
  name: string;
  team: string;
  career: string;
  assists: number;
  games: number;
  externalId: string;
};

export type FetchNationalTeamOfficialAssistsOptions = {
  /** Return an explicit partial draft instead of throwing below 200 rows. */
  allowPartialDraft?: boolean;
  /** Injectable fetch for deterministic tests; production uses global fetch. */
  fetchImpl?: typeof fetch;
};

export type BuildNationalTeamOfficialAssistsOptions = {
  /** SHA-256 of the source export or HTML used to produce the rows. */
  contentSha256: string;
  sourceUrl?: string;
  canonicalSourceUrl?: string;
  sourceKey?: string;
  sourceName?: string;
  sourceType?: 'official' | 'licensed_provider' | 'manual' | 'reference' | 'api';
  rightsStatus?: 'unknown' | 'review_required' | 'approved' | 'rejected';
  coverageComplete?: boolean;
  allowPartialDraft?: boolean;
  partialDraftReason?: string;
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match: string, entity: string) => named[entity.toLowerCase()] ?? match);
}

function cellText(cell: string): string {
  return decodeHtml(cell
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()).replace(/\s+/g, ' ').trim();
}

function extractCells(row: string): string[] {
  return [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => match[1] ?? '');
}

function extractTable(html: string): string {
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const table = tables.find((candidate) => {
    const text = cellText(candidate).toLocaleLowerCase('en-US');
    return text.includes('best assistants')
      && text.includes('national')
      && text.includes('player')
      && text.includes('assists')
      && text.includes('games');
  });
  if (!table) throw new Error('IFFHS national assists: no se encontró la tabla nacional publicada');
  return table;
}

function stableExternalId(name: string, team: string): string {
  const digest = createHash('sha256')
    .update(`${name.trim().toLocaleLowerCase('en-US')}|${team.trim().toLocaleLowerCase('en-US')}`)
    .digest('hex')
    .slice(0, 24);
  return `iffhs-national-assists:${digest}`;
}

function validateRows(rows: NationalTeamOfficialAssistRow[]): void {
  if (rows.length === 0) throw new Error('National assists: la fuente no contiene filas');
  const ids = new Set<string>();
  let previousRank = 0;
  let previousAssists = Number.POSITIVE_INFINITY;
  for (const [index, row] of rows.entries()) {
    if (!Number.isInteger(row.sourceRank) || row.sourceRank < 1) {
      throw new Error(`National assists: rango inválido en fila ${index + 1}`);
    }
    if (!row.name.trim() || !row.team.trim() || !row.career.trim()) {
      throw new Error(`National assists: identidad incompleta en fila ${index + 1}`);
    }
    if (!Number.isInteger(row.assists) || row.assists < 0 || !Number.isInteger(row.games) || row.games < 1) {
      throw new Error(`National assists: valor inválido en fila ${index + 1}`);
    }
    if (!row.externalId.trim()) throw new Error(`National assists: externalId vacío en fila ${index + 1}`);
    if (ids.has(row.externalId)) throw new Error(`National assists: jugador duplicado en fila ${index + 1}`);
    if (row.sourceRank <= previousRank) throw new Error(`National assists: rango repetido o fuera de orden en fila ${index + 1}`);
    if (row.assists > previousAssists) throw new Error(`National assists: asistencias fuera de orden en fila ${index + 1}`);
    ids.add(row.externalId);
    previousRank = row.sourceRank;
    previousAssists = row.assists;
  }
}

/** Parse and validate only rows actually present in the IFFHS table. */
export function parseNationalTeamOfficialAssistsPage(html: string): NationalTeamOfficialAssistRow[] {
  const table = extractTable(html);
  const parsedRows: NationalTeamOfficialAssistRow[] = [];

  for (const rawRow of table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
    const cells = extractCells(rawRow[0]);
    if (cells.length < 6) continue;
    const values = cells.map(cellText);
    const sourceRank = Number(values[0]);
    const assists = Number(values[4]);
    const games = Number(values[5]);
    const [name, team, career] = values.slice(1, 4);
    if (!/^\d+$/.test(values[0] ?? '') || !Number.isInteger(sourceRank) || sourceRank < 1) continue;
    if (!name || !team || !career || !Number.isInteger(assists) || assists < 0 || !Number.isInteger(games) || games < 1) continue;
    parsedRows.push({
      sourceRank,
      name,
      team,
      career,
      assists,
      games,
      externalId: stableExternalId(name, team)
    });
  }

  if (parsedRows.length === 0) throw new Error('IFFHS national assists: la tabla no contiene filas parseables');
  validateRows(parsedRows);
  return parsedRows;
}

async function fetchSourceHtml(fetchImpl: typeof fetch): Promise<{ html: string; contentSha256: string }> {
  const response = await fetchImpl(nationalTeamAssistsSourceUrl, {
    headers: { Accept: 'text/html', 'User-Agent': requestUserAgent },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`IFFHS national assists: HTTP ${response.status}`);
  const html = await response.text();
  if (html.trim() === '') throw new Error('IFFHS national assists: respuesta sin HTML');
  return { html, contentSha256: createHash('sha256').update(html).digest('hex') };
}

/**
 * Builds a RankingInput from a verified export. This is the hand-off point
 * for a future licensed Opta/Stats Perform feed: it accepts only real source
 * rows and keeps the same evidence contract as the public IFFHS importer.
 */
export function buildNationalTeamOfficialAssistsRanking(
  rows: NationalTeamOfficialAssistRow[],
  options: BuildNationalTeamOfficialAssistsOptions
): RankingInput {
  validateRows(rows);
  const sourceClaimsComplete = options.coverageComplete ?? rows.length >= nationalTeamAssistsTargetSize;
  const coverageComplete = sourceClaimsComplete && rows.length >= nationalTeamAssistsTargetSize;
  if (sourceClaimsComplete && rows.length < nationalTeamAssistsTargetSize) {
    throw new Error(
      `National assists: la fuente declara cobertura completa, pero solo contiene ${rows.length}/${nationalTeamAssistsTargetSize} filas`
    );
  }
  if (!coverageComplete && !options.allowPartialDraft) {
    throw new Error(
      `National assists: cobertura insuficiente (${rows.length}/${nationalTeamAssistsTargetSize}); `
      + 'no se puede construir el top 200 sin inventar filas'
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(options.contentSha256)) {
    throw new Error('National assists: contentSha256 debe ser un SHA-256 hexadecimal de 64 caracteres');
  }

  const sourceUrl = options.sourceUrl ?? nationalTeamAssistsSourceUrl;
  const canonicalSourceUrl = options.canonicalSourceUrl ?? nationalTeamAssistsCanonicalSourceUrl;
  const sourceKey = options.sourceKey ?? 'iffhs-national-team-assists';
  const sourceName = options.sourceName ?? 'IFFHS national-team assists historical leaders';
  const selectedRows = rows.slice(0, nationalTeamAssistsTargetSize);
  const partialDraftReason = options.partialDraftReason
    ?? `La fuente publica ${rows.length} líderes nacionales; no publica un top ${nationalTeamAssistsTargetSize}. Se conservan únicamente filas reales.`;

  return {
    categorySlug: nationalTeamAssistsCategorySlug,
    source: {
      key: sourceKey,
      name: sourceName,
      sourceType: options.sourceType ?? 'reference',
      baseUrl: sourceUrl,
      rightsStatus: options.rightsStatus ?? 'review_required'
    },
    dataVersion: `${sourceKey}-${options.contentSha256.slice(0, 24)}`,
    coverageComplete,
    ...(coverageComplete ? {} : { allowPartialDraft: true, partialDraftReason }),
    reviewed: false,
    entries: selectedRows.map((row) => ({
      entityId: row.externalId,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.assists,
      evidence: {
        sourceRank: row.sourceRank,
        externalId: row.externalId,
        sourceUrl,
        canonicalSourceUrl,
        sourceContentSha256: options.contentSha256,
        nationalTeam: row.team,
        internationalCareer: row.career,
        games: row.games,
        scope: nationalTeamAssistsScope,
        assistDefinition: nationalTeamAssistsDefinition,
        sourceAssessment: nationalTeamAssistSourceAssessment
      }
    }))
  };
}

export async function fetchNationalTeamOfficialAssists(
  options: FetchNationalTeamOfficialAssistsOptions = {}
): Promise<RankingInput> {
  const { html, contentSha256 } = await fetchSourceHtml(options.fetchImpl ?? fetch);
  const rows = parseNationalTeamOfficialAssistsPage(html);
  const coverageComplete = rows.length >= nationalTeamAssistsTargetSize;
  if (!coverageComplete && !options.allowPartialDraft) {
    throw new Error(
      `IFFHS national assists: cobertura insuficiente (${rows.length}/${nationalTeamAssistsTargetSize}); `
      + 'no se puede construir el top 200 sin inventar filas'
    );
  }

  return buildNationalTeamOfficialAssistsRanking(rows, {
    contentSha256,
    coverageComplete,
    allowPartialDraft: options.allowPartialDraft
  });
}
