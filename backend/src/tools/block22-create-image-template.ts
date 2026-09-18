import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BLOCK22_IMAGE_HEADERS, serializeCsv, type Block22ImageRow } from '../block22ImageCandidates.js';

const inputFile = resolve(process.env.BLOCK22_GAPS_FILE?.trim() || 'audits/block21/BLOCK21_WORLD_CUP_IMAGE_GAPS.json');
const outputRoot = resolve(process.env.BLOCK22_TEMPLATE_OUTPUT_ROOT?.trim() || 'audits/block22');
const input = JSON.parse(await readFile(inputFile, 'utf8')) as { entries: Array<{ canonicalPlayerId: string; playerName: string }> };
const rows: Block22ImageRow[] = input.entries.map((entry) => ({
  entityId: entry.canonicalPlayerId,
  canonicalName: entry.playerName,
  category: 'world-cup-goals',
  currentImage: 'monogram',
  proposedUrl: '', author: '', license: '', licenseUrl: '', attribution: '', reviewDate: '', status: 'needs_source',
  observations: 'Pendiente de enlace y revisión manual del propietario.', resourceSha256: '', identityVerified: 'no', identityEvidenceUrl: '', licenseVerified: 'no', attributionVerified: 'no', rightsEvidenceUrl: ''
}));
await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, 'BLOCK22_IMAGE_REVIEW_TEMPLATE.csv'), serializeCsv(rows), 'utf8');
await writeFile(resolve(outputRoot, 'BLOCK22_IMAGE_REVIEW_TEMPLATE_SCHEMA.md'), `# BLOQUE 22 — plantilla manual de imágenes\n\nFilas: **${rows.length}**. Editar solo con enlaces que el propietario pueda revisar.\n\nNo se descargan imágenes ni se aprueba ningún activo automáticamente. Una fila con enlace debe conservar autor, licencia, atribución, fecha, huella SHA-256 y evidencias de identidad/derechos.\n\nColumnas:\n\n${BLOCK22_IMAGE_HEADERS.map((header) => `- \`${header}\``).join('\n')}\n\nLos estados permitidos para incorporar una propuesta son \`pending_review\` o \`needs_source\`; \`approved\` y \`published\` están prohibidos en esta fase.\n`, 'utf8');
console.log(JSON.stringify({ status: 'template_created', rows: rows.length, outputRoot, imagesDownloaded: false, approvals: 0, rightsChanged: false }, null, 2));
