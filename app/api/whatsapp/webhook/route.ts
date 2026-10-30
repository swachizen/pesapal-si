import { after } from "next/server";
import { handleCommand } from "@/lib/commands";
import { env } from "@/lib/env";
import { sendWhatsApp, toWhatsAppAddress, validateTwilioRequest } from "@/lib/twilio/whatsapp";

export const maxDuration = 60;

const emptyTwiml = () =>
  new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });

export async function POST(req: Request) {
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;

  if (env.twilioToken && !env.skipTwilioSignature) {
    const signature = req.headers.get("x-twilio-signature") ?? "";
    const valid = validateTwilioRequest(signature, `${env.appUrl}/api/whatsapp/webhook`, params);
    if (!valid) return new Response("Forbidden", { status: 403 });
  }

  const from = params.From ?? "";
  const body = (params.Body ?? "").trim();
  if (env.ownerWhatsapp && toWhatsAppAddress(from) !== toWhatsAppAddress(env.ownerWhatsapp)) {
    return emptyTwiml();
  }

  if (body.length > 0) {
    after(async () => {
      try {
        await handleCommand(body);
      } catch (e) {
        console.error("[whatsapp] command failed", e);
        await sendWhatsApp("Something went wrong, Boss. Please try again in a moment.");
      }
    });
  }
  return emptyTwiml();
}

