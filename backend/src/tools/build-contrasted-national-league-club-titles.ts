import { buildOpenFootballManifest } from './generate-openfootball-manifest.js';
import { importRankingInput } from '../imports/rankingInput.js';
import { calculateOpenFootballWinner, parseFootballTxtResults } from '../providers/openFootballClient.js';
import { deriveFootballDataSeasonWinners, fetchFootballDataResults } from '../providers/footballDataResultsClient.js';
import { buildContrastedNationalLeagueRanking, type NationalLeagueTitleObservation } from '../providers/nationalLeagueTitlesContrast.js';
import { closeDb } from '../db.js';

const now = new Date();
const dryRun = process.argv.includes('--dry-run');

try {
  const manifest = await buildOpenFootballManifest(now);
  const openFootballObservations: NationalLeagueTitleObservation[] = [];
  // Keep a bounded concurrency: the manifest is large, but the source is
  // public and every response is independently validated before import.
  for (let offset = 0; offset < manifest.seasons.length; offset += 8) {
    const batch = manifest.seasons.slice(offset, offset + 8);
    const batchObservations = await Promise.all(batch.map(async (source): Promise<NationalLeagueTitleObservation> => {
    const response = await fetch(source.url, {
      headers: { 'User-Agent': 'Rango90-national-league-titles-contrast/0.1' },
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`OpenFootball ${source.url}: HTTP ${response.status}`);
    const matches = parseFootballTxtResults(await response.text(), source.season);
    const winner = calculateOpenFootballWinner(matches);
    const seasonStartYear = Number(source.season.match(/^\d{4}/)?.[0]);
    if (!Number.isInteger(seasonStartYear)) throw new Error(`Temporada OpenFootball inválida: ${source.season}`);
    return {
      source: 'openfootball',
      sourceUrl: source.url,
      competition: source.competition,
      season: source.season,
      seasonStartYear,
      clubName: winner.winner ?? '',
      derivation: 'reconstructed_table',
      status: winner.winner ? 'deterministic' : 'ambiguous',
      ...(winner.winner ? {} : { ambiguityReason: 'La tabla reconstruida no produce un campeón único' })
    };
    }));
    openFootballObservations.push(...batchObservations);
  }

  const footballDataUrl = 'https://raw.githubusercontent.com/schochastics/football-data/master/data/results/games.parquet';
  const footballDataMatches = await fetchFootballDataResults(footballDataUrl);
  const footballDataObservations: NationalLeagueTitleObservation[] = deriveFootballDataSeasonWinners(footballDataMatches, { now, sourceUrl: footballDataUrl }).map((winner) => ({
    source: 'football-data',
    sourceUrl: winner.sourceUrl,
    competition: winner.competition,
    season: winner.season,
    seasonStartYear: winner.seasonStartYear,
    clubName: winner.clubName,
    derivation: winner.derivation,
    status: winner.status,
    ...(winner.ambiguityReason ? { ambiguityReason: winner.ambiguityReason } : {})
  }));
  const observations = [...openFootballObservations, ...footballDataObservations];
  const input = buildContrastedNationalLeagueRanking(observations, {
    sourceVersion: `${manifest.sourceVersion}|football-data:${now.toISOString().slice(0, 10)}`,
    now
  });
  input.audit = {
    ...input.audit,
    openFootballManifestGeneratedAt: manifest.generatedAt,
    openFootballSeasonCount: manifest.seasons.length,
    openFootballObservationCount: openFootballObservations.length,
    footballDataObservationCount: footballDataObservations.length,
    footballDataResultCount: footballDataMatches.length,
    importMode: 'draft-only-contrasted-results'
  };
  const rankingId = dryRun ? null : await importRankingInput(input);
  console.log(JSON.stringify({
    categorySlug: input.categorySlug,
    rankingId,
    sourceVersion: input.dataVersion,
    observations: observations.length,
    entries: input.entries.length,
    audit: input.audit,
    coverageComplete: input.coverageComplete,
    reviewed: input.reviewed,
    published: false,
    dryRun,
    note: 'Importación draft. Solo las temporadas con coincidencia entre dos feeds se consideran confirmadas; las de una fuente quedan pendientes y las ambiguas/conflictivas no se cuentan.'
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
