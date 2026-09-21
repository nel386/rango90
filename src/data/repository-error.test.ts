import assert from "node:assert/strict";
import { classifyRepositoryError } from "./game-repository";

assert.equal(classifyRepositoryError({ code: "official_not_ready", kind: "server", status: 503 }), "official_not_ready");
assert.equal(classifyRepositoryError({ code: "official_test_challenge_rejected", kind: "invalid", status: 503 }), "official_test_only");
assert.equal(classifyRepositoryError({ code: "ranking_not_available", kind: "not_found", status: 404 }), "ranking_not_available");
assert.equal(classifyRepositoryError({ code: "request_timeout", kind: "timeout", status: 408 }), "timeout");
assert.equal(classifyRepositoryError({ code: undefined, kind: "offline", status: undefined }), "offline");
assert.equal(classifyRepositoryError({ code: "server_error", kind: "server", status: 503 }), "generic");
console.log("repository error classification tests passed");
