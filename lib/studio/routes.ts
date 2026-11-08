import { chosenOf, versionOf } from "../workspace/apply.ts";
import { isLocked } from "../project/change.ts";
import { can, type ProjectRole } from "../project/access.ts";
import { unlockedFor } from "../project/unlock.ts";
import { estimate, marketOf } from "../budget/costs.ts";
import { newBuildOf, tierOf } from "../site/store.ts";
import type { Project } from "../project/store.ts";
import { budgetView, designView } from "./view.ts";

// The reads Arcon Studio's routes share: a project's design as Studio sees it, and its budget.

export async function readDesign(project: Project, role: ProjectRole, origin: string) {
  const at = chosenOf(project);
  if ("status" in at) return { error: at.body.error as string, code: at.body.code as string, status: at.status };
  const canEdit = can(role, "edit") && project.status !== "done" && (await unlockedFor(project));
  const version = await versionOf(project.id);
  return { design: designView(project, at.current, role, canEdit, version, isLocked(project.status), origin) };
}

export function readBudget(project: Project) {
  const at = chosenOf(project);
  if ("status" in at) return null;
  const e = estimate(at.current, tierOf(project), marketOf(project.site?.location), newBuildOf(project), project.site?.location);
  return budgetView(e);
}
