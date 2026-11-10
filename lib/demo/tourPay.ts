import { supabaseAdmin } from "../supabase/admin.ts";
import { DEMO_IDS } from "./ids.ts";
import { TITLES } from "./story.ts";

// In the tour, a visitor can pay one of Maya's billed fees for real, in PayPal's sandbox, with no sign-up: the fee
// settles, the thread says so. So the next visitor can do the same, a fee the tour paid goes back to billed a few
// minutes later: its sandbox payment and its "paid with PayPal" line are taken out, the bill and its note stay.

/** The fees a tour visitor may pay: billed at seed time, never paid by the seed (scripts/demo-paypal.ts). */
export const TOUR_PAYABLE = ["Drawings and permits", "Electrical and plumbing"];
/** How long a visitor's payment stays settled before the fee is billed again for the next one. */
export const TOUR_HOLD_MS = 5 * 60_000;

/** Whether a paid tour fee is ready to go back to billed. */
export const due = (receivedAt: string | null, now = Date.now()) => !!receivedAt && now - new Date(receivedAt).getTime() > TOUR_HOLD_MS;

export async function resetTourPayments(now = Date.now()) {
  const db = supabaseAdmin();
  const { data: p } = await db.from("projects").select("id").eq("title", TITLES.maya).eq("owner_id", DEMO_IDS.lena).maybeSingle();
  if (!p) return 0;
  const { data: ms } = await db.from("milestones").select("id, label, status, received_at, billed_at").eq("project_id", p.id).in("label", TOUR_PAYABLE).eq("status", "received");
  let n = 0;
  for (const m of (ms ?? []) as { id: number; label: string; received_at: string | null; billed_at: string | null }[]) {
    if (!due(m.received_at, now)) continue;
    // back to billed first (only if still received), so two visitors resetting at once do it once
    const { data: moved } = await db.from("milestones").update({ status: "billed", received_at: null, claimed_at: null, payment_id: null }).eq("id", m.id).eq("status", "received").select("id");
    if (!moved?.length) continue;
    await db.from("payments").delete().eq("milestone_id", m.id).eq("payer_id", DEMO_IDS.maya);
    await db.from("messages").delete().eq("project_id", p.id).eq("kind", "event").contains("data", { type: "fee", label: m.label }).in("data->>action", ["paypal", "paid", "received"]);
    n++;
  }
  return n;
}
