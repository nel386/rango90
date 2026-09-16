import assert from "node:assert/strict";
import { clientAllowsChallenge, isLabRuntime } from "./runtime-contract";

assert.equal(clientAllowsChallenge("lab", true), true);
assert.equal(clientAllowsChallenge("official", false), true);
assert.equal(clientAllowsChallenge("official", true), false);
assert.equal(isLabRuntime("lab"), true);
assert.equal(isLabRuntime("official"), false);
assert.equal(isLabRuntime(undefined), false);
console.log("frontend runtime contract tests passed");
