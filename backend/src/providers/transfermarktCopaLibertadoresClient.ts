import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const sourceUrl = 'https://www.transfermarkt.com/copa-libertadores/ewigetorschuetzenliste/pokalwettbewerb/CLI/land_id/0/plus/0/galerie/0';

function translatedTransfermarktUrl(value: string): string {
  const url = new URL(value);
  url.hostname = 'www-transfermarkt-com.translate.goog';
  url.searchParams.set('_x_tr_sl', 'auto');
  url.searchParams.set('_x_tr_tl', 'en');
  url.searchParams.set('_x_tr_hl', 'en');
  return url.toString();
}

export type TransfermarktCopaLibertadoresGoalEntry = {
  sourceRank: number;
  name: string;
  goals: number;
  externalId: string;
  profileUrl: string;
  imageUrl: string | null;
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

/** Parses one compact Transfermarkt page (25 outer table rows). */
export function parseTransfermarktCopaLibertadoresGoalsPage(html: string, rankOffset = 0): TransfermarktCopaLibertadoresGoalEntry[] {
  const rows: TransfermarktCopaLibertadoresGoalEntry[] = [];
  const chunks = html.split(/(?=<tr\s+class="(?:odd|even)")/i).filter((chunk) => /^\s*<tr\s+class="(?:odd|even)"/i.test(chunk));
  for (const chunk of chunks) {
    const rankMatch = /<td\s+class="zentriert\s+">\s*(\d+)\s*<\/td>/i.exec(chunk);
    const playerMatch = /<td\s+class="hauptlink">\s*<a\s+title="([^"]+)"\s+href="([^"]+\/profil\/spieler\/\d+)[^"]*"/i.exec(chunk);
    const imageMatch = /<img\s+src="([^"]+\/portrait\/small\/[^"?]+)/i.exec(chunk);
    const goalMatches = [...chunk.matchAll(/<td\s+class="zentriert\s+hauptlink">\s*(\d+)\s*<\/td>/gi)];
    const goalMatch = goalMatches.at(-1);
    const sourceRank = Number(rankMatch?.[1]);
    const profileUrl = canonicalTransfermarktUrl(playerMatch?.[2] ?? '');
    const name = decodeHtml(playerMatch?.[1] ?? '');
    const goals = Number(goalMatch?.[1]);
    if (!Number.isInteger(sourceRank) || sourceRank < 1 || !name || !profileUrl || !Number.isInteger(goals) || goals < 1) continue;
    rows.push({
      sourceRank: rankOffset + rows.length + 1,
      name,
      goals,
      externalId: profileUrl,
      profileUrl,
      imageUrl: imageMatch?.[1] ? canonicalTransfermarktUrl(imageMatch[1]) : null
    });
  }
  return rows;
}

type TransfermarktCompetitionConfig = {
  label: string;
  sourceUrl: string;
  /** Optional fetch-only URL used when the direct Transfermarkt host is WAF-challenged. */
  fetchUrl?: string;
  categorySlug: string;
  sourceKey: string;
  entityNamespace: string;
  anchor?: { name: string; goals: number };
};

function validateTop200(rows: TransfermarktCopaLibertadoresGoalEntry[], label: string, anchor?: { name: string; goals: number }): void {
  if (rows.length < 200) throw new Error(`Transfermarkt ${label}: se esperaban al menos 200 filas, llegaron ${rows.length}`);
  const ids = new Set<string>();
  let previousGoals = Number.POSITIVE_INFINITY;
  for (const row of rows.slice(0, 200)) {
    if (ids.has(row.externalId)) throw new Error(`Transfermarkt ${label}: jugador duplicado ${row.externalId}`);
    if (row.goals > previousGoals) throw new Error(`Transfermarkt ${label}: goles fuera de orden en ${row.name}`);
    ids.add(row.externalId);
    previousGoals = row.goals;
  }
  if (anchor) {
    const first = rows[0];
    if (first?.name !== anchor.name || first.goals !== anchor.goals) {
      throw new Error(`Transfermarkt ${label}: anclaje inesperado (${first?.name ?? 'sin jugador'}: ${first?.goals ?? 'sin goles'})`);
    }
  }
}

async function fetchTransfermarktCompetitionGoals(config: TransfermarktCompetitionConfig): Promise<RankingInput> {
  const rows: TransfermarktCopaLibertadoresGoalEntry[] = [];
  const requestBaseUrl = new URL(config.fetchUrl ?? config.sourceUrl);
  const fetchPage = async (url: string): Promise<Response> => {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await fetch(url, {
        headers: { 'User-Agent': 'Rango90-data-import/0.1 (football data research)' },
        signal: AbortSignal.timeout(20_000)
      });
      if (response.ok || response.status !== 429 || attempt === 3) return response;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_500 * (attempt + 1)));
    }
    return response!;
  };
  for (let page = 1; rows.length < 200 && page <= 8; page += 1) {
    const requestUrl = new URL(requestBaseUrl);
    if (page > 1) requestUrl.pathname = `${requestUrl.pathname.replace(/\/$/, '')}/page/${page}`;
    const url = requestUrl.toString();
    let response = await fetchPage(url);
    if (!response.ok) throw new Error(`Transfermarkt ${config.label} ${response.status} (página ${page})`);
    let body = await response.text();
    let pageRows = parseTransfermarktCopaLibertadoresGoalsPage(body, rows.length);
    // Transfermarkt's CDN WAF returns an empty 202 to non-browser clients.
    // Its Google Translate proxy serves the same public HTML and keeps the
    // original source links in the document, so use it only as a transport
    // fallback when the direct response contains no table rows.
    if (pageRows.length === 0) {
      response = await fetchPage(translatedTransfermarktUrl(url));
      if (!response.ok) throw new Error(`Transfermarkt ${config.label} ${response.status} (página ${page}, proxy)`);
      body = await response.text();
      pageRows = parseTransfermarktCopaLibertadoresGoalsPage(body, rows.length);
    }
    if (pageRows.length === 0) throw new Error(`Transfermarkt ${config.label}: página ${page} sin filas`);
    rows.push(...pageRows);
  }
  validateTop200(rows, config.label, config.anchor);
  const topTwoHundred = rows.slice(0, 200);
  return {
    categorySlug: config.categorySlug,
    source: {
      key: config.sourceKey,
      name: `Transfermarkt — historical ${config.label} top scorers`,
      sourceType: 'reference',
      baseUrl: config.sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `transfermarkt-${config.label.toLowerCase().replaceAll(' ', '-')}-goals-top-200-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: topTwoHundred.map((row) => ({
      entityId: `transfermarkt:${config.entityNamespace}:player:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.goals,
      evidence: {
        sourceRank: row.sourceRank,
        externalId: row.externalId,
        profileUrl: row.profileUrl,
        sourceImageUrl: row.imageUrl,
        sourceUrl: config.sourceUrl,
        scope: `Goles históricos de jugadores en ${config.label} según la tabla histórica de Transfermarkt; top 200 visible; derechos y metodología sujetos a revisión antes de publicar`
      }
    }))
  };
}

export async function fetchTransfermarktCopaLibertadoresGoals(): Promise<RankingInput> {
  return fetchTransfermarktCompetitionGoals({
    label: 'Copa Libertadores',
    sourceUrl,
    categorySlug: 'copa-libertadores-goals',
    sourceKey: 'transfermarkt-copa-libertadores-historical-goals',
    entityNamespace: 'copa-libertadores',
    anchor: { name: 'Alberto Spencer', goals: 54 }
  });
}

export async function fetchTransfermarktCopaSudamericanaGoals(): Promise<RankingInput> {
  return fetchTransfermarktCompetitionGoals({
    label: 'Copa Sudamericana',
    sourceUrl: 'https://www.transfermarkt.com/copa-sudamericana/ewigetorschuetzenliste/pokalwettbewerb/CS/land_id/0/plus/0/galerie/0',
    categorySlug: 'copa-sudamericana-goals',
    sourceKey: 'transfermarkt-copa-sudamericana-historical-goals',
    entityNamespace: 'copa-sudamericana'
  });
}

export async function fetchTransfermarktUefaEuropaLeagueGoals(): Promise<RankingInput> {
  return fetchTransfermarktCompetitionGoals({
    label: 'UEFA Cup / Europa League',
    sourceUrl: 'https://www.transfermarkt.com/uefa-europa-league/ewigetorschuetzenliste/pokalwettbewerb/EL/land_id/0/plus/0/galerie/0',
    fetchUrl: 'https://www-transfermarkt-com.translate.goog/uefa-europa-league/ewigetorschuetzenliste/pokalwettbewerb/EL/land_id/0/plus/0/galerie/0?_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en',
    categorySlug: 'uefa-cup-europa-league-goals',
    sourceKey: 'transfermarkt-uefa-cup-europa-league-historical-goals',
    entityNamespace: 'uefa-cup-europa-league'
  });
}

export async function fetchTransfermarktEuropeanCupChampionsLeagueGoals(): Promise<RankingInput> {
  return fetchTransfermarktCompetitionGoals({
    label: 'European Cup / Champions League',
    sourceUrl: 'https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0',
    fetchUrl: 'https://www-transfermarkt-com.translate.goog/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0?_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en',
    // The legacy command is retained, but the catalog's active canonical slug
    // is uefa-champions-league-goals; the former duplicate is retired.
    categorySlug: 'uefa-champions-league-goals',
    sourceKey: 'transfermarkt-european-cup-champions-league-historical-goals',
    entityNamespace: 'european-cup-champions-league',
    anchor: { name: 'Cristiano Ronaldo', goals: 140 }
  });
}

export async function fetchTransfermarktWorldCupGoals(): Promise<RankingInput> {
  return fetchTransfermarktCompetitionGoals({
    label: 'FIFA World Cup final tournaments',
    sourceUrl: 'https://www.transfermarkt.com/weltmeisterschaft/ewigetorschuetzenliste/pokalwettbewerb/FIWC/plus//land_id/0',
    fetchUrl: 'https://www-transfermarkt-com.translate.goog/weltmeisterschaft/ewigetorschuetzenliste/pokalwettbewerb/FIWC/plus//land_id/0?_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en',
    categorySlug: 'world-cup-goals',
    sourceKey: 'transfermarkt-world-cup-historical-goals',
    entityNamespace: 'world-cup',
    anchor: { name: 'Kylian Mbappé', goals: 22 }
  });
}

export async function fetchTransfermarktClubWorldCupGoals(): Promise<RankingInput> {
  return fetchTransfermarktCompetitionGoals({
    label: 'FIFA Club World Cup',
    sourceUrl: 'https://www.transfermarkt.com/fifa-klub-wm/ewigetorschuetzenliste/pokalwettbewerb/KLUB',
    fetchUrl: 'https://www-transfermarkt-com.translate.goog/fifa-klub-wm/ewigetorschuetzenliste/pokalwettbewerb/KLUB?_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en',
    categorySlug: 'club-world-cup-goals',
    sourceKey: 'transfermarkt-fifa-club-world-cup-historical-goals',
    entityNamespace: 'club-world-cup'
  });
}

export async function fetchTransfermarktCopaAmericaGoals(): Promise<RankingInput> {
  return fetchTransfermarktCompetitionGoals({
    label: 'Copa América',
    sourceUrl: 'https://www.transfermarkt.com/copa-america/ewigetorschuetzenliste/pokalwettbewerb/COPA',
    fetchUrl: 'https://www-transfermarkt-com.translate.goog/copa-america/ewigetorschuetzenliste/pokalwettbewerb/COPA?_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en',
    categorySlug: 'copa-america-goals',
    sourceKey: 'transfermarkt-copa-america-historical-goals',
    entityNamespace: 'copa-america'
  });
}

export async function fetchTransfermarktNationsLeagueGoals(): Promise<RankingInput> {
  return fetchTransfermarktCompetitionGoals({
    label: 'UEFA Nations League',
    sourceUrl: 'https://www.transfermarkt.com/uefa-nations-league-finals/ewigetorschuetzenliste/pokalwettbewerb/UNFI',
    fetchUrl: 'https://www-transfermarkt-com.translate.goog/uefa-nations-league-finals/ewigetorschuetzenliste/pokalwettbewerb/UNFI?_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en',
    categorySlug: 'nations-league-goals',
    sourceKey: 'transfermarkt-nations-league-historical-goals',
    entityNamespace: 'nations-league'
  });
}
