"use client";

import { useEffect, useRef, useState } from "react";

// PayPal's own buttons (PayPal, Pay Later, card), loaded from PayPal's JS SDK. One script per kind of payment and
// currency, each under its own namespace, so a page can show an order and a plan side by side.
// The browser never decides an amount: createOrder asks Arcon's server, which makes the order from its own records.

type Buttons = { render: (el: HTMLElement) => Promise<void>; close?: () => void; isEligible?: () => boolean };
type Sdk = { Buttons: (o: Record<string, unknown>) => Buttons };

const loading = new Map<string, Promise<Sdk>>();

function sdk(kind: "order" | "plan", currency: string): Promise<Sdk> {
  const id = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  if (!id) return Promise.reject(new Error("no PayPal client id"));
  const ns = `paypal_${kind}_${currency}`;
  const known = loading.get(ns);
  if (known) return known;
  const q = new URLSearchParams(kind === "plan" ? { "client-id": id, vault: "true", intent: "subscription", components: "buttons" } : { "client-id": id, currency, intent: "capture", components: "buttons" });
  const p = new Promise<Sdk>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?${q}`;
    s.dataset.namespace = ns;
    s.onload = () => resolve((window as unknown as Record<string, Sdk>)[ns]);
    s.onerror = () => {
      loading.delete(ns);
      reject(new Error("PayPal didn't load"));
    };
    document.head.appendChild(s);
  });
  loading.set(ns, p);
  return p;
}

type Props =
  | { kind: "order"; currency: string; createOrder: () => Promise<string>; onApprove: (orderId: string) => Promise<void>; onError: (m: string) => void }
  | { kind: "plan"; createSubscription: (actions: { subscription: { create: (o: Record<string, unknown>) => Promise<string> } }) => Promise<string>; onApprove: (subscriptionId: string) => Promise<void>; onError: (m: string) => void };

export function PayPalButton(props: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  // the latest handlers, so the buttons are drawn once and still call fresh code
  const live = useRef(props);
  useEffect(() => {
    live.current = props;
  });
  const currency = props.kind === "order" ? props.currency : "USD";

  useEffect(() => {
    let buttons: Buttons | null = null;
    let gone = false;
    sdk(props.kind, currency)
      .then((paypal) => {
        if (gone || !box.current) return;
        const style = { layout: "vertical", shape: "pill", label: props.kind === "plan" ? "subscribe" : "pay", height: 44 };
        // our own server's words win over PayPal's generic error that follows them
        let said = false;
        const say = (e: unknown) => {
          said = true;
          live.current.onError(e instanceof Error ? e.message : String(e));
          throw e;
        };
        const onError = () => (said ? (said = false) : live.current.onError("PayPal couldn't finish that. Nothing was charged; try again."));
        buttons =
          props.kind === "plan"
            ? paypal.Buttons({
                style,
                createSubscription: (_: unknown, actions: Parameters<Extract<Props, { kind: "plan" }>["createSubscription"]>[0]) => (live.current as Extract<Props, { kind: "plan" }>).createSubscription(actions).catch(say),
                onApprove: (d: { subscriptionID: string }) => live.current.onApprove(d.subscriptionID).catch((e) => live.current.onError(e instanceof Error ? e.message : String(e))),
                onError,
              })
            : paypal.Buttons({
                style,
                createOrder: () => (live.current as Extract<Props, { kind: "order" }>).createOrder().catch(say),
                onApprove: (d: { orderID: string }) => live.current.onApprove(d.orderID).catch((e) => live.current.onError(e instanceof Error ? e.message : String(e))),
                onError,
              });
        return buttons.render(box.current).then(() => !gone && setState("ready"));
      })
      .catch(() => !gone && setState("failed"));
    return () => {
      gone = true;
      buttons?.close?.();
    };
  }, [props.kind, currency]);

  return (
    <div className="mt-4 max-w-sm">
      {state === "loading" && <p className="text-sm text-ink-soft">Loading PayPal…</p>}
      {state === "failed" && <p className="text-sm text-red-600">PayPal didn&apos;t load. Check your connection and refresh.</p>}
      <div ref={box} />
      {/* the sandbox's own test card, so anyone can try a payment (no real money; set NEXT_PUBLIC_PAYPAL_LIVE=1 to hide) */}
      {state === "ready" && process.env.NEXT_PUBLIC_PAYPAL_LIVE !== "1" && (
        <p className="mt-2 rounded-lg bg-accent/5 px-3 py-2 text-xs leading-relaxed text-ink-soft">
          PayPal sandbox, no real money. Choose <span className="text-ink">Debit or Credit Card</span>: <span className="font-mono text-ink">4111 1111 1111 1111</span>, any future date, any 3-digit code, ZIP <span className="font-mono text-ink">94105</span>, phone <span className="font-mono text-ink">415 555 0100</span>.
        </p>
      )}
    </div>
  );
}

/** Ask Arcon's server for an order; throws with the server's own words when it says no. */
export async function startOrder(body: Record<string, unknown>): Promise<string> {
  const res = await fetch("/api/paypal/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401 && j.signIn) {
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }
  if (!res.ok) throw new Error(j.error ?? "Couldn't start the payment.");
  return j.id as string;
}

/** Capture an approved order on Arcon's server, which opens what it paid for. */
export async function finishOrder(orderId: string): Promise<void> {
  const res = await fetch(`/api/paypal/orders/${orderId}/capture`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "The payment didn't go through.");
}
