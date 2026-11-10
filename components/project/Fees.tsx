"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { actionsFor, dueWhen, money, phaseSplit, splitWords, standardSplit, STATUS_LABEL, type FeeAction, type FeeSide, type FeeStatus, type ProKind } from "@/lib/project/fees";
import { chime, ok, tick } from "@/components/fx/sfx";
import { finishOrder, PayPalButton, startOrder } from "@/components/pay/PayPalButton";

type Milestone = { id: number; label: string; amount: number; currency: string; status: FeeStatus; to?: string | null; phase?: string | null; paypal?: boolean; viaPayPal?: boolean };
type Phase = { key: string; name: string; days: number; done: boolean };

const CURRENCIES = ["INR", "USD", "GBP", "EUR", "AED", "SGD", "AUD", "CAD"];
const guess = (location?: string | null) =>
  /india|pune|delhi|mumbai|bengaluru|bangalore|hyderabad|chennai|kolkata/i.test(location ?? "") ? "INR"
  : /\b(UK|London|Manchester)\b/i.test(location ?? "") ? "GBP"
  : /dubai|abu dhabi|UAE/i.test(location ?? "") ? "AED"
  : /singapore/i.test(location ?? "") ? "SGD"
  : /australia|sydney|melbourne/i.test(location ?? "") ? "AUD"
  : /canada|toronto|vancouver/i.test(location ?? "") ? "CAD"
  : /germany|berlin|munich/i.test(location ?? "") ? "EUR"
  : "USD";

const BUTTON: Record<FeeAction, string> = { bill: "Mark billed", paid: "I've paid", received: "Received ✓" };
const PILL: Record<FeeStatus, string> = { planned: "bg-line/60 text-ink-soft", billed: "bg-accent/15 text-accent", claimed: "bg-amber-500/15 text-amber-600", received: "bg-leaf/15 text-leaf" };

// Fees between the pro and the person paying: milestones the pro sets out, billed, marked paid, then confirmed.
// Each step also posts in the thread. Hidden for people who are on neither side.
export function Fees({ projectId, location }: { projectId: string; location?: string | null }) {
  const [data, setData] = useState<{ milestones: Milestone[]; side: FeeSide; kind: ProKind | null; phases?: Phase[]; movedIn?: boolean } | null>(null);
  // the split, laid out to change before it's saved
  const [draft, setDraft] = useState<{ label: string; amount: number; phase?: string }[] | null>(null);
  const [total, setTotal] = useState("");
  const [currency, setCurrency] = useState(guess(location));
  const [busy, setBusy] = useState<number | "add" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the milestone whose PayPal buttons are open
  const [paying, setPaying] = useState<number | null>(null);
  // a note Arcon's agent is drafting or has drafted for one milestone: a bill, a reminder, or what it's for
  const [note, setNote] = useState<{ id: number; kind: "bill" | "remind" | "explain"; text: string | null; by?: "agent" | "plain" } | null>(null);

  async function askArcon(m: Milestone, kind: "bill" | "remind" | "explain") {
    tick();
    setError(null);
    setPaying(null);
    setNote({ id: m.id, kind, text: null });
    const res = await fetch(`/api/projects/${projectId}/fees/${m.id}/note`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNote(null);
      return setError(j.error ?? "Arcon couldn't write that just now.");
    }
    setNote({ id: m.id, kind, text: j.text, by: j.by });
  }

  const load = useCallback(
    () =>
      fetch(`/api/projects/${projectId}/fees`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setData(d))
        .catch(() => {}),
    [projectId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (!data || !data.side || (data.side === "payer" && data.milestones.length === 0)) return null;
  const sum = data.milestones.reduce((s, m) => s + m.amount, 0);
  const got = data.milestones.filter((m) => m.status === "received").reduce((s, m) => s + m.amount, 0);
  const cur = data.milestones[0]?.currency ?? currency;

  async function act(m: Milestone, action: FeeAction | "remind", note?: string) {
    tick();
    setBusy(m.id);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/fees/${m.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...(note ? { note } : {}) }) });
    setBusy(null);
    // Refresh either way, so a step someone else just took (or a double click) shows as it is.
    void load();
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "That didn't go through.");
    ok();
  }

  async function paid(orderId: string) {
    setError(null);
    await finishOrder(orderId);
    chime();
    setPaying(null);
    void load();
  }

  function split() {
    const n = Number(total.replace(/[^\d.]/g, ""));
    if (!n) return setError("Enter your total fee.");
    tick();
    setError(null);
    // a builder on a running site: one part per phase, each due as it finishes
    setDraft(data?.kind === "builder" && data.phases?.length ? phaseSplit(n, data.phases) : standardSplit(n, data?.kind ?? "architect"));
  }

  async function add() {
    if (!draft) return;
    const items = draft.filter((d) => d.label.trim() && d.amount > 0).map((d) => ({ label: d.label.trim(), amount: d.amount, ...(d.phase ? { phase: d.phase } : {}) }));
    if (!items.length) return setError("Add a name and an amount for each milestone.");
    setBusy("add");
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/fees`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currency, items }) });
    setBusy(null);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Couldn't save.");
    ok();
    setTotal("");
    setDraft(null);
    void load();
  }

  return (
    <section className="mt-4 rounded-2xl border border-line bg-paper-raised p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-serif text-2xl">Fees</p>
        {sum > 0 && (
          <p className="text-sm text-ink-soft">
            {money(got, cur)} of {money(sum, cur)} received
          </p>
        )}
      </div>
      {sum > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <motion.div className="h-full bg-leaf" initial={{ width: 0 }} animate={{ width: `${(got / sum) * 100}%` }} transition={{ duration: 0.8 }} />
        </div>
      )}
      {data.milestones.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {data.milestones.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2.5">
              <span className="min-w-0">
                <span className="font-medium">{m.label}</span> <span className="text-ink-soft">· {money(m.amount, m.currency)}</span>
                {data.side === "payer" && m.to && <span className="block text-xs text-ink-soft">to {m.to}</span>}
                {m.status === "planned" && dueWhen(m.phase, data.phases ?? []) && (
                  <span className="block text-xs text-ink-soft">
                    Due {dueWhen(m.phase, data.phases ?? [])}
                    {isDue(m, data.phases ?? [], !!data.movedIn) && <span className="ml-1.5 rounded-full bg-leaf/10 px-2 py-0.5 text-leaf">{data.side === "pro" ? "done: bill it" : "done"}</span>}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs ${PILL[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                {m.viaPayPal && <span className="text-xs text-leaf">via PayPal</span>}
                {data.side === "payer" && m.paypal && (m.status === "billed" || m.status === "claimed") && (
                  <button onClick={() => (tick(), setPaying(paying === m.id ? null : m.id))} className="glow-btn rounded-full px-3 py-1 text-xs">
                    {paying === m.id ? "Close" : "Pay with PayPal"}
                  </button>
                )}
                {data.side === "payer" && (m.status === "billed" || m.status === "claimed") && (
                  <button onClick={() => askArcon(m, "explain")} className="text-xs text-ink-soft hover:text-accent">
                    What is this for?
                  </button>
                )}
                {data.side === "pro" && m.status === "billed" && (
                  <button onClick={() => askArcon(m, "remind")} disabled={busy === m.id} className="rounded-full border border-line px-3 py-1 text-xs transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:opacity-60">
                    Remind
                  </button>
                )}
                {actionsFor(m.status, data.side).map((a) => (
                  <button
                    key={a}
                    // billing goes through Arcon's note first: the agent drafts what this stage covered, the pro sends it
                    onClick={() => (a === "bill" ? askArcon(m, "bill") : act(m, a))}
                    disabled={busy === m.id}
                    className="rounded-full border border-line px-3 py-1 text-xs transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:opacity-60"
                  >
                    {a === "bill" ? "Bill…" : BUTTON[a]}
                  </button>
                ))}
              </span>
              {note?.id === m.id && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-xl border border-accent/30 bg-accent/5 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-accent">
                    {note.text === null ? "Arcon is reading the project…" : note.kind === "explain" ? "Arcon explains" : note.by === "agent" ? "Drafted by Arcon from the project's record · edit anything" : "A plain note · edit anything"}
                  </p>
                  {note.text === null ? (
                    <div className="mt-2 h-14 animate-pulse rounded-lg bg-line/60" />
                  ) : note.kind === "explain" ? (
                    <p className="mt-2 text-sm">{note.text}</p>
                  ) : (
                    <>
                      <textarea value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} rows={4} aria-label="The note your client gets" className="mt-2 w-full rounded-lg border border-line bg-paper p-2 text-sm" />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          onClick={async () => {
                            await act(m, note.kind === "bill" ? "bill" : "remind", note.text ?? undefined);
                            setNote(null);
                          }}
                          disabled={busy === m.id || !note.text?.trim()}
                          className="glow-btn rounded-full px-4 py-1.5 text-xs disabled:opacity-60"
                        >
                          {note.kind === "bill" ? `Send the bill · ${money(m.amount, m.currency)}` : "Send the reminder"}
                        </button>
                        <button onClick={() => setNote(null)} className="text-xs text-ink-soft hover:text-accent">
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
              {paying === m.id && (
                <div className="w-full">
                  <p className="text-xs text-ink-soft">Paid straight to {m.to ?? "your pro"} through PayPal. It settles here the moment it goes through.</p>
                  <PayPalButton kind="order" currency={m.currency} createOrder={() => startOrder({ for: "fee", projectId, milestoneId: m.id })} onApprove={paid} onError={setError} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-ink-soft">Set out your fee once: Arcon splits it into {data.kind === "builder" && data.phases?.length ? "a 10% deposit, one part per phase of your site (by how long each runs) and 10% on handover, each due as it finishes" : splitWords(data.kind ?? "architect")}. Change any name or amount before you save. Your client sees what&apos;s due and when.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency" className="rounded-full border border-line bg-paper px-3 py-2 text-sm">
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" placeholder="Your total fee" aria-label="Your total fee" className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-accent" />
            <button onClick={split} className="glow-btn rounded-full px-5 py-2 text-sm">
              Split it
            </button>
          </div>
          {draft && (
            <div className="mt-3 space-y-2">
              {draft.map((d, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input value={d.label} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="Milestone" maxLength={80} className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-accent" />
                  <input value={d.amount} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } : x)))} inputMode="decimal" aria-label="Amount" className="w-32 rounded-xl border border-line bg-paper px-3 py-1.5 text-right text-sm outline-none focus:border-accent" />
                  {dueWhen(d.phase, data.phases ?? []) && <span className="w-full text-xs text-ink-soft">due {dueWhen(d.phase, data.phases ?? [])}</span>}
                </div>
              ))}
              <p className="text-xs text-ink-soft">Total {money(draft.reduce((n, d) => n + d.amount, 0), currency)}</p>
              <button onClick={add} disabled={busy === "add"} className="glow-btn rounded-full px-5 py-2 text-sm disabled:opacity-60">
                {busy === "add" ? "Saving…" : "Save my fees"}
              </button>
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

/** A planned fee whose moment has come: the site started, its phase finished, or the client moved in. */
function isDue(m: Milestone, phases: Phase[], movedIn: boolean) {
  if (m.phase === "start") return phases.length > 0;
  if (m.phase === "handover") return movedIn;
  return phases.some((p) => p.key === m.phase && p.done);
}
