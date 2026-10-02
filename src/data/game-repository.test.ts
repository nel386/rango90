import assert from "node:assert/strict";
import { categories as backendCategories } from "../../backend/src/catalog";
import { HttpGameRepository, normalizeChallenge, RepositoryError } from "./game-repository";

const categories = Array.from({ length: 7 }, (_, index) => ({ ordinal: index, id: `category-${index}`, rankingSnapshotId: `snapshot-${index}`, slug: `category-${index}`, labelEs: `Categoría ${index}`, labelEn: `Category ${index}` }));
const decisions = Array.from({ length: 7 }, (_, index) => ({ ordinal: index, entityId: `entity-${index}`, name: `Entity ${index}`, shortName: `E${index}`, entityType: "player", imageStatus: "fallback" }));
const challenge = { id: "challenge-1", kind: "daily", challengeDate: "2026-09-16", sourceVersion: "source-1", challengeSha256: "hash-1", engineVersion: "engine-1", timeLimitSeconds: 90, scoreCap: 700, runtimeMode: "lab", provisionalData: true, testOnly: true, categories, decisions };

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const originalFetch = globalThis.fetch;
let dailyCalls = 0;
void (async () => {
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const path = new URL(String(input)).pathname;
  if (path === "/v1/challenges/daily") {
    dailyCalls += 1;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
    return jsonResponse({ challenge });
  }
  if (path === "/v1/games") {
    return jsonResponse({ sessionToken: "session-token-123456789", game: { id: "game-1", challengeId: "challenge-1", status: "active", startedAt: "2026-09-16T00:00:00.000Z", deadlineAt: "2026-09-16T00:01:30.000Z", currentOrdinal: 0 }, challenge });
  }
  if (path === "/v1/rankings/catalog") {
    return jsonResponse({ categories: [{ slug: "club-career-yellow-cards", labelEs: "Tarjetas amarillas globales en clubes — alcance observado", labelEn: "Global club yellow cards — observed scope", scope: "Ranking de carrera global", status: "partial_scope", selectable: true, allowsActiveSeason: true }] });
  }
  if (path.startsWith("/v1/rankings/")) {
    return jsonResponse({ category: "club-career-yellow-cards", categoryLabelEs: "Tarjetas amarillas globales en clubes — alcance observado", categoryLabelEn: "Global club yellow cards — observed scope", snapshotId: "snapshot-0", mode: "lab", status: "provisional", dataset: "active_weekly", season: 2026, scope: "active", scopeLabelEs: "3 competiciones completas", scopeLabelEn: "3 complete competitions", entries: [{ label_es: "Categoría 0", label_en: "Category 0", entity_id: "entity-0", canonical_name: "Entity 0", raw_value: 4, score_value: 4, rank: 1, tie_group: 1, image_status: "fallback", image_url: "/v1/media/entity-0/fallback", generated_at: "2026-09-16T00:00:00.000Z" }] });
  }
  return jsonResponse({ error: "not_found" }, 404);
}) as typeof fetch;

try {
  const repository = new HttpGameRepository("https://api.example.test");
  const [first, second] = await Promise.all([repository.getDailyChallenge(), repository.getDailyChallenge()]);
  assert.equal(first.id, "challenge-1");
  assert.equal(second.id, "challenge-1");
  assert.equal(dailyCalls, 1, "simultaneous daily loads must be deduplicated");
  const cardChallenge = normalizeChallenge({
    ...challenge,
    categories: [...categories.slice(0, 6), { ...categories[6]!, slug: "club-career-yellow-cards", labelEs: "Tarjetas amarillas globales en clubes", labelEn: "Global club career yellow cards" }],
  } as Parameters<typeof normalizeChallenge>[0]);
  const yellowCardsCategory = cardChallenge.categories.find((category) => category.slug === "club-career-yellow-cards");
  assert.equal(yellowCardsCategory?.label.es, "Tarjetas amarillas — temporada activa");
  assert.equal(yellowCardsCategory?.competitionLabel?.es, "Clubes · alcance observado");
  assert.match(yellowCardsCategory?.definition.es ?? "", /no representa una carrera completa/iu);
  assert.doesNotMatch(`${yellowCardsCategory?.label.es} ${yellowCardsCategory?.competitionLabel?.es}`, /global|histórico|carrera/iu);
  const backendYellowCards = backendCategories.find((category) => category.slug === "club-career-yellow-cards");
  assert.equal(backendYellowCards?.scopeKind, "club_active_season_observed");
  assert.match(backendYellowCards?.labelEs ?? "", /temporada activa.*alcance observado/iu);
  assert.match(backendYellowCards?.definition ?? "", /no es una carrera completa ni un ranking global/u);

  const session = await repository.startGame("challenge-1");
  assert.equal(session.status, "active");
  assert.equal(session.challenge.id, "challenge-1");
  const ranking = await repository.getCategoryRanking("category-0");
  assert.equal(ranking.status, "provisional");
  assert.equal(ranking.entries[0]?.canonicalName, "Entity 0");
  const yellowRanking = await repository.getCategoryRanking("club-career-yellow-cards", "active_season_weekly", "complete_scope");
  assert.equal(yellowRanking.category.labelEs, "Tarjetas amarillas — temporada activa (alcance observado)");
  assert.doesNotMatch(yellowRanking.category.labelEs, /global|carrera|histórico/iu);
  const rankingCategories = await repository.getRankingCategories();
  const yellowCatalogCategory = rankingCategories.find((category) => category.slug === "club-career-yellow-cards");
  assert.equal(yellowCatalogCategory?.labelEs, "Tarjetas amarillas — temporada activa (alcance observado)");
  assert.equal(yellowCatalogCategory?.scope, "Temporada activa; solo competiciones observadas. No es un ranking histórico ni de carrera.");

  globalThis.fetch = (async () => jsonResponse({ challenge: { ...challenge, decisions: decisions.slice(0, 6) } })) as typeof fetch;
  await assert.rejects(() => repository.getDailyChallenge(), (error: unknown) => error instanceof RepositoryError && error.code === "challenge_invalid");

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  })) as typeof fetch;
  await assert.rejects(() => repository.getRuntimeConfig({ timeoutMs: 5 }), (error: unknown) => error instanceof RepositoryError && error.kind === "timeout");

  const abortController = new AbortController();
  const cancelled = repository.getRuntimeConfig({ signal: abortController.signal });
  abortController.abort();
  await assert.rejects(() => cancelled, (error: unknown) => error instanceof RepositoryError && error.code === "request_cancelled");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("game-repository tests passed");
})().catch((error: unknown) => { throw error; });
