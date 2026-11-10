import { test } from "node:test";
import assert from "node:assert/strict";
import { planId, planOf, profileFrom } from "./plans.ts";
import type { Subscription } from "./client.ts";

const U = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const env = { PAYPAL_PLAN_PRO_MONTH: "P-PM", PAYPAL_PLAN_PRO_YEAR: "P-PY", PAYPAL_PLAN_BUILD_MONTH: "P-BM", PAYPAL_PLAN_BUILD_YEAR: "P-BY" };
const now = Date.parse("2026-11-10T12:00:00Z");
const sub = (o: Partial<Subscription>): Subscription => ({ id: "I-1", status: "ACTIVE", plan_id: "P-PM", custom_id: `plan:${U}:pro`, ...o });

test("plan ids map both ways", () => {
  assert.equal(planId("build", "year", env), "P-BY");
  assert.deepEqual(planOf("P-PY", env), { plan: "pro", cycle: "year" });
  assert.equal(planOf("P-OTHER", env), null);
});

test("an active plan runs to the next charge, plus a day", () => {
  const r = profileFrom(sub({ billing_info: { next_billing_time: "2026-12-10T10:00:00Z" } }), now, env);
  assert.deepEqual(r, { userId: U, plan: "pro", until: "2026-12-11T10:00:00.000Z", subscription: "I-1" });
});

test("an active plan with no next charge yet gets a cycle", () => {
  const r = profileFrom(sub({ plan_id: "P-BY", custom_id: `plan:${U}:build` }), now, env);
  assert.equal(r?.plan, "build");
  assert.equal(r?.until, new Date(now + 366 * 86_400_000).toISOString());
});

test("cancelled keeps what was paid; suspended or expired ends now; pending changes nothing", () => {
  assert.equal(profileFrom(sub({ status: "CANCELLED" }), now, env)?.until, "keep");
  assert.equal(profileFrom(sub({ status: "SUSPENDED" }), now, env)?.until, new Date(now).toISOString());
  assert.equal(profileFrom(sub({ status: "EXPIRED" }), now, env)?.subscription, null);
  assert.equal(profileFrom(sub({ status: "APPROVAL_PENDING" }), now, env), null);
});

test("a subscription that isn't Arcon's, or says the wrong plan, changes nothing", () => {
  assert.equal(profileFrom(sub({ plan_id: "P-OTHER" }), now, env), null);
  assert.equal(profileFrom(sub({ custom_id: "fee:3" }), now, env), null);
  assert.equal(profileFrom(sub({ custom_id: undefined }), now, env), null);
  // paid for Studio, claims Build
  assert.equal(profileFrom(sub({ custom_id: `plan:${U}:build` }), now, env), null);
});
