import { test } from "node:test";
import assert from "node:assert/strict";
import { completedCapture, orderBody, paypalValue, purposeId, readPurpose, sameAmount } from "./order.ts";

const P = "6f1c2a4e-0b7d-4c1e-9a3b-2d5e8f7a9c10";
const U = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

test("a purpose survives the round trip through custom_id", () => {
  for (const p of [{ kind: "unlock", projectId: P }, { kind: "fee", milestoneId: 42 }, { kind: "plan", userId: U, plan: "build" }] as const) {
    assert.deepEqual(readPurpose(purposeId(p)), p);
  }
});

test("anything Arcon didn't write is no purpose", () => {
  for (const id of [null, undefined, "", "unlock:", "unlock:not-a-uuid", `unlock:${P}:x`, "fee:abc", "fee:-1", "fee:1.5", `plan:${U}`, `plan:${U}:free`, `plan:${U}:pro:x`, "refund:1"]) {
    assert.equal(readPurpose(id), null, String(id));
  }
});

test("amounts go to PayPal with two decimals, or none where the currency has none", () => {
  assert.equal(paypalValue(149, "USD"), "149.00");
  assert.equal(paypalValue(2400.5, "USD"), "2400.50");
  assert.equal(paypalValue(0.105, "EUR"), "0.11");
  assert.equal(paypalValue(1200.7, "JPY"), "1201");
  assert.throws(() => paypalValue(0, "USD"));
  assert.throws(() => paypalValue(-5, "USD"));
  assert.throws(() => paypalValue(NaN, "USD"));
});

test("a capture counts only for the exact amount and currency", () => {
  assert.equal(sameAmount({ currency_code: "USD", value: "149.00" }, 149, "USD"), true);
  assert.equal(sameAmount({ currency_code: "USD", value: "1.00" }, 149, "USD"), false);
  assert.equal(sameAmount({ currency_code: "EUR", value: "149.00" }, 149, "USD"), false);
  assert.equal(sameAmount(undefined, 149, "USD"), false);
});

test("an order pays the pro's PayPal when there is one, and names what it is for", () => {
  const b = orderBody({ purpose: { kind: "fee", milestoneId: 7 }, amount: 3200, currency: "USD", description: "Approval of the final design", payeeEmail: "lena@example.com" });
  const u = b.purchase_units[0];
  assert.equal(b.intent, "CAPTURE");
  assert.equal(u.custom_id, "fee:7");
  assert.deepEqual(u.amount, { currency_code: "USD", value: "3200.00" });
  assert.deepEqual(u.payee, { email_address: "lena@example.com" });
  const own = orderBody({ purpose: { kind: "unlock", projectId: P }, amount: 149, currency: "USD", description: "x".repeat(300) });
  assert.equal("payee" in own.purchase_units[0], false);
  assert.equal(own.purchase_units[0].description.length, 127);
});

test("only a completed capture with a purpose settles anything", () => {
  const order = (status: string, custom_id?: string) => ({ id: "O1", status: "COMPLETED", purchase_units: [{ custom_id: "fee:7", payments: { captures: [{ id: "C1", status, custom_id, amount: { currency_code: "USD", value: "1.00" } }] } }] });
  assert.deepEqual(completedCapture(order("COMPLETED", "fee:7"))?.purpose, { kind: "fee", milestoneId: 7 });
  assert.deepEqual(completedCapture(order("COMPLETED"))?.purpose, { kind: "fee", milestoneId: 7 }); // falls back to the unit's id
  assert.equal(completedCapture(order("PENDING", "fee:7")), null);
  assert.equal(completedCapture(order("DECLINED", "fee:7")), null);
  assert.equal(completedCapture({ id: "O2", status: "CREATED" }), null);
  assert.equal(completedCapture(order("COMPLETED", "something:else")), null);
});

test("PayPal takes the big currencies, not INR or AED", async () => {
  const { paypalTakes } = await import("./order.ts");
  for (const c of ["USD", "EUR", "GBP", "AUD", "CAD", "SGD"]) assert.equal(paypalTakes(c), true, c);
  for (const c of ["INR", "AED", "usd", ""]) assert.equal(paypalTakes(c), false, c);
});
