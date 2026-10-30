import "server-only";
import { classifyIntent, type Intent } from "@/lib/ai/agent";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { fmtKes, fmtUsd } from "@/lib/format";
import { MENU } from "@/lib/messages";
import { maskPhone, sendB2C } from "@/lib/mpesa/daraja";
import { summarizePeriod } from "@/lib/money";
import { renderInvoicePdf } from "@/lib/pdf/invoice";
import { currentPeriod, reportUrl } from "@/lib/sign";
import {
  appendEvent,
  getLatestTransaction,
  listTransactions,
  listTransactionsForPeriod,
  updateTransaction,
} from "@/lib/transactions";
import { sendWhatsApp } from "@/lib/twilio/whatsapp";
import type { Transaction } from "@/lib/types";

const MIN_PAYOUT_KES = 10;

async function sendInvoice(tx: Transaction): Promise<void> {
  const to = env.demoClientEmail || tx.payer_email;
  if (!to) {
    await sendWhatsApp("I have no client email for this payment, Boss. Set DEMO_CLIENT_EMAIL and try again.");
    return;
  }
  const pdf = await renderInvoicePdf(tx);
  const result = await sendEmail({
    to,
    subject: `Invoice ${tx.invoice_no} from ${env.businessName}`,
    html: `<p>Hi ${tx.client_name},</p><p>Thank you for your payment of <strong>${fmtUsd(tx.usd_gross)}</strong>. Your invoice ${tx.invoice_no} is attached.</p><p>${env.businessName}</p>`,
    attachment: { filename: `${tx.invoice_no}.pdf`, content: pdf },
  });
  if (!result.ok) {
    await sendWhatsApp(`I could not email the invoice, Boss (${result.error ?? "unknown error"}). Try again shortly.`);
    return;
  }
  if (tx.status !== "paid_out" && tx.status !== "payout_pending") {
    await updateTransaction(tx.id, { status: "invoice_sent" });
  }
  await appendEvent(tx.id, `Invoice emailed to ${to}${result.simulated ? " (simulated)" : ""}`);
  await sendWhatsApp(
    `Done, Boss. Invoice ${tx.invoice_no} sent to ${to}${result.simulated ? " (demo mode, email simulated)" : ""}.\n\nNext:\n2. KRA report\n3. Payout to M-Pesa`
  );
}

async function sendKraReport(tx: Transaction): Promise<void> {
  const period = currentPeriod();
  const sum = summarizePeriod(await listTransactionsForPeriod(period));
  await appendEvent(tx.id, `KRA report generated for ${period}`);
  await sendWhatsApp(
    [
      `*KRA report ready* for ${period}`,
      `Payments: ${sum.count}`,
      `Gross receipts: ${fmtKes(sum.grossKes)}`,
      `Indicative tax (${(env.totRate * 100).toFixed(1)}%): ${fmtKes(sum.totKes)}`,
      "",
      "Please confirm your tax regime and rate on iTax before filing.",
      "",
      "Next:\n1. Send invoice to client\n3. Payout to M-Pesa",
    ].join("\n"),
    reportUrl(period)
  );
}

async function draftPayout(tx: Transaction): Promise<void> {
  if (tx.status === "paid_out") {
    await sendWhatsApp(`This one is already paid out, Boss (ref ${tx.mpesa_ref ?? "n/a"}).`);
    return;
  }
  const amount = Math.floor(tx.kes_net);
  if (amount < MIN_PAYOUT_KES) {
    await sendWhatsApp(`The net amount (${fmtKes(tx.kes_net)}) is below the KES ${MIN_PAYOUT_KES} M-Pesa minimum, Boss.`);
    return;
  }
  await updateTransaction(tx.id, { awaiting_confirm: true, status: "payout_pending" });
  await appendEvent(tx.id, `M-Pesa payout of KES ${amount} drafted, waiting for approval`);
  await sendWhatsApp(
    [
      "*Payout draft ready*",
      `Amount: KES ${amount}`,
      `To: ${maskPhone(env.payoutPhone || "254700000000")}`,
      "",
      "Reply *YES* to approve or *NO* to cancel.",
    ].join("\n")
  );
}

async function executePayout(tx: Transaction): Promise<void> {
  const amount = Math.floor(tx.kes_net);
  const phone = env.payoutPhone || "254700000000";
  const result = await sendB2C({
    amount,
    phone,
    remarks: `Payout for ${tx.invoice_no}`.slice(0, 100),
  });
  if (!result.ok) {
    await sendWhatsApp(`The payout failed, Boss: ${result.message}. Your draft is still waiting. Reply YES to retry.`);
    return;
  }
  await updateTransaction(tx.id, { awaiting_confirm: false, status: "paid_out", mpesa_ref: result.reference });
  await appendEvent(tx.id, `M-Pesa payout of KES ${amount} sent (${result.mode}), ref ${result.reference}`);
  await sendWhatsApp(
    [
      "*Payout sent, Boss*",
      `KES ${amount} to ${maskPhone(phone)}`,
      `Reference: ${result.reference}`,
      `Mode: ${result.mode === "live" ? "Daraja sandbox" : "Daraja mock"}`,
      "",
      "Anything else?\n1. Send invoice to client\n2. KRA report",
    ].join("\n")
  );
}

async function cancelPayout(tx: Transaction): Promise<void> {
  await updateTransaction(tx.id, { awaiting_confirm: false, status: "invoiced" });
  await appendEvent(tx.id, "M-Pesa payout cancelled by owner");
  await sendWhatsApp(`Payout cancelled, Boss. Nothing was sent.\n\n${MENU}`);
}

async function sendStatus(): Promise<void> {
  const all = await listTransactions(100);
  const total = all.reduce((s, t) => s + t.kes_gross, 0);
  const latest = all[0];
  await sendWhatsApp(
    `Boss, you have ${all.length} payment${all.length === 1 ? "" : "s"} worth ${fmtKes(total)}.${latest ? ` Latest: ${latest.client_name}, ${fmtUsd(latest.usd_gross)}.` : ""}\n\n${MENU}`
  );
}

export async function handleCommand(text: string): Promise<void> {
  const tx = await getLatestTransaction();
  if (!tx) {
    await sendWhatsApp("No payments yet, Boss. Make one from the dashboard and I will take it from there.");
    return;
  }
  const { intent, reply }: { intent: Intent; reply: string } = await classifyIntent(text);

  switch (intent) {
    case "confirm":
      if (tx.awaiting_confirm) await executePayout(tx);
      else await sendWhatsApp(`Nothing is waiting for approval, Boss.\n\n${MENU}`);
      return;
    case "cancel":
      if (tx.awaiting_confirm) await cancelPayout(tx);
      else await sendWhatsApp(`Nothing to cancel, Boss.\n\n${MENU}`);
      return;
    case "send_invoice":
      return sendInvoice(tx);
    case "kra_report":
      return sendKraReport(tx);
    case "payout":
      return draftPayout(tx);
    case "status":
      return sendStatus();
    default:
      await sendWhatsApp(reply || MENU);
  }
}

