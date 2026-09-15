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
  sourceVersion: "mock-typed-matrix-v1",
  challengeSha256: "0000000000000000000000000000000000000000000000000000000000000000",
  difficulty: "balanced",
  categories: [
    { slug: "club-career-yellow-cards", code: "TA", entityType: "player", label: { es: "Tarjetas amarillas", en: "Yellow cards" }, definition: { es: "Tarjetas amarillas recibidas en partidos oficiales.", en: "Yellow cards received in official matches." } },
    { slug: "club-career-red-cards", code: "TR", entityType: "player", label: { es: "Tarjetas rojas", en: "Red cards" }, definition: { es: "Tarjetas rojas recibidas en partidos oficiales.", en: "Red cards received in official matches." } },
    { slug: "club-career-titles", code: "TC", entityType: "player", label: { es: "Títulos de club del jugador", en: "Player club titles" }, definition: { es: "Títulos oficiales ganados por el jugador a nivel de club.", en: "Official titles won by the player at club level." } },
    { slug: "world-cup-goals", code: "GM", entityType: "player", label: { es: "Goles en Mundiales", en: "World Cup goals" }, definition: { es: "Goles marcados en fases finales de la Copa del Mundo.", en: "Goals scored in FIFA World Cup final tournaments." } },
    { slug: "player-career-goals", code: "GC", entityType: "player", label: { es: "Goles globales en la carrera", en: "Global career goals" }, definition: { es: "Goles oficiales globales: clubes y selección absoluta.", en: "Official global goals: clubs and senior national team." } },
    { slug: "uefa-champions-league-assists", code: "AS", entityType: "player", label: { es: "Asistencias en Champions", en: "Champions League assists" }, definition: { es: "Asistencias registradas en la Champions League.", en: "Assists recorded in the Champions League." } },
    { slug: "uefa-champions-league-goals", code: "CL", entityType: "player", label: { es: "Goles en Champions", en: "Champions League goals" }, definition: { es: "Goles registrados en la Champions League.", en: "Goals recorded in the Champions League." } },
  ],
  entities: [
    { id: "player-cristiano-ronaldo", name: "Cristiano Ronaldo", shortName: "CR", entityType: "player", position: "FW", scores: { "club-career-yellow-cards": 12, "club-career-red-cards": 54, "club-career-titles": 6, "world-cup-goals": 12, "player-career-goals": 1 } },
    { id: "player-lionel-messi", name: "Lionel Messi", shortName: "LM", entityType: "player", position: "FW", scores: { "club-career-yellow-cards": 18, "club-career-red-cards": 38, "club-career-titles": 8, "world-cup-goals": 13, "player-career-goals": 2 } },
    { id: "player-robert-lewandowski", name: "Robert Lewandowski", shortName: "RL", entityType: "player", position: "FW", scores: { "club-career-yellow-cards": 20, "club-career-red-cards": 27, "club-career-titles": 9, "world-cup-goals": 0, "player-career-goals": 5 } },
    { id: "player-karim-benzema", name: "Karim Benzema", shortName: "KB", entityType: "player", position: "FW", scores: { "club-career-yellow-cards": 25, "club-career-red-cards": 16, "club-career-titles": 10, "world-cup-goals": 0, "player-career-goals": 7 } },
    { id: "player-sergio-ramos", name: "Sergio Ramos", shortName: "SR", entityType: "player", position: "DF", scores: { "club-career-yellow-cards": 48, "club-career-red-cards": 27, "club-career-titles": 12, "world-cup-goals": 0, "player-career-goals": 48 } },
    { id: "player-pedro", name: "Pedro", shortName: "PE", entityType: "player", position: "FW", scores: { "club-career-yellow-cards": 30, "club-career-red-cards": 8, "club-career-titles": 14, "world-cup-goals": 0, "player-career-goals": 18, "uefa-champions-league-assists": 22, "uefa-champions-league-goals": 20 } },
    { id: "player-xavi", name: "Xavi", shortName: "XA", entityType: "player", position: "MF", scores: { "club-career-yellow-cards": 34, "club-career-red-cards": 5, "club-career-titles": 18, "world-cup-goals": 1, "player-career-goals": 24, "uefa-champions-league-assists": 30, "uefa-champions-league-goals": 13 } },
  ],
};
