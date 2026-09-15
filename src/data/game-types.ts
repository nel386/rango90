export type Locale = "es" | "en";
export type EntityType = "player" | "club" | "national_team";

export type MockCategory = {
  slug: string;
  code: string;
  id?: string;
  ordinal?: number;
  label: Record<Locale, string>;
  definition: Record<Locale, string>;
  entityType?: EntityType;
};

export type MockEntity = {
  id: string;
  name: string;
  shortName: string;
  entityType: EntityType;
  position: string;
  imageUrl?: string;
  imageFallbackUrl?: string;
  imageStatus?: "licensed" | "unlicensed" | "fallback";
  ordinal?: number;
  scores: Record<string, number>;
};

export type MockChallenge = {
  id: string;
  kind: "daily" | "duel";
  title: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  entityType: EntityType;
  timeLimitSeconds: number;
  qualificationScore: number;
  categories: MockCategory[];
  entities: MockEntity[];
  sourceVersion: string;
  challengeSha256?: string;
  engineVersion?: string;
  scoreCap?: number;
  difficulty: "balanced";
};
