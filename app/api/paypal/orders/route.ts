import { z } from "zod";
import { accessTo, userOf } from "@/lib/auth/request";
import { sideOf } from "@/lib/project/fees";
import { unlockPrice } from "@/lib/project/stage";
import { createOrder, paypalReady } from "@/lib/paypal/client";
import { paypalTakes, type Purpose } from "@/lib/paypal/order";
import { recordOrder } from "@/lib/paypal/settle";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.discriminatedUnion("for", [
  z.object({ for: z.literal("unlock"), projectId: z.string() }),
  z.object({ for: z.literal("fee"), projectId: z.string(), milestoneId: z.number().int().positive() }),
]);

const no = (error: string, status: number) => Response.json({ error }, { status });

// Make a PayPal order for something on a project. The amount and who is paid always come from Arcon's own records,
// never from the browser; the browser only says what it wants to pay for.
export async function POST(request: Request) {
  if (!paypalReady()) return no("Payments aren't set up yet.", 503);
  const cookie = request.headers.get("cookie");
  const me = await userOf(cookie);
  if (!me) return Response.json({ error: "Sign in first, so the payment is saved to your account.", signIn: true }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return no("That wasn't understood.", 400);
  const b = body.data;

  let purpose: Purpose, amount: number, currency: string, description: string, payeeEmail: string | null = null;
  if (b.for === "unlock") {
    const a = await accessTo(b.projectId, cookie, "edit");
    if (!a || a.role !== "owner") return no("Only the project's owner can unlock it.", 403);
    if (a.project.unlocked_at) return no("This project is already unlocked.", 409);
    purpose = { kind: "unlock", projectId: a.project.id };
    amount = unlockPrice(a.project.space_type);
    currency = "USD";
    description = `Arcon: unlock ${a.project.title ?? "your project"}`;
  } else {
    const a = await accessTo(b.projectId, cookie);
    if (!a || sideOf(a.role, a.project.mode) !== "payer") return no("Only the person paying the fees can pay them.", 403);
    const db = supabaseAdmin();
    const { data: m } = await db.from("milestones").select("id, label, amount, currency, status, created_by").eq("id", b.milestoneId).eq("project_id", a.project.id).maybeSingle();
    if (!m) return no("not found", 404);
    if (m.status !== "billed" && m.status !== "claimed") return no(m.status === "received" ? "This one is already paid." : "This one hasn't been billed yet.", 409);
    if (!paypalTakes(m.currency)) return no(`PayPal doesn't take ${m.currency} here, so this one is paid outside Arcon.`, 409);
    const { data: pro } = await db.from("profiles").select("paypal_email, company, name").eq("user_id", m.created_by).maybeSingle();
    if (!pro?.paypal_email) return no("Your pro hasn't connected PayPal yet, so this one is paid outside Arcon for now.", 409);
    purpose = { kind: "fee", milestoneId: m.id };
    amount = Number(m.amount);
    currency = m.currency;
    payeeEmail = pro.paypal_email;
    description = `${m.label} for ${a.project.title ?? "your project"}, to ${pro.company ?? pro.name}`;
  }

  try {
    const order = await createOrder({ purpose, amount, currency, description, payeeEmail });
    await recordOrder({ purpose, orderId: order.id, amount, currency, payerId: me, projectId: b.projectId, payeeEmail });
    return Response.json({ id: order.id }, { status: 201 });
  } catch {
    return no("PayPal couldn't start the payment. Try again in a moment.", 502);
  }
}
