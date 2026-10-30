import { after } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { handleCommand } from "@/lib/commands";
import { env } from "@/lib/env";
import { sendWhatsApp } from "@/lib/whatsapp/cloud";

export const maxDuration = 60;

interface WaMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  interactive?: { button_reply?: { id?: string }; list_reply?: { id?: string } };
}

interface WaPayload {
  entry?: Array<{ changes?: Array<{ value?: { messages?: WaMessage[] } }> }>;
}

const seen = new Set<string>();

function validSignature(raw: string, header: string | null): boolean {
  if (!env.whatsappAppSecret) return true;
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", env.whatsappAppSecret).update(raw).digest("hex"));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Meta calls this once when you save the webhook in the developer dashboard.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (
    p.get("hub.mode") === "subscribe" &&
    env.whatsappVerifyToken.length > 0 &&
    p.get("hub.verify_token") === env.whatsappVerifyToken
  ) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Forbidden", { status: 403 });
  }

  let payload: WaPayload;
  try {
    payload = JSON.parse(raw) as WaPayload;
  } catch {
    return new Response("ok", { status: 200 });
  }

  const commands: string[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        if (m.id) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          if (seen.size > 500) seen.clear();
        }
        const from = (m.from ?? "").replace(/\D/g, "");
        if (env.ownerWhatsapp && from !== env.ownerWhatsapp) continue;
        const text =
          m.type === "text"
            ? m.text?.body
            : m.type === "interactive"
              ? (m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id)
              : undefined;
        if (text && text.trim().length > 0) commands.push(text.trim());
      }
    }
  }

  if (commands.length > 0) {
    after(async () => {
      for (const command of commands) {
        try {
          await handleCommand(command);
        } catch (e) {
          console.error("[whatsapp] command failed", e);
          await sendWhatsApp("Something went wrong, Boss. Please try again in a moment.");
        }
      }
    });
  }
  // Always acknowledge fast so Meta does not retry.
  return new Response("ok", { status: 200 });
}

