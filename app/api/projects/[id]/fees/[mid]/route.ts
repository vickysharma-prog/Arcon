import { z } from "zod";
import { accessTo, userOf } from "@/lib/auth/request";
import { money, sideOf, step, type FeeAction, type FeeStatus } from "@/lib/project/fees";
import { nameOf, postEvent, postMessage } from "@/lib/project/thread";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ action: z.enum(["bill", "paid", "received", "remind"]), note: z.string().trim().max(1200).optional() });
const STAMP = { billed: "billed_at", claimed: "claimed_at", received: "received_at" } as const;

// One step on one milestone: the pro bills, the payer says they've paid, the pro confirms. Each step is checked
// against who is asking and where the milestone is, so nobody can skip one; each is posted in the thread.
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/fees/[mid]">) {
  const { id, mid } = await ctx.params;
  const cookie = request.headers.get("cookie");
  const a = await accessTo(id, cookie);
  const me = await userOf(cookie);
  if (!a || !me) return Response.json({ error: "not found" }, { status: 404 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || !/^\d+$/.test(mid)) return Response.json({ error: "That wasn't understood." }, { status: 400 });
  const db = supabaseAdmin();
  const { data: m } = await db.from("milestones").select("id, label, amount, currency, status, created_by").eq("id", Number(mid)).eq("project_id", id).maybeSingle();
  if (!m) return Response.json({ error: "not found" }, { status: 404 });
  const side = sideOf(a.role, a.project.mode);
  // only the pro who set a fee out bills it and confirms it
  if (side === "pro" && m.created_by !== me) return Response.json({ error: "That fee is another pro's to bill." }, { status: 403 });
  const author = { id: me, name: await nameOf(me) };
  // a reminder: the pro's note in the thread on a fee that's billed and not paid; the fee itself doesn't move
  if (body.data.action === "remind") {
    if (side !== "pro" || m.status !== "billed" || !body.data.note) return Response.json({ error: "Only a billed fee that isn't paid needs a reminder." }, { status: 409 });
    await postMessage(a.project, author, { body: body.data.note });
    return Response.json({ status: m.status });
  }
  const next = step(m.status as FeeStatus, body.data.action as FeeAction, side);
  if (!next) return Response.json({ error: "That step isn't yours to take, or it's already done." }, { status: 409 });
  // Only move it if it is still where we read it, so two clicks can't both count.
  const { data: moved } = await db
    .from("milestones")
    .update({ status: next, [STAMP[next as keyof typeof STAMP]]: new Date().toISOString() })
    .eq("id", m.id)
    .eq("status", m.status)
    .select("id");
  if (!moved?.length) return Response.json({ error: "Someone just updated this one. Refresh and try again." }, { status: 409 });
  await postEvent(a.project, author, { type: "fee", action: body.data.action as FeeAction, label: m.label, amount: money(Number(m.amount), m.currency) }).catch(() => {});
  // the bill's note (drafted by Arcon's agent, read and sent by the pro) follows the bill in the thread
  if (body.data.action === "bill" && body.data.note) await postMessage(a.project, author, { body: body.data.note }).catch(() => {});
  return Response.json({ status: next });
}

// The pro removes a milestone that hasn't been billed yet.
export async function DELETE(request: Request, ctx: RouteContext<"/api/projects/[id]/fees/[mid]">) {
  const { id, mid } = await ctx.params;
  const a = await accessTo(id, request.headers.get("cookie"));
  const me = await userOf(request.headers.get("cookie"));
  if (!a || !me || sideOf(a.role, a.project.mode) !== "pro" || !/^\d+$/.test(mid)) return Response.json({ error: "not found" }, { status: 404 });
  await supabaseAdmin().from("milestones").delete().eq("id", Number(mid)).eq("project_id", id).eq("status", "planned").eq("created_by", me);
  return Response.json({ ok: true });
}
