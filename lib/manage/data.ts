import { supabaseAdmin } from "../supabase/admin.ts";
import { acceptedQuotes, siteBudget } from "../project/quote.ts";
import { getProject } from "../project/store.ts";
import { runsSite, alertsFor, labourCost, overallPct, type MaterialRow, type PhaseRow } from "../site/progress.ts";
import { approvedLayout, newBuildOf, tierOf } from "../site/store.ts";
import { estimate, marketOf } from "../budget/costs.ts";
import { crewWeek, weekOf, type Attendance, type CrewMember, type Link } from "./crew.ts";
import { ledger, type FeeRow, type LedgerProject } from "./ledger.ts";

// The running of the business across every project: the fee ledger for anyone with fees, and for whoever runs
// sites (a builder, or an owner building it themselves) the crew, deliveries and money on each site. The costs here
// are the site runner's own; they're read only for sites this person runs.

const db = () => supabaseAdmin();
async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export type RunSite = { id: string; name: string; location: string | null; currency: string };

/** The sites this person runs that have started: a builder's, or an owner's own build. */
export async function sitesRunBy(projects: (LedgerProject & { location?: string | null })[]): Promise<RunSite[]> {
  const ids = projects.map((p) => p.id);
  if (!ids.length) return [];
  const [rows, started, builders] = await Promise.all([
    must<{ id: string; self_build: boolean | null }[]>(db().from("projects").select("id, self_build").in("id", ids)),
    must<{ project_id: string }[]>(db().from("site_phases").select("project_id").in("project_id", ids)),
    must<{ project_id: string }[]>(db().from("project_members").select("project_id").in("project_id", ids).eq("role", "builder")),
  ]);
  const self = new Map(rows.map((r) => [r.id, !!r.self_build]));
  const live = new Set(started.map((s) => s.project_id));
  const built = new Set(builders.map((b) => b.project_id));
  return projects
    .filter((p) => live.has(p.id) && runsSite(p.role, p.mode, self.get(p.id), built.has(p.id)))
    .map((p) => ({ id: p.id, name: p.name, location: p.location ?? null, currency: marketOf(p.location).currency }));
}

/** Every fee across this person's projects, from their side. */
export async function feeLedger(projects: LedgerProject[], me: string) {
  const ids = projects.map((p) => p.id);
  const rows = ids.length ? await must<FeeRow[]>(db().from("milestones").select("id, project_id, label, amount, currency, status, billed_at, created_by, payment_id").in("project_id", ids).order("position")) : [];
  const out = ledger(rows, projects, Date.now(), me);
  // who each fee is paid to, for the one paying
  const pros = [...new Set(rows.map((r) => r.created_by).filter((x): x is string => !!x))];
  const names = pros.length ? await must<{ user_id: string; name: string; company: string | null }[]>(db().from("profiles").select("user_id, name, company").in("user_id", pros)) : [];
  const to = new Map(names.map((n) => [n.user_id, n.company ?? n.name]));
  return { ...out, lines: out.lines.map((l) => ({ ...l, to: l.created_by ? (to.get(l.created_by) ?? null) : null })) };
}

/** The crew this person employs, across the sites they run, for the week `today` is in. */
export async function crewOf(userId: string, sites: RunSite[], today: string) {
  const ids = sites.map((s) => s.id);
  const [crew, links, att] = await Promise.all([
    must<CrewMember[]>(db().from("crew").select("id, name, trade, phone, day_rate").eq("owner_id", userId).eq("active", true).order("name")),
    ids.length ? must<Link[]>(db().from("site_crew").select("project_id, crew_id").in("project_id", ids)) : [],
    ids.length ? must<Attendance[]>(db().from("attendance").select("project_id, crew_id, day, present, hours").in("project_id", ids).gte("day", weekOf(today)[0])) : [],
  ]);
  return crewWeek(crew.map((c) => ({ ...c, day_rate: Number(c.day_rate) })), links, att, today);
}

/** Orders on the way to every site, the ones late, what came in lately, and stock running low for the work now. */
export async function deliveriesOf(sites: RunSite[], today: string) {
  const ids = sites.map((s) => s.id);
  if (!ids.length) return { open: [], recent: [], low: [] };
  const [orders, materials, phases] = await Promise.all([
    // the join returns one material per order (typed as a list by the client)
    must(db().from("material_orders").select("id, project_id, qty, supplier, cost, eta, status, delivered_at, materials(name, unit)").in("project_id", ids).order("eta", { ascending: true, nullsFirst: false })) as unknown as Promise<
      { id: number; project_id: string; qty: number; supplier: string | null; cost: number; eta: string | null; status: string; delivered_at: string | null; materials: { name: string; unit: string } | null }[]
    >,
    must<(MaterialRow & { project_id: string })[]>(db().from("materials").select("id, project_id, name, unit, phase, needed, ordered, delivered, used, unit_cost").in("project_id", ids)),
    must<(PhaseRow & { project_id: string })[]>(db().from("site_phases").select("id, project_id, key, name, start_date, end_date, status, pct, position").in("project_id", ids).order("position")),
  ]);
  const name = new Map(sites.map((s) => [s.id, s.name]));
  const line = (o: (typeof orders)[number]) => ({
    id: o.id,
    project_id: o.project_id,
    site: name.get(o.project_id) ?? "",
    material: o.materials?.name ?? "Material",
    unit: o.materials?.unit ?? "",
    qty: Number(o.qty),
    supplier: o.supplier,
    cost: Number(o.cost),
    eta: o.eta,
    late: o.status === "ordered" && !!o.eta && o.eta < today,
  });
  const fortnight = new Date(new Date(`${today}T00:00:00Z`).getTime() - 14 * 86_400_000).toISOString();
  const low = ids.flatMap((id) =>
    alertsFor({ phases: phases.filter((p) => p.project_id === id), tasks: [], materials: materials.filter((m) => m.project_id === id).map((m) => ({ ...m, needed: Number(m.needed), ordered: Number(m.ordered), delivered: Number(m.delivered), used: Number(m.used) })), onSiteToday: 1, today })
      .filter((a) => a.kind === "stock")
      .map((a) => ({ project_id: id, site: name.get(id) ?? "", text: a.text })),
  );
  return {
    open: orders.filter((o) => o.status === "ordered").map(line).sort((a, b) => Number(b.late) - Number(a.late)),
    recent: orders.filter((o) => o.status === "delivered" && (o.delivered_at ?? "") >= fortnight).map(line).slice(0, 12),
    low,
  };
}

/** Each site's money: the client's budget, what it has cost so far, and the fees billed and received on it. */
export async function moneyOf(sites: RunSite[]) {
  const ids = sites.map((s) => s.id);
  if (!ids.length) return [];
  const [att, crewLinks, orders, fees, phases, projects] = await Promise.all([
    must<{ project_id: string; crew_id: number; present: boolean; hours: number }[]>(db().from("attendance").select("project_id, crew_id, present, hours").in("project_id", ids)),
    must(db().from("site_crew").select("project_id, crew(id, day_rate)").in("project_id", ids)) as unknown as Promise<{ project_id: string; crew: { id: number; day_rate: number } | null }[]>,
    must<{ project_id: string; cost: number }[]>(db().from("material_orders").select("project_id, cost").in("project_id", ids)),
    must<{ project_id: string; amount: number; currency: string; status: string }[]>(db().from("milestones").select("project_id, amount, currency, status").in("project_id", ids)),
    must<{ project_id: string; start_date: string; end_date: string; pct: number }[]>(db().from("site_phases").select("project_id, start_date, end_date, pct").in("project_id", ids)),
    Promise.all(ids.map((id) => getProject(id).catch(() => null))),
  ]);
  const rate = new Map(crewLinks.flatMap((l) => (l.crew ? [[l.crew.id, Number(l.crew.day_rate)] as const] : [])));
  const quotes = await acceptedQuotes(ids);
  return Promise.all(
    sites.map(async (s, i) => {
      const p = projects[i];
      const layout = p ? await approvedLayout(p) : null;
      const est = p && layout ? estimate(layout, tierOf(p), marketOf(p.site?.location), newBuildOf(p), p.site?.location) : null;
      const labour = labourCost(att.filter((a) => a.project_id === s.id).map((a) => ({ present: a.present, hours: Number(a.hours), day_rate: rate.get(a.crew_id) ?? 0 })));
      const materials = Math.round(orders.filter((o) => o.project_id === s.id).reduce((n, o) => n + Number(o.cost), 0));
      const f = fees.filter((x) => x.project_id === s.id);
      const sum = (st: string[]) => f.filter((x) => st.includes(x.status)).reduce((n, x) => n + Number(x.amount), 0);
      return {
        ...s,
        currency: est?.market.currency ?? s.currency,
        progress: overallPct(phases.filter((x) => x.project_id === s.id).map((x) => ({ ...x, pct: Number(x.pct) }))),
        budget: siteBudget(est?.total ?? null, quotes.get(s.id) ?? null),
        quoted: quotes.has(s.id),
        labour,
        materials,
        spent: labour + materials,
        billed: sum(["billed", "claimed", "received"]),
        received: sum(["received"]),
        feeCurrency: f[0]?.currency ?? null,
      };
    }),
  );
}
