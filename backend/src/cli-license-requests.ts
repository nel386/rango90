import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDb, pool } from './db.js';
import { config } from './config.js';

type JsonRecord = Record<string, unknown>;

type AssetRow = {
  id: string;
  entity_id: string;
  canonical_name: string;
  country_code: string | null;
  provider: string;
  source_url: string;
  license_name: string | null;
  license_url: string | null;
  local_path: string | null;
  review_status: 'pending' | 'approved' | 'rejected';
  rights_basis: string;
  commercial_use: boolean;
  attribution_required: boolean;
  rights_evidence_url: string | null;
  trademark_status: string;
  source_rights_status: string;
  metadata: JsonRecord;
};

type AssetOutput = {
  imageAssetId: string;
  provider: string;
  assetUrl: string;
  sourcePageUrl: string;
  localPath: string | null;
  declaredLicense: string | null;
  declaredLicenseUrl: string | null;
  reviewStatus: AssetRow['review_status'];
  rightsBasis: string;
  commercialUse: boolean;
  attributionRequired: boolean;
  rightsEvidenceUrl: string | null;
  trademarkStatus: string;
  sourceRightsStatus: string;
};

type ClubRequest = {
  clubId: string;
  clubName: string;
  countryCode: string | null;
  probableRightsHolder: string;
  rightsHolderConfidence: 'low';
  rightsHolderStatus: 'not_verified';
  rightsHolderBasis: string;
  permissionRequired: boolean;
  permissionStatus: string;
  permissionRoute: string;
  requiredPermissionScope: string[];
  selectedAsset: AssetOutput | null;
  alternateAssets: AssetOutput[];
};

type ClubState = {
  name: string;
  countryCode: string | null;
  assets: AssetRow[];
};

const OUTPUT_VERSION = 'club-badge-license-requests-v1';
const permissionScope = [
  'commercial football game',
  'web and PWA',
  'Android application',
  'local storage and CDN/cache delivery',
  'resize/crop/convert to 512x512 WebP',
  'retention in immutable historical ranking snapshots',
  'worldwide distribution for the licence term',
  'trademark and crest reproduction clearance'
];

const providerPriority: Record<string, number> = {
  'api-football': 1,
  'uefa-official': 2,
  thesportsdb: 3,
  'wikimedia-commons': 4
};

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function metadataString(metadata: JsonRecord, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function directAssetUrl(asset: AssetRow): string {
  // TheSportsDB stores the team page in source_url and the image in badgeUrl.
  // Commons stores the file page in source_url and the original file in fileUrl.
  return metadataString(asset.metadata, 'badgeUrl')
    ?? metadataString(asset.metadata, 'fileUrl')
    ?? asset.source_url;
}

function toAssetOutput(asset: AssetRow): AssetOutput {
  return {
    imageAssetId: asset.id,
    provider: asset.provider,
    assetUrl: directAssetUrl(asset),
    sourcePageUrl: asset.source_url,
    localPath: asset.local_path,
    declaredLicense: asset.license_name,
    declaredLicenseUrl: asset.license_url,
    reviewStatus: asset.review_status,
    rightsBasis: asset.rights_basis,
    commercialUse: asset.commercial_use,
    attributionRequired: asset.attribution_required,
    rightsEvidenceUrl: asset.rights_evidence_url,
    trademarkStatus: asset.trademark_status,
    sourceRightsStatus: asset.source_rights_status
  };
}

function assetSort(a: AssetRow, b: AssetRow): number {
  const statusRank = { pending: 1, approved: 2, rejected: 3 } as const;
  return (statusRank[a.review_status] - statusRank[b.review_status])
    || ((providerPriority[a.provider] ?? 99) - (providerPriority[b.provider] ?? 99))
    || a.id.localeCompare(b.id);
}

function permissionRoute(provider: string): string {
  switch (provider) {
    case 'api-football':
      return 'Solicitar permiso escrito al titular del club y confirmar por contrato con API-Football/API-Sports si su distribución del asset cubre este uso; la URL de la API no es una licencia visual.';
    case 'uefa-official':
      return 'Solicitar permiso escrito al titular del club o una licencia UEFA que cubra expresamente el escudo concreto y este uso comercial; la URL oficial no es una licencia visual.';
    case 'thesportsdb':
      return 'Solicitar confirmación escrita de TheSportsDB sobre el artwork concreto y, además, autorización del titular del escudo; la existencia del artwork no acredita derechos comerciales.';
    case 'wikimedia-commons':
      return 'Conservar la licencia declarada como evidencia separada y obtener autorización marcaria/permiso del titular del club o una alternativa licenciada; una licencia de archivo no despeja por sí sola el uso del escudo.';
    default:
      return 'Identificar la fuente y solicitar permiso escrito al titular del club antes de publicar el escudo.';
  }
}

function permissionStatus(asset: AssetOutput | null): { required: boolean; status: string } {
  if (!asset) {
    return { required: true, status: 'asset_missing_and_permission_not_recorded' };
  }
  const evidenceComplete = asset.rightsBasis !== 'unknown'
    && asset.commercialUse
    && Boolean(asset.rightsEvidenceUrl)
    && asset.trademarkStatus === 'cleared';
  if (evidenceComplete) {
    return { required: false, status: 'evidence_recorded_needs_separate_legal_confirmation' };
  }
  return { required: true, status: 'permission_required_not_recorded' };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function markdownCell(value: unknown): string {
  return String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

async function main(): Promise<void> {
  const outputDirectory = resolve(arg('output-dir') ?? config.mediaCandidateRoot);
  const outputBase = arg('output-base') ?? OUTPUT_VERSION;
  await mkdir(outputDirectory, { recursive: true });

  const result = await pool.query<AssetRow>(
    `SELECT e.id AS entity_id, e.canonical_name, e.country_code,
            ia.id, ia.provider, ia.source_url, ia.license_name, ia.license_url,
            ia.local_path, ia.review_status, ia.rights_basis, ia.commercial_use,
            ia.attribution_required, ia.rights_evidence_url, ia.trademark_status,
            ia.metadata,
            COALESCE(s.rights_status, 'unknown') AS source_rights_status
     FROM entities e
     JOIN entity_game_profiles egp
       ON egp.entity_id = e.id AND egp.playable_default = TRUE
     LEFT JOIN image_assets ia
       ON ia.entity_id = e.id AND ia.asset_kind = 'badge'
     LEFT JOIN sources s
       ON s.key = CASE ia.provider
         WHEN 'api-football' THEN 'api-football'
         WHEN 'thesportsdb' THEN 'thesportsdb-artwork'
         WHEN 'uefa-official' THEN 'uefa-official'
         WHEN 'wikimedia-commons' THEN 'wikimedia-commons'
         ELSE ia.provider
       END
     WHERE e.entity_type = 'club'
     ORDER BY e.canonical_name, ia.id`
  );

  const byClub = new Map<string, ClubState>();
  for (const row of result.rows) {
    const current = byClub.get(row.entity_id) ?? { name: row.canonical_name, countryCode: row.country_code, assets: [] };
    if (row.id) current.assets.push(row);
    byClub.set(row.entity_id, current);
  }

  const clubs: ClubRequest[] = [...byClub.entries()].map(([clubId, club]) => {
    const assets = [...club.assets].sort(assetSort).map(toAssetOutput);
    const selectedAsset = assets[0] ?? null;
    const permission = permissionStatus(selectedAsset);
    return {
      clubId,
      clubName: club.name,
      countryCode: club.countryCode,
      probableRightsHolder: `Titular de la marca y/o diseño del escudo de «${club.name}»`,
      rightsHolderConfidence: 'low',
      rightsHolderStatus: 'not_verified',
      rightsHolderBasis: 'Inferencia basada únicamente en la identidad del club del catálogo; no se ha inventado ni verificado una entidad jurídica.',
      permissionRequired: permission.required,
      permissionStatus: permission.status,
      permissionRoute: permissionRoute(selectedAsset?.provider ?? 'unknown'),
      requiredPermissionScope: permissionScope,
      selectedAsset,
      alternateAssets: assets.slice(1)
    };
  });

  const providerCounts = clubs.flatMap((club) => club.selectedAsset ? [club.selectedAsset.provider] : []);
  const statusCounts = clubs.reduce<Record<string, number>>((counts, club) => {
    counts[club.permissionStatus] = (counts[club.permissionStatus] ?? 0) + 1;
    return counts;
  }, {});
  const manifest = {
    version: OUTPUT_VERSION,
    generatedAt: new Date().toISOString(),
    purpose: 'Paquete operativo para solicitar permisos/licencias de los escudos de clubes jugables.',
    sourceQuery: 'entities + entity_game_profiles.playable_default + image_assets(asset_kind=badge)',
    selectionRule: 'pending antes que approved antes que rejected; después api-football, uefa-official, thesportsdb y wikimedia-commons; después image_asset_id.',
    legalSafety: [
      'No cambia image_assets.',
      'No aprueba assets ni convierte una URL, licencia declarada o proveedor en autorización.',
      'probableRightsHolder es una hipótesis de contacto, no una identificación jurídica.',
      'La autorización marcaria y el alcance comercial deben documentarse antes de publicar.'
    ],
    summary: {
      playableClubs: clubs.length,
      clubsWithRegisteredAsset: clubs.filter((club) => club.selectedAsset !== null).length,
      clubsWithoutRegisteredAsset: clubs.filter((club) => club.selectedAsset === null).length,
      permissionRequired: clubs.filter((club) => club.permissionRequired).length,
      selectedAssetsByProvider: providerCounts.reduce<Record<string, number>>((counts, provider) => {
        counts[provider] = (counts[provider] ?? 0) + 1;
        return counts;
      }, {}),
      permissionStatus: statusCounts
    },
    clubs
  };

  const jsonPath = resolve(outputDirectory, `${outputBase}.json`);
  const csvPath = resolve(outputDirectory, `${outputBase}.csv`);
  const markdownPath = resolve(outputDirectory, `${outputBase}.md`);
  await writeFile(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const csvRows = [
    ['club_id', 'club_name', 'country_code', 'probable_rightsholder', 'rightsholder_confidence', 'permission_status', 'permission_route', 'image_asset_id', 'provider', 'asset_url', 'source_page_url', 'declared_license', 'declared_license_url', 'review_status', 'rights_basis', 'commercial_use', 'trademark_status', 'rights_evidence_url'].join(','),
    ...clubs.map((club) => {
      const asset = club.selectedAsset;
      return [
        club.clubId, club.clubName, club.countryCode, club.probableRightsHolder,
        club.rightsHolderConfidence, club.permissionStatus, club.permissionRoute,
        asset?.imageAssetId, asset?.provider, asset?.assetUrl, asset?.sourcePageUrl,
        asset?.declaredLicense, asset?.declaredLicenseUrl, asset?.reviewStatus,
        asset?.rightsBasis, asset?.commercialUse, asset?.trademarkStatus,
        asset?.rightsEvidenceUrl
      ].map(csvCell).join(',');
    })
  ];
  await writeFile(csvPath, `${csvRows.join('\n')}\n`, 'utf8');

  const markdownRows = clubs.map((club) => {
    const asset = club.selectedAsset;
    const assetLink = asset ? `[asset](${asset.assetUrl})` : 'sin asset registrado';
    return `| ${markdownCell(club.clubName)} | ${markdownCell(asset?.provider)} | ${assetLink} | ${markdownCell(club.probableRightsHolder)} | ${markdownCell(club.permissionStatus)} |`;
  });
  const markdown = [
    `# ${OUTPUT_VERSION}`,
    '',
    'Paquete generado desde los 228 clubes con `entity_game_profiles.playable_default = true`.',
    '',
    '> Este documento sirve para pedir permisos. No es una aprobación de derechos y no modifica PostgreSQL.',
    '',
    `Generado: ${manifest.generatedAt}`,
    `Clubes: ${clubs.length}`,
    `Permiso pendiente/no acreditado: ${manifest.summary.permissionRequired}`,
    '',
    '| Club | Proveedor | Asset exacto | Titular probable (no verificado) | Estado |',
    '| --- | --- | --- | --- | --- |',
    ...markdownRows,
    '',
    '## Alcance que debe figurar en el permiso',
    '',
    ...permissionScope.map((item) => `- ${item}`),
    '',
    '## Regla de uso',
    '',
    'La autorización debe identificar el escudo o familia de escudos, el titular que autoriza, el alcance comercial y el uso en web/PWA/Android/CDN. Una URL de API, una página de proveedor o una licencia declarada en Commons no sustituyen el permiso marcario requerido por la política de medios del proyecto.'
  ].join('\n');
  await writeFile(markdownPath, `${markdown}\n`, 'utf8');

  console.log(JSON.stringify({ jsonPath, csvPath, markdownPath, summary: manifest.summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => {
  await closeDb();
});
