const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const numFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const fmtUsd = (n: number) => usdFmt.format(n);
export const fmtKes = (n: number) => `KES ${numFmt.format(n)}`;

export function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(new Date(iso));
}

export function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Africa/Nairobi",
  }).format(new Date(iso));
}

export function errMsg(e: unknown, fallback = "Something went wrong"): string {
  return e instanceof Error ? e.message : fallback;
}

