import { z } from "zod";
import { accessTo, userOf } from "@/lib/auth/request";
import { money, sideOf } from "@/lib/project/fees";
import { nameOf, postEvent } from "@/lib/project/thread";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { paypalTakes } from "@/lib/paypal/order";

const cookie = (r: Request) => r.headers.get("cookie");

// The fee milestones on a project, and which side this person is on (the pro who bills, or the person who pays).
export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/fees">) {
  const a = await accessTo((await ctx.params).id, cookie(request));
  if (!a || a.role === "viewer") return Response.json({ error: "not found" }, { status: 404 });
  const side = sideOf(a.role, a.project.mode);
  const me = await userOf(cookie(request));
  let q = supabaseAdmin().from("milestones").select("id, label, amount, currency, status, billed_at, claimed_at, received_at, created_by, phase, payment_id").eq("project_id", a.project.id).order("position");
  // a pro sees the fees they set out (another pro on the project bills separately); the one paying sees them all
  if (side === "pro") q = q.eq("created_by", me ?? "");
  const { data } = await q;
  const rows = (data ?? []) as { created_by: string; amount: number; currency: string; payment_id: number | null }[];
  // who each fee is paid to (a studio's or company's name, else the person's), for the one paying
  const ids = [...new Set([...rows.map((m) => m.created_by), ...(me ? [me] : [])])];
  const { data: names } = await supabaseAdmin().from("profiles").select("user_id, name, company, role, paypal_email").in("user_id", ids);
  const people = (names ?? []) as { user_id: string; name: string; company: string | null; role: string; paypal_email: string | null }[];
  // who can be paid through PayPal: a pro who connected it, for a fee in a currency PayPal takes
  const onPayPal = new Set(people.filter((n) => n.paypal_email).map((n) => n.user_id));
  const to = new Map(people.map((n) => [n.user_id, n.company ?? n.name]));
  // the kind of pro asking decides how a total is split (a builder by stage of the build)
  const kind = side === "pro" ? (people.find((n) => n.user_id === me)?.role === "builder" ? "builder" : "architect") : null;
  // the site's phases (when it has started), so a builder's fees can follow them and say when each falls due
  const { data: ph } = await supabaseAdmin().from("site_phases").select("key, name, start_date, end_date, status").eq("project_id", a.project.id).order("position");
  const day = 86_400_000;
  const phases = ((ph ?? []) as { key: string; name: string; start_date: string; end_date: string; status: string }[]).map((p) => ({
    key: p.key,
    name: p.name,
    days: Math.max(1, Math.round((new Date(p.end_date).getTime() - new Date(p.start_date).getTime()) / day) + 1),
    done: p.status === "done",
  }));
  return Response.json({ milestones: rows.map(({ created_by, payment_id, ...m }) => ({ ...m, amount: Number(m.amount), to: to.get(created_by) ?? null, paypal: onPayPal.has(created_by) && paypalTakes(m.currency), viaPayPal: payment_id !== null })), side, kind, phases, movedIn: a.project.status === "done" });
}

const Add = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/).default("INR"),
  items: z
    .array(z.object({ label: z.string().trim().min(1).max(80), amount: z.number().min(0).max(1e12), phase: z.string().max(40).optional() }))
    .min(1)
    .max(12),
});

// The pro sets out their fees (one milestone or a whole split at once).
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/fees">) {
  const a = await accessTo((await ctx.params).id, cookie(request));
  const me = await userOf(cookie(request));
  if (!a || !me) return Response.json({ error: "not found" }, { status: 404 });
  if (sideOf(a.role, a.project.mode) !== "pro") return Response.json({ error: "Only the pro on the project sets the fees." }, { status: 403 });
  const body = Add.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Add a name and an amount for each milestone." }, { status: 400 });
  const db = supabaseAdmin();
  const { count } = await db.from("milestones").select("id", { count: "exact", head: true }).eq("project_id", a.project.id);
  const rows = body.data.items.map((it, i) => ({ project_id: a.project.id, label: it.label, amount: it.amount, currency: body.data.currency, position: (count ?? 0) + i, created_by: me, phase: it.phase ?? null }));
  const { error } = await db.from("milestones").insert(rows);
  if (error) return Response.json({ error: "Couldn't save the fees." }, { status: 500 });
  const total = rows.reduce((s, r) => s + r.amount, 0);
  await postEvent(a.project, { id: me, name: await nameOf(me) }, { type: "fee", action: "added", label: rows.map((r) => r.label).join(", "), amount: money(total, body.data.currency) }).catch(() => {});
  return Response.json({ ok: true }, { status: 201 });
}
