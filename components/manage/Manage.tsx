"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Reveal } from "@/components/fx/Motion";
import { ok, tick } from "@/components/fx/sfx";
import { money, STATUS_LABEL, type FeeAction } from "@/lib/project/fees";
import type { LedgerLine, LedgerTotals } from "@/lib/manage/ledger";
import { tapSite, type CrewLine } from "@/lib/manage/crew";

// Running the business across every project: the fee ledger, the crew's week, deliveries, and each site's money.
// Every button goes through the project's own API, so the same checks apply as on the project itself.

const label = "font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft";
const card = "rounded-2xl border border-line bg-paper-raised";

function Stat({ name, value, tone = "" }: { name: string; value: string; tone?: string }) {
  return (
    <div className={`${card} px-4 py-3`}>
      <p className={label}>{name}</p>
      <p className={`mt-1 font-serif text-2xl ${tone}`}>{value}</p>
    </div>
  );
}

function useAct() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the button stays busy until the new figures are on screen, not just until the save
  const [refreshing, refresh] = useTransition();
  // one or more posts in order; stops at the first that fails
  const act = async (key: string, ...calls: [url: string, body: unknown][]) => {
    tick();
    setBusy(key);
    setError(null);
    for (const [url, body] of calls) {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
      if (!res?.ok) {
        setBusy(null);
        return setError((await res?.json().catch(() => null))?.error ?? "That didn't go through. Try again.");
      }
    }
    ok();
    refresh(() => {
      router.refresh();
      setBusy(null);
    });
  };
  return { act, busy: busy ?? (refreshing ? "refresh" : null), error };
}

const Problem = ({ text }: { text: string | null }) => (text ? <p className="mt-3 text-sm text-red-600">{text}</p> : null);

// ---- Fee ledger -------------------------------------------------------------------------------------------------

const ACTION: Record<FeeAction, string> = { bill: "Bill it", paid: "I've paid", received: "Received" };
const TONE: Record<string, string> = { planned: "text-ink-soft border-line", billed: "text-accent border-accent/40", claimed: "text-amber-600 border-amber-500/40", received: "text-leaf border-leaf/40" };

export function FeeLedger({ lines, totals, pro }: { lines: LedgerLine[]; totals: LedgerTotals[]; pro: boolean }) {
  const { act, busy, error } = useAct();
  // ?all opens on every fee, settled ones too (the tour shows what clients paid through PayPal)
  const [show, setShow] = useState<"open" | "all">("open");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("all")) setShow("all");
  }, []);
  const shown = show === "open" ? lines.filter((l) => l.status !== "received") : lines;
  if (!lines.length)
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-sm text-ink-soft">
        {pro ? "No fees set out yet. On a project's Overview, set out your fee by milestone (design, approval, handover) and bill each one when it's due." : "No fees yet. When your architect or builder bills a milestone, it shows here to pay."}
      </p>
    );
  return (
    <>
      {totals.map((t) => (
        <Reveal key={t.currency} delay={0.04} className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {pro ? (
            <>
              <Stat name="Billed, unpaid" value={money(t.billed, t.currency)} tone="text-accent" />
              <Stat name="Paid, to confirm" value={money(t.toConfirm, t.currency)} tone="text-amber-600" />
              <Stat name="Received" value={money(t.received, t.currency)} tone="text-leaf" />
              <Stat name="Overdue" value={money(t.overdue, t.currency)} tone={t.overdue ? "text-red-600" : ""} />
            </>
          ) : (
            <>
              <Stat name="To pay now" value={money(t.billed, t.currency)} tone="text-accent" />
              <Stat name="Paid, being confirmed" value={money(t.toConfirm, t.currency)} tone="text-amber-600" />
              <Stat name="Paid" value={money(t.received, t.currency)} tone="text-leaf" />
              <Stat name="Still to come" value={money(t.planned, t.currency)} />
            </>
          )}
        </Reveal>
      ))}
      <div className="mt-6 flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider">
        {(["open", "all"] as const).map((v) => (
          <button key={v} onClick={() => (tick(), setShow(v))} aria-pressed={show === v} className={`rounded-full px-3 py-1 transition ${show === v ? "bg-btn text-btn-ink" : "text-ink-soft hover:text-ink"}`}>
            {v === "open" ? "Open" : "Everything"}
          </button>
        ))}
      </div>
      <Reveal delay={0.08} className={`${card} mt-3 overflow-x-auto`}>
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className={`${label} border-b border-line text-left`}>
              <th className="px-4 py-3 font-normal">Project</th>
              <th className="px-4 py-3 font-normal">Milestone</th>
              <th className="px-4 py-3 text-right font-normal">Amount</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 font-normal">Next</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((l) => (
              <tr key={l.id} className={l.overdue ? "bg-red-500/5" : ""}>
                <td className="px-4 py-3">
                  <Link href={`/project/${l.project_id}?tab=overview`} className="hover:text-accent">
                    {l.project}
                  </Link>
                  <span className={`ml-2 font-mono text-[10px] ${l.side === "in" ? "text-leaf" : "text-accent"}`}>{l.side === "in" ? "IN" : "OUT"}</span>
                  {l.side === "out" && l.to && <span className="block text-xs text-ink-soft">to {l.to}</span>}
                </td>
                <td className="px-4 py-3">{l.label}</td>
                <td className="px-4 py-3 text-right font-mono">{money(l.amount, l.currency)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${TONE[l.status]}`}>{STATUS_LABEL[l.status]}</span>
                  {l.payment_id ? <span className="ml-2 text-xs text-leaf">via PayPal</span> : null}
                  {l.waiting !== null && <span className={`ml-2 text-xs ${l.overdue ? "text-red-600" : "text-ink-soft"}`}>{l.waiting}d</span>}
                </td>
                <td className="px-4 py-3">
                  {l.actions.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {l.actions.map((a) =>
                        // billing happens on the project, where Arcon drafts the note that goes with the bill
                        a === "bill" ? (
                          <Link key={a} href={`/project/${l.project_id}?tab=overview#fees`} className="glow-btn rounded-full px-3 py-1 text-xs">
                            Bill…
                          </Link>
                        ) : (
                        <button key={a} disabled={!!busy} onClick={() => act(`${l.id}`, [`/api/projects/${l.project_id}/fees/${l.id}`, { action: a }])} className="glow-btn rounded-full px-3 py-1 text-xs disabled:opacity-60">
                          {busy === `${l.id}` ? "…" : ACTION[a]}
                        </button>
                        ),
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-soft">{l.next}</span>
                  )}
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-leaf">
                  ✓ Nothing open. Every fee is settled.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Reveal>
      <Problem text={error} />
    </>
  );
}

// ---- Crew & wages -----------------------------------------------------------------------------------------------

export function CrewBoard({ lines, sites, today, currency, onSite, earned }: { lines: CrewLine[]; sites: { id: string; name: string }[]; today: string; currency: string; onSite: number; earned: number }) {
  const { act, busy, error } = useAct();
  const site = new Map(sites.map((s) => [s.id, s.name]));
  if (!lines.length)
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-sm text-ink-soft">
        No crew yet. Add workers on a site&apos;s Crew panel (name, trade, day rate); they show here across every site you run.
      </p>
    );
  return (
    <>
      <Reveal delay={0.04} className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat name="Crew" value={String(lines.length)} />
        <Stat name="On site today" value={`${onSite}`} tone="text-leaf" />
        <Stat name="Days worked this week" value={String(lines.reduce((n, l) => n + l.days, 0))} />
        <Stat name="Wages this week" value={money(earned, currency)} tone="text-accent" />
      </Reveal>
      <ul className="mt-6 space-y-2">
        {lines.map((c, i) => (
          <Reveal key={c.id} delay={0.03 * Math.min(i, 10)}>
            <li className={`${card} grid items-center gap-3 p-4 sm:grid-cols-[1fr_auto]`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-serif text-lg ${c.here.length ? "bg-leaf/15 text-leaf ring-2 ring-leaf/40" : "bg-paper text-ink-soft"}`}>{c.name[0]}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {c.name}
                    {c.trade && <span className="ml-2 text-sm font-normal text-ink-soft">{c.trade}</span>}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {c.here.length ? <span className="text-leaf">● On site at {c.here.map((s) => site.get(s)).join(", ")}</span> : c.marked ? "Marked off today" : "Not marked today"}
                    {" · "}
                    {c.days} day{c.days === 1 ? "" : "s"} this week · {money(c.earned, currency)} at {money(c.day_rate, currency)}/day
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.sites.map((s) => {
                  const here = c.here.includes(s);
                  return (
                    <button
                      key={s}
                      disabled={!!busy}
                      title={here ? "Mark off site today" : c.here.length ? "Move here for today" : "Mark on site today"}
                      onClick={() => act(`${c.id}-${s}`, ...tapSite(c.here, s).map((t): [string, unknown] => [`/api/projects/${t.project_id}/site`, { op: "attend", crew_id: c.id, day: today, present: t.present }]))}
                      className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-60 ${here ? "border-leaf/50 bg-leaf/10 text-leaf" : "border-line text-ink-soft hover:border-accent hover:text-accent"}`}
                    >
                      {busy === `${c.id}-${s}` ? "…" : `${here ? "✓ " : "+ "}${site.get(s) ?? "Site"}`}
                    </button>
                  );
                })}
                {!c.sites.length && <span className="text-xs text-ink-soft">Not on a site yet</span>}
              </div>
            </li>
          </Reveal>
        ))}
      </ul>
      <Problem text={error} />
      <p className="mt-4 text-sm text-ink-soft">Tap a site to mark someone on site today (a full day); tapping another site moves them there. Hours, tasks and new workers are on each site&apos;s own page.</p>
    </>
  );
}

// ---- Materials & deliveries -------------------------------------------------------------------------------------

type Order = { id: number; project_id: string; site: string; material: string; unit: string; qty: number; supplier: string | null; cost: number; eta: string | null; late: boolean };

export function Deliveries({ open, recent, low, currency }: { open: Order[]; recent: Order[]; low: { project_id: string; site: string; text: string }[]; currency: Record<string, string> }) {
  const { act, busy, error } = useAct();
  const late = open.filter((o) => o.late).length;
  const day = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "No date");
  return (
    <>
      <Reveal delay={0.04} className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat name="On the way" value={String(open.length)} tone="text-accent" />
        <Stat name="Late" value={String(late)} tone={late ? "text-red-600" : ""} />
        <Stat name="Running low" value={String(low.length)} tone={low.length ? "text-amber-600" : ""} />
        <Stat name="Came in, 2 weeks" value={String(recent.length)} tone="text-leaf" />
      </Reveal>
      {low.length > 0 && (
        <Reveal delay={0.06} className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
          <p className={label}>Order soon</p>
          <ul className="mt-2 space-y-1 text-sm">
            {low.map((l, i) => (
              <li key={i}>
                <Link href={`/project/${l.project_id}?tab=site`} className="hover:text-accent">
                  <span className="font-medium">{l.site}:</span> {l.text}
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
      <p className={`${label} mt-8`}>On the way · {open.length}</p>
      {open.length ? (
        <ul className="mt-2 space-y-2">
          {open.map((o) => (
            <li key={o.id} className={`${card} flex flex-wrap items-center gap-3 p-4 ${o.late ? "border-red-500/40" : ""}`}>
              <span className={`grid h-10 w-12 shrink-0 place-items-center rounded-lg font-mono text-[11px] ${o.late ? "bg-red-500/10 text-red-600" : "bg-accent/10 text-accent"}`}>{day(o.eta)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {o.qty} {o.unit} {o.material}
                  {o.late && <span className="ml-2 text-xs text-red-600">late</span>}
                </p>
                <p className="truncate text-xs text-ink-soft">
                  <Link href={`/project/${o.project_id}?tab=site`} className="hover:text-accent">
                    {o.site}
                  </Link>
                  {o.supplier && ` · ${o.supplier}`}
                  {o.cost > 0 && ` · ${money(o.cost, currency[o.project_id] ?? "USD")}`}
                </p>
              </div>
              <button disabled={!!busy} onClick={() => act(String(o.id), [`/api/projects/${o.project_id}/site`, { op: "order.deliver", id: o.id }])} className="glow-btn rounded-full px-4 py-1.5 text-xs disabled:opacity-60">
                {busy === String(o.id) ? "…" : "Mark delivered"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">Nothing on order. Order materials from a site&apos;s Materials panel, with the supplier and when it&apos;s due.</p>
      )}
      {recent.length > 0 && (
        <>
          <p className={`${label} mt-8`}>Came in lately</p>
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-paper-raised text-sm">
            {recent.map((o) => (
              <li key={o.id} className="flex justify-between gap-3 px-4 py-2.5">
                <span className="truncate">
                  <span className="text-leaf">✓</span> {o.qty} {o.unit} {o.material}
                </span>
                <span className="shrink-0 text-ink-soft">{o.site}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Problem text={error} />
    </>
  );
}

// ---- Site money -------------------------------------------------------------------------------------------------

type SiteMoneyRow = { id: string; name: string; currency: string; progress: number; budget: { low: number; high: number } | null; labour: number; materials: number; spent: number; billed: number; received: number; feeCurrency: string | null };

export function SiteMoney({ sites }: { sites: SiteMoneyRow[] }) {
  if (!sites.length) return <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-sm text-ink-soft">No site running yet. Once a site starts, its budget and spend show here.</p>;
  return (
    <ul className="mt-6 space-y-3">
      {sites.map((s, i) => {
        const top = s.budget?.high ?? 0;
        const used = top ? Math.round((s.spent / top) * 100) : 0;
        // spending faster than the work is going: worth a look
        const ahead = top > 0 && used > s.progress + 15;
        return (
          <Reveal key={s.id} delay={0.05 * i}>
            <li className={`${card} p-5`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/project/${s.id}?tab=site`} className="font-serif text-2xl hover:text-accent">
                  {s.name}
                </Link>
                <span className="font-mono text-xs text-ink-soft">{s.progress}% built</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className={label}>Budget</p>
                  <p className="mt-1 font-mono text-sm">{s.budget ? `${money(s.budget.low, s.currency)}–${money(s.budget.high, s.currency)}` : "—"}</p>
                </div>
                <div>
                  <p className={label}>Spent so far</p>
                  <p className={`mt-1 font-mono text-sm ${ahead ? "text-red-600" : ""}`}>{money(s.spent, s.currency)}</p>
                  <p className="text-[11px] text-ink-soft">
                    labour {money(s.labour, s.currency)} · materials {money(s.materials, s.currency)}
                  </p>
                </div>
                <div>
                  <p className={label}>Billed to client</p>
                  <p className="mt-1 font-mono text-sm">{s.feeCurrency ? money(s.billed, s.feeCurrency) : "—"}</p>
                </div>
                <div>
                  <p className={label}>Received</p>
                  <p className="mt-1 font-mono text-sm text-leaf">{s.feeCurrency ? money(s.received, s.feeCurrency) : "—"}</p>
                </div>
              </div>
              {top > 0 && (
                <div className="mt-4">
                  <div className="relative h-2 overflow-hidden rounded-full bg-line">
                    <div className={`h-full rounded-full ${ahead ? "bg-red-500" : "bg-gradient-to-r from-leaf to-accent"}`} style={{ width: `${Math.min(100, used)}%` }} />
                    <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${s.progress}%` }} title="Work done" />
                  </div>
                  <p className="mt-1.5 text-xs text-ink-soft">
                    {used}% of the top of the budget spent, {s.progress}% of the work done
                    {ahead && <span className="text-red-600"> · spending is running ahead of the work</span>}
                  </p>
                </div>
              )}
            </li>
          </Reveal>
        );
      })}
      <p className="text-sm text-ink-soft">These are your own costs; clients see the budget and progress, never the spend.</p>
    </ul>
  );
}
