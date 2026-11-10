import { getProfile, projectsOf } from "../account/profile.ts";
import { memberProjects } from "../project/team.ts";
import { requestsFor } from "../pros/directory.ts";
import { boardFor } from "../home/board.ts";
import { sitesRunBy } from "../manage/data.ts";
import { projectName } from "../home/names.ts";
import { stageOf } from "../project/stage.ts";
import { unlockedFor } from "../project/unlock.ts";
import { supabaseAdmin } from "../supabase/admin.ts";
import type { ProjectRole } from "../project/access.ts";
import type { Role } from "../account/roles.ts";

// What the sidebar needs on every signed-in page: the role, the counts on its tools, and every project this person
// is on with where it stands. Light on purpose: no drawings, no estimates.

export type ShellProject = {
  id: string;
  name: string;
  role: ProjectRole;
  status: string;
  mode: string;
  space_type: string | null;
  stage: number;
  chosen: boolean;
  toured: boolean;
  unlocked: boolean;
  unread: number;
  owner: string | null;
};
export type Shell = { me: string; role: Role; counts: { waits: number; requests: number; live: number; fees: number; unread: number; runs: number }; projects: ShellProject[] };

export async function shellFor(userId: string, day?: string): Promise<Shell | null> {
  const profile = await getProfile(userId);
  if (!profile) return null;
  const pro = profile.role === "architect" || profile.role === "builder";
  const [own, shared, requests] = await Promise.all([projectsOf(userId), memberProjects(userId), pro ? requestsFor(userId) : []]);
  const all = [...own.map((p) => ({ ...p, role: "owner" as ProjectRole, owner: null as string | null })), ...shared].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 60);
  // the same rule the API uses (paid, a pro's plan or trial, or a demo), so the sidebar never offers what a route refuses.
  // ponytail: a couple of queries per locked project, fine at 60; one batched query if sidebars get slow.
  const locked = all.filter((p) => !p.unlocked_at).map((p) => p.id);
  const { data: rows } = locked.length ? await supabaseAdmin().from("projects").select("id, owner_id, mode, unlocked_at").in("id", locked) : { data: [] };
  const lockedRows = new Map(((rows ?? []) as Parameters<typeof unlockedFor>[0][]).map((r) => [r.id, r]));
  const open = await Promise.all(all.map((p) => (p.unlocked_at ? true : lockedRows.has(p.id) ? unlockedFor(lockedRows.get(p.id)!).catch(() => false) : false)));
  const [board, runs] = await Promise.all([
    boardFor(
    userId,
    all.map((p) => ({ id: p.id, name: projectName(p), role: p.role, mode: p.mode, status: p.status, chosen_option: p.chosen_option, space_type: p.space_type, site: p.site })),
    day,
    new Date(),
    true,
    ),
    // owners only: whether they run a build themselves (builders always get the site tools)
    profile.role === "owner" ? sitesRunBy(all.map((p) => ({ id: p.id, name: projectName(p), role: p.role, mode: p.mode as "owner" | "pro" }))) : [],
  ]);
  return {
    me: userId,
    role: profile.role,
    counts: {
      waits: board.waits.length,
      requests: requests.length,
      live: board.sites.length,
      fees: board.waits.filter((w) => w.kind === "pay" || w.kind === "confirm").length,
      unread: Object.values(board.unread).reduce((n, u) => n + u, 0),
      runs: runs.length,
    },
    projects: all.map((p, i) => ({
      id: p.id,
      name: projectName(p),
      role: p.role,
      status: p.status,
      mode: p.mode,
      space_type: p.space_type,
      stage: stageOf(p as Parameters<typeof stageOf>[0]),
      chosen: p.chosen_option !== null,
      toured: !!p.toured_at,
      unlocked: open[i],
      unread: board.unread[p.id] ?? 0,
      owner: p.owner ?? null,
    })),
  };
}
