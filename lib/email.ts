import "server-only";
import { env } from "@/lib/env";
import { errMsg } from "@/lib/format";

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  attachment?: { filename: string; content: Buffer };
}

export interface EmailResult {
  ok: boolean;
  simulated: boolean;
  error?: string;
}

/** Sends through Resend when RESEND_API_KEY is set, otherwise simulates. Never throws. */
export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  if (!env.resendKey) {
    console.log("[email:simulated]", input.to, input.subject);
    return { ok: true, simulated: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        attachments: input.attachment
          ? [
              {
                filename: input.attachment.filename,
                content: input.attachment.content.toString("base64"),
              },
            ]
          : undefined,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}`);
    return { ok: true, simulated: false };
  } catch (e) {
    console.error("[email] send failed:", errMsg(e));
    return { ok: false, simulated: false, error: errMsg(e) };
  }
}

