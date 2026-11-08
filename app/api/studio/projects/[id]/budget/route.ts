import { notFound, studioAccess } from "@/lib/studio/auth";
import { readBudget } from "@/lib/studio/routes";

// The design's budget as Arcon works it out: the range, by category and by room, in the project's own currency.
export async function GET(request: Request, ctx: RouteContext<"/api/studio/projects/[id]/budget">) {
  const a = await studioAccess((await ctx.params).id, request, "view", true);
  if (!a) return notFound();
  const budget = readBudget(a.project);
  if (!budget) return Response.json({ error: "Choose a plan first.", code: "no_plan" }, { status: 400 });
  return Response.json(budget);
}
