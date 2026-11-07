// Keeps the tour's demo sites looking like live sites on whatever day they're opened: moves the phases so Maya's
// current phase started three weeks ago and Ana's last one ends in ten days, marks the crew on site from three weeks
// back to six weeks ahead, and stocks the materials (done phases used up, the current one delivered and half used,
// later ones on order). Safe to run again any time; run it before judging.
//   node --env-file=.env.local --env-file=.env scripts/demo-refresh.ts
import { createClient } from "@supabase/supabase-js";
import { DEMO_IDS } from "../lib/demo/ids.ts";
import { TITLES } from "../lib/demo/story.ts";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const today = Date.parse(iso(Date.now()));

type Phase = { id: number; key: string; start_date: string; end_date: string; status: string };

async function refresh(title: string, anchor: (phases: Phase[]) => number) {
  const { data: p } = await db.from("projects").select("id").eq("title", title).eq("owner_id", DEMO_IDS.lena).single();
  if (!p) return console.log(`no ${title}`);
  const { data: phases } = await db.from("site_phases").select("id, key, start_date, end_date, status").eq("project_id", p.id).order("position");
  const list = (phases ?? []) as Phase[];
  if (!list.length) return console.log(`${title}: no site`);
  // the calendar: shift every phase by the same amount
  const shift = anchor(list);
  for (const ph of list)
    await db.from("site_phases").update({ start_date: iso(Date.parse(ph.start_date) + shift), end_date: iso(Date.parse(ph.end_date) + shift) }).eq("id", ph.id);
  // the crew: on site on weekdays, one or two off on a given day
  const { data: crew } = await db.from("site_crew").select("crew_id").eq("project_id", p.id);
  const rows = [];
  for (let d = -21; d <= 45; d++) {
    const day = new Date(today + d * DAY);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    for (const [i, c] of (crew ?? []).entries()) rows.push({ project_id: p.id, crew_id: c.crew_id, day: iso(day.getTime()), present: (d + i + 30) % 6 !== 0, hours: 8 });
  }
  if (rows.length) await db.from("attendance").upsert(rows);
  // the materials, by where their phase is
  const status = new Map(list.map((ph) => [ph.key, ph.status]));
  const { data: mats } = await db.from("materials").select("id, phase, needed").eq("project_id", p.id);
  for (const m of mats ?? []) {
    const s = status.get(m.phase ?? "") ?? "planned";
    const n = Number(m.needed);
    const stock = s === "done" ? { ordered: n, delivered: n, used: n } : s === "active" ? { ordered: n, delivered: n, used: Math.round(n * 0.5) } : { ordered: n, delivered: 0, used: 0 };
    await db.from("materials").update(stock).eq("id", m.id);
  }
  console.log(`${title}: phases moved ${Math.round(shift / DAY)} days, ${rows.length} days of crew, ${mats?.length ?? 0} materials`);
}

// Maya's house: the phase in progress started three weeks ago
await refresh(TITLES.maya, (ph) => {
  const now = ph.find((x) => x.status === "active") ?? ph[0];
  return today - 21 * DAY - Date.parse(now.start_date);
});
// Ana's apartment: the last phase ends in ten days
await refresh(TITLES.ana, (ph) => today + 10 * DAY - Date.parse(ph.at(-1)!.end_date));
