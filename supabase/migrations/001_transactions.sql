create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  paypal_id text not null unique,
  order_id text,
  payer_name text,
  payer_email text,
  description text not null default '',
  client_name text not null,
  category text not null default 'Other',
  service_title text not null default '',
  invoice_description text not null default '',
  invoice_no text not null unique,
  usd_gross numeric(12,2) not null,
  paypal_fee_usd numeric(12,2) not null default 0,
  usd_net numeric(12,2) not null,
  fx_rate numeric(12,4) not null,
  kes_gross numeric(14,2) not null,
  mpesa_fee_kes numeric(12,2) not null default 0,
  kes_net numeric(14,2) not null,
  kra_note text not null default '',
  status text not null default 'invoiced'
    check (status in ('invoiced','invoice_sent','payout_pending','paid_out')),
  awaiting_confirm boolean not null default false,
  mpesa_ref text,
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists transactions_created_at_idx
  on public.transactions (created_at desc);

-- RLS on with no policies: only the server (service role) can read or write.
alter table public.transactions enable row level security;

