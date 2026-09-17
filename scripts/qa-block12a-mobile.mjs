import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const phase = process.env.QA_PHASE ?? "lab";
const frontendUrl = (process.env.QA_FRONTEND_URL ?? "http://127.0.0.1:3000").replace(/\/$/u, "");
const artifactRoot = path.resolve(process.env.QA_ARTIFACT_DIR ?? "qa-artifacts", phase);
const timeoutSeconds = Number(process.env.QA_TIMEOUT_SECONDS ?? "22");
const reportPath = path.join(artifactRoot, `qa-report-${phase}.json`);
const screens = [];
const responseBodies = [];
const responseBodyPromises = [];
const consoleLines = [];
const networkLines = [];
let dependencyFailure = false;
let browser;
let context;
let page;
let traceStarted = false;

await fs.mkdir(artifactRoot, { recursive: true });

function detailOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function recordNotRun(name, detail) {
  screens.push({ screen: name, status: "not_run", detail });
}

async function writeReport() {
  await fs.writeFile(reportPath, `${JSON.stringify({ phase, viewport: { width: 390, height: 844 }, screens }, null, 2)}\n`);
  await fs.writeFile(path.join(artifactRoot, `network-${phase}.json`), `${JSON.stringify(responseBodies, null, 2)}\n`);
  await fs.writeFile(path.join(artifactRoot, `console-${phase}.log`), `${consoleLines.join("\n")}\n`);
  await fs.writeFile(path.join(artifactRoot, `network-${phase}.log`), `${networkLines.join("\n")}\n`);
}

async function waitForText(text, timeout = 10_000) {
  await page.getByText(text, { exact: true }).first().waitFor({ state: "visible", timeout });
}

async function waitForEntityPosition(current, timeout = 10_000) {
  await page.locator(".entity-card-topline").getByText(new RegExp(`Elemento ${current} de 7`, "u")).waitFor({ state: "visible", timeout });
}

async function screenshot(name) {
  const file = path.join(artifactRoot, name);
  await page.screenshot({ path: file, fullPage: true });
  const stat = await fs.stat(file);
  if (stat.size < 1000) throw new Error(`Screenshot is empty or too small: ${name}`);
  return path.relative(process.cwd(), file);
}

async function capture(name, check) {
  if (dependencyFailure || !page) {
    recordNotRun(name, dependencyFailure ? "browser/backend dependency failed" : "browser was not available");
    return false;
  }
  try {
    const detail = await check();
    screens.push({ screen: name, status: "passed", detail: detail ?? "assertions passed", screenshot: await screenshot(name) });
    return true;
  } catch (error) {
    const failedScreen = { screen: name, status: "failed", detail: detailOf(error) };
    try { failedScreen.screenshot = await screenshot(name); } catch (screenshotError) { failedScreen.detail += `; screenshot failed: ${detailOf(screenshotError)}`; }
    screens.push(failedScreen);
    return false;
  }
}

async function currentPlayerIndex() {
  const name = await page.locator(".entity-card h2").textContent();
  const match = name?.match(/QA Player (\d+)/u);
  if (!match) throw new Error(`Unexpected fixture player name: ${name ?? "missing"}`);
  return Number(match[1]);
}

async function categoryButtons() {
  return page.locator("button.category-row");
}

async function labelAt(index) {
  const button = (await categoryButtons()).nth(index);
  return (await button.locator(".category-copy strong").textContent())?.trim() ?? "";
}

async function startFromHome() {
  await page.getByRole("button", { name: /Jugar reto/u }).first().click();
  await waitForEntityPosition(1);
}

async function returnHomeFromGame() {
  await page.getByRole("button", { name: "Ir al inicio" }).click();
  await waitForText("Partida abandonada");
  await page.getByRole("button", { name: "Volver al inicio" }).click();
  await waitForText("Elige mal. Aprende rápido.");
}

async function selectCategory(index) {
  const button = (await categoryButtons()).nth(index);
  await button.waitFor({ state: "visible" });
  if (await button.isDisabled()) throw new Error(`Category ${index} is disabled`);
  await button.click();
}

try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROMIUM_EXECUTABLE_PATH || undefined });
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "es-ES",
    colorScheme: "light"
  });
  page = await context.newPage();
  page.on("console", (message) => consoleLines.push(`[${message.type()}] ${message.text()}`));
  page.on("pageerror", (error) => consoleLines.push(`[pageerror] ${error.message}`));
  page.on("requestfailed", (request) => networkLines.push(`FAILED ${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`));
  page.on("response", (response) => {
    const url = response.url();
    if (!url.includes("/v1/")) return;
    networkLines.push(`${response.status()} ${response.request().method()} ${url}`);
    const bodyPromise = response.text().then((body) => {
      responseBodies.push({ url, status: response.status(), body: body.slice(0, 50_000) });
    }).catch(() => undefined);
    responseBodyPromises.push(bodyPromise);
    responseBodies.push({ url, status: response.status(), bodyPending: true });
    void bodyPromise;
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  traceStarted = true;

  const url = `${frontendUrl}/es/`;
  if (phase !== "lab") {
    // The official audit has its own single-screen flow below.
  } else {
  const initialLoadPassed = await capture("01-carga-inicial.png", async () => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await waitForText("Elige mal. Aprende rápido.");
    await waitForText("Modo laboratorio");
    await waitForText("Datos provisionales");
    return "home and lab provisional banner visible";
  });
  if (!initialLoadPassed) dependencyFailure = true;

  if (!dependencyFailure) {
    const activeGamePassed = await capture("02-reto-activo.png", async () => {
      await startFromHome();
      await waitForText("¿Dónde encaja?");
      return "first playable player visible";
    });
    if (!activeGamePassed) dependencyFailure = true;

    await capture("03-respuesta-correcta.png", async () => {
      const playerIndex = await currentPlayerIndex();
      const bestIndex = (7 - (playerIndex % 7)) % 7;
      const bestLabel = await labelAt(bestIndex);
      await selectCategory(bestIndex);
      const feedback = page.locator(".feedback-card");
      await feedback.getByText(`La mejor categoría era: ${bestLabel}.`, { exact: true }).waitFor({ state: "visible" });
      await feedback.getByText("Respuesta correcta.", { exact: true }).waitFor({ state: "visible" });
      return `best category displayed: ${bestLabel}`;
    });

    await capture("04-respuesta-incorrecta-categoria.png", async () => {
      await waitForEntityPosition(2);
      const playerIndex = await currentPlayerIndex();
      const bestIndex = (7 - (playerIndex % 7)) % 7;
      const bestLabel = await labelAt(bestIndex);
      const buttons = await categoryButtons();
      let chosenIndex = -1;
      for (let index = 0; index < await buttons.count(); index += 1) {
        if (index !== bestIndex && !(await buttons.nth(index).isDisabled())) { chosenIndex = index; break; }
      }
      if (chosenIndex < 0) throw new Error("No enabled incorrect category was available");
      await selectCategory(chosenIndex);
      const feedback = page.locator(".feedback-card");
      await feedback.getByText(`La mejor categoría era: ${bestLabel}.`, { exact: true }).waitFor({ state: "visible" });
      await feedback.getByText("Respuesta menos óptima.", { exact: true }).waitFor({ state: "visible" });
      return `incorrect selection still exposed the correct category: ${bestLabel}`;
    });

    await capture("05-precarga-siguiente-jugador.png", async () => {
      await waitForEntityPosition(3);
      await page.waitForTimeout(300);
      const mediaRequests = responseBodies.filter((entry) => entry.url.includes("/v1/media/")).map((entry) => entry.url);
      if (new Set(mediaRequests).size < 2) throw new Error(`Expected current and next media requests, got ${new Set(mediaRequests).size}`);
      return `next player visible; ${new Set(mediaRequests).size} media requests observed`;
    });

    await capture("06-abandono.png", async () => {
      await page.getByRole("button", { name: "Abandonar" }).click();
      await waitForText("Partida abandonada");
      return "abandonment panel visible";
    });

    await capture("07-reinicio.png", async () => {
      await page.getByRole("button", { name: "Reiniciar" }).click();
      await waitForEntityPosition(1);
      if (await page.locator(".feedback-card").count() !== 0) throw new Error("old feedback remained after restart");
      return "restart returned to a clean first player";
    });

    await capture("08-respuestas-antiguas.png", async () => {
      await page.route("**/v1/games/*/decision", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        await route.continue();
      });
      const firstButton = (await categoryButtons()).filter({ has: page.locator(".category-copy strong") }).first();
      if (await firstButton.isDisabled()) throw new Error("first category unavailable for stale-response check");
      await firstButton.click();
      await page.getByRole("button", { name: "Abandonar" }).click();
      await page.getByRole("button", { name: "Volver al inicio" }).click();
      await waitForText("Elige mal. Aprende rápido.");
      await startFromHome();
      await page.waitForTimeout(1_800);
      await waitForEntityPosition(1);
      if (await page.locator(".feedback-card").count() !== 0) throw new Error("stale response changed the restarted game");
      await page.unroute("**/v1/games/*/decision");
      return "delayed response was ignored after generation reset";
    });

    await capture("09-timeout.png", async () => {
      await returnHomeFromGame();
      await startFromHome();
      await page.waitForTimeout((timeoutSeconds + 1) * 1_000);
      await waitForText("Tiempo agotado", 5_000);
      await waitForText("Las casillas restantes pesan 100.");
      return `timeout surfaced after approximately ${timeoutSeconds} seconds`;
    });

    await capture("10-error-de-red.png", async () => {
      await page.route("**/v1/challenges/daily", (route) => route.abort("failed").catch(() => undefined));
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForText("La partida no ha cargado.");
      await page.unroute("**/v1/challenges/daily");
      return "challenge load error and retry state visible";
    });

    await capture("11-ranking-historico.png", async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForText("Elige mal. Aprende rápido.");
      await page.getByRole("button", { name: "Ranking" }).click();
      await waitForText("La tabla no perdona.");
      await page.getByRole("button", { name: "Ver rankings por categoría" }).click();
      await waitForText("La historia, categoría a categoría.");
      const rankingStatus = page.locator(".ranking-status");
      await rankingStatus.waitFor({ state: "visible", timeout: 15_000 });
      const rankingStatusText = await rankingStatus.innerText();
      if (!rankingStatusText.includes("Ranking provisional / laboratorio")) throw new Error(`unexpected ranking status: ${rankingStatusText}`);
      return "historical ranking view visible with provisional status";
    });

    await capture("12-separacion-playable-historico.png", async () => {
      const body = await page.locator("body").innerText();
      if (!body.includes("Alcance: ranking histórico del snapshot")) throw new Error("historical snapshot scope copy is missing");
      if (!body.includes("No disponible para partidas jugables")) throw new Error("non-playable separation copy is missing");
      if (!(await page.locator(".category-ranking-row").count())) throw new Error("historical ranking rows are missing");
      return "historical rows expose non-playable separation";
    });
  }
  }
} catch (error) {
  dependencyFailure = true;
  consoleLines.push(`[runner] ${detailOf(error)}`);
  if (!page) {
    const names = phase === "official"
      ? ["01-official-not-ready.png"]
      : ["01-carga-inicial.png", "02-reto-activo.png", "03-respuesta-correcta.png", "04-respuesta-incorrecta-categoria.png", "05-precarga-siguiente-jugador.png", "06-abandono.png", "07-reinicio.png", "08-respuestas-antiguas.png", "09-timeout.png", "10-error-de-red.png", "11-ranking-historico.png", "12-separacion-playable-historico.png"];
    for (const name of names) recordNotRun(name, `browser/backend dependency failed: ${detailOf(error)}`);
  }
}

if (page && phase === "official") {
  await capture("01-official-not-ready.png", async () => {
    await page.goto(`${frontendUrl}/es/`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await waitForText("Todavía no está disponible.");
    await waitForText("Producto oficial");
    const body = await page.locator("body").innerText();
    if (!body.includes("El laboratorio sigue separado y no se usa como sustituto.")) throw new Error("official_not_ready copy is missing");
    if (body.includes("Modo laboratorio") || body.includes("Datos provisionales")) throw new Error("provisional lab copy leaked into official mode");
    return "official_not_ready visible with no lab fallback or provisional banner";
  });
}

if (traceStarted && context) {
  await context.tracing.stop({ path: path.join(artifactRoot, `trace-${phase}.zip`) }).catch((error) => consoleLines.push(`[trace] ${detailOf(error)}`));
}
if (context) await context.close().catch(() => undefined);
if (browser) await browser.close().catch(() => undefined);
await Promise.allSettled(responseBodyPromises);
await writeReport();

const failed = screens.some((screen) => screen.status === "failed");
const notRun = screens.some((screen) => screen.status === "not_run");
process.exitCode = failed || notRun ? 1 : 0;
