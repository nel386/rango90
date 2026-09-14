import sharp from 'sharp';

const MAX_FALLBACK_CACHE_ENTRIES = 4096;
const fallbackCache = new Map<string, Promise<Buffer>>();

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.codePointAt(0) ?? 0;
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return [...words[0]!].slice(0, 2).join('').toLocaleUpperCase('es-ES');
  return `${[...words[0]!][0] ?? ''}${[...words.at(-1)!][0] ?? ''}`.toLocaleUpperCase('es-ES');
}

/**
 * Generates an owned, deterministic visual fallback. It is intentionally not
 * stored in image_assets and must never be counted as a licensed portrait or
 * badge; it only keeps a playable UI slot visually complete while rights are
 * pending.
 */
export async function renderMediaFallback(name: string, entityId: string, entityType: 'player' | 'club' | 'national_team'): Promise<Buffer> {
  const cacheKey = `${entityId}:${entityType}:${name}`;
  const cached = fallbackCache.get(cacheKey);
  if (cached) return cached;

  const seed = hash(`${entityId}:${entityType}`);
  const hue = seed % 360;
  const text = escapeXml(initials(name));
  const label = escapeXml(entityType === 'player' ? 'Rango 90 player fallback' : 'Rango 90 team fallback');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 62% 34%)"/><stop offset="1" stop-color="hsl(${(hue + 46) % 360} 72% 19%)"/></linearGradient></defs>
    <rect width="512" height="512" rx="44" fill="url(#bg)"/>
    <circle cx="256" cy="206" r="78" fill="rgba(255,255,255,.16)"/>
    <path d="M112 438c17-91 73-132 144-132s127 41 144 132" fill="rgba(255,255,255,.16)"/>
    <text x="256" y="238" text-anchor="middle" font-family="Arial,sans-serif" font-size="82" font-weight="700" letter-spacing="2" fill="#fff">${text}</text>
    <text x="256" y="482" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" letter-spacing="2" fill="rgba(255,255,255,.72)">${label}</text>
  </svg>`;
  const rendered = sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();
  if (fallbackCache.size >= MAX_FALLBACK_CACHE_ENTRIES) {
    const oldest = fallbackCache.keys().next().value;
    if (oldest) fallbackCache.delete(oldest);
  }
  fallbackCache.set(cacheKey, rendered);
  void rendered.catch(() => {
    if (fallbackCache.get(cacheKey) === rendered) fallbackCache.delete(cacheKey);
  });
  return rendered;
}
