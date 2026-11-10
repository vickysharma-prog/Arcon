// Integration check against the PayPal sandbox and the real database, with the approved test accounts.
// It walks both payments end to end through Arcon's own settle code, then deletes what it made:
//   1. a client pays their architect's billed fee (paid straight into the architect's PayPal), it settles once;
//   2. the owner unlocks a locked project, it opens.
// PayPal's buyer approval happens in a popup a script can't click, so the check pays with PayPal's published sandbox
// test card instead; everything after the capture is the same code the app runs.
// Run: node --env-file=.env.local --env-file=.env scripts/paypal-check.ts
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { raw, getOrder } from "../lib/paypal/client.ts";
import { orderBody, purposeId, type Purpose } from "../lib/paypal/order.ts";
import { alreadyPaid, recordOrder, settleOrder, stillOwed } from "../lib/paypal/settle.ts";

const ARCHITECT_PAYPAL = process.env.PAYPAL_TEST_PAYEE ?? "sb-gib9c53656412@business.example.com";
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
const idOf = (role: string) => {
  const u = list.users.find((x) => x.email === `arcon.test.${role}@example.com`);
  if (!u) throw new Error(`no test ${role}: run scripts/test-users.ts ${role} first`);
  return u.id;
};
const architect = idOf("architect"), client = idOf("owner");

// pay an order with the sandbox test card, the way PayPal's card button would after the buyer approves
async function payByCard(purpose: Purpose, amount: number, description: string, payeeEmail: string | null, projectId: string) {
  const body = { ...orderBody({ purpose, amount, currency: "USD", description, payeeEmail }), payment_source: { card: { number: "4111111111111111", expiry: "2030-12", security_code: "123", name: "Arcon Check" } } };
  const order = await raw<{ id: string }>("POST", "/v2/checkout/orders", body, crypto.randomUUID());
  await recordOrder({ purpose, orderId: order.id, amount, currency: "USD", payerId: client, projectId, payeeEmail });
  return getOrder(order.id);
}

const { data: before } = await db.from("profiles").select("paypal_email").eq("user_id", architect).single();
const made: string[] = [];
try {
  await db.from("profiles").update({ paypal_email: ARCHITECT_PAYPAL }).eq("user_id", architect);

  // 1. a fee
  const { data: p1 } = await db.from("projects").insert({ owner_id: architect, mode: "pro", space_type: "house", title: "PayPal check (fee)", status: "ready", unlocked_at: new Date().toISOString() }).select("id").single();
  made.push(p1!.id);
  await db.from("project_members").insert({ project_id: p1!.id, user_id: client, role: "client", invited_by: architect });
  const { data: m } = await db.from("milestones").insert({ project_id: p1!.id, label: "Design", amount: 12.5, currency: "USD", status: "billed", billed_at: new Date().toISOString(), created_by: architect }).select("id").single();
  const fee: Purpose = { kind: "fee", milestoneId: m!.id };
  assert.equal(await alreadyPaid(purposeId(fee)), false);

  const order = await payByCard(fee, 12.5, "Design for PayPal check", ARCHITECT_PAYPAL, p1!.id);
  const cap = order.purchase_units?.[0] as { payee?: { email_address?: string } } | undefined;
  assert.equal(cap?.payee?.email_address, ARCHITECT_PAYPAL, "the money goes to the architect's PayPal");
  assert.deepEqual(await settleOrder(order), { ok: true, kind: "fee", already: false });
  const { data: after } = await db.from("milestones").select("status, payment_id").eq("id", m!.id).single();
  assert.equal(after!.status, "received");
  assert.ok(after!.payment_id);
  const { data: ev } = await db.from("messages").select("body").eq("project_id", p1!.id).eq("kind", "event");
  assert.ok(ev!.some((e) => /paid Design with PayPal/.test(e.body)), "the thread says it was paid");
  // settling again (the webhook after the capture) changes nothing; a second order is refused before capture
  assert.deepEqual(await settleOrder(order), { ok: true, kind: "fee", already: true });
  assert.equal(await alreadyPaid(purposeId(fee)), true);
  assert.equal(await stillOwed({ kind: "fee", purpose: purposeId(fee), project_id: p1!.id, milestone_id: m!.id }), false);
  console.log("✓ fee: paid to the architect's PayPal, settled once, said in the thread, a second payment refused");

  // 2. an unlock
  const { data: p2 } = await db.from("projects").insert({ owner_id: client, mode: "owner", space_type: "house", title: "PayPal check (unlock)", status: "ready" }).select("id, unlocked_at").single();
  made.push(p2!.id);
  assert.equal(p2!.unlocked_at, null);
  const unlock: Purpose = { kind: "unlock", projectId: p2!.id };
  assert.equal(await stillOwed({ kind: "unlock", purpose: purposeId(unlock), project_id: p2!.id, milestone_id: null }), true);
  const o2 = await payByCard(unlock, 149, "Unlock for PayPal check", null, p2!.id);
  assert.deepEqual(await settleOrder(o2), { ok: true, kind: "unlock", already: false });
  const { data: opened } = await db.from("projects").select("unlocked_at").eq("id", p2!.id).single();
  assert.ok(opened!.unlocked_at, "the project is open");
  console.log("✓ unlock: $149 to Arcon, the project opened");

  // 3. a wrong amount never opens anything
  const { data: p3 } = await db.from("projects").insert({ owner_id: client, mode: "owner", space_type: "house", title: "PayPal check (mismatch)", status: "ready" }).select("id").single();
  made.push(p3!.id);
  const bad: Purpose = { kind: "unlock", projectId: p3!.id };
  const o3 = await payByCard(bad, 1, "Mismatch check", null, p3!.id);
  await db.from("payments").update({ amount: 149 }).eq("order_id", o3.id); // Arcon asked for 149, PayPal took 1
  assert.deepEqual(await settleOrder(o3), { ok: false, reason: "mismatch" });
  const { data: still } = await db.from("projects").select("unlocked_at").eq("id", p3!.id).single();
  assert.equal(still!.unlocked_at, null);
  console.log("✓ mismatch: a payment for the wrong amount opens nothing");
} finally {
  await db.from("payments").delete().in("project_id", made);
  await db.from("projects").delete().in("id", made);
  await db.from("profiles").update({ paypal_email: before?.paypal_email ?? null }).eq("user_id", architect);
}
console.log("PayPal check passed; test projects removed.");
