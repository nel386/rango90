const key = process.env.API_FOOTBALL_KEY?.trim();
const output = {
  source: 'api-football',
  scope: 'FIFA World Cup masculine final tournaments',
  requestedWindow: { start: 1930, end: 2026 },
  payloadStored: false,
  apiKeyStored: false,
  requestCount: 0,
  seasonsAvailable: [] as number[],
  status: 'not_run' as 'not_run' | 'passed' | 'failed',
  reason: ''
};
if (!key) {
  output.reason = 'API_FOOTBALL_KEY_missing';
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}
try {
  const response = await fetch('https://v3.football.api-sports.io/leagues?id=1', { headers: { 'x-apisports-key': key }, signal: AbortSignal.timeout(20_000) });
  output.requestCount = 1;
  if (!response.ok) throw new Error(`api_http_${response.status}`);
  const body = await response.json() as { response?: Array<{ seasons?: Array<{ year?: number }> }> };
  const years = (body.response?.[0]?.seasons ?? []).map((season) => season.year).filter((year): year is number => typeof year === 'number' && Number.isInteger(year));
  output.seasonsAvailable = [...new Set(years.filter((year) => year >= 1930 && year <= 2026))].sort((left, right) => left - right);
  output.status = 'passed';
  output.reason = 'coverage plan only; match/event payloads were not downloaded';
} catch (error) {
  output.status = 'failed';
  output.reason = error instanceof Error ? error.message.replaceAll(key, '[redacted]') : 'api_request_failed';
}
console.log(JSON.stringify(output, null, 2));

export {};
