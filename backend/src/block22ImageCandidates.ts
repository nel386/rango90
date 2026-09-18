export const BLOCK22_IMAGE_HEADERS = [
  'entityId', 'canonicalName', 'category', 'currentImage', 'proposedUrl', 'author', 'license', 'licenseUrl',
  'attribution', 'reviewDate', 'status', 'observations', 'resourceSha256', 'identityVerified',
  'identityEvidenceUrl', 'licenseVerified', 'attributionVerified', 'rightsEvidenceUrl'
] as const;

export type Block22ImageRow = Record<(typeof BLOCK22_IMAGE_HEADERS)[number], string>;

export function parseCsv(text: string): Block22ImageRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (quoted && character === '"' && next === '"') { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (!quoted && character === ',') { row.push(cell); cell = ''; continue; }
    if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += character;
  }
  if (cell || row.length) { row.push(cell); if (row.some((value) => value !== '')) rows.push(row); }
  const header = rows.shift()?.map((value) => value.trim()) ?? [];
  if (header.join('\u0000') !== BLOCK22_IMAGE_HEADERS.join('\u0000')) throw new Error(`La plantilla debe usar estas columnas: ${BLOCK22_IMAGE_HEADERS.join(',')}`);
  return rows.map((values) => Object.fromEntries(BLOCK22_IMAGE_HEADERS.map((key, index) => [key, values[index]?.trim() ?? ''])) as Block22ImageRow);
}

export function escapeCsv(value: string): string {
  return /[",\n\r]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function serializeCsv(rows: Block22ImageRow[]): string {
  return [BLOCK22_IMAGE_HEADERS.join(','), ...rows.map((row) => BLOCK22_IMAGE_HEADERS.map((key) => escapeCsv(row[key])).join(','))].join('\n') + '\n';
}

export function validateImageRow(row: Block22ImageRow): string[] {
  const issues: string[] = [];
  if (!row.entityId) issues.push('entityId_missing');
  if (!row.canonicalName) issues.push('canonicalName_missing');
  if (row.category !== 'world-cup-goals') issues.push('category_must_be_world-cup-goals');
  if (!row.proposedUrl) return row.status === 'needs_source' ? issues : [...issues, 'proposedUrl_missing'];
  try {
    const url = new URL(row.proposedUrl);
    if (url.protocol !== 'https:') issues.push('proposedUrl_must_use_https');
  } catch { issues.push('proposedUrl_invalid'); }
  if (!row.author) issues.push('author_missing');
  if (!row.license) issues.push('license_missing');
  if (!row.attribution) issues.push('attribution_missing');
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(row.reviewDate)) issues.push('reviewDate_must_be_iso_date');
  if (!/^[0-9a-fA-F]{64}$/u.test(row.resourceSha256)) issues.push('resourceSha256_must_be_sha256');
  if (row.identityVerified !== 'yes') issues.push('identity_not_manually_verified');
  if (!row.identityEvidenceUrl) issues.push('identityEvidenceUrl_missing');
  if (row.licenseVerified !== 'yes') issues.push('license_not_manually_verified');
  if (row.attributionVerified !== 'yes') issues.push('attribution_not_manually_verified');
  if (row.status === 'approved' || row.status === 'published') issues.push('automatic_approval_forbidden');
  if (row.status !== 'pending_review') issues.push('status_must_be_pending_review');
  return issues;
}
