import { notFound, studioAccess } from "@/lib/studio/auth";
import { chosenOf } from "@/lib/workspace/apply";
import { sayCredit, tasteTrail } from "@/lib/design/trail";
import type { Brief } from "@/lib/design/brief";

// Why the design is the way it is, as Arcon already worked it out: the plan's reasons (quoting the interview) and each
// taste choice with what it came from. Facts only, so the agent explains from these and never invents a reason.
export async function GET(request: Request, ctx: RouteContext<"/api/studio/projects/[id]/reasons">) {
  const a = await studioAccess((await ctx.params).id, request, "view");
  if (!a) return notFound();
  const at = chosenOf(a.project);
  const plan = "status" in at ? null : at.current;
  const trail = tasteTrail(a.project, (a.project.brief ?? null) as Brief | null, plan);
  return Response.json({
    plan: plan?.concept ? { name: plan.concept.name, why: plan.concept.why } : null,
    choices: trail.choices.map((c) => ({ what: c.what, choice: c.choice, from: c.from.map(sayCredit) })),
    loves: trail.loves.map((l) => ({ name: l.name, kind: l.kind, gave: l.gave })),
  });
}
