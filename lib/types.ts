export type TxStatus = "invoiced" | "invoice_sent" | "payout_pending" | "paid_out";

export interface TxEvent {
  at: string;
  label: string;
}

export interface Transaction {
  id: string;
  paypal_id: string;
  order_id: string | null;
  payer_name: string | null;
  payer_email: string | null;
  description: string;
  client_name: string;
  category: string;
  service_title: string;
  invoice_description: string;
  invoice_no: string;
  usd_gross: number;
  paypal_fee_usd: number;
  usd_net: number;
  fx_rate: number;
  kes_gross: number;
  mpesa_fee_kes: number;
  kes_net: number;
  kra_note: string;
  status: TxStatus;
  awaiting_confirm: boolean;
  mpesa_ref: string | null;
  events: TxEvent[];
  created_at: string;
}

export interface DashboardPayload {
  transactions: Transaction[];
  fx: number;
  totRate: number;
  reportUrl: string;
  demoEnabled: boolean;
  whatsappLive: boolean;
}

