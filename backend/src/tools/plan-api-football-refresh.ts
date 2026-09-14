import { apiFootballRefreshPlan, type ApiFootballRefreshFrequency } from '../apiFootballRefreshPolicy.js';

const frequency = process.argv.slice(2).find((value) => value === 'daily' || value === 'weekly') as ApiFootballRefreshFrequency | undefined;
if (!frequency) {
  console.error('Uso: npm run data:plan:api-football -- daily|weekly');
  process.exit(2);
}

console.log(JSON.stringify(apiFootballRefreshPlan(frequency), null, 2));
