import { getOrder, getSubscription, verifyWebhook } from "@/lib/paypal/client";
import { settleOrder } from "@/lib/paypal/settle";
import { applySubscription } from "@/lib/paypal/subscribe";

type Event = { id: string; event_type: string; resource?: { id?: string; billing_agreement_id?: string; supplementary_data?: { related_ids?: { order_id?: string } } } };

// PayPal's webhook. Nothing in an event is trusted as it arrives: PayPal confirms the signature, then Arcon reads the
// order or subscription back from PayPal itself and settles from that. Settling twice changes nothing, so PayPal's
// retries and the capture route racing it are both safe.
export async function POST(request: Request) {
  const event = (await request.json().catch(() => null)) as Event | null;
  if (!event?.event_type) return new Response(null, { status: 400 });
  if (!(await verifyWebhook(request.headers, event).catch(() => false))) return new Response(null, { status: 401 });

  const r = event.resource ?? {};
  try {
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId = r.supplementary_data?.related_ids?.order_id;
      if (orderId) await settleOrder(await getOrder(orderId));
    } else if (event.event_type.startsWith("BILLING.SUBSCRIPTION.") && r.id) {
      await applySubscription(await getSubscription(r.id));
    } else if (event.event_type === "PAYMENT.SALE.COMPLETED" && r.billing_agreement_id) {
      // a renewal: the next charge moved on, so the plan runs further
      await applySubscription(await getSubscription(r.billing_agreement_id));
    }
  } catch {
    return new Response(null, { status: 500 }); // PayPal retries later
  }
  return new Response(null, { status: 200 });
}
