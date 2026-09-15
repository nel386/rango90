const pagesOrigin = process.env.RANGO90_PAGES_ORIGIN ?? "https://nel386.github.io/rango90";
const apiOrigin = process.env.RANGO90_API_ORIGIN ?? "https://rango90.onrender.com";

async function request(url, init = {}) {
  const response = await fetch(url, { ...init, redirect: "manual" });
  const body = await response.text();
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pages = await Promise.all([
  request(`${pagesOrigin}/es/`),
  request(`${pagesOrigin}/en/`),
]);
for (const [locale, result] of [["es", pages[0]], ["en", pages[1]]]) {
  assert(result.response.status === 200, `Pages ${locale}: HTTP ${result.response.status}`);
  assert(result.body.includes(`<html lang="${locale}">`), `Pages ${locale}: atributo lang ausente`);
  assert(result.body.includes("<title>Rango 90"), `Pages ${locale}: título ausente`);
  assert(result.body.includes("/_next/"), `Pages ${locale}: faltan assets de Next`);
}
const scriptPaths = [...pages[0].body.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
const scripts = await Promise.all(scriptPaths.map(async (path) => {
  const result = await request(new URL(path, pagesOrigin).toString());
  assert(result.response.status === 200, `Pages bundle ${path}: HTTP ${result.response.status}`);
  return result.body;
}));
const bundle = scripts.join("\n");
assert(bundle.includes(apiOrigin), "Pages bundle: falta el origen público del backend");
assert(!bundle.includes("api.example.com"), "Pages bundle: quedó un backend placeholder");

const health = await request(`${apiOrigin}/health`);
assert(health.response.status === 200, `API health: HTTP ${health.response.status}`);
const healthBody = JSON.parse(health.body);
assert(healthBody.ok === true, "API health: ok no es true");
assert(healthBody.database?.connected === true, "API health: base de datos no conectada");
assert(healthBody.database?.schemaReady === true, "API health: esquema no preparado");

const cors = await request(`${apiOrigin}/health`, {
  method: "OPTIONS",
  headers: {
    Origin: "https://nel386.github.io",
    "Access-Control-Request-Method": "GET",
    "Access-Control-Request-Headers": "content-type",
  },
});
assert(cors.response.status >= 200 && cors.response.status < 300, `CORS preflight: HTTP ${cors.response.status}`);
assert(cors.response.headers.get("access-control-allow-origin") === "https://nel386.github.io", "CORS: origen inesperado");
assert(cors.response.headers.get("access-control-allow-credentials") === "true", "CORS: credentials no habilitado");

const categories = await request(`${apiOrigin}/v1/categories`);
assert(categories.response.status === 200, `Categorías: HTTP ${categories.response.status}`);
assert(Array.isArray(JSON.parse(categories.body).categories), "Categorías: respuesta inválida");

const daily = await request(`${apiOrigin}/v1/challenges/daily`);
assert(daily.response.status === 200 || daily.response.status === 404, `Reto diario: HTTP ${daily.response.status}`);
const dailyBody = JSON.parse(daily.body);
if (daily.response.status === 200) {
  const challenge = dailyBody.challenge;
  assert(challenge?.id && challenge.kind === "daily", "Reto diario: contrato inválido");
  assert(Array.isArray(challenge.categories) && challenge.categories.length > 0, "Reto diario: faltan categorías");
  assert(Array.isArray(challenge.decisions) && challenge.decisions.length === challenge.decisionCount, "Reto diario: faltan decisiones");

  const game = await request(`${apiOrigin}/v1/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId: challenge.id }),
  });
  assert(game.response.status === 201, `Partida: HTTP ${game.response.status}`);
  const gameBody = JSON.parse(game.body);
  assert(gameBody.game?.id && gameBody.sessionToken, "Partida: sesión inválida");

  const usedCategories = new Set();
  const assignments = challenge.decisions.map((decision) => {
    const category = challenge.categories.find((candidate) => candidate.entityType === decision.entityType && !usedCategories.has(candidate.slug));
    assert(category, `Partida: no hay categoría compatible para ${decision.entityType}`);
    usedCategories.add(category.slug);
    return { ordinal: decision.ordinal, entityId: decision.entityId, categorySlug: category.slug };
  });
  const result = await request(`${apiOrigin}/v1/games/${encodeURIComponent(gameBody.game.id)}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": `smoke-public-${Date.now()}` },
    body: JSON.stringify({ sessionToken: gameBody.sessionToken, result: { assignments } }),
  });
  assert(result.response.status === 200, `Resultado: HTTP ${result.response.status}`);
  const resultBody = JSON.parse(result.body);
  assert(resultBody.accepted === true && resultBody.result?.assignments?.length === challenge.decisionCount, "Resultado: no aceptado");
} else {
  assert(dailyBody.error === "daily_challenge_not_found", "Reto diario ausente: error inesperado");
}

console.log(JSON.stringify({
  ok: true,
  pages: { es: pages[0].response.status, en: pages[1].response.status },
  api: { health: health.response.status, cors: cors.response.status, categories: categories.response.status, daily: daily.response.status },
  dailyState: daily.response.status === 200 ? (dailyBody.challenge.testOnly ? "test_only" : "published") : "not_published_yet",
}, null, 2));
