import { accessTo, userOf } from "@/lib/auth/request";
import { captureOrder, getOrder, PayPalError } from "@/lib/paypal/client";
import { paymentForOrder, settleOrder, stillOwed } from "@/lib/paypal/settle";

// The buyer approved the payment in PayPal: capture it, and open what it paid for. Only the person who started the
// order may capture it, and only an order Arcon wrote down. A capture that already happened (a retry, or the webhook
// got there first) is read back instead of failing.
export async function POST(request: Request, ctx: RouteContext<"/api/paypal/orders/[orderId]/capture">) {
  const { orderId } = await ctx.params;
  const cookie = request.headers.get("cookie");
  const me = await userOf(cookie);
  if (!/^[A-Z0-9]{10,30}$/.test(orderId)) return Response.json({ error: "not found" }, { status: 404 });
  const row = await paymentForOrder(orderId);
  // the one who started it: the signed-in payer, or for a guest's unlock, whoever owns that project in this browser
  const mine = row && (row.payer_id ? row.payer_id === me : row.kind === "unlock" && !!row.project_id && (await accessTo(row.project_id, cookie, "edit"))?.role === "owner");
  if (!row || !mine) return Response.json({ error: "not found" }, { status: 404 });

  // paid already another way (another tab, the manual route, or it was unlocked meanwhile): don't take the money twice
  if (row.status === "created" && !(await stillOwed(row))) return Response.json({ error: "This is already paid, so nothing was charged." }, { status: 409 });

  let order;
  try {
    order = await captureOrder(orderId);
  } catch (e) {
    if (e instanceof PayPalError && e.issue === "ORDER_ALREADY_CAPTURED") order = await getOrder(orderId);
    else if (e instanceof PayPalError && e.issue === "INSTRUMENT_DECLINED") return Response.json({ error: "PayPal declined that way to pay. Pick another one.", retry: true }, { status: 402 });
    else return Response.json({ error: "PayPal couldn't take the payment. Nothing was charged." }, { status: 502 });
  }
  const s = await settleOrder(order);
  if (!s.ok) return Response.json({ error: s.reason === "not-paid" ? "The payment hasn't gone through yet." : "That payment didn't match. Nothing was opened." }, { status: 409 });
  return Response.json({ ok: true, kind: s.kind });
}
