import { accessFor } from "../auth/request.ts";
import type { Action } from "../project/access.ts";
import { nameOf } from "../project/thread.ts";
import { bearerOf } from "./token.ts";
import { userForToken } from "./store.ts";

// Who an Arcon Studio request acts for: the person whose connection token it carries. Never a guest.

export async function studioUser(request: Request): Promise<string | null> {
  const token = bearerOf(request.headers.get("authorization"));
  if (!token) return null;
  try {
    return await userForToken(token);
  } catch {
    return null;
  }
}

/** The project and the person's role on it, if their Studio connection may do `action`; else null (404 to the caller). */
export async function studioAccess(id: string, request: Request, action: Action = "view", paid = false) {
  const userId = await studioUser(request);
  if (!userId) return null;
  const a = await accessFor(id, { userId }, action, paid);
  return a ? { ...a, userId } : null;
}

/** How a change made through Studio shows in the project's thread: the person's name, from Arcon Studio. */
export async function studioActor(userId: string, by: "person" | "agent") {
  const name = await nameOf(userId);
  return { id: userId, name: by === "agent" ? `${name}'s agent in Arcon Studio` : `${name} (Arcon Studio)` };
}

export const unauthorized = () => Response.json({ error: "Connect Arcon Studio again: this connection is missing, expired or revoked.", code: "unauthorized" }, { status: 401 });
export const notFound = () => Response.json({ error: "No such project, or this connection can't see it.", code: "not_found" }, { status: 404 });
