import { after, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { captureOrder } from "@/lib/paypal/client";
import { processPayment } from "@/lib/pipeline";

export const maxDuration = 60;

// PayPal redirects the buyer here after approval: /api/paypal/capture?token=ORDER_ID
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.redirect(`${env.appUrl}/?paid=error`);
  try {
    const capture = await captureOrder(token);
    if (capture.status === "COMPLETED") {
      after(async () => {
        try {
          await processPayment({
            captureId: capture.id,
            orderId: token,
            amount: capture.amount.value,
            currency: capture.amount.currency_code,
            source: "capture",
          });
        } catch (e) {
          console.error("[capture] pipeline failed", e);
        }
      });
    }
    return NextResponse.redirect(`${env.appUrl}/?paid=1`);
  } catch (e) {
    console.error("[paypal] capture failed", e);
    return NextResponse.redirect(`${env.appUrl}/?paid=error`);
  }
}

