import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

export const transfermarktLaLigaAssistsSourceUrl =
  'https://www.transfermarkt.com/laliga/assistliste/wettbewerb/ES1/saison_id/0/plus/';
export const transfermarktLaLigaAssistsTargetSize = 200;
export const transfermarktLaLigaAssistsScope =
  'LaLiga masculina desde 1928/29; Ewige Vorlagengeberliste (tabla histórica de asistencias de Transfermarkt, selector saison_id/0); top 200 jugadores con valor positivo observado.';
export const transfermarktLaLigaAssistsDefinition =
  'Una asistencia es el valor de la columna histórica de asistencias publicada por Transfermarkt. El alcance histórico es el acumulado de LaLiga masculina que Transfermarkt identifica como Ewige Vorlagengeberliste y cuyo selector de temporadas llega hasta la primera campaña 1928/29; no se mezclan temporadas ni definiciones de otros proveedores.';
export const transfermarktBundesligaAssistsSourceUrl =
  'https://www.transfermarkt.com/bundesliga/assistliste/wettbewerb/L1/saison_id/0/plus/';
export const transfermarktSerieAAssistsSourceUrl =
  'https://www.transfermarkt.com/serie-a/assistliste/wettbewerb/IT1/saison_id/0/plus/';
export const transfermarktLigue1AssistsSourceUrl =
  'https://www.transfermarkt.com/ligue-1/assistliste/wettbewerb/FR1/saison_id/0/plus/';
export const transfermarktPrimeiraLigaAssistsSourceUrl =
  'https://www.transfermarkt.com/primeira-liga/assistliste/wettbewerb/PO1/saison_id/0/plus/';
export const transfermarktBundesligaAssistsScope =
  'Bundesliga masculina (1. Bundesliga), desde 1963/64 hasta la temporada vigente; Ewige Vorlagengeberliste de Transfermarkt; top 200 jugadores con al menos una asistencia registrada en la tabla histórica.';
export const transfermarktBundesligaAssistsDefinition =
  'Una asistencia es el valor de la columna histórica de asistencias publicada por Transfermarkt; no se recalcula con API-Football ni se mezcla con otras definiciones. La definición de Transfermarkt puede incluir acciones que otros proveedores tratan de forma distinta y queda documentada como tal.';
export const transfermarktSerieAAssistsScope =
  'Serie A masculina desde 1929/30; Ewige Vorlagengeberliste (tabla histórica de asistencias de Transfermarkt, selector saison_id/0); top 200 jugadores con valor positivo observado.';
export const transfermarktSerieAAssistsDefinition =
  'Una asistencia es el valor de la columna histórica de asistencias publicada por Transfermarkt. El alcance histórico es el acumulado de la Serie A masculina que Transfermarkt identifica como Ewige Vorlagengeberliste y cuyo selector de temporadas llega hasta la campaña 1929/30; no se mezclan temporadas ni definiciones de otros proveedores.';
export const transfermarktLigue1AssistsScope =
  'Ligue 1 masculina desde 1932/33; Ewige Vorlagengeberliste (tabla histórica de asistencias de Transfermarkt, selector saison_id/0); top 200 jugadores con valor positivo observado.';
export const transfermarktLigue1AssistsDefinition =
  'Una asistencia es el valor de la columna histórica de asistencias publicada por Transfermarkt. El alcance histórico es el acumulado de la Ligue 1 masculina que Transfermarkt identifica como Ewige Vorlagengeberliste y cuyo selector de temporadas llega hasta la campaña 1932/33; no se mezclan temporadas ni definiciones de otros proveedores.';
export const transfermarktPrimeiraLigaAssistsScope =
  'Primeira Liga masculina desde 1934/35; Ewige Vorlagengeberliste (tabla histórica de asistencias de Transfermarkt, selector saison_id/0); top 200 jugadores con valor positivo observado.';
export const transfermarktPrimeiraLigaAssistsDefinition =
  'Una asistencia es el valor de la columna histórica de asistencias publicada por Transfermarkt. El alcance histórico es el acumulado de la Primeira Liga masculina que Transfermarkt identifica como Ewige Vorlagengeberliste y cuyo selector de temporadas llega hasta la campaña 1934/35; no se mezclan temporadas ni definiciones de otros proveedores.';

export type TransfermarktHistoricalLeagueAssistsConfig = {
  competitionCode: string;
  categorySlug: string;
  sourceKey: string;
  sourceName: string;
  sourceUrl: string;
  scope: string;
  entityPrefix: string;
};

export const transfermarktHistoricalLeagueAssistsConfigs = {
  laLiga: {
    competitionCode: 'ES1',
    categorySlug: 'la-liga-assists',
    sourceKey: 'transfermarkt-la-liga-assists',
    sourceName: 'Transfermarkt LaLiga historical all-time assists',
    sourceUrl: transfermarktLaLigaAssistsSourceUrl,
    scope: transfermarktLaLigaAssistsScope,
    entityPrefix: 'transfermarkt:la-liga:'
  },
  bundesliga: {
    competitionCode: 'L1',
    categorySlug: 'bundesliga-assists',
    sourceKey: 'transfermarkt-bundesliga-assists',
    sourceName: 'Transfermarkt Bundesliga historical all-time assists',
    sourceUrl: transfermarktBundesligaAssistsSourceUrl,
    scope: transfermarktBundesligaAssistsScope,
    entityPrefix: 'transfermarkt:bundesliga:'
  },
  serieA: {
    competitionCode: 'IT1',
    categorySlug: 'serie-a-assists',
    sourceKey: 'transfermarkt-serie-a-assists',
    sourceName: 'Transfermarkt Serie A historical all-time assists',
    sourceUrl: transfermarktSerieAAssistsSourceUrl,
    scope: transfermarktSerieAAssistsScope,
    entityPrefix: 'transfermarkt:serie-a:'
  },
  ligue1: {
    competitionCode: 'FR1',
    categorySlug: 'ligue-1-assists',
    sourceKey: 'transfermarkt-ligue-1-assists',
    sourceName: 'Transfermarkt Ligue 1 historical all-time assists',
    sourceUrl: transfermarktLigue1AssistsSourceUrl,
    scope: transfermarktLigue1AssistsScope,
    entityPrefix: 'transfermarkt:ligue-1:'
  },
  primeiraLiga: {
    competitionCode: 'PO1',
    categorySlug: 'primeira-liga-assists',
    sourceKey: 'transfermarkt-primeira-liga-assists',
    sourceName: 'Transfermarkt Primeira Liga historical all-time assists',
    sourceUrl: transfermarktPrimeiraLigaAssistsSourceUrl,
    scope: transfermarktPrimeiraLigaAssistsScope,
    entityPrefix: 'transfermarkt:primeira-liga:'
  }
} satisfies Record<string, TransfermarktHistoricalLeagueAssistsConfig>;

export type TransfermarktLaLigaAssistEntry = {
  sourceRank: number;
  sourceTableRank: number;
  providerPlayerId: number;
  name: string;
  appearances: number | null;
  assists: number;
  profileUrl: string;
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match: string, entity: string) => named[entity.toLowerCase()] ?? match)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalTransfermarktUrl(value: string): string {
  try {
    const url = new URL(value.replaceAll('&amp;', '&'));
    if (url.hostname === 'www-transfermarkt-com.translate.goog') {
      url.hostname = 'www.transfermarkt.com';
      for (const key of [...url.searchParams.keys()]) {
        if (key.startsWith('_x_tr_')) url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}

function numericCells(row: string): number[] {
  return [...row.matchAll(/<td\s+class="zentriert"[^>]*>\s*(\d+)\s*<\/td>/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isSafeInteger(value));
}

function validateLaLigaHistoricalScope(html: string): void {
  const seasonSelect = /<select\s+name="saison_id"[^>]*>([\s\S]*?)<\/select>/i.exec(html)?.[1] ?? '';
  const options = [...seasonSelect.matchAll(/<option\s+value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/gi)]
    .map((match) => ({ value: match[1], label: decodeHtml(match[2] ?? '') }));
  if (!options.some((option) => option.value === '0' && /Ewige Vorlagengeberliste/i.test(option.label))) {
    throw new Error('Transfermarkt LaLiga assists: la página no acredita el selector histórico Ewige Vorlagengeberliste');
  }
  if (!options.some((option) => option.value === '1928' && /1928\/29/.test(option.label))) {
    throw new Error('Transfermarkt LaLiga assists: la página no acredita el inicio histórico 1928/29');
  }
}

function validateSerieAHistoricalScope(html: string): void {
  const seasonSelect = /<select\s+name="saison_id"[^>]*>([\s\S]*?)<\/select>/i.exec(html)?.[1] ?? '';
  const options = [...seasonSelect.matchAll(/<option\s+value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/gi)]
    .map((match) => ({ value: match[1], label: decodeHtml(match[2] ?? '') }));
  if (!options.some((option) => option.value === '0' && /Ewige Vorlagengeberliste/i.test(option.label))) {
    throw new Error('Transfermarkt Serie A assists: la página no acredita el selector histórico Ewige Vorlagengeberliste');
  }
  if (!options.some((option) => option.value === '1929' && /1929\/30/.test(option.label))) {
    throw new Error('Transfermarkt Serie A assists: la página no acredita el inicio histórico 1929/30');
  }
}

function validateTransfermarktHistoricalScope(html: string, label: string, firstSeasonValue: string, firstSeasonLabel: string): void {
  const seasonSelect = /<select\s+name="saison_id"[^>]*>([\s\S]*?)<\/select>/i.exec(html)?.[1] ?? '';
  const options = [...seasonSelect.matchAll(/<option\s+value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/gi)]
    .map((match) => ({ value: match[1], label: decodeHtml(match[2] ?? '') }));
  if (!options.some((option) => option.value === '0' && /Ewige Vorlagengeberliste/i.test(option.label))) {
    throw new Error(`Transfermarkt ${label} assists: la página no acredita el selector histórico Ewige Vorlagengeberliste`);
  }
  if (!options.some((option) => option.value === firstSeasonValue && option.label.includes(firstSeasonLabel))) {
    throw new Error(`Transfermarkt ${label} assists: la página no acredita el inicio histórico ${firstSeasonLabel}`);
  }
}

/** Parse one Transfermarkt all-time assists page. */
export function parseTransfermarktLaLigaAssistsPage(
  html: string,
  rankOffset = 0,
  competitionCode = 'ES1'
): TransfermarktLaLigaAssistEntry[] {
  const rows: TransfermarktLaLigaAssistEntry[] = [];
  const chunks = html
    .split(/(?=<tr\s+class="(?:odd|even)")/i)
    .filter((chunk) => /^\s*<tr\s+class="(?:odd|even)"/i.test(chunk));

  for (const chunk of chunks) {
    const rank = Number(/<td\s+class="zentriert"[^>]*>\s*(\d+)\s*<\/td>/i.exec(chunk)?.[1] ?? '');
    const player = /<a\s+title="([^"]+)"\s+href="([^"]+\/profil\/spieler\/(\d+)[^"]*)"/i.exec(chunk);
    const assists = numericCells(chunk).at(-1);
    const appearanceMatch = new RegExp(`\\/leistungsdaten\\/spieler\\/\\d+\\/saison\\/[^" ]*\\/wettbewerb\\/${competitionCode}[^\\"]*">\\s*(\\d+)\\s*<\\/a>`, 'i').exec(chunk);
    const appearances = appearanceMatch ? Number(appearanceMatch[1]) : null;
    if (!Number.isSafeInteger(rank) || rank < 1 || !player?.[1] || !player[2]
      || !Number.isSafeInteger(Number(player[3])) || Number(player[3]) < 1
      || !appearanceMatch
      || typeof assists !== 'number' || !Number.isSafeInteger(assists) || assists < 1) continue;
    rows.push({
      sourceRank: rankOffset + rows.length + 1,
      sourceTableRank: rank,
      providerPlayerId: Number(player[3]),
      name: decodeHtml(player[1]),
      appearances,
      assists,
      profileUrl: canonicalTransfermarktUrl(player[2])
    });
  }
  return rows;
}

function translatedTransfermarktUrl(value: string): string {
  const url = new URL(value);
  url.hostname = 'www-transfermarkt-com.translate.goog';
  url.searchParams.set('_x_tr_sl', 'auto');
  url.searchParams.set('_x_tr_tl', 'en');
  url.searchParams.set('_x_tr_hl', 'en');
  return url.toString();
}

function validateRows(rows: TransfermarktLaLigaAssistEntry[], label: string, strictHistoricalValidation = false): void {
  if (rows.length < transfermarktLaLigaAssistsTargetSize) {
    throw new Error(`Transfermarkt ${label} assists: cobertura insuficiente (${rows.length}/${transfermarktLaLigaAssistsTargetSize})`);
  }
  const ids = new Set<number>();
  const profileUrls = new Set<string>();
  let previous = Number.POSITIVE_INFINITY;
  for (const [index, row] of rows.slice(0, transfermarktLaLigaAssistsTargetSize).entries()) {
    const expectedRank = index + 1;
    if (strictHistoricalValidation && row.sourceRank !== expectedRank) {
      throw new Error(`Transfermarkt ${label} assists: rango de importación no contiguo (esperado ${expectedRank}, recibido ${row.sourceRank})`);
    }
    if (strictHistoricalValidation && row.sourceTableRank !== expectedRank) {
      throw new Error(`Transfermarkt ${label} assists: rango de tabla no contiguo (esperado ${expectedRank}, recibido ${row.sourceTableRank})`);
    }
    if (ids.has(row.providerPlayerId)) throw new Error(`Transfermarkt ${label} assists: jugador duplicado ${row.providerPlayerId}`);
    if (strictHistoricalValidation && profileUrls.has(row.profileUrl)) throw new Error(`Transfermarkt ${label} assists: perfil duplicado ${row.profileUrl}`);
    if (strictHistoricalValidation && (!Number.isSafeInteger(row.providerPlayerId) || row.providerPlayerId < 1)) {
      throw new Error(`Transfermarkt ${label} assists: ID de jugador inválido ${row.providerPlayerId}`);
    }
    if (strictHistoricalValidation && (!Number.isSafeInteger(row.assists) || row.assists < 1)) {
      throw new Error(`Transfermarkt ${label} assists: asistencia inválida para ${row.name}`);
    }
    if (row.assists > previous) throw new Error(`Transfermarkt ${label} assists: orden descendente inválido en ${row.name}`);
    ids.add(row.providerPlayerId);
    profileUrls.add(row.profileUrl);
    previous = row.assists;
  }
}

async function fetchPage(url: string, fetchImpl: typeof fetch): Promise<string> {
  let response = await fetchImpl(url, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(30_000)
  });
  let body = response.ok ? await response.text() : '';
  if (body.includes('<tr class="odd">') || body.includes('<tr class="even">')) return body;
  const proxyUrl = translatedTransfermarktUrl(url);
  response = await fetchImpl(proxyUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`Transfermarkt historical assists ${response.status}`);
  body = await response.text();
  if (!body.trim()) throw new Error('Transfermarkt LaLiga assists: respuesta vacía');
  return body;
}

export type TransfermarktLaLigaAssistsFetchOptions = { fetchImpl?: typeof fetch };

export async function fetchTransfermarktHistoricalLeagueAssists(
  config: TransfermarktHistoricalLeagueAssistsConfig,
  options: TransfermarktLaLigaAssistsFetchOptions = {}
): Promise<RankingInput> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const rows: TransfermarktLaLigaAssistEntry[] = [];
  const sourcePageContentSha256: string[] = [];
  const sourcePageEvidence: Array<{
    page: number;
    url: string;
    contentSha256: string;
    rows: number;
    firstSourceTableRank: number;
    lastSourceTableRank: number;
  }> = [];
  const isBundesliga = config.categorySlug === 'bundesliga-assists';
  const isLaLiga = config.categorySlug === 'la-liga-assists';
  const isSerieA = config.categorySlug === 'serie-a-assists';
  const isLigue1 = config.categorySlug === 'ligue-1-assists';
  const isPrimeiraLiga = config.categorySlug === 'primeira-liga-assists';
  const strictHistoricalValidation = isBundesliga || isLaLiga || isSerieA || isLigue1 || isPrimeiraLiga;
  const baseUrl = config.sourceUrl;
  for (let page = 1; page <= 12 && rows.length < transfermarktLaLigaAssistsTargetSize; page += 1) {
    // Transfermarkt serves pagination reliably through the `page` query
    // parameter. Appending `/page/N` can be normalized away by translation
    // proxies and silently return page 1 again.
    const pageUrl = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
    const pageHtml = await fetchPage(pageUrl, fetchImpl);
    if (isLaLiga && page === 1) validateLaLigaHistoricalScope(pageHtml);
    if (isSerieA && page === 1) validateSerieAHistoricalScope(pageHtml);
    if (isLigue1 && page === 1) validateTransfermarktHistoricalScope(pageHtml, 'Ligue 1', '1932', '32/33');
    if (isPrimeiraLiga && page === 1) validateTransfermarktHistoricalScope(pageHtml, 'Primeira Liga', '1934', '34/35');
    sourcePageContentSha256.push(createHash('sha256').update(pageHtml).digest('hex'));
    const pageRows = parseTransfermarktLaLigaAssistsPage(pageHtml, rows.length, config.competitionCode);
    if (pageRows.length === 0) throw new Error(`Transfermarkt ${config.categorySlug} assists: página ${page} sin filas`);
    if (isLaLiga || isSerieA) {
      const expectedFirstRank = rows.length + 1;
      const expectedLastRank = expectedFirstRank + pageRows.length - 1;
      if (pageRows.length !== 25) {
        throw new Error(`Transfermarkt ${config.categorySlug} assists: página ${page} no contiene exactamente 25 filas válidas (${pageRows.length})`);
      }
      if (pageRows[0]?.sourceTableRank !== expectedFirstRank || pageRows.at(-1)?.sourceTableRank !== expectedLastRank) {
        throw new Error(`Transfermarkt ${config.categorySlug} assists: página ${page} no continúa el rango esperado ${expectedFirstRank}-${expectedLastRank}`);
      }
      sourcePageEvidence.push({
        page,
        url: pageUrl,
        contentSha256: sourcePageContentSha256.at(-1)!,
        rows: pageRows.length,
        firstSourceTableRank: pageRows[0].sourceTableRank,
        lastSourceTableRank: pageRows.at(-1)!.sourceTableRank
      });
    }
    rows.push(...pageRows);
  }
  validateRows(rows, config.categorySlug, strictHistoricalValidation);
  const coverageComplete = isBundesliga || isLaLiga || isSerieA || isLigue1 || isPrimeiraLiga;
  return {
    categorySlug: config.categorySlug,
    source: {
      key: config.sourceKey,
      name: config.sourceName,
      sourceType: 'reference',
      baseUrl: config.sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `${config.sourceKey}-top-200-${new Date().toISOString().slice(0, 10)}`,
    // The source has supplied the complete requested top-200 slice for these
    // historical tables. Review and publication remain separate gates: it is
    // reference data with rights_status=review_required, so the snapshot
    // remains draft.
    coverageComplete,
    ...(!coverageComplete ? {
      allowPartialDraft: true,
      partialDraftReason: 'La tabla histórica aporta 200 filas positivas homogéneas, pero la definición histórica de asistencia y los derechos de redistribución de Transfermarkt requieren revisión antes de certificar cobertura total o publicar.'
    } : {}),
    reviewed: false,
    entries: rows.slice(0, transfermarktLaLigaAssistsTargetSize).map((row) => ({
      entityId: `${config.entityPrefix}player:${createHash('sha256').update(String(row.providerPlayerId)).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.assists,
      evidence: {
        sourceRank: row.sourceRank,
        sourceTableRank: row.sourceTableRank,
        providerPlayerId: row.providerPlayerId,
        profileUrl: row.profileUrl,
        appearances: row.appearances,
        assists: row.assists,
        sourceUrl: config.sourceUrl,
        scope: config.scope,
        assistDefinition: isBundesliga
          ? transfermarktBundesligaAssistsDefinition
          : isLaLiga
            ? transfermarktLaLigaAssistsDefinition
            : isSerieA
              ? transfermarktSerieAAssistsDefinition
              : isLigue1
                ? transfermarktLigue1AssistsDefinition
                : isPrimeiraLiga
                  ? transfermarktPrimeiraLigaAssistsDefinition
              : 'transfermarkt_historical_assist_column',
        ...(coverageComplete ? {
          ...(isLaLiga ? {
            historicalStartSeason: '1928-29',
            historicalEndSeason: 'current',
            seasonParameter: 'saison_id/0 (Ewige Vorlagengeberliste)',
            pagination: 'query_parameter_page',
            sourcePageCount: sourcePageContentSha256.length,
            sourcePageSize: 25,
            sourceRowsObserved: rows.length,
            sourcePageContentSha256,
            sourcePageEvidence
          } : {}),
          ...(isBundesliga ? {
          historicalStartSeason: '1963-64',
          historicalEndSeason: 'current',
          seasonParameter: 'saison_id/0 (all seasons)',
          pagination: 'query_parameter_page',
          sourcePageCount: sourcePageContentSha256.length,
          sourcePageSize: 25,
          sourceRowsObserved: rows.length,
          sourcePageContentSha256,
          rightsStatus: 'review_required',
          rightsNote: 'Transfermarkt/Gumpo copyright; no public redistribution licence verified. Rights review is independent from data coverage.'
          } : {}),
          ...(isSerieA ? {
            historicalStartSeason: '1929-30',
            historicalEndSeason: 'current',
            seasonParameter: 'saison_id/0 (Ewige Vorlagengeberliste)',
            pagination: 'query_parameter_page',
            sourcePageCount: sourcePageContentSha256.length,
            sourcePageSize: 25,
            sourceRowsObserved: rows.length,
            sourcePageContentSha256,
            sourcePageEvidence,
            rightsStatus: 'review_required',
            rightsNote: 'Transfermarkt/Gumpo copyright; no public redistribution licence verified. Rights review is independent from data coverage.'
          } : {}),
          ...(isLigue1 ? {
            historicalStartSeason: '1932-33',
            historicalEndSeason: 'current',
            seasonParameter: 'saison_id/0 (Ewige Vorlagengeberliste)',
            pagination: 'query_parameter_page',
            sourcePageCount: sourcePageContentSha256.length,
            sourcePageSize: 25,
            sourceRowsObserved: rows.length,
            sourcePageContentSha256,
            sourcePageEvidence,
            rightsStatus: 'review_required',
            rightsNote: 'Transfermarkt/Gumpo copyright; no public redistribution licence verified. Rights review is independent from data coverage.'
          } : {}),
          ...(isPrimeiraLiga ? {
            historicalStartSeason: '1934-35',
            historicalEndSeason: 'current',
            seasonParameter: 'saison_id/0 (Ewige Vorlagengeberliste)',
            pagination: 'query_parameter_page',
            sourcePageCount: sourcePageContentSha256.length,
            sourcePageSize: 25,
            sourceRowsObserved: rows.length,
            sourcePageContentSha256,
            sourcePageEvidence,
            rightsStatus: 'review_required',
            rightsNote: 'Transfermarkt/Gumpo copyright; no public redistribution licence verified. Rights review is independent from data coverage.'
          } : {}),
          ...(isLaLiga ? {
            rightsStatus: 'review_required',
            rightsNote: 'Transfermarkt/Gumpo copyright; no public redistribution licence verified. Rights review is independent from data coverage.'
          } : {})
        } : {
          rightsNote: 'Transfermarkt/Gumpo copyright; no public redistribution licence verified; review_required.'
        })
      }
    }))
  };
}

export async function fetchTransfermarktLaLigaAssists(
  options: TransfermarktLaLigaAssistsFetchOptions = {}
): Promise<RankingInput> {
  return fetchTransfermarktHistoricalLeagueAssists(transfermarktHistoricalLeagueAssistsConfigs.laLiga, options);
}
