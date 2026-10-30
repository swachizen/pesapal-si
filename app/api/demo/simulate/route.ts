import { after, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processPayment } from "@/lib/pipeline";

export const maxDuration = 60;

// Offline demo: runs the exact same pipeline as a PayPal webhook, for $0.15 only.
export async function POST() {
  if (!env.demoEnabled) return NextResponse.json({ error: "Demo mode is off" }, { status: 403 });
  after(async () => {
    try {
      await processPayment({
        captureId: `SIM-${Date.now()}`,
        amount: "0.15",
        currency: "USD",
        source: "demo",
        details: {
          payerName: "Sarah Johnson",
          payerEmail: "sarah@example.com",
          description: "Logo design for Sarah",
        },
      });
    } catch (e) {
      console.error("[demo] pipeline failed", e);
    }
  });
  return NextResponse.json({ queued: true });
}

