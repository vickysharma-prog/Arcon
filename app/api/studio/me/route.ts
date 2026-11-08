import { studioUser, unauthorized } from "@/lib/studio/auth";
import { nameOf } from "@/lib/project/thread";

// Arcon Studio checks its connection here: who it acts for.
export async function GET(request: Request) {
  const userId = await studioUser(request);
  if (!userId) return unauthorized();
  return Response.json({ name: await nameOf(userId) });
}
