import { userOf } from "@/lib/auth/request";
import { revokeConnection } from "@/lib/studio/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Disconnects one Arcon Studio connection at once: its token stops working on the next request.
export async function DELETE(request: Request, ctx: RouteContext<"/api/studio/connections/[cid]">) {
  const userId = await userOf(request.headers.get("cookie"));
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { cid } = await ctx.params;
  if (!UUID.test(cid)) return Response.json({ error: "not found" }, { status: 404 });
  await revokeConnection(userId, cid);
  return Response.json({ ok: true });
}
