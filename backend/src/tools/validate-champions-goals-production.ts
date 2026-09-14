import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type Entry = {
  entityId: string;
  entityType: string;
  name: string;
  rawValue: number;
  evidence?: { sourceRank?: number; externalId?: string; sourceUrl?: string };
};

type RankingInput = {
  categorySlug: string;
  dataVersion: string;
  coverageComplete: boolean;
  entries: Entry[];
  audit?: { contrastSources?: Array<Record<string, unknown>> };
};

const rankingPath = resolve(process.cwd(), 'data/production/uefa-champions-league-goals-2026-09-12.json');
const contrastPath = resolve(process.cwd(), 'data/evidence/uefa-champions-league-goals-2026-09-12/official-contrast.json');

const ranking = JSON.parse(await readFile(rankingPath, 'utf8')) as RankingInput;
const contrast = JSON.parse(await readFile(contrastPath, 'utf8')) as {
  comparison: { observedPrimaryRows: number; observedOfficialRows: number; matchedNames: number; equalValues: number; valueDiscrepancies: number };
  discrepancies: Array<Record<string, unknown>>;
};

const errors: string[] = [];
if (ranking.categorySlug !== 'uefa-champions-league-goals') errors.push('categorySlug incorrecto');
if (ranking.entries.length !== 200) errors.push(`se esperaban 200 filas y hay ${ranking.entries.length}`);
if (!ranking.coverageComplete) errors.push('coverageComplete debe ser true para un snapshot completo');

const entityIds = new Set<string>();
const externalIds = new Set<string>();
let previousValue = Number.POSITIVE_INFINITY;
for (const [index, entry] of ranking.entries.entries()) {
  const sourceRank = entry.evidence?.sourceRank;
  if (entry.entityType !== 'player') errors.push(`fila ${index + 1}: entityType no es player`);
  if (entityIds.has(entry.entityId)) errors.push(`fila ${index + 1}: entityId duplicado`);
  entityIds.add(entry.entityId);
  if (!Number.isFinite(entry.rawValue) || entry.rawValue <= 0) errors.push(`fila ${index + 1}: valor no positivo`);
  if (sourceRank !== index + 1) errors.push(`fila ${index + 1}: sourceRank ${sourceRank} no es ${index + 1}`);
  if (entry.rawValue > previousValue) errors.push(`fila ${index + 1}: valores fuera de orden`);
  previousValue = entry.rawValue;
  if (!entry.evidence?.externalId || externalIds.has(entry.evidence.externalId)) errors.push(`fila ${index + 1}: externalId vacío o duplicado`);
  if (entry.evidence?.externalId) externalIds.add(entry.evidence.externalId);
  if (/example|synthetic|placeholder|fake/i.test(entry.name)) errors.push(`fila ${index + 1}: nombre artificial`);
}

let currentRank = 0;
let previous: number | undefined;
let tieGroup = 0;
const tieGroups = new Map<number, number>();
const computed = ranking.entries.map((entry, index) => {
  if (previous === undefined || entry.rawValue !== previous) {
    currentRank = index + 1;
    tieGroup += 1;
    previous = entry.rawValue;
  }
  tieGroups.set(currentRank, (tieGroups.get(currentRank) ?? 0) + 1);
  return { sourceRank: index + 1, rank: currentRank, tieGroup, name: entry.name, goals: entry.rawValue };
});

const expectedDiscrepancies = contrast.comparison.valueDiscrepancies;
if (contrast.discrepancies.length !== expectedDiscrepancies) errors.push('el detalle de discrepancias no coincide con el resumen');
if (ranking.audit?.contrastSources?.length !== 2) errors.push('faltan las dos fuentes de contraste declaradas');

console.log(JSON.stringify({
  category: ranking.categorySlug,
  dataVersion: ranking.dataVersion,
  sourceRows: ranking.entries.length,
  uniqueEntities: entityIds.size,
  uniqueExternalIds: externalIds.size,
  sourcePositions: { first: 1, last: ranking.entries.length },
  rankingPositions: { first: computed[0]?.rank ?? null, last: computed.at(-1)?.rank ?? null },
  tieGroups: [...tieGroups.entries()].map(([rank, size]) => ({ rank, size })),
  contrast: contrast.comparison,
  readyForPublish: errors.length === 0 && expectedDiscrepancies === 0,
  errors
}, null, 2));

if (errors.length > 0) process.exitCode = 1;
