import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BLOCK45H_SITE_URL?.trim() || "http://127.0.0.1:4179";
const output = "artifacts/block45h";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function inspectRanking(page) {
  const endpointResponse = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("No llegó la respuesta del ranking de amarillas")), 30_000);
    page.on("response", async (response) => {
      if (!response.url().includes("/v1/rankings/club-career-yellow-cards?")) return;
      clearTimeout(timeout);
      resolve({ status: response.status(), body: await response.json() });
    });
  });
  await page.locator("nav button").filter({ hasText: "RANKING" }).click();
  await page.getByRole("button", { name: /View rankings by category|Ver rankings por categoría/u }).click();
  await page.locator("#ranking-category-select").waitFor();
  await page.locator("#ranking-category-select").selectOption("club-career-yellow-cards");
  const result = await endpointResponse;
  assert.equal(result.status, 200);
  assert.equal(result.body.season, 2026);
  assert.equal(result.body.dataset, "active_weekly");
  assert.equal(result.body.scope, "active");
  assert.equal(result.body.coverageComplete, true);
  assert.deepEqual(result.body.includedCompetitions, ["39", "140", "135"]);
  assert.deepEqual(result.body.excludedCompetitions, ["78", "61", "94"]);
  assert.match(result.body.scopeLabelEs, /3 competiciones completas/u);
  assert.match(result.body.categoryLabelEs, /temporada actual/u);
  const topTwentyCut = result.body.entries.filter((entry) => entry.rank <= 20);
  assert.equal(topTwentyCut.length, 79, "empates deben conservar todas las filas hasta el puesto 20");
  assert.equal(new Set(topTwentyCut.map((entry) => entry.entity_id)).size, topTwentyCut.length);
  for (const entry of topTwentyCut) {
    assert.ok(entry.sources.length > 0, `${entry.canonical_name} debe conservar fuente`);
    for (const source of entry.sources) {
      assert.equal(source.verificationStatus, "confirmed");
      assert.match(source.contentSha256, /^[a-f0-9]{64}$/u);
      assert.match(source.locator, /season=2026/u);
      assert.match(source.locator, /league=(39|140|135),/u);
    }
  }
  const marcos = result.body.entries.find((entry) => entry.canonical_name === "Marcos Alonso");
  assert.ok(marcos);
  assert.equal(marcos.rank, 19);
  assert.equal(marcos.raw_value, 2);
  assert.equal(marcos.entity_id, "clubcards:api-football:player:2278");
  assert.match(marcos.sources[0].locator, /league=140,season=2026.*team\.id=538\.cards/u);
  const raulGarcia = result.body.entries.find((entry) => entry.canonical_name === "Raúl García");
  assert.equal(raulGarcia?.rank, 80);
  assert.equal(raulGarcia?.raw_value, 1);
  assert.equal(result.body.entries.some((entry) => entry.canonical_name === "Alberto Lopo"), false);

  const uiRow = page.locator(".category-ranking-row").filter({ hasText: "Marcos Alonso" });
  await uiRow.waitFor();
  const rowText = await uiRow.innerText();
  assert.match(rowText, /Marcos Alonso/u);
  assert.match(rowText, /19/u);
  assert.match(rowText, /2/u);
  const selectedCategory = await page.locator("#ranking-category-select").locator("option:checked").innerText();
  assert.doesNotMatch(selectedCategory, /global|carrera|histórico/iu);
  assert.match(await page.locator("#ranking-dataset-select").locator("option:checked").innerText(), /temporada activa/u);
  assert.match(await page.locator(".ranking-status").innerText(), /3 competiciones completas/u);
  return result.body;
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const response = await desktop.goto(`${baseUrl}/es/`, { waitUntil: "networkidle", timeout: 60_000 });
  assert.ok(response?.ok(), `La página no respondió correctamente: ${response?.status()}`);
  const desktopPayload = await inspectRanking(desktop);
  await desktop.screenshot({ path: `${output}/yellow-cards-active-scope-es-desktop.png`, fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mobileResponse = await mobile.goto(`${baseUrl}/es/`, { waitUntil: "networkidle", timeout: 60_000 });
  assert.ok(mobileResponse?.ok(), `La página móvil no respondió correctamente: ${mobileResponse?.status()}`);
  const mobilePayload = await inspectRanking(mobile);
  assert.equal(mobilePayload.snapshotId, desktopPayload.snapshotId);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await mobile.screenshot({ path: `${output}/yellow-cards-active-scope-es-mobile.png`, fullPage: true });

  console.log(JSON.stringify({
    status: "passed",
    category: desktopPayload.category,
    snapshotId: desktopPayload.snapshotId,
    season: desktopPayload.season,
    marcosAlonso: { rank: 19, yellowCards: 2 },
    desktop: `${output}/yellow-cards-active-scope-es-desktop.png`,
    mobile: `${output}/yellow-cards-active-scope-es-mobile.png`,
    endpointScope: "active season 2026; 3/6 competitions",
    mobileHorizontalOverflow: false,
  }, null, 2));
} finally {
  await browser.close();
}
