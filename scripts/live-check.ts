// Checks the live site after a deploy, as the test accounts Vicky approved, from here (never in her browser).
// Run: node --env-file=.env.local --env-file=.env scripts/live-check.ts [base url]
// Prints one line per check and exits 1 if any fail. Uses the test projects in Supabase.
import { createClient } from "@supabase/supabase-js";
import { signUser } from "../lib/auth/guest.ts";

const BASE = process.argv[2] ?? "https://arcon-ten.vercel.app";
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data } = await db.auth.admin.listUsers({ perPage: 200 });
const cookieFor = async (role: string) => {
  const u = data.users.find((x) => x.email === `arcon.test.${role}@example.com`);
  if (!u) throw new Error(`no test ${role}`);
  return `arcon_user=${await signUser(u.id, process.env.ARCON_SESSION_SECRET!)}`;
};

// The test projects: a house being built (owner, client, builder), a café and a self-build house (owner).
const BUILDING = "2ec977ae-e718-430e-89a9-44afeff12b4e";
const CAFE = "6aa147ed-2d22-4cd9-b093-9e76b912a4ce";
const SELF = "2418b263-5bff-43b4-a762-2f5d76e22ac2";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const get = async (path: string, role?: string) => {
  const res = await fetch(BASE + path, { headers: role ? { cookie: await cookieFor(role) } : {} });
  const type = res.headers.get("content-type") ?? "";
  return { status: res.status, body: type.includes("json") ? await res.json() : await res.text() };
};

// Pages
for (const p of ["/", "/login"]) {
  const r = await get(p);
  check(`page ${p}`, r.status === 200, String(r.status));
}
const home = await get("/home?view=today", "builder");
check("builder's Today on site loads", home.status === 200 && String(home.body).includes("Today on site"));

// The site: the builder sees the costs, the client the budget only (15 Oct)
const asBuilder = await get(`/api/projects/${BUILDING}/site`, "builder");
check("site as builder", asBuilder.status === 200 && asBuilder.body.runs === true && typeof asBuilder.body.site?.money?.spent === "number", `spent ${asBuilder.body.site?.money?.spent}`);
const asClient = await get(`/api/projects/${BUILDING}/site`, "client");
const leaked = JSON.stringify(asClient.body.site ?? {}).match(/day_rate|unit_cost|"cost"|spent|labour/);
check("site as client hides the builder's costs", asClient.status === 200 && asClient.body.runs === false && !leaked, leaked ? `leaks ${leaked[0]}` : "budget only");
check("client can't change the site", (await fetch(`${BASE}/api/projects/${BUILDING}/site`, { method: "POST", headers: { cookie: await cookieFor("client"), "content-type": "application/json" }, body: JSON.stringify({ op: "material.add", name: "x", unit: "u", needed: 1 }) })).status === 403);

// The steps to get building, and an owner managing the build (14 Oct)
const self = await get(`/api/projects/${SELF}/site`, "owner");
check("site steps for the owner", self.status === 200 && !!self.body.steps, JSON.stringify(self.body.steps ?? {}));

// The neighbourhood read (15 Oct): real cafés only, one per chain
const n = await get(`/api/projects/${CAFE}/neighbourhood?crowd=all`, "owner");
const places: { name: string }[] = n.body.read?.places ?? [];
check("neighbourhood read", n.status === 200 && places.length >= 3, `${places.length} places`);
const stems = places.map((p) => p.name.toLowerCase().split(/\s+/)[0]);
check("one place per chain", new Set(stems).size === stems.length, stems.join(", "));
const young = await get(`/api/projects/${CAFE}/neighbourhood?crowd=young`, "owner");
check("crowd switch", young.status === 200 && (young.body.read?.places ?? []).length >= 3);

// The drawings pack (15 Oct) is drawn in the browser: check the live bundle for the page carries it.
const page = await get(`/project/${CAFE}`, "owner");
const scripts = [...String(page.body).matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]);
const bundle = (await Promise.all(scripts.map(async (s) => (await fetch(BASE + s)).text()))).join(" ");
const drawings = bundle.includes("Door and window schedule");
check("project page loads", page.status === 200, `${scripts.length} scripts`);
check("drawings pack in the live bundle", drawings);
// The exterior from taste and day and night (16 Oct)
check("exterior from taste in the live bundle", bundle.includes("a pitched gable roof") && bundle.includes("a planted garden"));
check("day and night in the live bundle", bundle.includes("#0d1424"));

// The taste quiz (16 Oct): public, a fixed list, a taste card with no sign-in
check("quiz page", (await get("/quiz")).status === 200);
const opts = await get("/api/quiz");
check("quiz pictures", (opts.body.rounds ?? []).every((r: { options: unknown[] }) => r.options.length >= 6), (opts.body.rounds ?? []).map((r: { options: unknown[] }) => r.options.length).join("/"));
const qcard = await get("/api/quiz?p=aman-tokyo.muji.spirited-away");
check("quiz card", qcard.status === 200 && !!qcard.body.style && (qcard.body.words ?? []).length > 0, qcard.body.style);
check("quiz refuses picks off the list", (await get("/api/quiz?p=aman-tokyo.supreme.amelie")).status === 400);
// The interview flow (16 Oct): questions, then "Now let's find your style" with pictures, the style, then the design
check("pictures carry taste ids for the interview", (opts.body.rounds ?? []).every((r: { options: { id?: string }[] }) => r.options.every((o) => !!o.id)));
const start = await get("/start");
const startJs = (await Promise.all([...String(start.body).matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map(async (m) => (await fetch(BASE + m[1])).text()))).join(" ");
check("interview: find your style, then design my space", start.status === 200 && startJs.includes("Now design my space") && startJs.includes("find your style"));

// Room moods and art and sound (16 Oct)
const art = await get(`/api/projects/${CAFE}/art`, "owner");
check("art and sound", art.status === 200 && (art.body.art ?? []).length > 0 && (art.body.music ?? []).length > 0, `${(art.body.art ?? []).length} galleries, ${(art.body.music ?? []).length} artists`);
check("room moods in the live bundle", bundle.includes("Mood, read from your taste"));

// The app (16 Oct): installable, the logo in the tab, and someone signed in opens their projects, not the landing page
const landing = String((await get("/")).body);
check("logo in the browser tab", /<link rel="icon" href="\/icon\.svg/.test(landing) && (await fetch(BASE + "/icon.svg")).ok);
const manifest = await get("/manifest.webmanifest");
check("app manifest", manifest.status === 200 && manifest.body.short_name === "Arcon", String(manifest.status));
const sw = await fetch(BASE + "/sw.js");
check("service worker never cached", sw.ok && (sw.headers.get("cache-control") ?? "").includes("no-cache"), sw.headers.get("cache-control") ?? "");
const opened = await fetch(BASE + "/", { headers: { cookie: await cookieFor("owner") }, redirect: "manual" });
check("signed in opens their projects", opened.status >= 300 && opened.status < 400 && (opened.headers.get("location") ?? "").endsWith("/home"), `${opened.status} ${opened.headers.get("location")}`);

// The opening plays whichever page Arcon opens on (16 Oct)
check("opening on every page", String((await get("/quiz")).body).includes('class="intro '));

// Resources, deleting, and sign-up stopping addresses that can't get mail (16 Oct)
check("resources page", (await get("/resources")).status === 200);
const mail = async (email: string) => (await (await fetch(BASE + "/api/email-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) })).json()).problem;
check("sign-up refuses a made-up domain", !!(await mail("someone@qwzxkjhqpl.com")) && (await mail("someone@gmail.com")) === null);
check("a stranger can't delete a project", (await fetch(`${BASE}/api/projects/${CAFE}`, { method: "DELETE" })).status === 404);
check("a client can't delete the owner's project", (await fetch(`${BASE}/api/projects/${BUILDING}`, { method: "DELETE", headers: { cookie: await cookieFor("client") } })).status === 404);
check("deleting an account needs DELETE typed", (await fetch(`${BASE}/api/account`, { method: "DELETE", headers: { cookie: await cookieFor("owner"), "content-type": "application/json" }, body: "{}" })).status === 400);

// The landing page's live taste strip (16 Oct)
const strip = await get("/api/strip");
check("live taste strip", strip.status === 200 && (strip.body.reads ?? []).length === 3 && strip.body.reads.every((r: { words: unknown[] }) => r.words.length > 0), (strip.body.reads ?? []).map((r: { style: string }) => r.style).join(", "));

// The role homes and the command box (16 Oct)
for (const [who, title] of [["owner", "My spaces"], ["architect", "Studio"], ["builder", "Sites"]]) {
  const h = String((await get("/home", who)).body);
  check(`home for the ${who}: ${title}`, h.includes(title) && (h.includes("Waiting on you") || h.includes("Nothing waiting")) && h.includes("sketch-draw"));
}
const pal = await get("/api/palette", "owner");
check("command box lists projects", pal.status === 200 && (pal.body.projects ?? []).length > 0, `${(pal.body.projects ?? []).length} projects`);

// The app frame, the business views and moving in
const shell = await get("/api/shell", "builder");
check("sidebar data for a builder", shell.status === 200 && shell.body.shell?.role === "builder" && Array.isArray(shell.body.shell?.projects), `${(shell.body.shell?.projects ?? []).length} projects`);
for (const [view, title] of [["fees", "Fees &amp; payments"], ["crew", "Crew"], ["deliveries", "Materials"], ["money", "Site money"]] as const) {
  const v = await get(`/home?view=${view}`, "builder");
  check(`builder's ${view} view`, v.status === 200 && String(v.body).includes(title));
}
const moveIn = await get(`/api/projects/${BUILDING}/movein`, "owner");
check("move-in steps for the owner", moveIn.status === 200 && Array.isArray(moveIn.body.checks) && moveIn.body.checks.length >= 4, `${(moveIn.body.checks ?? []).length} steps`);
const stranger = await get(`/api/projects/${BUILDING}/movein`);
check("a stranger can't read the move-in", stranger.status >= 400);

// The builder's quote, fees by phase, the architect on site (read-only)
const quoteB = await get(`/api/projects/${BUILDING}/quote`, "builder");
check("the builder can send a quote", quoteB.status === 200 && quoteB.body.canSend === true);
const quoteC = await get(`/api/projects/${BUILDING}/quote`, "client");
check("the client can't send a quote", quoteC.status === 200 && quoteC.body.canSend === false);
check("a stranger can't see the quote", (await get(`/api/projects/${BUILDING}/quote`)).status >= 400);
const feesB = await get(`/api/projects/${BUILDING}/fees`, "builder");
check("a builder's fees know the site's phases", feesB.status === 200 && Array.isArray(feesB.body.phases) && feesB.body.phases.length > 0, `${(feesB.body.phases ?? []).length} phases`);
const siteO = await get(`/api/projects/${BUILDING}/site`, "owner");
check("the site carries visits and says who inspects", siteO.status === 200 && siteO.body.inspects === false && Array.isArray(siteO.body.site?.visits));
const city = await get("/api/city?q=Los%20Angeles", "owner");
check("the interview finds a city on the map", city.status === 200 && (city.body.places ?? []).some((p: string) => p.includes("Los Angeles")), (city.body.places ?? []).join("; "));

console.log(failed ? `${failed} failed` : "all live checks passed");
process.exit(failed ? 1 : 0);
