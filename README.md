# PesaPal AI

Agentic commerce for Kenyan freelancers: PayPal USD in, WhatsApp agent, PDF invoice, KRA report, M-Pesa payout.

## Install
```bash
npm i ai@^5 @ai-sdk/google@^2 zod@^3.25.76 @react-pdf/renderer server-only
npm uninstall twilio
npx shadcn@latest add button card badge table skeleton sonner
```
1. Copy `.env.example` to `.env.local` and fill it in.
2. Run `supabase/migrations/001_transactions.sql` in the Supabase SQL editor.
3. Put `Inter-Variable.woff2` and `SpaceGrotesk-Variable.woff2` in `public/fonts`.
4. `npm run dev`, then follow `docs/DEMO_SCRIPT.md`.

## Security note
The dashboard feed is open for the demo. Add Supabase Auth before using real data.

