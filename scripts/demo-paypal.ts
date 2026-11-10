// Puts PayPal into the demo world, through the same code the app runs, so the tour shows money moving the way it
// would for real. Every payment is a real sandbox capture settled by Arcon's own settle code, so each carries its
// transaction id and its line in the project's thread:
//   - Lena (architect) and Mike (builder) connect their sandbox PayPal accounts;
//   - Maya has paid Lena's first fee; Lena's next one is billed with the note Arcon's agent drafted;
//   - Maya has paid Mike's stages as each finished; the one just finished is billed with the agent's note;
//   - Ana has paid Mike for every finished stage of her apartment; the last stage waits;
//   - Sam unlocked his café's design with one PayPal payment.
// PayPal's buyer approval is a popup a script can't press, so the sandbox's published test card stands in for it.
// Safe to run again: whatever is already paid or billed is left as it is.
//   node --env-file=.env.local --env-file=.env scripts/demo-paypal.ts
import { createClient } from "@supabase/supabase-js";
import { DEMO_IDS } from "../lib/demo/ids.ts";
import { TITLES } from "../lib/demo/story.ts";
import { chatModel } from "../lib/models.ts";
import { getOrder, raw } from "../lib/paypal/client.ts";
import { orderBody, type Purpose } from "../lib/paypal/order.ts";
import { alreadyPaid, recordOrder, settleOrder } from "../lib/paypal/settle.ts";
import { draftNote } from "../lib/project/feeNotes.ts";
import { money } from "../lib/project/fees.ts";

const PAYPAL = { lena: process.env.PAYPAL_DEMO_LENA ?? "sb-gib9c53656412@business.example.com", mike: process.env.PAYPAL_DEMO_MIKE };
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const DAY = 86_400_000;
type Fee = { id: number; label: string; amount: number; currency: string; status: string; phase: string | null; created_by: string };
type Who = { id: string; name: string; company: string };
const LENA: Who = { id: DEMO_IDS.lena, name: "Lena Ortiz", company: "Lena Ortiz Studio" };
const MIKE: Who = { id: DEMO_IDS.mike, name: "Mike Brennan", company: "Brennan Build Co." };

await db.from("profiles").update({ paypal_email: PAYPAL.lena }).eq("user_id", LENA.id);
if (PAYPAL.mike) await db.from("profiles").update({ paypal_email: PAYPAL.mike }).eq("user_id", MIKE.id);
const { data: names } = await db.from("profiles").select("user_id, name, company").in("user_id", [LENA.id, MIKE.id]);
for (const n of names ?? []) Object.assign(n.user_id === LENA.id ? LENA : MIKE, { name: n.name, company: n.company ?? n.name });

const project = async (title: string, owner: string) => {
  const { data } = await db.from("projects").select("id, title").eq("title", title).eq("owner_id", owner).single();
  if (!data) throw new Error(`no ${title}: run scripts/demo-world.ts first`);
  return data as { id: string; title: string };
};
const fees = async (projectId: string, by: string) => ((await db.from("milestones").select("id, label, amount, currency, status, phase, created_by").eq("project_id", projectId).eq("created_by", by).order("position")).data ?? []) as Fee[];
const event = (projectId: string, who: Who, body: string, data: Record<string, unknown>) => db.from("messages").insert({ project_id: projectId, channel: "all", kind: "event", author_id: who.id, author_name: who.name, body, data });
const say = (projectId: string, who: Who, body: string) => db.from("messages").insert({ project_id: projectId, channel: "all", kind: "message", author_id: who.id, author_name: who.name, body });

/** A real sandbox capture through Arcon's settle code: the order is recorded, captured, and settled once. */
async function pay(p: { id: string; title: string }, purpose: Purpose, amount: number, currency: string, description: string, payer: string, payee: string | null) {
  const body = { ...orderBody({ purpose, amount, currency, description, payeeEmail: payee }), payment_source: { card: { number: "4111111111111111", expiry: "2030-12", security_code: "123", name: "Demo client" } } };
  const order = await raw<{ id: string }>("POST", "/v2/checkout/orders", body, crypto.randomUUID());
  await recordOrder({ purpose, orderId: order.id, amount, currency, payerId: payer, projectId: p.id, payeeEmail: payee });
  return settleOrder(await getOrder(order.id));
}

/** Bill a fee (dated `daysAgo`), then the client pays it with PayPal. */
async function billAndPay(p: { id: string; title: string }, f: Fee, pro: Who, payer: string, daysAgo: number) {
  if (f.status === "received" || (await alreadyPaid(`fee:${f.id}`))) return;
  const amount = money(Number(f.amount), f.currency);
  if (f.status === "planned") {
    await db.from("milestones").update({ status: "billed", billed_at: new Date(Date.now() - daysAgo * DAY).toISOString() }).eq("id", f.id);
    await event(p.id, pro, `${pro.name} billed ${f.label}: ${amount}.`, { type: "fee", action: "bill", label: f.label, amount });
  }
  const s = await pay(p, { kind: "fee", milestoneId: f.id }, Number(f.amount), f.currency, `${f.label} for ${p.title}, to ${pro.company}`, payer, PAYPAL[pro.id === LENA.id ? "lena" : "mike"] ?? null);
  console.log(`  paid ${f.label} ${amount}:`, s.ok ? "settled" : s);
}

/** Bill a fee with the note Arcon's agent drafts from the project's record since the pro's last bill. */
async function billWithNote(p: { id: string; title: string }, f: Fee, pro: Who, client: string) {
  if (f.status !== "planned") return;
  const { data: last } = await db.from("milestones").select("billed_at").eq("project_id", p.id).eq("created_by", pro.id).not("billed_at", "is", null).order("billed_at", { ascending: false }).limit(1).maybeSingle();
  let q = db.from("messages").select("body, data").eq("project_id", p.id).eq("kind", "event").order("created_at").limit(80);
  if (last?.billed_at) q = q.gt("created_at", last.billed_at);
  const done = (((await q).data ?? []) as { body: string; data: { type?: string } }[]).filter((e) => e.data?.type !== "fee" && e.data?.type !== "unlocked").map((e) => e.body).slice(-12);
  const note = await draftNote({ kind: "bill", pro: pro.company, client, project: p.title, milestone: { label: f.label, amount: Number(f.amount), currency: f.currency, billedDaysAgo: null }, done, paypal: true }, chatModel());
  const amount = money(Number(f.amount), f.currency);
  await db.from("milestones").update({ status: "billed", billed_at: new Date(Date.now() - 2 * DAY).toISOString() }).eq("id", f.id);
  await event(p.id, pro, `${pro.name} billed ${f.label}: ${amount}.`, { type: "fee", action: "bill", label: f.label, amount });
  await say(p.id, pro, note.text);
  console.log(`  billed ${f.label} ${amount} with the ${note.by} note: ${note.text}`);
}

// Maya's house: Lena's design fees, then Mike's stages as the site moves
const maya = await project(TITLES.maya, LENA.id);
console.log(maya.title);
const lenaFees = await fees(maya.id, LENA.id);
if (lenaFees[0]) await billAndPay(maya, lenaFees[0], LENA, DEMO_IDS.maya, 40);
if (lenaFees[1]) await billWithNote(maya, lenaFees[1], LENA, "Maya");
if (PAYPAL.mike) {
  const { data: phases } = await db.from("site_phases").select("key, status").eq("project_id", maya.id);
  const done = new Set((phases ?? []).filter((x) => x.status === "done").map((x) => x.key));
  const mikeFees = await fees(maya.id, MIKE.id);
  const finished = mikeFees.filter((f) => f.phase === "start" || (f.phase && done.has(f.phase)));
  // every finished stage paid but the latest, which Mike bills now with Arcon's note
  for (const [i, f] of finished.slice(0, -1).entries()) await billAndPay(maya, f, MIKE, DEMO_IDS.maya, 60 - i * 12);
  const latest = finished.at(-1);
  if (latest) await billWithNote(maya, latest, MIKE, "Maya");

  // Ana's apartment: every finished stage paid; the stage on site now and the handover still to come
  const ana = await project(TITLES.ana, LENA.id);
  console.log(ana.title);
  const { data: ap } = await db.from("site_phases").select("key, status").eq("project_id", ana.id);
  const anaDone = new Set((ap ?? []).filter((x) => x.status === "done").map((x) => x.key));
  const { data: anaClient } = await db.from("project_members").select("user_id").eq("project_id", ana.id).eq("role", "client").maybeSingle();
  const anaFinished = (await fees(ana.id, MIKE.id)).filter((f) => f.phase === "start" || (f.phase && anaDone.has(f.phase)));
  for (const [i, f] of anaFinished.entries()) await billAndPay(ana, f, MIKE, anaClient?.user_id ?? LENA.id, 70 - i * 10);
} else console.log("Mike has no sandbox PayPal yet (PAYPAL_DEMO_MIKE): his fees are left as they are");

// Sam's café: unlocked with one PayPal payment to Arcon
const cafe = await project(TITLES.sam, DEMO_IDS.sam);
console.log(cafe.title);
if (!(await alreadyPaid(`unlock:${cafe.id}`))) {
  // the café was opened while everything was open; it is paid for now, the way a new one would be
  const s = await pay(cafe, { kind: "unlock", projectId: cafe.id }, 299, "USD", `Arcon: unlock ${cafe.title}`, DEMO_IDS.sam, null);
  console.log("  unlocked with PayPal:", s.ok ? "settled" : s); // settle posts "unlocked the project" in the thread
}
console.log("demo PayPal ready");
