import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const mode = process.argv[2];
const expectedBasePathByMode = { pages: process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/rango90", android: "" };

if (!(mode in expectedBasePathByMode)) {
  console.error("Uso: node scripts/verify-static-build.mjs <pages|android>");
  process.exit(1);
}

const outDir = resolve("out");
const basePath = expectedBasePathByMode[mode];

const requiredFiles = [
  "index.html",
  "es/index.html",
  "en/index.html",
  "manifest.webmanifest",
  "manifest-es.webmanifest",
  "manifest-en.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "sw.js",
];
const missingFiles = requiredFiles.filter((file) => !existsSync(join(outDir, file)));

if (missingFiles.length > 0) {
  console.error(`Faltan archivos del build ${mode}: ${missingFiles.join(", ")}`);
  process.exit(1);
}

const html = readFileSync(join(outDir, "es", "index.html"), "utf8");
const manifest = readFileSync(join(outDir, "manifest-es.webmanifest"), "utf8");
const serviceWorker = readFileSync(join(outDir, "sw.js"), "utf8");
const expectedAssetPrefix = `${basePath}/_next/`;
const expectedManifest = `${basePath}/manifest-es.webmanifest`;

if (!html.includes(expectedAssetPrefix) || !html.includes(`href="${expectedManifest}"`)) {
  console.error(`El build ${mode} no contiene las rutas esperadas para base path '${basePath || "/"}'.`);
  process.exit(1);
}

if (!manifest.includes('"start_url": "./es/"') || !manifest.includes('"scope": "./"')) {
  console.error(`El manifest del build ${mode} no tiene start_url/scope relativos.`);
  process.exit(1);
}

if (!serviceWorker.includes('new URL("./", self.location.href)')) {
  console.error("El service worker no está usando rutas derivadas de su propia ubicación.");
  process.exit(1);
}

const jsFiles = [];
const visit = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (entry.name.endsWith(".js")) jsFiles.push(path);
  }
};
visit(join(outDir, "_next"));

const clientBundle = jsFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const workerRegistration = /register\(`\$\{[^}]+\}\/sw\.js/;
if (!clientBundle.includes(`\"${basePath}\"`) || !workerRegistration.test(clientBundle)) {
  console.error(`El runtime PWA no quedó compilado con la ruta esperada ${basePath || "/"}sw.js.`);
  process.exit(1);
}

console.log(`Build ${mode} verificado: base path '${basePath || "/"}', PWA y manifests presentes.`);
