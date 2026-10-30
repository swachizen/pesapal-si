import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { env } from "@/lib/env";
import { fmtDate, fmtKes, fmtUsd } from "@/lib/format";
import type { Transaction } from "@/lib/types";

const c = {
  ink: "#000000",
  brand: "#0068d6",
  muted: "#666666",
  line: "#eaeaea",
  soft: "#fafafa",
  green: "#1a7f37",
  greenSoft: "#eefbf1",
  greenEdge: "#b7e4c3",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: c.ink, paddingBottom: 60 },
  band: {
    backgroundColor: c.ink,
    paddingHorizontal: 40,
    paddingTop: 34,
    paddingBottom: 28,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stripe: { height: 4, backgroundColor: c.brand },
  brand: { color: "#ffffff", fontSize: 22, fontFamily: "Helvetica-Bold" },
  bandSub: { color: "#a1a1a1", fontSize: 9, marginTop: 4 },
  invLabel: { color: "#a1a1a1", fontSize: 9, textAlign: "right" },
  invNo: { color: "#ffffff", fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right", marginTop: 2 },
  body: { paddingHorizontal: 40, paddingTop: 28 },
  row: { flexDirection: "row" },
  col: { flex: 1, paddingRight: 12 },
  label: { fontSize: 8.5, color: c.muted, marginBottom: 4 },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: c.muted },
  paid: {
    backgroundColor: c.greenSoft,
    color: c.green,
    borderWidth: 1,
    borderColor: c.greenEdge,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    alignSelf: "flex-start",
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: c.ink,
    paddingBottom: 6,
    marginTop: 26,
  },
  tr: { flexDirection: "row", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.line },
  cDesc: { flex: 1, paddingRight: 10 },
  cQty: { width: 50, textAlign: "right" },
  cAmt: { width: 90, textAlign: "right" },
  totals: { alignSelf: "flex-end", width: 230, marginTop: 14 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: c.ink,
    marginTop: 6,
    paddingTop: 8,
  },
  panel: {
    marginTop: 26,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.soft,
    borderRadius: 6,
    padding: 16,
  },
  panelTitle: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 2 },
  panelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  net: {
    marginTop: 12,
    backgroundColor: c.ink,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netLabel: { color: "#a1a1a1", fontSize: 9 },
  netValue: { color: "#ffffff", fontSize: 18, fontFamily: "Helvetica-Bold" },
  notes: { marginTop: 18, fontSize: 9, color: c.muted, lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: c.line,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: c.muted,
  },
});

function InvoiceDocument({ tx }: { tx: Transaction }) {
  const feeLabel = `PayPal fee (${env.paypalFeePercent}%)`;
  return (
    <Document title={`Invoice ${tx.invoice_no}`} author={env.businessName} creator="PesaPal AI">
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          <View>
            <Text style={s.brand}>{env.businessName}</Text>
            <Text style={s.bandSub}>{env.businessLocation}</Text>
          </View>
          <View>
            <Text style={s.invLabel}>Invoice</Text>
            <Text style={s.invNo}>{tx.invoice_no}</Text>
            <Text style={s.invLabel}>{fmtDate(tx.created_at)}</Text>
          </View>
        </View>
        <View style={s.stripe} />

        <View style={s.body}>
          <View style={s.row}>
            <View style={s.col}>
              <Text style={s.label}>Billed to</Text>
              <Text style={s.bold}>{tx.client_name}</Text>
              {tx.payer_name ? <Text style={s.muted}>{tx.payer_name}</Text> : null}
              {tx.payer_email ? <Text style={s.muted}>{tx.payer_email}</Text> : null}
            </View>
            <View style={s.col}>
              <Text style={s.label}>From</Text>
              <Text style={s.bold}>{env.businessName}</Text>
              {env.businessEmail ? <Text style={s.muted}>{env.businessEmail}</Text> : null}
              <Text style={s.muted}>KRA PIN: {env.kraPin}</Text>
            </View>
            <View style={s.col}>
              <Text style={s.label}>Status</Text>
              <Text style={s.paid}>Paid via PayPal</Text>
            </View>
          </View>

          <View style={s.tableHead}>
            <Text style={[s.cDesc, s.label]}>Description</Text>
            <Text style={[s.cQty, s.label]}>Qty</Text>
            <Text style={[s.cAmt, s.label]}>Amount (USD)</Text>
          </View>
          <View style={s.tr}>
            <View style={s.cDesc}>
              <Text style={s.bold}>{tx.service_title}</Text>
              <Text style={[s.muted, { marginTop: 3 }]}>{tx.invoice_description}</Text>
            </View>
            <Text style={s.cQty}>1</Text>
            <Text style={s.cAmt}>{fmtUsd(tx.usd_gross)}</Text>
          </View>

          <View style={s.totals}>
            <View style={s.totalRow}>
              <Text style={s.muted}>Subtotal</Text>
              <Text>{fmtUsd(tx.usd_gross)}</Text>
            </View>
            <View style={s.grand}>
              <Text style={s.bold}>Total paid</Text>
              <Text style={s.bold}>{fmtUsd(tx.usd_gross)}</Text>
            </View>
          </View>

          <View style={s.panel} wrap={false}>
            <Text style={s.panelTitle}>Settlement in Kenya Shillings</Text>
            <Text style={[s.muted, { marginBottom: 8 }]}>
              Converted at the live market rate on the day of payment.
            </Text>
            <View style={s.panelRow}>
              <Text style={s.muted}>Client paid</Text>
              <Text>{fmtUsd(tx.usd_gross)}</Text>
            </View>
            <View style={s.panelRow}>
              <Text style={s.muted}>{feeLabel}</Text>
              <Text>-{fmtUsd(tx.paypal_fee_usd)}</Text>
            </View>
            <View style={s.panelRow}>
              <Text style={s.muted}>Net received in PayPal</Text>
              <Text>{fmtUsd(tx.usd_net)}</Text>
            </View>
            <View style={s.panelRow}>
              <Text style={s.muted}>Exchange rate</Text>
              <Text>1 USD = {tx.fx_rate.toFixed(4)} KES</Text>
            </View>
            <View style={s.panelRow}>
              <Text style={s.muted}>Converted amount</Text>
              <Text>{fmtKes(tx.kes_gross)}</Text>
            </View>
            <View style={s.panelRow}>
              <Text style={s.muted}>M-Pesa withdrawal fee (estimate)</Text>
              <Text>-{fmtKes(tx.mpesa_fee_kes)}</Text>
            </View>
            <View style={s.net}>
              <Text style={s.netLabel}>Net to M-Pesa</Text>
              <Text style={s.netValue}>{fmtKes(tx.kes_net)}</Text>
            </View>
          </View>

          <Text style={s.notes}>
            Payment reference: {tx.paypal_id}. Category: {tx.category}. Thank you for your business.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text>Generated by PesaPal AI</Text>
          <Text>{tx.invoice_no}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(tx: Transaction): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument tx={tx} />);
}

