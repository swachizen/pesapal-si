import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { errMsg } from "@/lib/format";
import { getFxRate } from "@/lib/money";
import { currentPeriod, reportUrl } from "@/lib/sign";
import { listTransactions } from "@/lib/transactions";
import type { DashboardPayload } from "@/lib/types";

// Demo dashboard feed. Put Supabase Auth in front of this before real use.
export async function GET() {
  try {
    const [transactions, fx] = await Promise.all([listTransactions(50), getFxRate()]);
    const payload: DashboardPayload = {
      transactions,
      fx,
      totRate: env.totRate,
      reportUrl: reportUrl(currentPeriod()),
      demoEnabled: env.demoEnabled,
      whatsappLive: Boolean(env.twilioSid && env.twilioToken && env.ownerWhatsapp),
    };
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[transactions] failed", e);
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

