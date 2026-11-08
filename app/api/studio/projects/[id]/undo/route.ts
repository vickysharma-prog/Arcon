import { z } from "zod";
import { notFound, studioAccess, studioActor } from "@/lib/studio/auth";
import { editDesign } from "@/lib/workspace/apply";

// Steps the design back one version from Arcon Studio, if it is still at the version Studio saw.
const Body = z.object({ baseVersion: z.number().int().min(0) });

export async function POST(request: Request, ctx: RouteContext<"/api/studio/projects/[id]/undo">) {
  const a = await studioAccess((await ctx.params).id, request, "edit", true);
  if (!a) return notFound();
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Say which version you saw.", code: "bad_request" }, { status: 400 });
  const out = await editDesign(a, { undo: true }, await studioActor(a.userId, "person"), body.data.baseVersion);
  if (out.status !== 200) return Response.json(out.body, { status: out.status });
  const { note, version } = out.body as { note: string; version: number };
  return Response.json({ note, version });
}
