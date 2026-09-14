import type { MockChallenge } from "./game-types";

export type { Locale, MockCategory, MockChallenge, MockEntity } from "./game-types";

export const mockDailyChallenge: MockChallenge = {
  id: "mock-daily-balanced-01",
  kind: "daily",
  title: { es: "El reto normal", en: "The standard challenge" },
  subtitle: { es: "Siete decisiones. Una tabla histórica.", en: "Seven decisions. One historical table." },
  entityType: "player",
  timeLimitSeconds: 90,
  qualificationScore: 250,
  sourceVersion: "mock-balanced-v1",
  challengeSha256: "0000000000000000000000000000000000000000000000000000000000000000",
  difficulty: "balanced",
  categories: [
    { slug: "career-goals", code: "GO", label: { es: "Goles en carrera", en: "Career goals" }, definition: { es: "Goles oficiales en la carrera del jugador. Menor puesto = más goles.", en: "Official career goals. Lower rank means more goals." } },
    { slug: "ballon-dor", code: "BD", label: { es: "Balones de Oro", en: "Ballon d'Or wins" }, definition: { es: "Número de Balones de Oro ganados por el jugador.", en: "Number of Ballon d'Or awards won by the player." } },
    { slug: "red-cards", code: "RC", label: { es: "Tarjetas rojas", en: "Red cards" }, definition: { es: "Tarjetas rojas registradas en partidos oficiales.", en: "Red cards recorded in official matches." } },
    { slug: "champions-titles", code: "CL", label: { es: "Champions ganadas", en: "Champions League wins" }, definition: { es: "Títulos de Copa de Europa / Champions League.", en: "European Cup / Champions League titles." } },
    { slug: "national-goals", code: "SE", label: { es: "Goles con selección", en: "National team goals" }, definition: { es: "Goles oficiales marcados con la selección absoluta.", en: "Official goals scored for the senior national team." } },
    { slug: "league-titles", code: "LG", label: { es: "Ligas ganadas", en: "League titles" }, definition: { es: "Títulos de liga nacional conseguidos durante la carrera.", en: "Domestic league titles won during the career." } },
    { slug: "world-cup-goals", code: "WC", label: { es: "Goles en Mundiales", en: "World Cup goals" }, definition: { es: "Goles marcados en fases finales de la Copa del Mundo.", en: "Goals scored in FIFA World Cup final tournaments." } },
  ],
  entities: [
    { id: "player-cristiano-ronaldo", name: "Cristiano Ronaldo", shortName: "CR", entityType: "player", position: "FW", scores: { "career-goals": 1, "ballon-dor": 3, "red-cards": 54, "champions-titles": 1, "national-goals": 1, "league-titles": 6, "world-cup-goals": 12 } },
    { id: "player-lionel-messi", name: "Lionel Messi", shortName: "LM", entityType: "player", position: "FW", scores: { "career-goals": 2, "ballon-dor": 1, "red-cards": 38, "champions-titles": 2, "national-goals": 2, "league-titles": 1, "world-cup-goals": 1 } },
    { id: "player-robert-lewandowski", name: "Robert Lewandowski", shortName: "RL", entityType: "player", position: "FW", scores: { "career-goals": 5, "ballon-dor": 4, "red-cards": 27, "champions-titles": 4, "national-goals": 15, "league-titles": 3, "world-cup-goals": 17 } },
    { id: "player-karim-benzema", name: "Karim Benzema", shortName: "KB", entityType: "player", position: "FW", scores: { "career-goals": 7, "ballon-dor": 2, "red-cards": 16, "champions-titles": 3, "national-goals": 20, "league-titles": 4, "world-cup-goals": 99 } },
    { id: "player-sergio-ramos", name: "Sergio Ramos", shortName: "SR", entityType: "player", position: "DF", scores: { "career-goals": 48, "ballon-dor": 65, "red-cards": 27, "champions-titles": 5, "national-goals": 35, "league-titles": 10, "world-cup-goals": 25 } },
    { id: "player-xavi-hernandez", name: "Xavi Hernández", shortName: "XH", entityType: "player", position: "MF", scores: { "career-goals": 36, "ballon-dor": 5, "red-cards": 60, "champions-titles": 6, "national-goals": 8, "league-titles": 2, "world-cup-goals": 3 } },
    { id: "player-iker-casillas", name: "Iker Casillas", shortName: "IC", entityType: "player", position: "GK", scores: { "career-goals": 90, "ballon-dor": 99, "red-cards": 100, "champions-titles": 7, "national-goals": 7, "league-titles": 5, "world-cup-goals": 2 } },
  ],
};
