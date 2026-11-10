// What Arcon asks PayPal for, and how it reads what comes back. Pure, so the routes and the tests agree.
//
// Every order and subscription carries a `custom_id` naming what it pays for, so a capture or a webhook can only ever
// settle the thing it was made for:
//   unlock:<project id>       a project unlocked once
//   fee:<milestone id>        a pro's fee milestone, paid by the client
//   plan:<user id>:<plan>     a pro's Studio or Build plan

export type Purpose = { kind: "unlock"; projectId: string } | { kind: "fee"; milestoneId: number } | { kind: "plan"; userId: string; plan: "pro" | "build" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function purposeId(p: Purpose): string {
  if (p.kind === "unlock") return `unlock:${p.projectId}`;
  if (p.kind === "fee") return `fee:${p.milestoneId}`;
  return `plan:${p.userId}:${p.plan}`;
}

/** The purpose named by a `custom_id`, or null for anything Arcon didn't write. */
export function readPurpose(id: string | null | undefined): Purpose | null {
  const [kind, a, b, ...rest] = (id ?? "").split(":");
  if (rest.length) return null;
  if (kind === "unlock" && UUID.test(a ?? "") && b === undefined) return { kind, projectId: a };
  if (kind === "fee" && /^\d{1,15}$/.test(a ?? "") && b === undefined) return { kind, milestoneId: Number(a) };
  if (kind === "plan" && UUID.test(a ?? "") && (b === "pro" || b === "build")) return { kind, userId: a, plan: b };
  return null;
}

// The currencies PayPal Checkout takes (INR only inside India, so a fee in INR is settled outside PayPal).
const PAYPAL_CURRENCIES = new Set(["AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF", "ILS", "JPY", "MXN", "MYR", "NOK", "NZD", "PHP", "PLN", "SEK", "SGD", "THB", "TWD", "USD"]);
export const paypalTakes = (currency: string) => PAYPAL_CURRENCIES.has(currency);

// Currencies PayPal takes without decimals.
const WHOLE = new Set(["HUF", "JPY", "TWD"]);

/** An amount the way PayPal wants it: a string with two decimals (none for JPY, HUF, TWD). */
export function paypalValue(amount: number, currency: string): string {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount must be above zero");
  return WHOLE.has(currency) ? String(Math.round(amount)) : (Math.round(amount * 100) / 100).toFixed(2);
}

/** Whether what PayPal captured is exactly what was asked for (the same currency, the same value). */
export const sameAmount = (got: { currency_code?: string; value?: string } | undefined, amount: number, currency: string) =>
  !!got && got.currency_code === currency && got.value === paypalValue(amount, currency);

export type OrderInput = { purpose: Purpose; amount: number; currency: string; description: string; payeeEmail?: string | null };

/** The body of a v2 Orders call: one purchase unit, paid to the pro's PayPal when there is one. */
export function orderBody(o: OrderInput) {
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: purposeId(o.purpose),
        custom_id: purposeId(o.purpose),
        description: o.description.slice(0, 127),
        amount: { currency_code: o.currency, value: paypalValue(o.amount, o.currency) },
        ...(o.payeeEmail ? { payee: { email_address: o.payeeEmail } } : {}),
      },
    ],
    payment_source: { paypal: { experience_context: { brand_name: "Arcon", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } } },
  };
}

type Capture = { id: string; status: string; amount?: { currency_code: string; value: string }; custom_id?: string };
type Unit = { custom_id?: string; payments?: { captures?: Capture[] } };
export type CapturedOrder = { id: string; status: string; purchase_units?: Unit[] };

/** The completed capture in a captured order, with the purpose it was for, or null when nothing was paid. */
export function completedCapture(order: CapturedOrder): (Capture & { purpose: Purpose }) | null {
  const unit = order.purchase_units?.[0];
  const cap = unit?.payments?.captures?.find((c) => c.status === "COMPLETED");
  const purpose = readPurpose(cap?.custom_id ?? unit?.custom_id);
  return cap && purpose ? { ...cap, purpose } : null;
}
