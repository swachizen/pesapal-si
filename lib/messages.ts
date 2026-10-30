import { fmtKes, fmtUsd } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export const MENU = [
  "Reply with:",
  "1. Send invoice to client",
  "2. KRA report",
  "3. Payout to M-Pesa",
].join("\n");

export function paidMessage(tx: Transaction): string {
  return [
    `Boss, *${tx.client_name}* paid *${fmtUsd(tx.usd_gross)}* (*${fmtKes(tx.kes_gross)}*).`,
    `I have made your invoice (${tx.invoice_no}), what's next?`,
    "",
    MENU,
  ].join("\n");
}

export function paidBody(tx: Transaction): string {
  return [
    `Boss, *${tx.client_name}* paid *${fmtUsd(tx.usd_gross)}* (*${fmtKes(tx.kes_gross)}*).`,
    `I have made your invoice (${tx.invoice_no}), what's next?`,
  ].join("\n");
}

