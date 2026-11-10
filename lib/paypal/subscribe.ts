import { supabaseAdmin } from "../supabase/admin.ts";
import type { Subscription } from "./client.ts";
import { profileFrom } from "./plans.ts";

/** Put what a PayPal subscription says onto the person's profile. Safe to call again with the same subscription. */
export async function applySubscription(sub: Subscription): Promise<boolean> {
  const p = profileFrom(sub);
  if (!p) return false;
  const patch: Record<string, unknown> = { plan: p.plan, paypal_subscription: p.subscription };
  if (p.until !== "keep") patch.plan_until = p.until;
  const { error } = await supabaseAdmin().from("profiles").update(patch).eq("user_id", p.userId);
  if (error) throw new Error(error.message);
  return true;
}
