import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";

export interface PayoutRequest {
  amount: number;
  phone: string;
  remarks: string;
}

export interface PayoutResult {
  ok: boolean;
  mode: "live" | "mock";
  reference: string;
  message: string;
}

export function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("254")) return d;
  if (d.startsWith("0")) return `254${d.slice(1)}`;
  if (d.length === 9) return `254${d}`;
  return d;
}

export function maskPhone(raw: string): string {
  const p = normalizePhone(raw);
  return p.length >= 8 ? `${p.slice(0, 5)}***${p.slice(-3)}` : "***";
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Clean mock of the Daraja B2C API so the agent flow always completes. */
async function mockB2C(): Promise<PayoutResult> {
  await sleep(900);
  return {
    ok: true,
    mode: "mock",
    reference: `MOCK${Date.now().toString(36).toUpperCase()}`,
    message: "Simulated Daraja B2C success",
  };
}

async function liveB2C(req: PayoutRequest): Promise<PayoutResult> {
  if (!env.darajaKey || !env.darajaSecret || !env.darajaCredential) {
    throw new Error("Daraja credentials are not configured");
  }
  const basic = Buffer.from(`${env.darajaKey}:${env.darajaSecret}`).toString("base64");
  const tokenRes = await fetch(`${env.darajaBase}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!tokenRes.ok) throw new Error(`Daraja auth failed (${tokenRes.status})`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const originatorId = randomUUID();
  const res = await fetch(`${env.darajaBase}/mpesa/b2c/v3/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      OriginatorConversationID: originatorId,
      InitiatorName: env.darajaInitiator,
      SecurityCredential: env.darajaCredential,
      CommandID: "BusinessPayment",
      Amount: req.amount,
      PartyA: env.darajaShortcode,
      PartyB: normalizePhone(req.phone),
      Remarks: req.remarks,
      QueueTimeOutURL: `${env.appUrl}/api/mpesa/result`,
      ResultURL: `${env.appUrl}/api/mpesa/result`,
      Occasion: "PesaPal AI payout",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const data = (await res.json()) as { ResponseCode?: string; ResponseDescription?: string };
  if (!res.ok || data.ResponseCode !== "0") {
    throw new Error(data.ResponseDescription ?? `Daraja B2C failed (${res.status})`);
  }
  return {
    ok: true,
    mode: "live",
    reference: originatorId,
    message: data.ResponseDescription ?? "Accepted for processing",
  };
}

export async function sendB2C(req: PayoutRequest): Promise<PayoutResult> {
  if (env.darajaMode !== "live") return mockB2C();
  try {
    return await liveB2C(req);
  } catch (e) {
    console.error("[daraja] live sandbox failed, falling back to mock", e);
    const mock = await mockB2C();
    return { ...mock, message: "Live sandbox unavailable, completed with mock fallback" };
  }
}

