import { z } from "zod";
import { userOf } from "@/lib/auth/request";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ email: z.email().max(254).nullable() });

// Where a pro is paid: the PayPal account their clients' fees go to. null disconnects it.
export async function PUT(request: Request) {
  const me = await userOf(request.headers.get("cookie"));
  if (!me) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "That isn't an email address." }, { status: 400 });
  const db = supabaseAdmin();
  const { data: p } = await db.from("profiles").select("role").eq("user_id", me).maybeSingle();
  if (p?.role !== "architect" && p?.role !== "builder") return Response.json({ error: "Only architects and builders are paid fees through Arcon." }, { status: 403 });
  const { error } = await db.from("profiles").update({ paypal_email: body.data.email?.trim().toLowerCase() ?? null }).eq("user_id", me);
  if (error) return Response.json({ error: "Couldn't save it." }, { status: 500 });
  return Response.json({ ok: true });
}
