import { z } from "zod";
import { publicProject } from "../auth/request.ts";
import { latestVersion, saveVersion, undoVersion, updateProject, type Project } from "../project/store.ts";
import { applyChange, describe, type Change } from "./edit.ts";
import { decides, inPersonClient, postEvent } from "../project/thread.ts";
import { approvedVersion, costDelta, isLocked, pendingChange } from "../project/change.ts";
import { statusAfter } from "../project/review.ts";
import type { ProjectRole } from "../project/access.ts";
import type { Layout } from "../layout/schema.ts";

// One change to a project's chosen plan, made by the workspace (the browser), or by Arcon Studio for its person.
// The server always works the plan out again from the change itself, so no preview is ever trusted as the result.

export const ChangeSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("resize"), room: z.string().min(1), by: z.number().min(0.3).max(3) }),
  z.object({ op: z.literal("add"), kind: z.string().min(1).max(30), name: z.string().min(1).max(40) }),
  z.object({ op: z.literal("remove"), room: z.string().min(1) }),
  z.object({ op: z.literal("rename"), room: z.string().min(1), name: z.string().min(1).max(40) }),
  z.object({ op: z.literal("kitchen"), open: z.boolean() }),
]);

export type Actor = { id: string | null; name: string };
export type Outcome = { status: number; body: Record<string, unknown> };
const fail = (status: number, error: string, extra: Record<string, unknown> = {}): Outcome => ({ status, body: { error, ...extra } });

/** The chosen plan as it stands, or an outcome saying why there is none to change. */
export function chosenOf(p: Project): { chosen: number; current: Layout } | Outcome {
  if (p.status === "done") return fail(409, "This one's built and moved into, so the design stays as it is.", { code: "done" });
  const chosen = p.chosen_option;
  const current = chosen === null ? undefined : p.options?.[chosen];
  if (chosen === null || !current) return fail(400, "Choose a plan first.", { code: "no_plan" });
  return { chosen, current };
}

/** The version the design is at: the newest saved one, or 0 for a plan just chosen and never changed. */
export const versionOf = async (projectId: string) => (await latestVersion(projectId))?.version ?? 0;

/** What a change would do, without saving anything: the new plan, the sentence for it, and what it does to the cost. */
export function previewChange(p: Project, current: Layout, change: Change) {
  const out = applyChange(current, change, { width: p.site.width ?? 0, depth: p.site.depth ?? 0 });
  if ("error" in out) return { error: out.error };
  return { layout: out.layout, note: describe(change, current), cost: costDelta(current, out.layout, p) };
}

/**
 * Makes one change or one undo. `baseVersion`, when given, is the version the caller saw: if the design has moved on
 * since, nothing is saved and the caller gets 409 `stale` with the version it is at now.
 */
export async function editDesign(a: { project: Project; role: ProjectRole }, input: { change: Change } | { undo: true }, actor: Actor, baseVersion?: number): Promise<Outcome> {
  const p = a.project;
  const at = chosenOf(p);
  if ("status" in at) return at;
  const { chosen, current } = at;
  if (baseVersion !== undefined) {
    const now = await versionOf(p.id);
    if (now !== baseVersion) return fail(409, "The design changed since this was read. Read it again and redo the change.", { code: "stale", version: now });
  }
  const locked = isLocked(p.status);
  // a change already waiting, so the request is announced once
  const waiting = locked ? await pendingChange(p) : null;
  const save = async (layout: Layout) => {
    const options = [...(p.options ?? [])];
    options[chosen] = layout;
    return publicProject(await updateProject(p.id, { options }));
  };

  if ("undo" in input) {
    // undo never reaches back past what was approved
    if (locked && !waiting) return fail(400, "That's the approved design. Change it, and the change goes for approval.", { code: "approved" });
    const prev = await undoVersion(p.id);
    if (!prev) return fail(400, "There's nothing to undo.", { code: "nothing_to_undo" });
    return { status: 200, body: { project: await save(prev.layout), note: "Undid the last change", version: prev.version } };
  }

  const change = input.change;
  const out = applyChange(current, change, { width: p.site.width ?? 0, depth: p.site.depth ?? 0 });
  if ("error" in out) return fail(422, out.error, { change, code: "does_not_fit" });
  // The plan as chosen is the first version, so the first change can always be undone.
  if (!(await latestVersion(p.id))) await saveVersion(p.id, current, "Chose this plan");
  const note = describe(change, current);
  const version = await saveVersion(p.id, out.layout, note);
  // A change after review or approval needs approving again; the thread says what changed.
  const status = statusAfter("edit", p.status);
  if (status !== p.status) await updateProject(p.id, { status });
  await postEvent(p, actor, { type: "changed", version, note }).catch((e) => console.warn("thread event failed:", e));
  const project = await save(out.layout);
  if (locked) {
    const now = await pendingChange({ ...p, options: project.options as typeof p.options });
    // Whoever approves the design, changing it themselves (an owner on their own), approves it as they go.
    const own = !!now && (await decides(p, a.role)) && !(await inPersonClient(p, a.role)) && !!actor.id;
    if (own) {
      const { supabaseAdmin } = await import("../supabase/admin.ts");
      await supabaseAdmin().from("approvals").insert({ project_id: p.id, version, user_id: actor.id, decision: "approved", note: "Changed by the owner" });
    } else if (now && !waiting) {
      await postEvent(p, actor, { type: "change", what: "asked", version, cost: now.text }).catch(() => {});
    }
    return { status: 200, body: { project, note, change, version, request: now && !own ? { from: now.from, cost: now.text } : null, approved: await approvedVersion(p.id) } };
  }
  return { status: 200, body: { project, note, change, version } };
}
