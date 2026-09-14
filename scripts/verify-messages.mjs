import { readFile } from "node:fs/promises";

function flatten(value, prefix = "", output = new Map()) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, output);
    }
  } else {
    output.set(prefix, value);
  }
  return output;
}

const locales = ["es", "en"];
const messages = new Map();
for (const locale of locales) {
  const parsed = JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
  const flattened = flatten(parsed);
  const invalid = [...flattened.entries()].filter(([, value]) => typeof value !== "string" || !value.trim());
  if (invalid.length > 0) {
    throw new Error(`${locale}: hay valores de traducción vacíos o no textuales: ${invalid.map(([key]) => key).join(", ")}`);
  }
  messages.set(locale, flattened);
}

const esKeys = new Set(messages.get("es").keys());
const enKeys = new Set(messages.get("en").keys());
const onlyEs = [...esKeys].filter((key) => !enKeys.has(key));
const onlyEn = [...enKeys].filter((key) => !esKeys.has(key));
if (onlyEs.length > 0 || onlyEn.length > 0) {
  throw new Error(`Las traducciones no tienen las mismas claves. Solo es: ${onlyEs.join(", ")}; solo en: ${onlyEn.join(", ")}`);
}

console.log(`Mensajes verificados: ${esKeys.size} claves compartidas entre es/en.`);
