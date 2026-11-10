"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PayPalButton } from "@/components/pay/PayPalButton";
import { chime, ok, tick } from "@/components/fx/sfx";
import { PLAN_NAME, PRICES, type Cycle } from "@/lib/paypal/plans";

type Props = { role: string; plan: string; planUntil: string | null; trialUntil: string | null; subscribed: boolean; paypalEmail: string | null };

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

// A pro's money on Arcon: their Studio or Build plan, paid on PayPal, and the PayPal account their clients pay into.
export function Billing({ role, plan, planUntil, trialUntil, subscribed, paypalEmail }: Props) {
  const router = useRouter();
  const which = role === "architect" ? "pro" : "build";
  const [cycle, setCycle] = useState<Cycle>("month");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState(paypalEmail ?? "");
  const [saved, setSaved] = useState(!!paypalEmail);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const onPlan = (plan === "pro" || plan === "build") && planUntil && new Date(planUntil).getTime() > now;
  const inTrial = trialUntil && new Date(trialUntil).getTime() > now;

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/paypal/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? "That didn't go through.");
    return j;
  }

  async function savePayee(next: string | null) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/paypal/payee", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: next }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Couldn't save it.");
    ok();
    setSaved(!!next);
    if (!next) setEmail("");
  }

  return (
    <section className="mx-auto mt-12 w-full max-w-2xl rounded-2xl border border-line bg-paper-raised p-5">
      <p className="text-xs uppercase tracking-widest text-ink-soft">Plan and payments</p>
      <p className="mt-1 font-serif text-2xl">
        {onPlan ? PLAN_NAME[plan as "pro" | "build"] : inTrial ? `${PLAN_NAME[which]} trial` : "No plan yet"}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {onPlan && subscribed && planUntil && `Renews through PayPal; paid up to ${day(planUntil)}.`}
        {onPlan && !subscribed && planUntil && `Cancelled. Everything stays open until ${day(planUntil)}.`}
        {!onPlan && inTrial && trialUntil && `Free until ${day(trialUntil)}. Pick a plan now and the first charge waits for the trial to end.`}
        {!onPlan && !inTrial && "Your client projects are read-only until you pick a plan."}
      </p>

      {!subscribed && (
        <div className="mt-4">
          <div className="inline-flex rounded-full border border-line p-1 text-sm" role="radiogroup" aria-label="Billing cycle">
            {(["month", "year"] as const).map((c) => (
              <button key={c} role="radio" aria-checked={cycle === c} onClick={() => (tick(), setCycle(c))} className={`rounded-full px-4 py-1.5 ${cycle === c ? "bg-accent text-paper" : "text-ink-soft"}`}>
                ${PRICES[which][c].toLocaleString()} a {c}
                {c === "year" && " · two months free"}
              </button>
            ))}
          </div>
          {/* keyed by cycle, so switching draws fresh buttons for that plan */}
          <PayPalButton
            key={cycle}
            kind="plan"
            createSubscription={async (actions) => {
              const s = await post({ action: "start", plan: which, cycle });
              return actions.subscription.create({ plan_id: s.planId, custom_id: s.customId, ...(s.startTime ? { start_time: s.startTime } : {}), application_context: { brand_name: "Arcon", shipping_preference: "NO_SHIPPING" } });
            }}
            onApprove={async (id) => {
              await post({ action: "confirm", subscriptionId: id });
              chime();
              router.refresh();
            }}
            onError={setError}
          />
        </div>
      )}
      {subscribed && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            await post({ action: "cancel" }).then(() => router.refresh(), (e: Error) => setError(e.message));
            setBusy(false);
          }}
          className="mt-4 rounded-full border border-line px-4 py-2 text-sm hover:border-accent hover:text-accent disabled:opacity-60"
        >
          Cancel the plan
        </button>
      )}

      <div className="mt-8 border-t border-line pt-5">
        <p className="font-medium">Get paid with PayPal</p>
        <p className="mt-1 text-sm text-ink-soft">Your clients pay your fees straight into this PayPal account, and each fee settles on the project the moment it does. Arcon never holds the money.</p>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void savePayee(email.trim() || null);
          }}
        >
          <input type="email" value={email} onChange={(e) => (setEmail(e.target.value), setSaved(false))} placeholder="you@studio.com" aria-label="Your PayPal email" className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2 text-sm" />
          <button disabled={busy || saved} className="glow-btn rounded-full px-5 py-2 text-sm disabled:opacity-60">
            {saved ? "Connected ✓" : "Connect"}
          </button>
          {saved && (
            <button type="button" disabled={busy} onClick={() => savePayee(null)} className="text-sm text-ink-soft hover:text-accent">
              Disconnect
            </button>
          )}
        </form>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
