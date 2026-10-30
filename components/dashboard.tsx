"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, FileText, Landmark, Loader2, MessageCircle, Wallet, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, fmtKes, fmtTime, fmtUsd } from "@/lib/format";
import type { DashboardPayload, Transaction, TxStatus } from "@/lib/types";

const POLL_MS = 3000;

const STATUS: Record<TxStatus, { label: string; className: string }> = {
  invoiced: { label: "Invoice ready", className: "border-info-border bg-info-soft text-info-text" },
  invoice_sent: { label: "Invoice sent", className: "border-success-border bg-success-soft text-success-text" },
  payout_pending: { label: "Awaiting approval", className: "border-warning-border bg-warning-soft text-warning-text" },
  paid_out: { label: "Paid out", className: "border-success-border bg-success-soft text-success-text" },
};

function announce(t: Transaction) {
  toast.success(`Payment received: ${fmtUsd(t.usd_gross)}`, {
    description: `${t.client_name} paid. ${fmtKes(t.kes_gross)} converted, invoice ${t.invoice_no} is ready.`,
  });
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="gap-2 py-5">
      <CardHeader className="px-5">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-display text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 text-sm text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}

function Breakdown({ tx }: { tx: Transaction }) {
  const rows: Array<[string, string]> = [
    ["Client paid", fmtUsd(tx.usd_gross)],
    ["PayPal fee", `-${fmtUsd(tx.paypal_fee_usd)}`],
    ["Net in PayPal", fmtUsd(tx.usd_net)],
    ["Live rate", `1 USD = ${tx.fx_rate.toFixed(2)} KES`],
    ["Converted", fmtKes(tx.kes_gross)],
    ["M-Pesa fee (est.)", `-${fmtKes(tx.mpesa_fee_kes)}`],
  ];
  return (
    <dl className="text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between border-b py-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="tabular-nums">{v}</dd>
        </div>
      ))}
      <div className="mt-4 flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-primary-foreground">
        <dt className="text-sm opacity-80">Net payout</dt>
        <dd className="font-display text-xl font-semibold tabular-nums">{fmtKes(tx.kes_net)}</dd>
      </div>
    </dl>
  );
}

export function Dashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<"paypal" | "demo" | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const justPaid = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DashboardPayload;
      setData(json);
      setFailed(false);
      const ids = new Set(json.transactions.map((t) => t.id));
      if (seen.current === null) {
        if (justPaid.current && json.transactions[0]) announce(json.transactions[0]);
      } else {
        for (const t of json.transactions) if (!seen.current.has(t.id)) announce(t);
      }
      seen.current = ids;
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get("paid");
    if (flag) {
      justPaid.current = flag === "1";
      if (flag === "error") toast.error("The PayPal payment did not complete. Please try again.");
      window.history.replaceState(null, "", "/");
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  async function startPayPal() {
    setBusy("paypal");
    try {
      const res = await fetch("/api/paypal/create-order", { method: "POST" });
      const json = (await res.json()) as { approveUrl?: string; error?: string };
      if (!res.ok || !json.approveUrl) throw new Error(json.error ?? "Could not start PayPal checkout");
      window.location.assign(json.approveUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start PayPal checkout");
      setBusy(null);
    }
  }

  async function runDemo() {
    setBusy("demo");
    try {
      const res = await fetch("/api/demo/simulate", { method: "POST" });
      if (!res.ok) throw new Error("Demo mode is off");
      toast.message("Agent is working", { description: "Categorising, converting and writing your invoice." });
      window.setTimeout(() => void load(), 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not run the demo");
    } finally {
      setBusy(null);
    }
  }

  const txs = data?.transactions ?? [];
  const latest = txs[0];

  const stats = useMemo(() => {
    const usdNet = txs.reduce((s, t) => s + t.usd_net, 0);
    const kes = txs.reduce((s, t) => s + t.kes_gross, 0);
    const taxBase = txs.reduce((s, t) => s + t.usd_gross * t.fx_rate, 0);
    return { usdNet, kes, tax: taxBase * (data?.totRate ?? 0) };
  }, [txs, data?.totRate]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-brand font-display font-bold text-brand-foreground" aria-hidden="true">
              P
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">PesaPal AI</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-warning-border bg-warning-soft text-warning-text">
              PayPal Sandbox
            </Badge>
            <Badge variant="outline" className="hidden sm:inline-flex">
              <MessageCircle className="size-3" aria-hidden="true" />
              {data?.whatsappLive ? "WhatsApp live" : "WhatsApp simulated"}
            </Badge>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1>Dollars in. Shillings out.</h1>
            <p className="mt-4 max-w-prose text-lg text-muted-foreground">
              PesaPal AI watches your PayPal, writes the invoice, converts it to Kenya Shillings and asks you on
              WhatsApp what to do next.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Button size="lg" onClick={startPayPal} disabled={busy !== null}>
              {busy === "paypal" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Wallet aria-hidden="true" />}
              Receive $0.15 with PayPal
            </Button>
            {data?.demoEnabled ? (
              <Button size="lg" variant="outline" onClick={runDemo} disabled={busy !== null}>
                {busy === "demo" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Zap aria-hidden="true" />}
                Run offline demo
              </Button>
            ) : null}
          </div>
        </section>

        {failed && !data ? (
          <div role="alert" className="status status-error">
            We could not load your payments. Check your Supabase keys in .env and reload.
          </div>
        ) : null}

        <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data ? (
            <>
              <Stat label="Received after PayPal fees" value={fmtUsd(stats.usdNet)} hint="Across all payments" />
              <Stat label="In Kenya Shillings" value={fmtKes(stats.kes)} hint={`Live rate: 1 USD = ${data.fx.toFixed(2)} KES`} />
              <Stat label="Invoices" value={String(txs.length)} hint="PDF made automatically" />
              <Stat label="Tax to set aside (estimate)" value={fmtKes(stats.tax)} hint={`At ${(data.totRate * 100).toFixed(1)}% of gross receipts`} />
            </>
          ) : (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          )}
        </section>

        <section aria-label="Latest payment" className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="font-display text-xl">Latest payment</CardTitle>
              <CardDescription>
                {latest ? `${latest.client_name}, ${fmtDate(latest.created_at)}` : "Waiting for your first payment"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!data ? (
                <Skeleton className="h-64 rounded-lg" />
              ) : latest ? (
                <div className="space-y-5">
                  <div className="status status-success flex items-center gap-2">
                    <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
                    <span className="font-medium">
                      Payment received: {fmtUsd(latest.usd_gross)} from {latest.client_name}
                    </span>
                  </div>
                  <Breakdown tx={latest} />
                </div>
              ) : (
                <p className="max-w-prose text-muted-foreground">
                  No payments yet. Select Receive $0.15 with PayPal above and watch the agent work.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-display text-xl">What the agent did</CardTitle>
              <CardDescription>Live activity for the latest payment</CardDescription>
            </CardHeader>
            <CardContent>
              {latest ? (
                <ol className="space-y-4">
                  {latest.events.map((ev, i) => (
                    <li key={`${ev.at}-${i}`} className="flex gap-3 text-sm">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
                      <div>
                        <p>{ev.label}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{fmtTime(ev.at)}</p>
                      </div>
                    </li>
                  ))}
                  {latest.status === "invoiced" ? (
                    <li className="flex gap-3 text-sm">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                      <p className="text-muted-foreground">Waiting for your reply on WhatsApp</p>
                    </li>
                  ) : null}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Agent steps will appear here.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-label="Payments">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="font-display text-xl">Payments and documents</CardTitle>
                <CardDescription>Every payment gets an invoice. Your monthly report is tax-ready.</CardDescription>
              </div>
              {data ? (
                <div className="flex gap-2">
                  <a href={data.reportUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <Landmark aria-hidden="true" />
                    View KRA report
                  </a>
                  <a href={data.reportUrl} download="KRA-report.pdf" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                    <Download aria-hidden="true" />
                    Download
                  </a>
                </div>
              ) : null}
            </CardHeader>
            <CardContent>
              {!data ? (
                <Skeleton className="h-40 rounded-lg" />
              ) : txs.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">Your payments will show up here.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">USD</TableHead>
                      <TableHead className="text-right">KES</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Invoice PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txs.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium tabular-nums">{t.invoice_no}</TableCell>
                        <TableCell>{t.client_name}</TableCell>
                        <TableCell>{t.category}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtUsd(t.usd_gross)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtKes(t.kes_gross)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS[t.status].className}>
                            {STATUS[t.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <a
                            href={`/api/invoice/${t.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-link underline-offset-4 hover:underline"
                          >
                            <FileText className="size-4" aria-hidden="true" />
                            Open
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

        <footer className="pb-6 text-center text-sm text-muted-foreground">
          Built for African freelancers. Sandbox demo: every PayPal payment is $0.15 and no real money moves.
        </footer>
      </main>
    </div>
  );
}

