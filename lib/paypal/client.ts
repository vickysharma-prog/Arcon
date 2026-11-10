import { orderBody, type CapturedOrder, type OrderInput } from "./order.ts";

// PayPal's REST API, server side only: a token, orders, subscriptions and webhook checks. Plain fetch, no SDK.
// PAYPAL_ENV picks the API: "live" for real money, anything else is the sandbox.

const BASE = () => (process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

export const paypalReady = () => !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

let cached: { token: string; until: number } | null = null;

async function token(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PayPal keys are not set");
  const res = await fetch(`${BASE()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal token: ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  // a minute's margin so a token never runs out mid-call
  cached = { token: j.access_token, until: Date.now() + (j.expires_in - 60) * 1000 };
  return j.access_token;
}

export class PayPalError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`PayPal ${status}`);
    this.status = status;
    this.body = body;
  }
  /** PayPal's own error name, e.g. INSTRUMENT_DECLINED or ORDER_ALREADY_CAPTURED. */
  get issue(): string | null {
    const b = this.body as { details?: { issue?: string }[]; name?: string } | null;
    return b?.details?.[0]?.issue ?? b?.name ?? null;
  }
}

async function call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      // PayPal-Request-Id makes a retried call return the first result instead of doing it twice
      ...(idempotencyKey ? { "PayPal-Request-Id": idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new PayPalError(res.status, json);
  return json as T;
}

export const createOrder = (o: OrderInput, requestId?: string) => call<{ id: string; status: string }>("POST", "/v2/checkout/orders", orderBody(o), requestId);
export const getOrder = (id: string) => call<CapturedOrder>("GET", `/v2/checkout/orders/${encodeURIComponent(id)}`);
export const captureOrder = (id: string) => call<CapturedOrder>("POST", `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {}, `capture-${id}`);

export type Subscription = { id: string; status: string; plan_id: string; custom_id?: string; billing_info?: { next_billing_time?: string; last_payment?: { time?: string } }; start_time?: string };
export const getSubscription = (id: string) => call<Subscription>("GET", `/v1/billing/subscriptions/${encodeURIComponent(id)}`);
export const cancelSubscription = (id: string, reason: string) => call<null>("POST", `/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, { reason });

/** Whether a webhook really came from PayPal, checked by PayPal itself against the webhook's id. */
export async function verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const h = (k: string) => headers.get(k) ?? "";
  const r = await call<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: h("paypal-auth-algo"),
    cert_url: h("paypal-cert-url"),
    transmission_id: h("paypal-transmission-id"),
    transmission_sig: h("paypal-transmission-sig"),
    transmission_time: h("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: event,
  });
  return r.verification_status === "SUCCESS";
}

/** Used once by scripts/paypal-setup.ts to make the product, plans and webhook. */
export const raw = call;
