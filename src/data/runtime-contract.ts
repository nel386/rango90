import type { RuntimeMode } from "./game-types";

export function clientAllowsChallenge(runtimeMode: RuntimeMode, testOnly: boolean): boolean {
  return runtimeMode === "lab" || !testOnly;
}

export function isLabRuntime(runtimeMode: RuntimeMode | undefined): boolean {
  return runtimeMode === "lab";
}
