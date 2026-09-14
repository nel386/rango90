import { ApiFootballClient } from './apiFootballClient.js';

export type ApiFootballTrophy = {
  league?: string | null;
  country?: string | null;
  season?: string | number | null;
  place?: string | null;
};

export type ApiFootballPlayerTrophiesResult = {
  playerId: number;
  trophies: ApiFootballTrophy[];
};

export async function fetchApiFootballPlayerTrophies(playerId: number): Promise<ApiFootballPlayerTrophiesResult> {
  if (!Number.isInteger(playerId) || playerId < 1) throw new Error(`ID de jugador API-Football inválido: ${playerId}`);
  const client = new ApiFootballClient();
  const payload = await client.request<{ response?: ApiFootballTrophy[]; errors?: unknown }>(
    '/trophies',
    { player: playerId }
  );
  if (hasApiErrors(payload.errors)) throw new Error(`API-Football trophies ${playerId}: ${JSON.stringify(payload.errors)}`);
  const trophies = payload.response ?? [];
  for (const trophy of trophies) {
    if (!trophy || typeof trophy !== 'object' || typeof trophy.league !== 'string' || trophy.league.trim().length === 0) {
      throw new Error(`API-Football trophies ${playerId}: trofeo incompleto`);
    }
    if (trophy.place !== null && trophy.place !== undefined && typeof trophy.place !== 'string') {
      throw new Error(`API-Football trophies ${playerId}: posición inválida`);
    }
  }
  return { playerId, trophies };
}

function hasApiErrors(errors: unknown): boolean {
  if (Array.isArray(errors)) return errors.length > 0;
  if (errors && typeof errors === 'object') return Object.keys(errors).length > 0;
  return Boolean(errors);
}
