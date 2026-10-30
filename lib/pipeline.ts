import "server-only";
import { randomUUID } from "node:crypto";
import { analyzePayment } from "@/lib/ai/agent";
import { env } from "@/lib/env";
import { fmtKes } from "@/lib/format";
import { paidBody } from "@/lib/messages";
import { computePayout, getFxRate } from "@/lib/money";
import { getOrderDetails, type OrderDetails } from "@/lib/paypal/client";
import { appendEvent, paypalIdExists } from "@/lib/transactions";
import { sendWhatsApp } from "@/lib/whatsapp/cloud";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Transaction, TxEvent } from "@/lib/types";

export interface PaymentInput {
  captureId: string;
  orderId?: string;
  amount: string;
  currency: string;
  source: "webhook" | "capture" | "demo";
  details?: OrderDetails;
}

export interface PipelineResult {
  status: "created" | "duplicate" | "skipped";
  id?: string;
}

const SOURCE_LABEL: Record<PaymentInput["source"], string> = {
  webhook: "PayPal webhook received: PAYMENT.CAPTURE.COMPLETED",
  capture: "PayPal payment captured",
  demo: "Demo payment simulated",
};

function makeInvoiceNo(id: string): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `INV-${day}-${id.slice(0, 6).toUpperCase()}`;
}

/** PayPal payment in, categorised + converted + invoiced + WhatsApp out. Idempotent per capture. */
export async function processPayment(input: PaymentInput): Promise<PipelineResult> {
  if (input.currency !== "USD") {
    console.log(`[pipeline] skipped non-USD payment ${input.captureId}`);
    return { status: "skipped" };
  }
  const usd = Number(input.amount);
  if (!Number.isFinite(usd) || usd <= 0) return { status: "skipped" };
  if (await paypalIdExists(input.captureId)) return { status: "duplicate" };

  let details: OrderDetails = input.details ?? {
    payerName: null,
    payerEmail: null,
    description: "Payment received",
  };
  if (!input.details && input.orderId) {
    try {
      details = await getOrderDetails(input.orderId);
    } catch (e) {
      console.error("[pipeline] could not fetch order details", e);
    }
  }

  const fx = await getFxRate();
  const calc = computePayout(usd, fx);
  const id = randomUUID();
  const invoiceNo = makeInvoiceNo(id);
  const analysis = await analyzePayment({
    note: details.description,
    payerName: details.payerName,
    usd,
    fx,
    invoiceNo,
  });

  const now = () => new Date().toISOString();
  const events: TxEvent[] = [
    { at: now(), label: SOURCE_LABEL[input.source] },
    { at: now(), label: `Categorised as ${analysis.category} for ${analysis.clientName}` },
    { at: now(), label: `Converted at 1 USD = ${fx.toFixed(2)} KES (${fmtKes(calc.kesGross)})` },
    { at: now(), label: `Invoice ${invoiceNo} and KRA note generated` },
  ];

  const { data, error } = await getSupabaseAdminClient()
    .from("transactions")
    .insert({
      id,
      paypal_id: input.captureId,
      order_id: input.orderId ?? null,
      payer_name: details.payerName,
      payer_email: details.payerEmail,
      description: details.description,
      client_name: analysis.clientName,
      category: analysis.category,
      service_title: analysis.serviceTitle,
      invoice_description: analysis.invoiceDescription,
      invoice_no: invoiceNo,
      usd_gross: usd,
      paypal_fee_usd: calc.feeUsd,
      usd_net: calc.usdNet,
      fx_rate: fx,
      kes_gross: calc.kesGross,
      mpesa_fee_kes: calc.mpesaFeeKes,
      kes_net: calc.kesNet,
      kra_note: analysis.kraNote,
      status: "invoiced",
      awaiting_confirm: false,
      events,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return { status: "duplicate" };
    throw new Error(`[pipeline] insert failed: ${error.message}`);
  }
  const tx = data as Transaction;

  const sent = await sendWhatsApp(paidBody(tx), `${env.appUrl}/api/invoice/${tx.id}`, [
    { id: "1", title: "Send invoice" },
    { id: "2", title: "KRA report" },
    { id: "3", title: "M-Pesa payout" },
  ]);
  await appendEvent(
    tx.id,
    sent.simulated
      ? "WhatsApp summary prepared (simulated, WhatsApp not configured)"
      : sent.ok
        ? "WhatsApp summary and PDF invoice sent"
        : "WhatsApp delivery failed"
  );
  return { status: "created", id: tx.id };
}

