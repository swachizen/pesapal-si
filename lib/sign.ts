import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export function signReport(period: string): string {
  return createHmac("sha256", env.appSecret).update(`kra:${period}`).digest("hex");
}

export function verifyReport(period: string, sig: string): boolean {
  const expected = Buffer.from(signReport(period));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function reportUrl(period: string): string {
  return `${env.appUrl}/api/kra-report?period=${period}&sig=${signReport(period)}`;
}

/** Current month as YYYY-MM in Nairobi time. */
export function currentPeriod(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

