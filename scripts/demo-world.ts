// Builds the demo world through the real app, as the people in it: Lena's studio in Los Angeles with three
// clients (Maya's house being built, the Parks' house waiting for approval, Ana's apartment in its last week), Mike the
// builder, and Sam's café in Brooklyn. Every step goes through the app's own routes, so what visitors see is what a
// real run makes. Re-running replaces the old demo projects. The design step calls the model (four designs).
// Run with the app up (npx next build && npx next start -p 3000):
//   node --env-file=.env.local --env-file=.env scripts/demo-world.ts [base url]
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { signUser } from "../lib/auth/guest.ts";
import { phaseSplit } from "../lib/project/fees.ts";
import { ANA, DEMO_EMAIL, DEMO_ROLES, MAYA, PARKS, PEOPLE, SAM, TITLES, type DemoRole } from "../lib/demo/story.ts";
import type { Answers } from "../lib/interview/script.ts";

const BASE = process.argv[2] ?? "http://localhost:3000";
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const must = <T>(r: { data: T; error: unknown }) => {
  if (r.error) throw r.error;
  return r.data;
};

// The people: one account each, a demo profile (unlocked, never listed in the pro directory)
const { data: list } = await db.auth.admin.listUsers({ perPage: 500 });
const ids = {} as Record<DemoRole, string>;
for (const who of DEMO_ROLES) {
  const email = DEMO_EMAIL(who);
  let u = list.users.find((x) => x.email === email);
  if (!u) {
    const made = await db.auth.admin.createUser({ email, password: randomBytes(24).toString("hex"), email_confirm: true });
    if (made.error) throw made.error;
    u = made.data.user;
  }
  ids[who] = u.id;
  const p = PEOPLE[who];
  must(await db.from("profiles").upsert({ user_id: u.id, role: p.role, name: p.name, company: p.company, city: p.city, units: "imperial", demo: true, listed: false }));
}
const cookies = Object.fromEntries(await Promise.all(DEMO_ROLES.map(async (r) => [r, `arcon_user=${await signUser(ids[r], process.env.ARCON_SESSION_SECRET!)}`])));

async function call<T = Record<string, unknown>>(as: DemoRole, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, { method, headers: { cookie: cookies[as], "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${as} ${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}
const say = (as: DemoRole, id: string, body: string, channel = "all") => call(as, "POST", `/api/projects/${id}/thread`, { body, channel });
const site = (as: DemoRole, id: string, op: Record<string, unknown>) => call(as, "POST", `/api/projects/${id}/site`, op);
/** The design (a few model calls): a slow one outlasts fetch's 5-minute wait, so then watch for its plans instead. */
async function designed(as: DemoRole, id: string) {
  try {
    await call(as, "POST", `/api/projects/${id}/design`);
  } catch (e) {
    if (!String(e).includes("fetch failed")) throw e;
    for (let i = 0; i < 60; i++) {
      const { data } = await db.from("projects").select("options").eq("id", id).single();
      if ((data?.options ?? []).length) return;
      await new Promise((r) => setTimeout(r, 10_000));
    }
    throw new Error(`design of ${id} never finished`);
  }
}
const log = (s: string) => console.log(new Date().toISOString().slice(11, 19), s);

// The old demo world goes first (projects cascade to everything on them; Mike's crew is his own)
const old = must(await db.from("projects").select("id").in("owner_id", [ids.lena, ids.sam, ids.maya, ids.mike])) as { id: string }[];
if (old.length) must(await db.from("projects").delete().in("id", old.map((p) => p.id)));
must(await db.from("crew").delete().eq("owner_id", ids.mike));
log(`cleared ${old.length} old demo projects`);

/** A client of Lena's: the project, the answers (by the client through the invite, or by Lena in person), a design. */
async function lenasClient(name: string, answers: Answers, title: string, client?: DemoRole) {
  const { id, token } = await call<{ id: string; token?: string }>("lena", "POST", "/api/clients", { name, spaceType: answers.type, city: answers.city, link: !!client });
  if (client) await call(client, "POST", `/api/join/${token}`);
  await call(client ?? "lena", "POST", "/api/interview", { answers, lang: "en", projectId: id });
  must(await db.from("projects").update({ title }).eq("id", id));
  log(`${title}: designing`);
  await designed("lena", id);
  await call("lena", "POST", `/api/projects/${id}/choose`, { option: 0 });
  log(`${title}: designed`);
  return id;
}

async function bringMike(id: string, as: DemoRole) {
  const { token } = await call<{ token: string }>("lena", "POST", `/api/projects/${id}/team`, { role: "builder" });
  await call("mike", "POST", `/api/join/${token}`);
  const q = await call<{ estimate?: { low: number; high: number } | null }>("mike", "GET", `/api/projects/${id}/quote`);
  const mid = q.estimate ? (q.estimate.low + q.estimate.high) / 2 : 400_000;
  const amount = Math.round((mid * 1.03) / 5000) * 5000;
  await call("mike", "POST", `/api/projects/${id}/quote`, { op: "send", amount, weeks: 34, note: "Fixed price for the shell, finishes and landscaping as drawn. Permits and the soils report are included." });
  await call(as, "POST", `/api/projects/${id}/quote`, { op: "answer", accept: true, note: "Thank you, Mike. Let's build it." });
  return amount;
}

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Starts the site, sets the builder's fees on its phases and the crew, then finishes `done` phases. The phases are
 *  moved so the story sits on the calendar: `anchor` is when phase number `at` starts (or, with at = -1, when the
 *  last one ends). */
async function build(id: string, done: number, quote: number, at: number, anchor: string) {
  await site("mike", id, { op: "start", start: iso(Date.now()) });
  const f = await call<{ phases: { key: string; name: string; days: number }[] }>("mike", "GET", `/api/projects/${id}/fees`);
  await call("mike", "POST", `/api/projects/${id}/fees`, { currency: "USD", items: phaseSplit(quote, f.phases) });
  const crew = [
    { name: "Carlos Mendez", trade: "Site lead", day_rate: 420 },
    { name: "Tasha Green", trade: "Carpenter", day_rate: 360 },
    { name: "Wei Chen", trade: "Electrician", day_rate: 390 },
    { name: "Luis Ortega", trade: "Plumber", day_rate: 380 },
  ];
  for (const c of crew) await site("mike", id, { op: "crew.add", ...c });
  const s = await call<{ site: { phases: { id: number; name: string; start_date: string; end_date: string }[]; crew: { id: number }[]; materials: { id: number; name: string; needed: number; unit_cost?: number }[] } }>("mike", "GET", `/api/projects/${id}/site`);
  for (const c of s.site.crew ?? []) await site("mike", id, { op: "crew.attach", crew_id: c.id }).catch(() => {});
  const phases = s.site.phases as { id: number; start_date: string; end_date: string }[];
  const ref = at < 0 ? Date.parse(phases.at(-1)!.end_date) : Date.parse(phases[at].start_date);
  const shift = Date.parse(anchor) - ref;
  for (const ph of phases) await site("mike", id, { op: "phase", id: ph.id, start_date: iso(Date.parse(ph.start_date) + shift), end_date: iso(Date.parse(ph.end_date) + shift) });
  for (const ph of s.site.phases.slice(0, done)) await site("mike", id, { op: "phase", id: ph.id, pct: 100 });
  return s.site;
}

// 1. Maya's house: answered by Maya, designed by Lena, approved, quoted and halfway built
const maya = await lenasClient("Maya Reyes", MAYA, TITLES.maya, "maya");
await say("lena", maya, "Maya, your first design is ready. I went with the open kitchen you asked for, onto the living room and the garden, so you can see the kids while you cook.");
await say("maya", maya, "This is exactly what we talked about. Could the office be on the quiet side, away from the street?");
await say("lena", maya, "Good call, I'll keep it to the back of the house. And open Maya's style: every colour and material there says which of your picks it came from.");
await call("lena", "POST", `/api/projects/${maya}/review`, { action: "send" });
await call("maya", "POST", `/api/projects/${maya}/review`, { action: "approve", note: "Approved. Dev and I love the garden kitchen." });
log("Maya's house: approved");
await call("lena", "POST", `/api/projects/${maya}/fees`, { currency: "USD", items: [{ label: "Concept and plans", amount: 18000 }, { label: "Drawings and permits", amount: 22000 }, { label: "Site visits", amount: 14000 }] });
const mayaQuote = await bringMike(maya, "maya");
// the fourth phase started three weeks ago
const mayaSite = await build(maya, 3, mayaQuote, 3, iso(Date.now() - 21 * DAY));
const now = mayaSite.phases[3];
if (now) await site("mike", maya, { op: "phase", id: now.id, pct: 55 });
for (const ph of mayaSite.phases.slice(0, 3)) await site("lena", maya, { op: "signoff", id: ph.id, note: "Checked on site against the drawings." });
await site("lena", maya, { op: "visit", note: "Walked the frame with Mike. Window openings match the drawings; asked for blocking behind the kitchen shelves.", visited_on: "2026-09-18" });
await site("lena", maya, { op: "visit", note: "Rough-in looks clean. The office outlet moves 2 ft to the left of the desk wall; Mike has it.", visited_on: "2026-10-14" });
if (now) await site("mike", maya, { op: "update", note: "Electrical rough-in passed the city inspection this morning. Drywall starts Monday.", phase_id: now.id, pct: 55 });
await say("mike", maya, "Maya, the inspection passed. We're on schedule for drywall next week.");
await say("maya", maya, "Amazing news, thank you all!");
// the last two weeks on site: who came in, and what was delivered
for (let d = 14; d >= 1; d--) {
  const day = new Date(Date.now() - d * DAY);
  if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
  for (const [i, c] of (mayaSite.crew ?? []).entries()) await site("mike", maya, { op: "attend", crew_id: c.id, day: iso(day.getTime()), present: (d + i) % 5 !== 0, hours: 8 });
}
for (const m of mayaSite.materials.slice(0, 4)) {
  const qty = Math.max(1, Math.round(m.needed));
  await site("mike", maya, { op: "order.add", material_id: m.id, qty, supplier: "LA Builders Supply", cost: Math.round(qty * (m.unit_cost ?? 12)) });
}
const orders = (await call<{ site: { orders: { id: number }[] } }>("mike", "GET", `/api/projects/${maya}/site`)).site.orders;
for (const o of orders.slice(0, 3)) await site("mike", maya, { op: "order.deliver", id: o.id });
log("Maya's house: on site");

// 2. The Parks' house: Lena took their answers in person; waiting for their approval
const parks = await lenasClient("June Park", PARKS, TITLES.parks);
await call("lena", "POST", `/api/projects/${parks}/review`, { action: "send" });
await say("lena", parks, "June and Daniel, the single-floor plan keeps your parents' suite at the quiet end, with its own door to the garden. Take a look before Thursday.");
log("The Parks' house: in review");

// 3. Ana's apartment: designed, approved in person, in its last week: snags being fixed, the handover pack written,
// waiting for Ana to accept the keys
const ana = await lenasClient("Ana Silva", ANA, TITLES.ana);
await call("lena", "POST", `/api/projects/${ana}/review`, { action: "send" });
await call("lena", "POST", `/api/projects/${ana}/review`, { action: "approve", note: "Ana approved it in the studio." });
const anaQuote = await bringMike(ana, "lena");
// everything but the last phase done; it finishes in ten days
// (done = -1: every phase but the last)
const anaSite = await build(ana, -1, anaQuote, -1, iso(Date.now() + 10 * DAY));
const lastPhase = anaSite.phases.at(-1)!;
await site("mike", ana, { op: "phase", id: lastPhase.id, pct: 60 });
for (const ph of anaSite.phases.slice(0, -1)) await site("lena", ana, { op: "signoff", id: ph.id, note: "Checked on site." });
await site("mike", ana, { op: "update", note: "Plants are in and the shelves are styled. Snag list next, then handover.", phase_id: lastPhase.id, pct: 60 });
for (const snag of [
  { room: "Bathroom", note: "Grout gap behind the vanity" },
  { room: "Kitchen", note: "Pantry door rubs the frame" },
  { room: "Bedroom", note: "Paint touch-up by the window" },
])
  await call("lena", "POST", `/api/projects/${ana}/movein`, { op: "snag.add", ...snag });
const snags = (await call<{ snags: { id: number }[] }>("mike", "GET", `/api/projects/${ana}/movein`)).snags;
await call("mike", "POST", `/api/projects/${ana}/movein`, { op: "snag.step", id: snags[0].id, action: "fix" });
await call("mike", "POST", `/api/projects/${ana}/movein`, { op: "pack", warranty_months: 12, note: "Keys, appliance manuals and the paint colours are in the kitchen drawer." });
log("Ana's apartment: in its last week");

// 4. Sam's café in Brooklyn: Sam's own project, paid for
const { id: sam } = await call<{ id: string }>("sam", "POST", "/api/interview", { answers: SAM, lang: "en" });
must(await db.from("projects").update({ unlocked_at: new Date().toISOString(), title: TITLES.sam }).eq("id", sam));
await designed("sam", sam);
await call("sam", "POST", `/api/projects/${sam}/choose`, { option: 0 });
log("The Brooklyn café: designed");

// Spread each project's story over its real months, in the order it happened (the seed ran it in minutes)
const spans: [string, string, string][] = [
  [maya, "2025-12-01", "2026-10-20"],
  [parks, "2026-09-22", "2026-10-19"],
  [ana, "2026-02-02", iso(Date.now() - DAY)],
  [sam, "2026-10-06", "2026-10-08"],
];
for (const [id, from, to] of spans) {
  // one timeline across the tables, so a reply still comes after what it answers
  const rows: { table: string; id: number; created_at: string }[] = [];
  for (const table of ["events", "messages", "approvals", "quotes", "site_updates", "site_visits"])
    for (const r of ((await db.from(table).select("id, created_at").eq("project_id", id)).data ?? []) as { id: number; created_at: string }[]) rows.push({ table, ...r });
  rows.sort((x, y) => x.created_at.localeCompare(y.created_at));
  const a = Date.parse(from), b = Date.parse(to);
  for (const [i, r] of rows.entries()) await db.from(r.table).update({ created_at: new Date(a + ((b - a) * (i + 1)) / (rows.length + 1)).toISOString() }).eq("id", r.id);
}
console.log(JSON.stringify({ maya, parks, ana, sam }));
