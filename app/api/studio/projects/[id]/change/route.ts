import { z } from "zod";
import { notFound, studioAccess, studioActor } from "@/lib/studio/auth";
import { ChangeSchema, editDesign } from "@/lib/workspace/apply";

// Makes one change from Arcon Studio, against the version Studio saw. If the design moved on since, nothing is saved
// and Studio gets 409 `stale`. `by` says whether a person clicked it or approved their agent's proposal.
const Body = z.object({ change: ChangeSchema, baseVersion: z.number().int().min(0), by: z.enum(["person", "agent"]) });

export async function POST(request: Request, ctx: RouteContext<"/api/studio/projects/[id]/change">) {
  const a = await studioAccess((await ctx.params).id, request, "edit", true);
  if (!a) return notFound();
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "That change wasn't understood.", code: "bad_change" }, { status: 400 });
  const out = await editDesign(a, { change: body.data.change }, await studioActor(a.userId, body.data.by), body.data.baseVersion);
  if (out.status !== 200) return Response.json(out.body, { status: out.status });
  const { note, version, request: ask } = out.body as { note: string; version: number; request?: { from: number; cost: string } | null };
  return Response.json({ note, version, request: ask ?? null });
}
