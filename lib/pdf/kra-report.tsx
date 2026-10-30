import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { env } from "@/lib/env";
import { fmtDate, fmtKes, fmtUsd } from "@/lib/format";
import { summarizePeriod } from "@/lib/money";
import type { Transaction } from "@/lib/types";

const c = {
  ink: "#000000",
  brand: "#0068d6",
  muted: "#666666",
  line: "#eaeaea",
  soft: "#fafafa",
  warn: "#8a5200",
  warnSoft: "#fff8e6",
  warnEdge: "#f7d78a",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: c.ink, padding: 40, paddingBottom: 60 },
  head: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 3, borderBottomColor: c.brand, paddingBottom: 14 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  sub: { color: c.muted, marginTop: 4 },
  right: { textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: c.muted },
  grid: { flexDirection: "row", marginTop: 18 },
  card: { flex: 1, borderWidth: 1, borderColor: c.line, backgroundColor: c.soft, borderRadius: 6, padding: 10, marginRight: 8 },
  cardLast: { flex: 1, borderWidth: 1, borderColor: c.ink, backgroundColor: c.ink, borderRadius: 6, padding: 10 },
  cardLabel: { fontSize: 8, color: c.muted },
  cardValue: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 4 },
  section: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 22, marginBottom: 8 },
  th: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.ink, paddingBottom: 5 },
  tr: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.line },
  cDate: { width: 62 },
  cInv: { width: 96 },
  cClient: { flex: 1, paddingRight: 6 },
  cCat: { width: 64 },
  cUsd: { width: 52, textAlign: "right" },
  cRate: { width: 46, textAlign: "right" },
  cKes: { width: 80, textAlign: "right" },
  th8: { fontSize: 8, color: c.muted },
  note: { marginBottom: 6, lineHeight: 1.4 },
  disclaimer: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: c.warnEdge,
    backgroundColor: c.warnSoft,
    borderRadius: 6,
    padding: 10,
    color: c.warn,
    lineHeight: 1.45,
  },
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

function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1))
  );
}

function KraDocument({ period, txs }: { period: string; txs: Transaction[] }) {
  const sum = summarizePeriod(txs);
  const rate = `${(env.totRate * 100).toFixed(1)}%`;
  return (
    <Document title={`KRA income report ${period}`} author={env.businessName} creator="PesaPal AI">
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.title}>KRA income report</Text>
            <Text style={s.sub}>{periodLabel(period)} (Nairobi time)</Text>
          </View>
          <View>
            <Text style={[s.bold, s.right]}>{env.businessName}</Text>
            <Text style={[s.muted, s.right]}>KRA PIN: {env.kraPin}</Text>
            <Text style={[s.muted, s.right]}>{env.businessLocation}</Text>
          </View>
        </View>

        <View style={s.grid}>
          <View style={s.card}>
            <Text style={s.cardLabel}>Payments</Text>
            <Text style={s.cardValue}>{sum.count}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>Gross receipts</Text>
            <Text style={s.cardValue}>{fmtKes(sum.grossKes)}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>PayPal fees</Text>
            <Text style={s.cardValue}>{fmtKes(sum.feesKes)}</Text>
          </View>
          <View style={s.cardLast}>
            <Text style={[s.cardLabel, { color: "#a1a1a1" }]}>Indicative tax at {rate}</Text>
            <Text style={[s.cardValue, { color: "#ffffff" }]}>{fmtKes(sum.totKes)}</Text>
          </View>
        </View>

        <Text style={s.section}>Income ledger</Text>
        <View style={s.th}>
          <Text style={[s.cDate, s.th8]}>Date</Text>
          <Text style={[s.cInv, s.th8]}>Invoice</Text>
          <Text style={[s.cClient, s.th8]}>Client</Text>
          <Text style={[s.cCat, s.th8]}>Category</Text>
          <Text style={[s.cUsd, s.th8]}>USD</Text>
          <Text style={[s.cRate, s.th8]}>Rate</Text>
          <Text style={[s.cKes, s.th8]}>KES</Text>
        </View>
        {txs.length === 0 ? (
          <Text style={[s.muted, { paddingVertical: 10 }]}>No payments recorded in this period.</Text>
        ) : (
          txs.map((t) => (
            <View key={t.id} style={s.tr} wrap={false}>
              <Text style={s.cDate}>{fmtDate(t.created_at)}</Text>
              <Text style={s.cInv}>{t.invoice_no}</Text>
              <Text style={s.cClient}>{t.client_name}</Text>
              <Text style={s.cCat}>{t.category}</Text>
              <Text style={s.cUsd}>{fmtUsd(t.usd_gross)}</Text>
              <Text style={s.cRate}>{t.fx_rate.toFixed(2)}</Text>
              <Text style={s.cKes}>{fmtKes(t.usd_gross * t.fx_rate)}</Text>
            </View>
          ))
        )}

        {txs.length > 0 ? (
          <View>
            <Text style={s.section}>Accounting notes</Text>
            {txs.slice(0, 15).map((t) => (
              <Text key={`note-${t.id}`} style={s.note} wrap={false}>
                <Text style={s.bold}>{t.invoice_no}: </Text>
                {t.kra_note}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={s.disclaimer}>
          Indicative figures built from PayPal-captured payments and the exchange rate on each payment
          date. Turnover Tax applies to resident businesses within the KRA turnover band; confirm your
          regime, rate and filing deadline on iTax before you file. This report is a record-keeping
          aid, not tax advice.
        </Text>

        <View style={s.footer} fixed>
          <Text>Generated by PesaPal AI</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderKraReportPdf(period: string, txs: Transaction[]): Promise<Buffer> {
  return renderToBuffer(<KraDocument period={period} txs={txs} />);
}

