import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Transaction, TxEvent } from "@/lib/types";

const TABLE = "transactions";

function fail(message: string): never {
  throw new Error(`[transactions] ${message}`);
}

export async function getLatestTransaction(): Promise<Transaction | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail(error.message);
  return (data as Transaction | null) ?? null;
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error.message);
  return (data as Transaction | null) ?? null;
}

export async function paypalIdExists(paypalId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdminClient()
    .from(TABLE)
    .select("id")
    .eq("paypal_id", paypalId)
    .maybeSingle();
  if (error) fail(error.message);
  return Boolean(data);
}

export async function listTransactions(limit = 50): Promise<Transaction[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail(error.message);
  return (data as Transaction[] | null) ?? [];
}

export function periodRange(period: string): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return {
    start: new Date(`${period}-01T00:00:00+03:00`).toISOString(),
    end: new Date(`${next}-01T00:00:00+03:00`).toISOString(),
  };
}

export async function listTransactionsForPeriod(period: string): Promise<Transaction[]> {
  const { start, end } = periodRange(period);
  const { data, error } = await getSupabaseAdminClient()
    .from(TABLE)
    .select("*")
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: true });
  if (error) fail(error.message);
  return (data as Transaction[] | null) ?? [];
}

export async function updateTransaction(
  id: string,
  patch: Partial<Omit<Transaction, "id">>
): Promise<void> {
  const { error } = await getSupabaseAdminClient().from(TABLE).update(patch).eq("id", id);
  if (error) fail(error.message);
}

export async function appendEvent(id: string, label: string): Promise<void> {
  const tx = await getTransaction(id);
  if (!tx) return;
  const events: TxEvent[] = [...tx.events, { at: new Date().toISOString(), label }];
  await updateTransaction(id, { events });
}

