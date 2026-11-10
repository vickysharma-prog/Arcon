import { test } from "node:test";
import assert from "node:assert/strict";
import { due, TOUR_HOLD_MS, TOUR_PAYABLE } from "./tourPay.ts";

test("a fee paid in the tour stays settled for a few minutes, then goes back for the next visitor", () => {
  const now = Date.parse("2026-11-11T10:00:00Z");
  assert.equal(due(null, now), false);
  assert.equal(due(new Date(now - 60_000).toISOString(), now), false);
  assert.equal(due(new Date(now - TOUR_HOLD_MS - 1000).toISOString(), now), true);
});

test("only the fees the seed left billed can be paid in the tour", () => {
  assert.deepEqual(TOUR_PAYABLE, ["Drawings and permits", "Electrical and plumbing"]);
});
