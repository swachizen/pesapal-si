import "server-only";
import { env } from "@/lib/env";
import { errMsg } from "@/lib/format";

export interface SendResult {
  ok: boolean;
  simulated: boolean;
}

export interface WaButton {
  id: string;
  title: string;
}

const HINTS: Record<number, string> = {
  131047: "The 24-hour window is closed. Send any message (for example hi) from your phone to the business number, then retry.",
  131030: "The recipient is not on the allowed list. Add and verify your number on the API Setup page in Meta.",
  190: "The access token is invalid or expired. Temporary tokens last 24 hours.",
};

async function post(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );
    if (res.ok) return true;
    const data = (await res.json().catch(() => null)) as {
      error?: { message?: string; code?: number };
    } | null;
    const code = data?.error?.code;
    console.error(
      "[whatsapp] send failed:",
      data?.error?.message ?? `HTTP ${res.status}`,
      code && HINTS[code] ? `| ${HINTS[code]}` : ""
    );
    return false;
  } catch (e) {
    console.error("[whatsapp] send error:", errMsg(e));
    return false;
  }
}

/**
 * Sends a WhatsApp Cloud API message to the owner. Never throws.
 * - buttons: interactive message with up to 3 tap-to-reply buttons (PDF shown as header if given)
 * - mediaUrl only: PDF document with the text as caption
 * - neither: plain text
 */
export async function sendWhatsApp(
  body: string,
  mediaUrl?: string,
  buttons?: WaButton[]
): Promise<SendResult> {
  if (!env.whatsappConfigured) {
    console.log("[whatsapp:simulated]", body, mediaUrl ?? "");
    return { ok: true, simulated: true };
  }

  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: env.ownerWhatsapp,
  };
  const publicMedia = mediaUrl && mediaUrl.startsWith("https://") ? mediaUrl : undefined;
  const filename = mediaUrl?.includes("/api/kra-report") ? "KRA-report.pdf" : "Invoice.pdf";
  const hasButtons = Boolean(buttons && buttons.length > 0);

  let ok: boolean;
  if (hasButtons && buttons) {
    ok = await post({
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        ...(publicMedia ? { header: { type: "document", document: { link: publicMedia, filename } } } : {}),
        body: { text: body.slice(0, 1024) },
        action: {
          buttons: buttons.slice(0, 3).map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    });
  } else if (publicMedia) {
    ok = await post({
      ...base,
      type: "document",
      document: { link: publicMedia, filename, caption: body.slice(0, 1024) },
    });
  } else {
    ok = await post({ ...base, type: "text", text: { preview_url: false, body } });
  }
  if (ok) return { ok: true, simulated: false };

  // Plain text sent first and failed: retrying cannot help.
  if (!hasButtons && !publicMedia) return { ok: false, simulated: false };

  const parts = [body];
  if (buttons && buttons.length > 0) {
    parts.push(`Reply: ${buttons.map((b) => `${b.id} = ${b.title}`).join(", ")}`);
  }
  if (mediaUrl) parts.push(`PDF: ${mediaUrl}`);
  const retry = await post({ ...base, type: "text", text: { preview_url: true, body: parts.join("\n\n") } });
  return { ok: retry, simulated: false };
}

