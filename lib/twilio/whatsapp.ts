import "server-only";
import twilio from "twilio";
import { env } from "@/lib/env";
import { errMsg } from "@/lib/format";

export function toWhatsAppAddress(value: string): string {
  const v = value.trim();
  return v.startsWith("whatsapp:") ? v : `whatsapp:${v}`;
}

export interface SendResult {
  ok: boolean;
  simulated: boolean;
}

/** Sends a WhatsApp message (optionally with a PDF) to the owner. Never throws. */
export async function sendWhatsApp(body: string, mediaUrl?: string): Promise<SendResult> {
  const to = env.ownerWhatsapp;
  if (!env.twilioSid || !env.twilioToken || !to) {
    console.log("[whatsapp:simulated]", body, mediaUrl ?? "");
    return { ok: true, simulated: true };
  }
  const client = twilio(env.twilioSid, env.twilioToken);
  const base = { from: toWhatsAppAddress(env.twilioFrom), to: toWhatsAppAddress(to) };

  if (mediaUrl && mediaUrl.startsWith("https://")) {
    try {
      await client.messages.create({ ...base, body, mediaUrl: [mediaUrl] });
      return { ok: true, simulated: false };
    } catch (e) {
      console.error("[whatsapp] media send failed, retrying with link:", errMsg(e));
    }
  }

  try {
    const text = mediaUrl ? `${body}\n\nInvoice PDF: ${mediaUrl}` : body;
    await client.messages.create({ ...base, body: text });
    return { ok: true, simulated: false };
  } catch (e) {
    console.error("[whatsapp] send failed:", errMsg(e));
    return { ok: false, simulated: false };
  }
}

export function validateTwilioRequest(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(env.twilioToken, signature, url, params);
}

