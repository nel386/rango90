import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const mode = process.argv[2];
const basePathByMode = { pages: process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/rango90", android: "" };

if (!(mode in basePathByMode)) {
  console.error("Uso: node scripts/build-frontend.mjs <pages|android>");
  process.exit(1);
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
if (!apiBaseUrl) {
  console.error("Falta NEXT_PUBLIC_API_BASE_URL. Los builds de Pages y Android no deben publicarse sin backend.");
  process.exit(1);
}

try {
  const parsedApiUrl = new URL(apiBaseUrl);
  if (parsedApiUrl.protocol !== 'https:'
    || parsedApiUrl.username
    || parsedApiUrl.password
    || parsedApiUrl.pathname !== "/"
    || parsedApiUrl.search
    || parsedApiUrl.hash) {
    throw new Error("invalid public API origin");
  }
} catch {
  console.error("NEXT_PUBLIC_API_BASE_URL debe ser un origen HTTPS, sin credenciales, path, query ni hash.");
  process.exit(1);
}

const nextBinary = resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next",
);

const result = spawnSync(nextBinary, ["build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_BASE_PATH: basePathByMode[mode] },
});

if (result.error) {
  console.error(`No se pudo ejecutar Next.js: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
