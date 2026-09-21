import type { RuntimeMode } from "./game-types";

export function clientAllowsChallenge(runtimeMode: RuntimeMode, testOnly: boolean): boolean {
  // Runtime mode is diagnostic metadata only. A real, audited provisional
  // challenge remains playable in the single product mode.
  void runtimeMode;
  void testOnly;
  return true;
}

export function isLabRuntime(runtimeMode: RuntimeMode | undefined): boolean {
  return runtimeMode === "lab";
}
