// Puts PayPal into the demo world, through the same code the app runs: Lena connects her (sandbox) PayPal; Maya has
// paid Lena's first fee with PayPal (a real sandbox capture, settled by Arcon's settle code, so it carries its
// transaction id and its line in the thread); Lena's next fee is billed with the note Arcon's agent drafted from the
// project's record, so a visitor sees what the agent wrote and the Pay with PayPal button waiting for Maya.
// Safe to run again: whatever is already paid or billed is left as it is.
//   node --env-file=.env.local --env-file=.env scripts/demo-paypal.ts
import { createClient } from "@supabase/supabase-js";
import { DEMO_IDS } from "../lib/demo/ids.ts";
import { TITLES } from "../lib/demo/story.ts";
import { chatModel } from "../lib/models.ts";
import { getOrder, raw } from "../lib/paypal/client.ts";
import { orderBody, type Purpose } from "../lib/paypal/order.ts";
import { recordOrder, settleOrder } from "../lib/paypal/settle.ts";
import { draftNote } from "../lib/project/feeNotes.ts";
import { money } from "../lib/project/fees.ts";

const LENA_PAYPAL = process.env.PAYPAL_DEMO_PAYEE ?? "sb-gib9c53656412@business.example.com";
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

await db.from("profiles").update({ paypal_email: LENA_PAYPAL }).eq("user_id", DEMO_IDS.lena);
const { data: p } = await db.from("projects").select("id, title, owner_id").eq("title", TITLES.maya).eq("owner_id", DEMO_IDS.lena).single();
if (!p) throw new Error("no Maya's house: run scripts/demo-world.ts first");
const { data: ms } = await db.from("milestones").select("id, label, amount, currency, status").eq("project_id", p.id).eq("created_by", DEMO_IDS.lena).order("position");
const [first, second] = (ms ?? []) as { id: number; label: string; amount: number; currency: string; status: string }[];
if (!first || !second) throw new Error("Lena has no fees on Maya's house");
const lena = { id: DEMO_IDS.lena, name: "Lena Ortiz" };
const post = (kind: "event" | "message", body: string, data: Record<string, unknown> = {}) =>
  db.from("messages").insert({ project_id: p.id, channel: "all", kind, author_id: lena.id, author_name: lena.name, body, data });

// 1. the first fee: billed, then paid by Maya with PayPal (the sandbox's test card stands in for her approval)
if (first.status !== "received") {
  if (first.status === "planned") {
    await db.from("milestones").update({ status: "billed", billed_at: new Date(Date.now() - 40 * 86_400_000).toISOString() }).eq("id", first.id);
    await post("event", `Lena Ortiz billed ${first.label}: ${money(Number(first.amount), first.currency)}.`, { type: "fee", action: "bill", label: first.label, amount: money(Number(first.amount), first.currency) });
  }
  const purpose: Purpose = { kind: "fee", milestoneId: first.id };
  const body = { ...orderBody({ purpose, amount: Number(first.amount), currency: first.currency, description: `${first.label} for ${p.title}, to Lena Ortiz Studio`, payeeEmail: LENA_PAYPAL }), payment_source: { card: { number: "4111111111111111", expiry: "2030-12", security_code: "123", name: "Maya Reyes" } } };
  const order = await raw<{ id: string }>("POST", "/v2/checkout/orders", body, crypto.randomUUID());
  await recordOrder({ purpose, orderId: order.id, amount: Number(first.amount), currency: first.currency, payerId: DEMO_IDS.maya, projectId: p.id, payeeEmail: LENA_PAYPAL });
  console.log(first.label, await settleOrder(await getOrder(order.id)));
}

// 2. the second fee: billed with the note Arcon's agent drafted from the project's record
if (second.status === "planned") {
  const { data: events } = await db.from("messages").select("body, data").eq("project_id", p.id).eq("kind", "event").order("created_at").limit(60);
  const done = ((events ?? []) as { body: string; data: { type?: string } }[]).filter((e) => e.data?.type !== "fee").map((e) => e.body).slice(-12);
  const note = await draftNote({ kind: "bill", pro: "Lena Ortiz Studio", client: "Maya", project: p.title, milestone: { label: second.label, amount: Number(second.amount), currency: second.currency, billedDaysAgo: null }, done, paypal: true }, chatModel());
  await db.from("milestones").update({ status: "billed", billed_at: new Date(Date.now() - 3 * 86_400_000).toISOString() }).eq("id", second.id);
  await post("event", `Lena Ortiz billed ${second.label}: ${money(Number(second.amount), second.currency)}.`, { type: "fee", action: "bill", label: second.label, amount: money(Number(second.amount), second.currency) });
  await post("message", note.text);
  console.log(second.label, "billed with the", note.by, "note:", note.text);
}
console.log("demo PayPal ready");
