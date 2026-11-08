import { notFound, studioAccess } from "@/lib/studio/auth";
import { readDesign } from "@/lib/studio/routes";

// One project's chosen plan as Arcon Studio sees it: rooms, the version it is at, and what this person may do.
export async function GET(request: Request, ctx: RouteContext<"/api/studio/projects/[id]">) {
  const a = await studioAccess((await ctx.params).id, request, "view");
  if (!a) return notFound();
  const out = await readDesign(a.project, a.role, new URL(request.url).origin);
  if ("error" in out) return Response.json({ error: out.error, code: out.code }, { status: out.status });
  return Response.json(out.design);
}
