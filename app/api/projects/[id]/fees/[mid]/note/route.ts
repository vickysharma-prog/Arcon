import { z } from "zod";
import { accessTo, userOf } from "@/lib/auth/request";
import { chatModel } from "@/lib/models";
import { sideOf } from "@/lib/project/fees";
import { draftNote, type NoteKind } from "@/lib/project/feeNotes";
import { paypalTakes } from "@/lib/paypal/order";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ kind: z.enum(["bill", "remind", "explain"]) });
const DAY = 86_400_000;

// Arcon's agent drafts the words around one fee: the note with a bill or a reminder (for the pro, who reads and sends
// it), or what the fee is for (for the client). It reads the project's own record and the milestone; it saves and
// sends nothing.
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/fees/[mid]/note">) {
  const { id, mid } = await ctx.params;
  const cookie = request.headers.get("cookie");
  const [a, me] = await Promise.all([accessTo(id, cookie), userOf(cookie)]);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!a || !me || !body.success || !/^\d+$/.test(mid)) return Response.json({ error: "not found" }, { status: 404 });
  const kind: NoteKind = body.data.kind;
  const side = sideOf(a.role, a.project.mode);
  if ((kind === "explain" ? "payer" : "pro") !== side) return Response.json({ error: "That isn't yours to ask for." }, { status: 403 });

  const db = supabaseAdmin();
  const { data: m } = await db.from("milestones").select("id, label, amount, currency, status, billed_at, created_by").eq("id", Number(mid)).eq("project_id", id).maybeSingle();
  if (!m || (side === "pro" && m.created_by !== me)) return Response.json({ error: "not found" }, { status: 404 });
  if (kind === "bill" && m.status !== "planned") return Response.json({ error: "This one is already billed." }, { status: 409 });
  if (kind === "remind" && m.status !== "billed") return Response.json({ error: "Only a billed fee that isn't paid needs a reminder." }, { status: 409 });

  // what happened since this pro last billed (or since the project began): the thread's own events, fee steps left out
  const { data: last } = await db.from("milestones").select("billed_at").eq("project_id", id).eq("created_by", m.created_by).not("billed_at", "is", null).neq("id", m.id).order("billed_at", { ascending: false }).limit(1).maybeSingle();
  let q = db.from("messages").select("body, data, created_at").eq("project_id", id).eq("kind", "event").order("created_at", { ascending: true }).limit(60);
  if (last?.billed_at) q = q.gt("created_at", last.billed_at);
  const { data: events } = await q;
  const done = ((events ?? []) as { body: string; data: { type?: string } }[]).filter((e) => e.data?.type !== "fee" && e.data?.type !== "unlocked").map((e) => e.body.replace(/\s+/g, " ").slice(0, 200)).slice(-12);

  const [{ data: pro }, { data: owner }] = await Promise.all([
    db.from("profiles").select("name, company, paypal_email").eq("user_id", m.created_by).maybeSingle(),
    db.from("profiles").select("name").eq("user_id", a.project.owner_id ?? "").maybeSingle(),
  ]);
  const client = a.project.mode === "pro" ? (a.project.designed_for ?? null) : (owner?.name ?? null);
  const draft = await draftNote(
    {
      kind,
      pro: pro?.company ?? pro?.name ?? "Your architect",
      client,
      project: a.project.title ?? "the project",
      milestone: { label: m.label, amount: Number(m.amount), currency: m.currency, billedDaysAgo: m.billed_at ? Math.floor((Date.now() - new Date(m.billed_at).getTime()) / DAY) : null },
      done,
      paypal: !!pro?.paypal_email && paypalTakes(m.currency),
    },
    chatModel(),
  );
  return Response.json(draft);
}
