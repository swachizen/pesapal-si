import { renderKraReportPdf } from "@/lib/pdf/kra-report";
import { verifyReport } from "@/lib/sign";
import { listTransactionsForPeriod } from "@/lib/transactions";

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  if (!PERIOD.test(period) || !verifyReport(period, sig)) {
    return new Response("Forbidden", { status: 403 });
  }
  const txs = await listTransactionsForPeriod(period);
  const pdf = await renderKraReportPdf(period, txs);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="KRA-report-${period}.pdf"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

