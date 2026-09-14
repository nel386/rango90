import { config } from '../config.js';

export class ApiFootballClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl = config.apiFootballBaseUrl, apiKey = config.apiFootballKey) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey.trim();
  }

  async request<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error('API_FOOTBALL_KEY no está configurada');
    }

    const url = new URL(`${this.baseUrl}/${path.replace(/^\//, '')}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        headers: { 'x-apisports-key': this.apiKey },
        signal: AbortSignal.timeout(config.apiFootballTimeoutMs)
      });
      if (response.ok) return (await response.json()) as T;
      if (response.status === 401 || response.status === 403) {
        throw new Error(`API-Football ${response.status}: la API ha rechazado la credencial; comprueba API_FOOTBALL_KEY, que no sea un placeholder, el host ${this.baseUrl} y que la suscripción esté activa`);
      }
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`API-Football ${response.status}: ${await response.text()}`);
      }
      lastError = new Error(`API-Football ${response.status}`);
      const retryAfter = Number(response.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : 1_000 * 2 ** attempt;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 30_000)));
    }
    throw lastError instanceof Error ? lastError : new Error('API-Football request failed');
  }

  async requestAllPages<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T[]> {
    const rows: T[] = [];
    let page = 1;
    while (true) {
      const payload = await this.request<{ response?: T[]; paging?: { current?: number; total?: number } }>(path, { ...params, page });
      rows.push(...(payload.response ?? []));
      const current = payload.paging?.current ?? page;
      const total = payload.paging?.total ?? current;
      if (current >= total) return rows;
      page = current + 1;
    }
  }
}
