import assert from "node:assert/strict";
import { pageDigest, shouldAlert } from "./watch_legal_page.ts";

const now = new Date("2026-10-25T00:00:00.000Z");
const original = pageDigest("signed-document-delivery: v1");
const changed = pageDigest("signed-document-delivery: v2");

assert.equal(shouldAlert(original, changed, "2026-10-26T00:00:00.000Z", now), true);
assert.equal(shouldAlert(original, original, "2026-10-26T00:00:00.000Z", now), false);
assert.equal(shouldAlert(original, changed, "2026-10-24T00:00:00.000Z", now), false);
console.log("deadline alert decision: passed");
