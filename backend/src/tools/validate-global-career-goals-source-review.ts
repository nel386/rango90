import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type SourceStatus = {
  key: string;
  status: string;
  observedRows?: {
    profiledPlayers?: number;
    publicAllTimeRankingRows?: number;
    publicRankingRows?: number;
    officialMatchesRows?: number;
    officialTopLevelRows?: number;
    publicGlobalCareerRankingRows?: number | null;
  };
};

type Evidence = {
  target: { minimumUniquePlayers: number };
  decision: { usableSourceFound: boolean; imported: boolean; databaseChanged: boolean; apiFootballUsed: boolean };
  sources: SourceStatus[];
};

const artifactPath = resolve(
  process.cwd(),
  'data/evidence/global-career-goals-2026-09-12/global-career-goals-source-review.json'
);

const evidence = JSON.parse(await readFile(artifactPath, 'utf8')) as Evidence;
const failures: string[] = [];

if (evidence.target.minimumUniquePlayers !== 200) {
  failures.push('El umbral del expediente debe ser 200 jugadores únicos');
}
if (evidence.decision.apiFootballUsed) {
  failures.push('El expediente declara uso de API-Football');
}
if (evidence.decision.usableSourceFound || evidence.decision.imported || evidence.decision.databaseChanged) {
  failures.push('Una investigación sin fuente válida no puede declarar importación ni cambios de BD');
}
if (new Set(evidence.sources.map((source) => source.key)).size !== evidence.sources.length) {
  failures.push('Hay fuentes duplicadas en el expediente');
}

for (const source of evidence.sources) {
  const rows = source.observedRows ?? {};
  const candidateRows = [
    rows.profiledPlayers,
    rows.publicAllTimeRankingRows,
    rows.publicRankingRows,
    rows.officialMatchesRows,
    rows.officialTopLevelRows,
    rows.publicGlobalCareerRankingRows
  ].filter((value): value is number => typeof value === 'number');
  if (source.status.startsWith('usable') && !candidateRows.some((value) => value >= 200)) {
    failures.push(`La fuente ${source.key} figura como usable sin 200 filas`);
  }
}

if (failures.length > 0) {
  throw new Error(failures.join('; '));
}

console.log(`Fuente válida encontrada: ${evidence.decision.usableSourceFound ? 'sí' : 'no'}`);
console.log(`Candidatos documentados: ${evidence.sources.length}`);
console.log('Expediente cerrado sin importación insegura.');
