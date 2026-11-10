import { supabaseAdmin } from "../supabase/admin.ts";
import { money } from "../project/fees.ts";
import { getProject } from "../project/store.ts";
import { nameOf, postEvent } from "../project/thread.ts";
import { unlockProject } from "../project/unlock.ts";
import { completedCapture, purposeId, sameAmount, type CapturedOrder, type Purpose } from "./order.ts";

// The payments ledger: an order is written down when it is made, and settled once, when PayPal says the money was
// captured. The capture route and the webhook both call settleOrder; whichever comes second finds it done.

export type PaymentRow = {
  id: number;
  kind: Purpose["kind"];
  purpose: string;
  project_id: string | null;
  milestone_id: number | null;
  payer_id: string | null;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "completed" | "failed" | "refunded";
};

export async function recordOrder(r: { purpose: Purpose; orderId: string; amount: number; currency: string; payerId: string; projectId: string | null; payeeEmail?: string | null }) {
  const { error } = await supabaseAdmin()
    .from("payments")
    .insert({
      kind: r.purpose.kind,
      purpose: purposeId(r.purpose),
      project_id: r.projectId,
      milestone_id: r.purpose.kind === "fee" ? r.purpose.milestoneId : null,
      payer_id: r.payerId,
      payee_email: r.payeeEmail ?? null,
      order_id: r.orderId,
      amount: r.amount,
      currency: r.currency,
    });
  if (error) throw new Error(error.message);
}

export const paymentForOrder = async (orderId: string) =>
  ((await supabaseAdmin().from("payments").select("id, kind, purpose, project_id, milestone_id, payer_id, order_id, amount, currency, status").eq("order_id", orderId).maybeSingle()).data as PaymentRow | null);

/** Whether a purpose has already been paid through PayPal (any completed payment for it). */
export async function alreadyPaid(purpose: string): Promise<boolean> {
  const { count } = await supabaseAdmin().from("payments").select("id", { count: "exact", head: true }).eq("purpose", purpose).eq("status", "completed");
  return (count ?? 0) > 0;
}

/**
 * Whether what an order pays for is still owed, read just before capturing it, so a second order for the same
 * thing (two tabs, Pay pressed twice) is never charged: the project still locked, the fee still billed.
 */
export async function stillOwed(row: Pick<PaymentRow, "kind" | "purpose" | "project_id" | "milestone_id">): Promise<boolean> {
  if (await alreadyPaid(row.purpose)) return false;
  const db = supabaseAdmin();
  if (row.kind === "unlock" && row.project_id) {
    const { data } = await db.from("projects").select("unlocked_at").eq("id", row.project_id).maybeSingle();
    return !!data && !data.unlocked_at;
  }
  if (row.kind === "fee" && row.milestone_id) {
    const { data } = await db.from("milestones").select("status").eq("id", row.milestone_id).maybeSingle();
    return data?.status === "billed" || data?.status === "claimed";
  }
  return false;
}

export type Settled = { ok: true; kind: Purpose["kind"]; already: boolean } | { ok: false; reason: "not-paid" | "unknown" | "mismatch" };

/** Settle a captured order: check it is the one Arcon made, for the amount it asked, then open what it paid for. */
export async function settleOrder(order: CapturedOrder): Promise<Settled> {
  const cap = completedCapture(order);
  if (!cap) return { ok: false, reason: "not-paid" };
  const row = await paymentForOrder(order.id);
  if (!row) return { ok: false, reason: "unknown" };
  const db = supabaseAdmin();
  if (row.purpose !== purposeId(cap.purpose) || !sameAmount(cap.amount, Number(row.amount), row.currency)) {
    await db.from("payments").update({ status: "failed" }).eq("id", row.id).eq("status", "created");
    return { ok: false, reason: "mismatch" };
  }
  // only the first caller moves it from created to completed; a second one finds it done and changes nothing
  const { data: moved } = await db.from("payments").update({ status: "completed", capture_id: cap.id, completed_at: new Date().toISOString() }).eq("id", row.id).eq("status", "created").select("id");
  if (!moved?.length) return { ok: true, kind: row.kind, already: true };

  const project = row.project_id ? await getProject(row.project_id).catch(() => null) : null;
  const actor = { id: row.payer_id, name: row.payer_id ? await nameOf(row.payer_id) : "Someone" };
  const amount = money(Number(row.amount), row.currency);
  if (cap.purpose.kind === "unlock" && project) {
    await unlockProject(project.id);
    await postEvent(project, actor, { type: "unlocked", amount }).catch(() => {});
  }
  if (cap.purpose.kind === "fee") {
    const { data: m } = await db
      .from("milestones")
      .update({ status: "received", received_at: new Date().toISOString(), payment_id: row.id })
      .eq("id", cap.purpose.milestoneId)
      .in("status", ["billed", "claimed"])
      .select("label")
      .maybeSingle();
    if (m && project) await postEvent(project, actor, { type: "fee", action: "paypal", label: (m as { label: string }).label, amount }).catch(() => {});
  }
  return { ok: true, kind: row.kind, already: false };
}
