import assert from "node:assert/strict";
import { deadlineReached, secondsUntilDeadline } from "./game-clock";

const start = Date.parse("2026-09-16T00:00:00.000Z");
const deadline = "2026-09-16T00:00:10.000Z";
assert.equal(secondsUntilDeadline(deadline, start), 10);
assert.equal(secondsUntilDeadline(deadline, start + 9_001), 1);
assert.equal(secondsUntilDeadline(deadline, start + 10_000), 0);
assert.equal(deadlineReached(deadline, start + 9_999), false);
assert.equal(deadlineReached(deadline, start + 10_000), true);
assert.equal(secondsUntilDeadline("invalid", start), 0);
console.log("game-clock tests passed");
