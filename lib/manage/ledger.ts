import { actionsFor, sideOf, type FeeAction, type FeeStatus } from "../project/fees.ts";

// The fee ledger: every fee milestone across a person's projects in one list, from their side. A pro sees what
// they've billed and been paid; whoever pays sees what they owe. Pure, so the page and the tests agree.

/** `created_by`: the pro who set the milestone out; only they bill it and confirm it. */
export type FeeRow = { id: number; project_id: string; label: string; amount: number; currency: string; status: FeeStatus; billed_at: string | null; created_by?: string | null; payment_id?: number | null };
export type LedgerProject = { id: string; name: string; role: string; mode: "owner" | "pro" };
export type LedgerLine = FeeRow & { project: string; side: "in" | "out"; overdue: boolean; waiting: number | null; next: string; actions: FeeAction[]; to?: string | null };
export type LedgerTotals = { currency: string; planned: number; billed: number; toConfirm: number; received: number; overdue: number };

/** Billed this many days ago and still not paid: overdue. */
export const OVERDUE_DAYS = 14;
const DAY = 86_400_000;

function nextFor(status: FeeStatus, side: "in" | "out"): string {
  if (status === "received") return "Settled";
  if (side === "in") return status === "planned" ? "Bill it when the work is done" : status === "billed" ? "Waiting for payment" : "They say it's paid: confirm";
  return status === "planned" ? "Not billed yet" : status === "billed" ? "Pay, then mark it paid" : "Waiting for them to confirm";
}

// what needs this person first, then what's waiting on others, then what's settled
const RANK = (l: LedgerLine) => (l.actions.length && l.status !== "planned" ? 0 : l.overdue ? 1 : l.status === "billed" || l.status === "claimed" ? 2 : l.status === "planned" ? 3 : 4);

/** `me`: the person reading it. A pro sees only the fees they set out; the one paying sees every fee they owe. */
export function ledger(rows: FeeRow[], projects: LedgerProject[], now = Date.now(), me: string | null = null): { lines: LedgerLine[]; totals: LedgerTotals[] } {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const lines: LedgerLine[] = [];
  for (const r of rows) {
    const p = byId.get(r.project_id);
    const fs = p ? sideOf(p.role, p.mode) : null;
    if (!p || !fs) continue; // viewers don't see fees
    if (fs === "pro" && me && r.created_by && r.created_by !== me) continue; // another pro's fees on a shared project
    const side = fs === "pro" ? "in" : "out";
    const waiting = r.status === "billed" && r.billed_at ? Math.floor((now - new Date(r.billed_at).getTime()) / DAY) : null;
    lines.push({ ...r, amount: Number(r.amount), project: p.name, side, overdue: waiting !== null && waiting >= OVERDUE_DAYS, waiting, next: nextFor(r.status, side), actions: actionsFor(r.status, fs) });
  }
  lines.sort((a, b) => RANK(a) - RANK(b) || a.project.localeCompare(b.project));

  const totals = new Map<string, LedgerTotals>();
  for (const l of lines) {
    const t = totals.get(l.currency) ?? { currency: l.currency, planned: 0, billed: 0, toConfirm: 0, received: 0, overdue: 0 };
    if (l.status === "planned") t.planned += l.amount;
    if (l.status === "billed") t.billed += l.amount;
    if (l.status === "claimed") t.toConfirm += l.amount;
    if (l.status === "received") t.received += l.amount;
    if (l.overdue) t.overdue += l.amount;
    totals.set(l.currency, t);
  }
  return { lines, totals: [...totals.values()] };
}
