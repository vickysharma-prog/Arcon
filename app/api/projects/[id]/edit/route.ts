import { z } from "zod";
import { accessTo, ownedProject } from "@/lib/auth/request";
import { listVersions } from "@/lib/project/store";
import type { Change } from "@/lib/workspace/edit";
import { suggestions, understand } from "@/lib/workspace/understand";
import { ask } from "@/lib/workspace/ask";
import { chatModel } from "@/lib/models";
import { actorOf } from "@/lib/project/actor";
import { ChangeSchema, chosenOf, editDesign } from "@/lib/workspace/apply";

// One change to the chosen plan: a change the workspace built, words someone typed, or undo. The change itself is made
// in lib/workspace/apply.ts, which Arcon Studio uses too, so both work the plan out the same way.
export const maxDuration = 60;

const Body = z.union([z.object({ change: ChangeSchema }), z.object({ text: z.string().min(1).max(300) }), z.object({ undo: z.literal(true) })]);

export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/edit">) {
  const p = await ownedProject((await ctx.params).id, request.headers.get("cookie"));
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ versions: await listVersions(p.id) });
}

export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/edit">) {
  const a = await accessTo((await ctx.params).id, request.headers.get("cookie"), "edit", true);
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "That change wasn't understood." }, { status: 400 });
  const actor = await actorOf(request.headers.get("cookie"));
  if ("undo" in body.data) return reply(await editDesign(a, { undo: true }, actor));

  let change: Change;
  if ("change" in body.data) change = body.data.change;
  else {
    const at = chosenOf(a.project);
    if ("status" in at) return reply(at);
    const read = understand(body.data.text, at.current);
    if (read) change = read;
    else {
      // The plain rules couldn't read it: one model call, mapped to the same changes.
      try {
        // A full model first: the lite ones are slower here. Others stand in when one is busy or out of quota.
        const asked = await ask(body.data.text, at.current, chatModel(process.env, { tools: true }));
        if ("none" in asked) return Response.json({ error: asked.none, suggestions: suggestions(at.current) }, { status: 422 });
        change = asked;
      } catch {
        return Response.json({ error: "I couldn't read that one. Try one of these.", suggestions: suggestions(at.current) }, { status: 422 });
      }
    }
  }
  return reply(await editDesign(a, { change }, actor));
}

const reply = (o: { status: number; body: Record<string, unknown> }) => Response.json(o.body, { status: o.status });
