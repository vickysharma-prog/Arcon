import { studioUser, unauthorized } from "@/lib/studio/auth";
import { projectsOf } from "@/lib/account/profile";
import { memberProjects } from "@/lib/project/team";

// The projects an Arcon Studio connection can see: the person's own, and the ones they're on, newest first.
export async function GET(request: Request) {
  const userId = await studioUser(request);
  if (!userId) return unauthorized();
  const [own, member] = await Promise.all([projectsOf(userId), memberProjects(userId)]);
  const cards = [
    ...own.map((p) => ({ ...p, role: "owner" as const })),
    ...member.map(({ owner_id: _o, owner: _n, ...p }) => p),
  ]
    .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 50)
    .map((p) => ({
      id: p.id,
      title: p.title ?? "Untitled project",
      spaceType: p.space_type,
      status: p.status,
      role: p.role,
      location: p.site?.location ?? null,
      hasPlan: p.chosen_option !== null,
      updatedAt: p.updated_at,
    }));
  return Response.json({ projects: cards });
}
