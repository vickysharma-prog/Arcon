// One-time PayPal setup for an app (sandbox or live): the product, Arcon's four plans, and the webhook.
// Run: node --env-file=.env scripts/paypal-setup.ts [https://your-site/api/billing/paypal]
// Prints the env lines to add (.env and Vercel). Running it again makes new plans, so run it once per app.
import { raw } from "../lib/paypal/client.ts";
import { PLAN_NAME, PRICES, type Cycle, type Plan } from "../lib/paypal/plans.ts";

const product = await raw<{ id: string }>("POST", "/v1/catalogs/products", { name: "Arcon pro plans", type: "SERVICE", category: "SOFTWARE", description: "Studio for architects and designers, Build for builders" });
console.log(`# product ${product.id}`);

for (const plan of ["pro", "build"] as Plan[]) {
  for (const cycle of ["month", "year"] as Cycle[]) {
    const p = await raw<{ id: string }>("POST", "/v1/billing/plans", {
      product_id: product.id,
      name: `Arcon ${PLAN_NAME[plan]}, by the ${cycle}`,
      billing_cycles: [{ frequency: { interval_unit: cycle.toUpperCase(), interval_count: 1 }, tenure_type: "REGULAR", sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: PRICES[plan][cycle].toFixed(2), currency_code: "USD" } } }],
      payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 2 },
    });
    console.log(`PAYPAL_PLAN_${plan.toUpperCase()}_${cycle.toUpperCase()}=${p.id}`);
  }
}

const url = process.argv[2];
if (url) {
  const types = ["PAYMENT.CAPTURE.COMPLETED", "PAYMENT.SALE.COMPLETED", "BILLING.SUBSCRIPTION.ACTIVATED", "BILLING.SUBSCRIPTION.UPDATED", "BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.SUSPENDED", "BILLING.SUBSCRIPTION.EXPIRED", "BILLING.SUBSCRIPTION.RE-ACTIVATED"];
  const w = await raw<{ id: string }>("POST", "/v1/notifications/webhooks", { url, event_types: types.map((name) => ({ name })) });
  console.log(`PAYPAL_WEBHOOK_ID=${w.id}`);
}
