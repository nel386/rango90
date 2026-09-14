import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type OpenFootballManifestSeason = {
  competition: string;
  season: string;
  url: string;
  sourcePath: string;
  sourceSha: string;
};

export type OpenFootballManifest = {
  sourceVersion: string;
  generatedAt: string;
  seasons: OpenFootballManifestSeason[];
};

type Repository = {
  name: string;
  competitionRoot: string;
  excludeCountryRoots?: readonly string[];
};

type GitTreeResponse = {
  sha?: string;
  truncated?: boolean;
  tree?: Array<{ path?: string; type?: string; sha?: string }>;
};

const repositories: Repository[] = [
  { name: 'england', competitionRoot: 'england' },
  { name: 'deutschland', competitionRoot: 'germany' },
  { name: 'espana', competitionRoot: 'spain' },
  { name: 'italy', competitionRoot: 'italy' },
  { name: 'france', competitionRoot: 'france' },
  {
    name: 'europe',
    competitionRoot: 'europe',
    excludeCountryRoots: ['england', 'germany', 'spain', 'italy', 'france']
  },
  { name: 'south-america', competitionRoot: 'south-america' },
  { name: 'world', competitionRoot: 'world' }
];

function seasonStartYear(season: string): number {
  return Number(season.match(/^\d{4}/)?.[0] ?? NaN);
}

export function isCompletedSeasonLabel(season: string, now = new Date()): boolean {
  const year = seasonStartYear(season);
  if (!Number.isInteger(year)) return false;
  const currentYear = now.getUTCFullYear();
  // A YYYY-YY label beginning last year is normally the current European
  // season in September; a plain YYYY label for last year is complete.
  if (/^\d{4}-\d{2}$/.test(season)) return year < currentYear - 1;
  return year < currentYear;
}

function isTopFlightPath(repository: Repository, path: string): boolean {
  const normalized = path.toLowerCase();
  if (!normalized.endsWith('.txt') || normalized.includes('cup') || normalized.includes('qual')) return false;
  if (repository.name === 'england' || repository.name === 'deutschland' || repository.name === 'espana' || repository.name === 'italy' || repository.name === 'france') {
    return /(?:^|\/)1-[^/]+\.txt$/.test(normalized);
  }
  return /(?:^|\/)\d{4}(?:-\d{2})?_[a-z0-9-]+1\.txt$/.test(normalized);
}

export function competitionForPath(repository: Repository, path: string): string | null {
  const parts = path.split('/');
  if (repository.name === 'europe' || repository.name === 'south-america') return parts[0] || null;
  if (repository.name === 'world') return parts[1] || null;
  return repository.competitionRoot;
}

export function seasonForPath(repository: Repository, path: string): string | null {
  const parts = path.split('/');
  const candidate = repository.name === 'england' || repository.name === 'deutschland' || repository.name === 'espana' || repository.name === 'italy' || repository.name === 'france'
    ? parts[0]
    : parts.at(-1)?.match(/^(\d{4}(?:-\d{2})?)[_]/)?.[1];
  return candidate && isCompletedSeasonLabel(candidate) ? candidate : null;
}

export function selectOpenFootballSeasonFiles(repository: Repository, tree: GitTreeResponse, now = new Date()): OpenFootballManifestSeason[] {
  if (tree.truncated) throw new Error(`OpenFootball/${repository.name}: la respuesta del árbol GitHub está truncada`);
  const commitSha = tree.sha;
  if (!commitSha || !Array.isArray(tree.tree)) throw new Error(`OpenFootball/${repository.name}: respuesta GitHub inválida`);
  const selected: OpenFootballManifestSeason[] = [];
  for (const item of tree.tree) {
    if (item.type !== 'blob' || !item.path || !item.sha || !isTopFlightPath(repository, item.path)) continue;
    const competition = competitionForPath(repository, item.path);
    const fileName = item.path.split('/').at(-1) ?? '';
    const season = repository.name === 'england' || repository.name === 'deutschland' || repository.name === 'espana' || repository.name === 'italy' || repository.name === 'france'
      ? item.path.split('/')[0]
      : fileName.match(/^(\d{4}(?:-\d{2})?)[_]/)?.[1];
    if (!competition || !season || !isCompletedSeasonLabel(season, now) || repository.excludeCountryRoots?.includes(competition)) continue;
    selected.push({
      competition,
      season,
      url: `https://raw.githubusercontent.com/openfootball/${repository.name}/${commitSha}/${item.path}`,
      sourcePath: item.path,
      sourceSha: item.sha
    });
  }
  return selected.sort((left, right) => left.competition.localeCompare(right.competition) || left.season.localeCompare(right.season) || left.sourcePath.localeCompare(right.sourcePath));
}

async function fetchTree(repository: Repository): Promise<GitTreeResponse> {
  const response = await fetch(`https://api.github.com/repos/openfootball/${repository.name}/git/trees/master?recursive=1`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Rango90-openfootball-manifest/0.1' },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`OpenFootball/${repository.name}: GitHub API HTTP ${response.status}`);
  return await response.json() as GitTreeResponse;
}

export async function buildOpenFootballManifest(now = new Date()): Promise<OpenFootballManifest> {
  const result: OpenFootballManifestSeason[] = [];
  const versions: string[] = [];
  for (const repository of repositories) {
    const tree = await fetchTree(repository);
    versions.push(`${repository.name}@${tree.sha ?? 'unknown'}`);
    result.push(...selectOpenFootballSeasonFiles(repository, tree, now));
  }
  const deduped = new Map(result.map((season) => [`${season.competition}:${season.season}`, season]));
  return {
    sourceVersion: versions.join(','),
    generatedAt: now.toISOString(),
    seasons: [...deduped.values()].sort((left, right) => left.competition.localeCompare(right.competition) || left.season.localeCompare(right.season))
  };
}

const outputPath = process.argv.find((argument) => argument.startsWith('--output='))?.slice('--output='.length)
  ?? (process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : undefined);
if (outputPath) {
  const manifest = await buildOpenFootballManifest();
  const destination = resolve(outputPath);
  await writeFile(destination, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: destination, sourceVersion: manifest.sourceVersion, seasons: manifest.seasons.length, competitions: new Set(manifest.seasons.map((season) => season.competition)).size }, null, 2));
}
