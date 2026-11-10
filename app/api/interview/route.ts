import { z } from "zod";
import { accessTo, whoOf } from "@/lib/auth/request";
import { createProject, deleteProject, updateProject } from "@/lib/project/store";
import { search, type Entity } from "@/lib/qloo/api";
import { layerOf } from "@/lib/qloo/taste";
import { profileFor } from "@/lib/qloo/profile";
import { confirmPick, resolvePicks } from "@/lib/plan-import/taste";
import { missingForDesign } from "@/lib/interview/logic";
import { picksOf, problems, toProject, type Answers } from "@/lib/interview/script";
import { nameOf, postEvent } from "@/lib/project/thread";

// The scripted interview's last step: the browser sends every answer, this checks them against the script,
// confirms the three taste picks with Qloo, and creates the project ready to design. No model runs here.
export const maxDuration = 60;

const Body = z.object({
  answers: z.record(z.string(), z.unknown()),
  lang: z.enum(["en", "hi", "hinglish"]).default("en"),
  // A project a pro created for a client ("New client"): the answers fill it instead of making a new one.
  projectId: z.uuid().optional(),
});

export async function POST(request: Request) {
  const { guestId, userId } = await whoOf(request.headers.get("cookie"));
  if (!guestId && !userId) return Response.json({ error: "Please reload the page and try again." }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Something went wrong with your answers. Please start again." }, { status: 400 });
  const answers = body.data.answers as Answers;
  // Filling a pro's project: only its owner (the architect or builder) or its client, and only while it waits.
  const into = body.data.projectId ? await accessTo(body.data.projectId, request.headers.get("cookie")) : null;
  if (body.data.projectId && (!into || into.project.status !== "interview" || !["owner", "architect", "client"].includes(into.role)))
    return Response.json({ error: "This project isn't waiting for answers." }, { status: 409 });
  const wrong = problems(answers);
  if (wrong.length) return Response.json({ error: "Some answers are missing. Please go back and check them.", problems: wrong }, { status: 400 });

  let found: Entity[];
  try {
    // One confirmed pick per question (a place, a brand, a film or music), then the optional extras.
    const picks = picksOf(answers);
    const all = [...(await resolvePicks(picks.slice(0, 3), search)), ...(await Promise.all(picks.slice(3).map((p) => confirmPick(p, search))))];
    found = all.filter((e, i) => all.findIndex((x) => x.entity_id === e.entity_id) === i);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "We couldn't confirm what you love. Try again." }, { status: 422 });
  }
  const signals = found.map((e) => ({ entityId: e.entity_id, name: e.name, layer: layerOf(e), type: e.types?.[0] }));
  const taste = await profileFor(signals, new Map(found.map((e) => [e.entity_id, e])));

  const fields = { ...toProject(answers, body.data.lang), status: "designing" as const, taste_signals: signals, taste };
  const p = into
    ? await updateProject(into.project.id, { ...fields, title: into.project.title ?? fields.title })
    : await createProject({ ...fields, guest_id: guestId, owner_id: userId });
  // The script is built to always meet what the design needs; if it ever doesn't, that's a bug, not the user's.
  const missing = missingForDesign(p);
  if (missing.length) {
    console.error("scripted interview left gaps:", missing);
    if (!into) await deleteProject(p.id);
    return Response.json({ error: "We couldn't start your design. Please try again." }, { status: 500 });
  }
  // the client answered a pro's project: the pro's cue to start, told in the thread and the bell
  if (into && into.role === "client" && userId) await postEvent(p, { id: userId, name: await nameOf(userId) }, { type: "answered" }).catch(() => {});
  return Response.json({ id: p.id });
}
