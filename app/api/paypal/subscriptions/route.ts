import { z } from "zod";
import { userOf } from "@/lib/auth/request";
import { cancelSubscription, getSubscription, paypalReady } from "@/lib/paypal/client";
import { purposeId } from "@/lib/paypal/order";
import { planId } from "@/lib/paypal/plans";
import { applySubscription } from "@/lib/paypal/subscribe";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), plan: z.enum(["pro", "build"]), cycle: z.enum(["month", "year"]) }),
  z.object({ action: z.literal("confirm"), subscriptionId: z.string().regex(/^I-[A-Z0-9]{6,30}$/) }),
  z.object({ action: z.literal("cancel") }),
]);

const no = (error: string, status: number) => Response.json({ error }, { status });

// A pro's Studio or Build plan on PayPal.
//   start: what the PayPal button needs (the plan, who it is for, and a first charge after any trial left)
//   confirm: after the pro approves in PayPal, read it back from PayPal and open the plan
//   cancel: stop renewing; the plan runs to the end of what was paid
export async function POST(request: Request) {
  if (!paypalReady()) return no("Payments aren't set up yet.", 503);
  const me = await userOf(request.headers.get("cookie"));
  if (!me) return no("Sign in first.", 401);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return no("That wasn't understood.", 400);
  const b = body.data;
  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("role, trial_until, paypal_subscription").eq("user_id", me).maybeSingle();
  if (!profile) return no("Finish your profile first.", 409);

  if (b.action === "start") {
    if (b.plan === "pro" && profile.role !== "architect") return no("Studio is for architects and designers.", 403);
    if (b.plan === "build" && profile.role !== "builder") return no("Build is for builders and contractors.", 403);
    if (profile.paypal_subscription) return no("You already have a plan. Cancel it first to change it.", 409);
    const id = planId(b.plan, b.cycle);
    if (!id) return no("That plan isn't set up yet.", 503);
    // a trial that hasn't run out stays free: the first charge waits for its end
    const trialEnds = profile.trial_until && new Date(profile.trial_until).getTime() > Date.now() + 3_600_000 ? profile.trial_until : null;
    return Response.json({ planId: id, customId: purposeId({ kind: "plan", userId: me, plan: b.plan }), startTime: trialEnds });
  }

  if (b.action === "confirm") {
    const sub = await getSubscription(b.subscriptionId).catch(() => null);
    if (!sub || !sub.custom_id?.startsWith(`plan:${me}:`)) return no("not found", 404);
    if (!(await applySubscription(sub))) return no("PayPal hasn't confirmed the plan yet. It opens as soon as it does.", 202);
    return Response.json({ ok: true });
  }

  if (!profile.paypal_subscription) return no("You have no plan to cancel.", 409);
  await cancelSubscription(profile.paypal_subscription, "Cancelled from Arcon").catch(() => null);
  await applySubscription(await getSubscription(profile.paypal_subscription));
  return Response.json({ ok: true });
}
