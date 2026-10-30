import { after, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyWebhookSignature } from "@/lib/paypal/client";
import { processPayment } from "@/lib/pipeline";

interface PayPalEvent {
  event_type?: string;
  resource?: {
    id?: string;
    amount?: { value?: string; currency_code?: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
}

export async function POST(req: Request) {
  const raw = await req.text();

  let verified = env.paypalSkipVerify;
  if (!verified) {
    try {
      verified = await verifyWebhookSignature(req.headers, raw);
    } catch (e) {
      console.error("[paypal] webhook verification error", e);
    }
  }
  if (!verified) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  let event: PayPalEvent;
  try {
    event = JSON.parse(raw) as PayPalEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const r = event.resource;
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED" && r?.id && r.amount?.value) {
    const captureId = r.id;
    const amount = r.amount.value;
    const currency = r.amount.currency_code ?? "USD";
    const orderId = r.supplementary_data?.related_ids?.order_id;
    after(async () => {
      try {
        await processPayment({ captureId, orderId, amount, currency, source: "webhook" });
      } catch (e) {
        console.error("[webhook] pipeline failed", e);
      }
    });
  }
  // Always acknowledge fast so PayPal does not retry.
  return NextResponse.json({ received: true });
}

