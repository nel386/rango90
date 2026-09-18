import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { WorldCupSnapshot } from '../worldCupRankingEngine.js';

const inputRoot = resolve(process.env.BLOCK20_INPUT_ROOT?.trim() || 'audits/block20');
const outputRoot = resolve(process.env.BLOCK21_IMAGE_GAP_OUTPUT_ROOT?.trim() || inputRoot);
const snapshots = JSON.parse(await readFile(resolve(inputRoot, 'BLOCK20_SNAPSHOTS.json'), 'utf8')) as { historical: WorldCupSnapshot; active: WorldCupSnapshot };

type Gap = {
  canonicalPlayerId: string;
  playerName: string;
  rank: number;
  rawValue: number;
  tieGroup: number;
  scopes: string[];
  snapshotIds: string[];
  factCount: number;
  imageStatus: 'unavailable';
  action: 'owner_must_supply_authorized_source';
};

const gaps = new Map<string, Gap>();
for (const snapshot of [snapshots.historical, snapshots.active]) {
  for (const entry of snapshot.ranking.filter((candidate) => candidate.rank <= 200)) {
    const prior = gaps.get(entry.canonicalPlayerId);
    gaps.set(entry.canonicalPlayerId, {
      canonicalPlayerId: entry.canonicalPlayerId,
      playerName: entry.playerName,
      rank: prior ? Math.min(prior.rank, entry.rank) : entry.rank,
      rawValue: prior ? Math.max(prior.rawValue, entry.rawValue) : entry.rawValue,
      tieGroup: prior?.tieGroup ?? entry.tieGroup,
      scopes: [...new Set([...(prior?.scopes ?? []), snapshot.dataset])].sort(),
      snapshotIds: [...new Set([...(prior?.snapshotIds ?? []), snapshot.id])].sort(),
      factCount: Math.max(prior?.factCount ?? 0, entry.factIds.length),
      imageStatus: 'unavailable',
      action: 'owner_must_supply_authorized_source'
    });
  }
}

const entries = [...gaps.values()].sort((a, b) => a.rank - b.rank || b.rawValue - a.rawValue || a.canonicalPlayerId.localeCompare(b.canonicalPlayerId));
const report = { status: 'manual_review_required', generatedAt: new Date().toISOString(), playersWithoutImage: entries.length, sourceSnapshots: { historical: snapshots.historical.id, active: snapshots.active.id }, entries, rightsChanged: false, imagesAdded: false, publicationChanged: false };
await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, 'BLOCK21_WORLD_CUP_IMAGE_GAPS.json'), JSON.stringify(report, null, 2), 'utf8');
await writeFile(resolve(outputRoot, 'BLOCK21_WORLD_CUP_IMAGE_GAPS.md'), `# BLOQUE 21 — jugadores del Mundial sin imagen\n\n- estado: **manual_review_required**\n- jugadores listados: **${entries.length}**\n- imágenes añadidas: **no**\n- cambios de derechos: **no**\n- publicación oficial: **sin cambios**\n\nEl propietario debe aportar enlaces y autorización de uso antes de incorporar cualquier imagen.\n\n| Jugador | ID canónico | Mejor puesto | Valor | Ámbitos | Hechos |\n| --- | --- | ---: | ---: | --- | ---: |\n${entries.map((entry) => `| ${entry.playerName} | ${entry.canonicalPlayerId} | ${entry.rank} | ${entry.rawValue} | ${entry.scopes.join(', ')} | ${entry.factCount} |`).join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ status: report.status, playersWithoutImage: entries.length, imagesAdded: false, rightsChanged: false, publicationChanged: false }, null, 2));
