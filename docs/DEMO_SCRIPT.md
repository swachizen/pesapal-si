# 3-minute demo script

**0:00 Hook (15s).** "I sell logos from Likoni to clients in the US. PayPal pays me in dollars. Then the real work starts: conversion, invoices, tax, M-Pesa. PesaPal AI is an agent that does it all."

**0:15 Pay (30s).** Dashboard, press *Receive $0.15 with PayPal*, approve with the sandbox buyer. Land back on the dashboard.

**0:45 Result (30s).** Toast and "Payment received" card appear. Point at the breakdown: $0.15, PayPal fee, live rate, KES. Point at the agent timeline: webhook, categorised, converted, invoice written.

**1:15 WhatsApp (45s).** Show phone: "Boss, Sarah paid $0.15 (KES 18.06). I have made your invoice, what's next?" with the PDF. Open the PDF and scroll the KES settlement panel.

**2:00 Agentic actions (45s).** Reply `1` (invoice emailed to client), `2` (KRA report PDF arrives), `3` then `YES` (M-Pesa payout approved by you, not by the bot).

**2:45 Close (15s).** "Agentic commerce for 10 million African freelancers: PayPal in, shillings out, tax ready. Built with PayPal, Gemini, Twilio and Daraja."

## Pre-recording checklist
- Run `ngrok http 3000`, set `APP_URL` to the https URL, restart.
- PayPal app: add webhook `APP_URL/api/paypal/webhook` for `PAYMENT.CAPTURE.COMPLETED`, copy the Webhook ID.
- Twilio sandbox: join from your phone, set "When a message comes in" to `APP_URL/api/whatsapp/webhook`.
- Send one WhatsApp message to the sandbox within 24 hours so the session is open.
- Keep `DARAJA_MODE=mock` for the take. Switch to `live` only if the sandbox is healthy; it falls back to mock automatically.
- Do a dry run, then clear the table in Supabase for a clean recording.

