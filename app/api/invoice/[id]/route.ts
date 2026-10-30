import { renderInvoicePdf } from "@/lib/pdf/invoice";
import { getTransaction } from "@/lib/transactions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const tx = await getTransaction(id);
  if (!tx) return new Response("Not found", { status: 404 });
  const pdf = await renderInvoicePdf(tx);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${tx.invoice_no}.pdf"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

