import { getProject, type Project } from "../project/store.ts";
import { roleFor } from "../project/team.ts";
import { unlockedFor } from "../project/unlock.ts";
import { can, type Action, type ProjectRole } from "../project/access.ts";
import { GUEST_COOKIE, readCookie, USER_COOKIE, verifyGuest, verifyUser } from "./guest.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const guestOf = (cookieHeader: string | null) =>
  verifyGuest(readCookie(cookieHeader, GUEST_COOKIE), process.env.ARCON_SESSION_SECRET ?? "");

export const userOf = (cookieHeader: string | null) =>
  verifyUser(readCookie(cookieHeader, USER_COOKIE), process.env.ARCON_SESSION_SECRET ?? "");

/** Who sent this request: the signed-in user, the browser's guest id, or both. */
export async function whoOf(cookieHeader: string | null) {
  const [userId, guestId] = await Promise.all([userOf(cookieHeader), guestOf(cookieHeader)]);
  return { userId, guestId };
}

// The project and the sender's role on it, if they may do `action`. Anything else is null, so a stranger
// can't tell a missing project from someone else's, and a viewer can't tell an edit route exists.
// `paid`: the route is part of what unlocking opens (budget, shopping, changes, invites), so a locked project is refused.
export async function accessTo(id: string, cookieHeader: string | null, action: Action = "view", paid = false): Promise<{ project: Project; role: ProjectRole } | null> {
  return accessFor(id, await whoOf(cookieHeader), action, paid);
}

/** The same check for a known person: a cookie's, or the person an Arcon Studio connection acts for. */
export async function accessFor(id: string, who: { userId?: string | null; guestId?: string | null }, action: Action = "view", paid = false): Promise<{ project: Project; role: ProjectRole } | null> {
  if (!UUID.test(id)) return null;
  if (!who.userId && !who.guestId) return null;
  try {
    const project = await getProject(id);
    const role = await roleFor(project, who);
    if (!role || !can(role, action)) return null;
    // A pro's client project whose plan has lapsed stays readable for everyone (the site keeps running elsewhere);
    // only changes wait for a plan.
    if (paid && !(action === "view" && project.mode === "pro") && !(await unlockedFor(project))) return null;
    return { project, role };
  } catch {
    return null;
  }
}

/** The project, if the sender may do `action` on it (viewing by default). */
export const ownedProject = async (id: string, cookieHeader: string | null, action: Action = "view", paid = false) => (await accessTo(id, cookieHeader, action, paid))?.project ?? null;

// What the browser may see: no owner or guest ids.
export const publicProject = ({ owner_id: _o, guest_id: _g, ...rest }: Project) => rest;
