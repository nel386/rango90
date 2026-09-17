import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.env.QA_ARTIFACT_DIR ?? "qa-artifacts");
const phases = [
  ["lab", [
    "01-carga-inicial.png", "02-reto-activo.png", "03-respuesta-correcta.png", "04-respuesta-incorrecta-categoria.png",
    "05-precarga-siguiente-jugador.png", "06-abandono.png", "07-reinicio.png", "08-respuestas-antiguas.png",
    "09-timeout.png", "10-error-de-red.png", "11-ranking-historico.png", "12-separacion-playable-historico.png"
  ]],
  ["official", ["01-official-not-ready.png"]]
];
let failed = false;

for (const [phase, expected] of phases) {
  const file = path.join(root, phase, `qa-report-${phase}.json`);
  try {
    const report = JSON.parse(await fs.readFile(file, "utf8"));
    const byName = new Map(report.screens.map((screen) => [screen.screen, screen]));
    for (const name of expected) {
      const screen = byName.get(name);
      const status = screen?.status ?? "not_run";
      console.log(`${phase} ${status.padEnd(8)} ${name}${screen?.detail ? ` — ${screen.detail}` : ""}`);
      if (status !== "passed") failed = true;
    }
  } catch (error) {
    console.log(`${phase} not_run  report missing or unreadable: ${error instanceof Error ? error.message : String(error)}`);
    failed = true;
  }
}

process.exitCode = failed ? 1 : 0;
