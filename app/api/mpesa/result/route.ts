import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface DarajaResult {
  Result?: { ResultCode?: number; OriginatorConversationID?: string };
}

// Daraja posts the final B2C result here (also used as the timeout URL).
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DarajaResult;
    const ref = body.Result?.OriginatorConversationID;
    if (ref && body.Result?.ResultCode !== 0) {
      await getSupabaseAdminClient()
        .from("transactions")
        .update({ status: "payout_pending", awaiting_confirm: false })
        .eq("mpesa_ref", ref);
    }
  } catch (e) {
    console.error("[mpesa] result callback error", e);
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}

