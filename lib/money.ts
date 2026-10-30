import "server-only";
import { env } from "@/lib/env";
import type { Transaction } from "@/lib/types";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Live USD to KES rate from ExchangeRate-API's open endpoint, cached, with a safe fallback. */
let fxCache: { rate: number; expiresAt: number } | null = null;
let fxInflight: Promise<number> | null = null;

async function fetchFx(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
    const data = (await res.json()) as { rates?: Record<string, number> };
    const kes = data.rates?.KES;
    if (typeof kes === "number" && kes > 0) {
      fxCache = { rate: kes, expiresAt: Date.now() + 60 * 60_000 };
      return kes;
    }
  } catch (e) {
    console.error("[fx] using fallback rate:", e instanceof Error ? e.message : "unknown");
  }
  fxCache = { rate: env.fallbackFx, expiresAt: Date.now() + 5 * 60_000 };
  return env.fallbackFx;
}

export function getFxRate(): Promise<number> {
  if (fxCache && fxCache.expiresAt > Date.now()) return Promise.resolve(fxCache.rate);
  fxInflight ??= fetchFx().finally(() => {
    fxInflight = null;
  });
  return fxInflight;
}

/** Estimated M-Pesa withdrawal fee tiers (KES). Replace with your real tariff. */
export function estimateMpesaFee(kes: number): number {
  const tiers: Array<[number, number]> = [
    [100, 0],
    [500, 5],
    [1000, 10],
    [1500, 15],
    [2500, 20],
    [3500, 25],
    [5000, 30],
    [7500, 40],
    [10000, 50],
    [Number.POSITIVE_INFINITY, 60],
  ];
  for (const [limit, fee] of tiers) if (kes <= limit) return fee;
  return 60;
}

export interface Payout {
  feeUsd: number;
  usdNet: number;
  kesGross: number;
  mpesaFeeKes: number;
  kesNet: number;
}

/** $100 - 4.4% = $95.60, x live rate = KES, minus M-Pesa fee = net payout. */
export function computePayout(usdGross: number, fx: number): Payout {
  const feeUsd = round2(usdGross * (env.paypalFeePercent / 100));
  const usdNet = round2(usdGross - feeUsd);
  const kesGross = round2(usdNet * fx);
  const mpesaFeeKes = estimateMpesaFee(kesGross);
  const kesNet = round2(Math.max(kesGross - mpesaFeeKes, 0));
  return { feeUsd, usdNet, kesGross, mpesaFeeKes, kesNet };
}

export interface PeriodSummary {
  count: number;
  usdGross: number;
  grossKes: number;
  feesKes: number;
  netKes: number;
  totKes: number;
}

export function summarizePeriod(txs: Transaction[]): PeriodSummary {
  const usdGross = txs.reduce((s, t) => s + t.usd_gross, 0);
  const grossKes = txs.reduce((s, t) => s + t.usd_gross * t.fx_rate, 0);
  const feesKes = txs.reduce((s, t) => s + t.paypal_fee_usd * t.fx_rate, 0);
  return {
    count: txs.length,
    usdGross: round2(usdGross),
    grossKes: round2(grossKes),
    feesKes: round2(feesKes),
    netKes: round2(grossKes - feesKes),
    totKes: round2(grossKes * env.totRate),
  };
}

