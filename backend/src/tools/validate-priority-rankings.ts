import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDb, pool } from '../db.js';
import {
  renderPriorityValidationMarkdown,
  validatePriorityRanking,
  type PriorityIdentityContext,
  type PrioritySourceSnapshot,
  type PriorityValidationReport
} from '../priorityRankingValidation.js';

const PRIORITY_SLUGS = ['uefa-champions-league-goals', 'world-cup-goals'] as const;

type RankingTruthReport = {
  categories: Array<{
    slug: string;
    snapshots: {
      ranking: { id: string | null; dataVersion: string | null; algorithmVersion: string | null; contentSha256: string | null; generatedAt: string | null; status: string | null };
      source: { id: string | null; storageUri: string | null; contentSha256: string | null };
    };
    observedScope: { coverageComplete: boolean | null };
    top20: Array<{
      entityId: string;
      sourceEntityId: string;
      sourceName: string;
      canonicalName: string;
      value: number;
      rank: number;
      score: number;
      tieGroup: number;
      identityStatus: 'canonical' | 'resolved' | 'missing' | 'conflict';
      playable: boolean;
      mediaStatus: 'licensed' | 'fallback' | 'pending' | 'unavailable';
      evidenceUrls: string[];
    }>;
  }>;
};

type ExternalRow = { entity_id: string; external_id: string };
type ImageRow = { entity_id: string; provider: string; review_status: string; rights_evidence_url: string | null; rights_verified_at: string | null; source_url: string | null; local_path: string | null };

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeUrl(value: string): string {
  return value.replace(/^https?:\/\//u, 'https://').replace(/\/$/u, '');
}

function independentReferences(slug: string): Array<{ name: string; url: string; scope: string; status: 'reference_only' }> {
  if (slug === 'uefa-champions-league-goals') {
    return [{ name: 'UEFA — ranking histórico de goleadores', url: 'https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/', scope: 'contraste oficial; confirmar definición de competición y clasificatorias', status: 'reference_only' }];
  }
  return [{ name: 'FIFA — máximos goleadores históricos del Mundial', url: 'https://www.fifa.com/en/id/mens/worldcup/articles/fifa-world-cup-all-time-leading-scorers', scope: 'contraste oficial; torneos finales de la Copa Mundial masculina', status: 'reference_only' }];
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function loadContext(sourceKeys: string[], entityIds: string[]): Promise<PriorityIdentityContext> {
  const [externals, images] = await Promise.all([
    pool.query<ExternalRow>(
      `SELECT entity_id, external_id
         FROM entity_external_ids
        WHERE source_key = ANY($1::text[])
          AND entity_type = 'player'`,
      [sourceKeys]
    ),
    pool.query<ImageRow>(
      `SELECT entity_id, provider, review_status, rights_evidence_url, rights_verified_at, source_url, local_path
         FROM image_assets
        WHERE entity_id = ANY($1::text[])
          AND asset_kind = 'portrait'`,
      [entityIds]
    )
  ]);
  const profileUrlsByEntity: Record<string, string[]> = {};
  const entitiesByProfileUrl: Record<string, string[]> = {};
  for (const external of externals.rows) {
    const url = normalizeUrl(external.external_id);
    profileUrlsByEntity[external.entity_id] = [...(profileUrlsByEntity[external.entity_id] ?? []), url];
    entitiesByProfileUrl[url] = [...new Set([...(entitiesByProfileUrl[url] ?? []), external.entity_id])].sort();
  }
  const imageByEntity: PriorityIdentityContext['imageByEntity'] = {};
  for (const image of images.rows) {
    imageByEntity[image.entity_id] = [...(imageByEntity[image.entity_id] ?? []), {
      provider: image.provider,
      reviewStatus: image.review_status,
      rightsEvidenceUrl: image.rights_evidence_url,
      rightsVerifiedAt: image.rights_verified_at,
      sourceUrl: image.source_url,
      localPath: image.local_path
    }];
  }
  return { profileUrlsByEntity, entitiesByProfileUrl, imageByEntity };
}

async function main(): Promise<void> {
  const auditPath = resolve(arg('audit') ?? 'audits/ranking-truth/ranking-truth.json');
  const outputDirectory = resolve(arg('out-dir') ?? 'audits/ranking-validation');
  const audit = await readJson<RankingTruthReport>(auditPath);
  const categories = PRIORITY_SLUGS.map((slug) => audit.categories.find((category) => category.slug === slug));
  if (categories.some((category) => !category)) throw new Error(`El informe no contiene las dos categorías prioritarias: ${PRIORITY_SLUGS.join(', ')}`);
  const selected = categories as Array<NonNullable<typeof categories[number]>>;
  const sourceSnapshots = await Promise.all(selected.map(async (category) => {
    if (!category.snapshots.source.storageUri) throw new Error(`Falta storageUri de fuente para ${category.slug}`);
    return readJson<PrioritySourceSnapshot>(resolve(category.snapshots.source.storageUri));
  }));
  const contexts = await Promise.all(selected.map((category, index) => loadContext(
    sourceSnapshots[index] ? [sourceSnapshots[index].source.key] : [],
    [...new Set(category.top20.flatMap((entry) => [entry.entityId, entry.sourceEntityId]))]
  )));
  const reports: PriorityValidationReport[] = selected.map((category, index) => {
    const source = sourceSnapshots[index];
    if (!source) throw new Error(`Falta snapshot de fuente para ${category.slug}`);
    return validatePriorityRanking(
      {
        categorySlug: category.slug,
        rankingSnapshotId: category.snapshots.ranking.id,
        sourceSnapshotId: category.snapshots.source.id,
        source: source.source,
        snapshot: {
          dataVersion: category.snapshots.ranking.dataVersion,
          algorithmVersion: category.snapshots.ranking.algorithmVersion,
          contentSha256: category.snapshots.ranking.contentSha256,
          generatedAt: category.snapshots.ranking.generatedAt,
          coverageComplete: category.observedScope.coverageComplete,
          reviewed: source.reviewed,
          sourceContentSha256: category.snapshots.source.contentSha256,
          sourceStorageUri: category.snapshots.source.storageUri
        },
        top20: category.top20.map((entry) => ({ ...entry, sourceEntityId: entry.sourceEntityId, sourceName: entry.sourceName, canonicalName: entry.canonicalName, value: entry.value, rank: entry.rank, score: entry.score, tieGroup: entry.tieGroup, identityStatus: entry.identityStatus, playable: entry.playable, mediaStatus: entry.mediaStatus, evidenceUrls: entry.evidenceUrls })),
        sourceAudit: source.audit
      },
      source,
      contexts[index] ?? { profileUrlsByEntity: {}, entitiesByProfileUrl: {}, imageByEntity: {} },
      independentReferences(category.slug)
    );
  });
  const discrepancies = reports.flatMap((report) => report.discrepancies.map((discrepancy) => ({ categorySlug: report.categorySlug, ...discrepancy })));
  const bundle = {
    artifactKind: 'priority_ranking_validation_bundle' as const,
    readOnly: true as const,
    productionData: false as const,
    editorialApproval: false as const,
    auditInput: auditPath,
    categories: reports.map((report) => ({ categorySlug: report.categorySlug, validationSha256: report.hashes.validationSha256, discrepancyCount: report.discrepancies.length })),
    discrepancies,
    reports,
    recommendation: 'Informe de discrepancias para revisión técnica y editorial. No constituye una fuente de producción ni una aprobación.',
  };
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    ...reports.map((report) => writeFile(resolve(outputDirectory, `ranking-validation-${report.categorySlug}.md`), renderPriorityValidationMarkdown(report), 'utf8')),
    writeFile(resolve(outputDirectory, 'ranking-validation-discrepancies.json'), `${JSON.stringify(bundle, null, 2)}\n`, 'utf8')
  ]);
  console.log(JSON.stringify({ readOnly: true, productionData: false, editorialApproval: false, outputDirectory, categories: bundle.categories, discrepancyCount: discrepancies.length }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
