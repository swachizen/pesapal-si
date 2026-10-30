import "server-only";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { env } from "@/lib/env";
import { MENU } from "@/lib/messages";

/* ------------------------------ Payment brain ------------------------------ */

const analysisSchema = z.object({
  clientName: z.string().describe("Client first name or business name taken from the note"),
  category: z.enum(["Design", "Development", "Writing", "Marketing", "Consulting", "Other"]),
  serviceTitle: z.string().describe("Short invoice title, at most 6 words"),
  invoiceDescription: z
    .string()
    .describe("One professional sentence describing the service delivered"),
  kraNote: z
    .string()
    .describe(
      "Two-sentence accounting note: income type, foreign-source service income via PayPal, USD to KES basis, invoice reference"
    ),
});

export type PaymentAnalysis = z.infer<typeof analysisSchema>;

export interface AnalyzeInput {
  note: string;
  payerName: string | null;
  usd: number;
  fx: number;
  invoiceNo: string;
}

function fallbackAnalysis(i: AnalyzeInput): PaymentAnalysis {
  const match = i.note.match(/\bfor\s+([A-Za-z][\w&.' -]{0,40})$/i);
  const client = (match?.[1] ?? i.payerName ?? "Client").trim();
  const n = i.note.toLowerCase();
  const category: PaymentAnalysis["category"] = /logo|brand|design|poster|graphic/.test(n)
    ? "Design"
    : /web|app|code|develop/.test(n)
      ? "Development"
      : /write|article|copy|blog/.test(n)
        ? "Writing"
        : /market|seo|ads|social/.test(n)
          ? "Marketing"
          : /consult/.test(n)
            ? "Consulting"
            : "Other";
  const raw = i.note.replace(/\s+for\s+.+$/i, "").trim() || "Professional services";
  const title = raw.charAt(0).toUpperCase() + raw.slice(1);
  return {
    clientName: client,
    category,
    serviceTitle: title,
    invoiceDescription: `${title} delivered to ${client}.`,
    kraNote: `Foreign-source service income received from ${client} via PayPal. Converted at USD 1 = KES ${i.fx.toFixed(2)}; invoice ref ${i.invoiceNo}.`,
  };
}

export async function analyzePayment(i: AnalyzeInput): Promise<PaymentAnalysis & { source: "gemini" | "fallback" }> {
  if (!env.hasGemini) return { ...fallbackAnalysis(i), source: "fallback" };
  try {
    const { object } = await generateObject({
      model: google(env.geminiModel),
      schema: analysisSchema,
      system:
        "You are the bookkeeping agent for a Kenyan freelancer paid in USD through PayPal. Read the payment note and return clean structured data. Keep wording professional, plain and concise. Never invent amounts.",
      prompt: `Payment note: "${i.note}"\nPayer name on PayPal: ${i.payerName ?? "unknown"}\nAmount: USD ${i.usd.toFixed(2)}\nUSD to KES rate: ${i.fx.toFixed(2)}\nInvoice number: ${i.invoiceNo}`,
      abortSignal: AbortSignal.timeout(25_000),
      maxRetries: 0,
    });
    return { ...object, source: "gemini" };
  } catch (e) {
    console.error("[agent] Gemini failed, using fallback:", e instanceof Error ? e.message : "unknown");
    return { ...fallbackAnalysis(i), source: "fallback" };
  }
}

/* ----------------------------- WhatsApp commands ---------------------------- */

export type Intent =
  | "send_invoice"
  | "kra_report"
  | "payout"
  | "status"
  | "chat"
  | "confirm"
  | "cancel";

const intentSchema = z.object({
  intent: z.enum(["send_invoice", "kra_report", "payout", "status", "chat"]),
  reply: z
    .string()
    .describe(
      "If intent is chat: a friendly answer in at most two sentences. Otherwise an empty string."
    ),
});

/** Fast, deterministic routing for the common short replies. */
export function keywordIntent(text: string): Intent | null {
  const t = text.trim().toLowerCase();
  if (/^(yes|y|confirm|approve|approved|ok|okay|go ahead)\b/.test(t)) return "confirm";
  if (/^(no|n|cancel|stop)\b/.test(t)) return "cancel";
  if (/^1\b|invoice|client/.test(t)) return "send_invoice";
  if (/^2\b|kra|tax|report/.test(t)) return "kra_report";
  if (/^3\b|payout|pay out|mpesa|m-pesa|withdraw|cash/.test(t)) return "payout";
  if (/status|balance|summary/.test(t)) return "status";
  return null;
}

export async function classifyIntent(text: string): Promise<{ intent: Intent; reply: string }> {
  const quick = keywordIntent(text);
  if (quick) return { intent: quick, reply: "" };
  if (!env.hasGemini) {
    return { intent: "chat", reply: `I did not catch that, Boss.\n\n${MENU}` };
  }
  try {
    const { object } = await generateObject({
      model: google(env.geminiModel),
      schema: intentSchema,
      system:
        "You route WhatsApp messages from a freelancer to one action: send_invoice (email the invoice to the client), kra_report (tax report), payout (withdraw to M-Pesa), status (balance or summary), or chat (anything else).",
      prompt: `Message: "${text}"`,
      abortSignal: AbortSignal.timeout(8_000),
    });
    const reply = object.reply.trim();
    return {
      intent: object.intent,
      reply: object.intent === "chat" ? `${reply || "Happy to help, Boss."}\n\n${MENU}` : "",
    };
  } catch (e) {
    console.error("[agent] intent classification failed", e);
    return { intent: "chat", reply: `I did not catch that, Boss.\n\n${MENU}` };
  }
}

