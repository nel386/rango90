import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const sourceUrl = 'https://datencenter.dfb.de/competitions/bundesliga/record_scorers';

export type DfbBundesligaGoalEntry = {
  sourceRank: number;
  displayedRank: number;
  name: string;
  goals: number;
  appearances: number;
  externalId: string;
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

export function parseDfbBundesligaGoals(html: string): DfbBundesligaGoalEntry[] {
  const rowPattern = /<tr class="c-Table-body-row">\s*<td>\s*(\d+)\.\s*<\/td>\s*<td>\s*<a href="([^"]+)">\s*([^<]+?)\s*<\/a>\s*<\/td>\s*<td>\s*(\d+)\s*<\/td>\s*<td>\s*(\d+)\s*<\/td>\s*<\/tr>/g;
  const rows: DfbBundesligaGoalEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(html)) !== null) {
    const displayedRank = Number(match[1]);
    const externalId = match[2];
    const name = decodeHtml(match[3] ?? '');
    const goals = Number(match[4]);
    const appearances = Number(match[5]);
    if (!externalId || !name || !Number.isInteger(displayedRank) || !Number.isInteger(goals) || goals < 1 || !Number.isInteger(appearances) || appearances < 0) continue;
    rows.push({ sourceRank: rows.length + 1, displayedRank, name, goals, appearances, externalId });
  }
  return rows;
}

function validateTop100(rows: DfbBundesligaGoalEntry[]): void {
  if (rows.length < 100) throw new Error(`DFB Bundesliga: se esperaban al menos 100 filas, llegaron ${rows.length}`);
  const ids = new Set<string>();
  let previousRank = 0;
  let previousGoals = Number.POSITIVE_INFINITY;
  for (const row of rows.slice(0, 100)) {
    if (ids.has(row.externalId)) throw new Error(`DFB Bundesliga: jugador duplicado ${row.externalId}`);
    if (row.displayedRank < previousRank) throw new Error(`DFB Bundesliga: puesto fuera de orden ${row.displayedRank}`);
    if (row.goals > previousGoals) throw new Error(`DFB Bundesliga: goles fuera de orden en ${row.name}`);
    ids.add(row.externalId);
    previousRank = row.displayedRank;
    previousGoals = row.goals;
  }
}

function pageUrl(page: number): string {
  return `${sourceUrl}?competition_id=bundesliga&datacenter_name=datencenter&page=${page}`;
}

export async function fetchDfbBundesligaGoals(): Promise<RankingInput> {
  const collected: DfbBundesligaGoalEntry[] = [];
  const seen = new Set<string>();
  for (const page of [1, 2, 3]) {
    const response = await fetch(pageUrl(page), {
      headers: { 'User-Agent': 'Rango90-data-import/0.1' },
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) throw new Error(`DFB Bundesliga page ${page} ${response.status}`);
    for (const row of parseDfbBundesligaGoals(await response.text())) {
      if (seen.has(row.externalId)) continue;
      seen.add(row.externalId);
      collected.push({ ...row, sourceRank: collected.length + 1 });
    }
    if (collected.length >= 100) break;
  }
  if (collected.length < 100) throw new Error(`DFB Bundesliga: cobertura inesperadamente baja (${collected.length} jugadores únicos)`);
  const rows = collected.slice(0, 100);
  validateTop100(rows);
  return {
    categorySlug: 'bundesliga-goals',
    source: {
      key: 'dfb-bundesliga-record-scorers',
      name: 'DFB Bundesliga record scorers',
      sourceType: 'official',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `dfb-bundesliga-goals-top-100-${new Date().toISOString().slice(0, 10)}`,
    // The official table is validated as a complete ordered top-100 cut.
    // Source licensing and publication approval remain separate gates.
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `dfb:bundesliga:player:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.goals,
      evidence: {
        sourceRank: row.sourceRank,
        sourceDisplayedRank: row.displayedRank,
        externalId: row.externalId,
        appearances: row.appearances,
        sourceUrl,
        scope: 'Goles en Bundesliga según el registro histórico oficial del DFB; top 100 de jugadores únicos, deduplicado por la ficha estable del jugador'
      }
    }))
  };
}
