import { z } from "zod";
import { userOf } from "@/lib/auth/request";
import { createConnection, listConnections } from "@/lib/studio/store";

// A signed-in person's Arcon Studio connections. Creating one returns its token once; only its hash is kept.
const Body = z.object({ name: z.string().trim().min(1).max(60) });

export async function GET(request: Request) {
  const userId = await userOf(request.headers.get("cookie"));
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  return Response.json({ connections: await listConnections(userId) });
}

export async function POST(request: Request) {
  const userId = await userOf(request.headers.get("cookie"));
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Give the connection a name." }, { status: 400 });
  try {
    return Response.json(await createConnection(userId, body.data.name), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't connect just now." }, { status: 409 });
  }
}
