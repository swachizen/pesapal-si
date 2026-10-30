import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";

let tokenCache: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const basic = Buffer.from(`${env.paypalClientId}:${env.paypalClientSecret}`).toString("base64");
  const res = await fetch(`${env.paypalBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function paypal<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${env.paypalBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(method === "POST" ? { "PayPal-Request-Id": randomUUID() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal ${method} ${path} failed (${res.status}) ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface CreatedOrder {
  id: string;
  approveUrl: string;
}

export async function createOrder(amount: string, description: string): Promise<CreatedOrder> {
  const data = await paypal<{ id: string; links?: Array<{ href: string; rel: string }> }>(
    "/v2/checkout/orders",
    "POST",
    {
      intent: "CAPTURE",
      purchase_units: [
        { amount: { currency_code: "USD", value: amount }, description },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "PesaPal AI",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: `${env.appUrl}/api/paypal/capture`,
            cancel_url: `${env.appUrl}/?paid=cancelled`,
          },
        },
      },
    }
  );
  const link = data.links?.find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!link) throw new Error("PayPal did not return an approval link");
  return { id: data.id, approveUrl: link.href };
}

export interface CaptureInfo {
  id: string;
  status: string;
  amount: { value: string; currency_code: string };
}

export async function captureOrder(orderId: string): Promise<CaptureInfo> {
  const data = await paypal<{
    purchase_units?: Array<{ payments?: { captures?: CaptureInfo[] } }>;
  }>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, "POST", {});
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) throw new Error("PayPal capture response had no capture");
  return capture;
}

export interface OrderDetails {
  payerName: string | null;
  payerEmail: string | null;
  description: string;
}

export async function getOrderDetails(orderId: string): Promise<OrderDetails> {
  const data = await paypal<{
    payer?: { name?: { given_name?: string; surname?: string }; email_address?: string };
    purchase_units?: Array<{ description?: string }>;
  }>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, "GET");
  const given = data.payer?.name?.given_name ?? "";
  const sur = data.payer?.name?.surname ?? "";
  const name = `${given} ${sur}`.trim();
  return {
    payerName: name.length > 0 ? name : null,
    payerEmail: data.payer?.email_address ?? null,
    description: data.purchase_units?.[0]?.description ?? "Payment received",
  };
}

export async function verifyWebhookSignature(headers: Headers, rawBody: string): Promise<boolean> {
  if (!env.paypalWebhookId) return false;
  const data = await paypal<{ verification_status?: string }>(
    "/v1/notifications/verify-webhook-signature",
    "POST",
    {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: env.paypalWebhookId,
      webhook_event: JSON.parse(rawBody) as unknown,
    }
  );
  return data.verification_status === "SUCCESS";
}

