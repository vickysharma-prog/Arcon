import { z } from "zod";
import { notFound, studioAccess } from "@/lib/studio/auth";
import { ChangeSchema, chosenOf, previewChange } from "@/lib/workspace/apply";
import { designView } from "@/lib/studio/view";

// What a change would do, saving nothing: the plan after it, the sentence for it, and the change in cost.
// Arcon Studio shows this before anyone approves a change.
const Body = z.object({ change: ChangeSchema });

export async function POST(request: Request, ctx: RouteContext<"/api/studio/projects/[id]/preview">) {
  const a = await studioAccess((await ctx.params).id, request, "view");
  if (!a) return notFound();
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "That change wasn't understood.", code: "bad_change" }, { status: 400 });
  const at = chosenOf(a.project);
  if ("status" in at) return Response.json(at.body, { status: at.status });
  const out = previewChange(a.project, at.current, body.data.change);
  if ("error" in out) return Response.json({ error: out.error, code: "does_not_fit" }, { status: 422 });
  const after = designView(a.project, out.layout, a.role, false, 0, false, new URL(request.url).origin);
  return Response.json({ note: out.note, cost: out.cost, rooms: after.rooms, spaces: after.spaces, shell: after.shell });
}
