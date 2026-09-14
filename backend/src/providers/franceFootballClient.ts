import vm from 'node:vm';
import type { RankingInput } from '../imports/rankingInput.js';

const sourceUrl = 'https://www.francefootball.fr/ballon-d-or/palmares/';

interface FranceFootballWinner {
  IDJOUEUR?: unknown;
  NOM?: unknown;
  YEAR?: unknown;
  LINK?: unknown;
  URLMEDIA?: unknown;
  CODEPAYS?: unknown;
}

export interface BallonDorWinner {
  year: number;
  playerId: string;
  name: string;
  winnerUrl: string;
  imageUrl: string;
  countryCode: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`France Football: falta ${label}`);
  return value.trim();
}

function parseNuxtState(html: string): unknown {
  const script = html.match(/window\.__NUXT__=([\s\S]*?)<\/script>/)?.[1];
  if (!script) throw new Error('France Football: no se encontró el estado __NUXT__');
  const context: { result?: unknown } = {};
  try {
    vm.runInNewContext(`result=${script}`, context, { timeout: 1_000 });
  } catch (error) {
    throw new Error(`France Football: estado __NUXT__ inválido (${error instanceof Error ? error.message : String(error)})`);
  }
  return context.result;
}

export function parseBallonDorWinners(html: string): BallonDorWinner[] {
  const root = parseNuxtState(html);
  const fetchState = isRecord(root) && isRecord(root.fetch) ? root.fetch : undefined;
  const palmares = fetchState && isRecord(fetchState['Palmares:0']) ? fetchState['Palmares:0'] : undefined;
  const sections = palmares && Array.isArray(palmares.palmaresObjectItems) ? palmares.palmaresObjectItems : undefined;
  const maleSection = sections?.find((section) => isRecord(section) && section.id === 'male');
  const rawWinners = maleSection && isRecord(maleSection) && Array.isArray(maleSection.players) ? maleSection.players : undefined;
  if (!rawWinners || rawWinners.length < 60) throw new Error(`France Football: palmarés masculino incompleto (${rawWinners?.length ?? 0} filas)`);

  const winners = Array.from(rawWinners, (raw) => {
    if (!isRecord(raw)) throw new Error('France Football: ganador con formato inválido');
    const winner = raw as FranceFootballWinner;
    const playerId = stringValue(winner.IDJOUEUR, 'IDJOUEUR');
    const name = stringValue(winner.NOM, 'nombre');
    const winnerUrl = stringValue(winner.LINK, `enlace de ${name}`);
    const imageUrl = stringValue(winner.URLMEDIA, `imagen de ${name}`);
    const countryCode = stringValue(winner.CODEPAYS, `país de ${name}`);
    const year = Number(stringValue(winner.YEAR, `año de ${name}`));
    if (!/^\d{4}$/.test(String(year)) || year < 1956 || year > 2100) throw new Error(`France Football: año inválido para ${name}`);
    if (!/^https:\/\//.test(imageUrl)) throw new Error(`France Football: URL de imagen inválida para ${name}`);
    return { year, playerId, name, winnerUrl, imageUrl, countryCode };
  });

  const years = new Set<number>();
  for (const winner of winners) {
    if (years.has(winner.year)) throw new Error(`France Football: año duplicado ${winner.year}`);
    years.add(winner.year);
  }
  if (winners.length !== years.size) throw new Error('France Football: existen años duplicados en el palmarés');
  return winners.sort((a, b) => b.year - a.year);
}

export async function fetchBallonDorRanking(): Promise<RankingInput> {
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`France Football palmarés ${response.status}`);
  const winners = parseBallonDorWinners(await response.text());
  const byPlayer = new Map<string, BallonDorWinner[]>();
  for (const winner of winners) {
    const current = byPlayer.get(winner.playerId) ?? [];
    current.push(winner);
    byPlayer.set(winner.playerId, current);
  }

  const entries = [...byPlayer.entries()].map(([playerId, playerWinners]) => {
    const latest = playerWinners[0];
    if (!latest) throw new Error(`France Football: jugador sin victorias ${playerId}`);
    const entityId = `france-football:player:${playerId}`;
    return {
      entityId,
      entityType: 'player' as const,
      name: latest.name,
      rawValue: playerWinners.length,
      evidence: {
        externalId: playerId,
        sourceUrl,
        scope: 'Ballon d’Or masculino; palmarés completo oficial',
        awardYears: playerWinners.map((winner) => winner.year).sort((a, b) => b - a)
      },
      image: {
        assetKind: 'portrait' as const,
        sourceUrl: latest.imageUrl,
        provider: 'france-football-official'
      }
    };
  }).sort((a, b) => b.rawValue - a.rawValue || a.name.localeCompare(b.name));

  return {
    categorySlug: 'ballon-dor-wins',
    source: {
      key: 'france-football-official',
      name: 'France Football official Ballon d’Or palmarès',
      sourceType: 'official',
      baseUrl: sourceUrl,
      rightsStatus: 'review_required'
    },
    dataVersion: `ballon-dor-men-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries,
    awards: winners.map((winner) => ({
      awardKey: 'ballon-dor-men',
      awardLabel: 'Ballon d’Or masculino',
      awardYear: winner.year,
      winnerEntityId: `france-football:player:${winner.playerId}`,
      sourceUrl,
      metadata: { winnerUrl: winner.winnerUrl, sourcePlayerId: winner.playerId, countryCode: winner.countryCode }
    }))
  };
}
