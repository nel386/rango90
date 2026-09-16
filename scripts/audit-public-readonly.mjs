import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const runId = process.env.RANGO90_BLOCK6_RUN_ID ?? `block6-${randomUUID()}`;
const timestamp = process.env.RANGO90_BLOCK6_TIMESTAMP ?? new Date().toISOString();
const pagesOrigin = process.env.RANGO90_PAGES_ORIGIN ?? "https://nel386.github.io/rango90";
const apiOrigin = process.env.RANGO90_API_ORIGIN ?? "https://rango90.onrender.com";
const outputPath = resolve("backend/audits/block6/public-readonly.json");

async function get(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { redirect: "manual", signal: controller.signal });
    const body = await response.text();
    let json = null;
    try { json = JSON.parse(body); } catch { /* HTML or empty response */ }
    return { url, status: response.status, ok: response.ok, json, bodySha256: createHash("sha256").update(body).digest("hex") };
  } catch (error) {
    return { url, status: null, ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

const checks = await Promise.all([
  get(`${pagesOrigin}/es/`),
  get(`${pagesOrigin}/en/`),
  get(`${apiOrigin}/health`),
  get(`${apiOrigin}/v1/config`),
  get(`${apiOrigin}/v1/categories`),
  get(`${apiOrigin}/v1/challenges/daily`),
  get(`${apiOrigin}/v1/rankings/uefa-champions-league-goals`)
]);
const [pagesEs, pagesEn, health, config, categories, daily, ranking] = checks;
const runtimeMode = config.json?.runtimeMode ?? health.json?.runtimeMode ?? null;
const challenge = daily.json?.challenge ?? null;
const provisionalLeak = runtimeMode === "official" && Boolean(
  challenge?.testOnly || challenge?.provisionalData || challenge?.categories?.some((category) => category.snapshotStatus === "draft")
);
const fiveXx = checks.filter((check) => check.status !== null && check.status >= 500);
const structuralChecks = [
  pagesEs.status === 200,
  pagesEn.status === 200,
  health.status === 200,
  config.status === 200,
  categories.status === 200,
  daily.status === 200 || daily.status === 404 || daily.status === 503,
  ranking.status === 200 || ranking.status === 404
];
const status = fiveXx.length > 0 || !structuralChecks.every(Boolean) || provisionalLeak || runtimeMode !== "official" ? "failed" : "passed";
const result = {
  status,
  runId,
  timestamp,
  urls: { pagesOrigin, apiOrigin },
  runtimeMode,
  checks,
  findings: {
    fiveXx: fiveXx.map((check) => ({ url: check.url, status: check.status })),
    provisionalLeak,
    publicModeIsOfficial: runtimeMode === "official",
    challengeState: challenge ? (challenge.testOnly ? "test_only" : challenge.provisionalData ? "provisional" : "published") : "not_available",
    rankingState: ranking.status === 200 ? ranking.json?.status ?? "unknown" : "not_available"
  },
  readOnly: true
};
await mkdir(resolve("backend/audits/block6"), { recursive: true });
await writeFile(outputPath, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (status !== "passed") process.exitCode = 1;
