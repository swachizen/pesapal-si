# 3-minute demo script

**0:00 Hook (15s).** "I sell logos from Likoni to clients in the US. PayPal pays me in dollars. Then the real work starts: conversion, invoices, tax, M-Pesa. PesaPal AI is an agent that does it all."

**0:15 Pay (30s).** Dashboard, press *Receive $0.15 with PayPal*, approve with the sandbox buyer. Land back on the dashboard.

**0:45 Result (30s).** Toast and "Payment received" card appear. Point at the breakdown: $0.15, PayPal fee, live rate, KES. Point at the agent timeline: webhook, categorised, converted, invoice written.

**1:15 WhatsApp (45s).** Show phone: "Boss, Sarah paid $0.15 (KES 18.06). I have made your invoice, what's next?" with the PDF on top and three buttons. Open the PDF and scroll the KES settlement panel.

**2:00 Agentic actions (45s).** Tap *Send invoice* (emailed to the client), tap *KRA report* (PDF arrives), tap *M-Pesa payout*, then *Approve* (you approve the money, not the bot).

**2:45 Close (15s).** "Agentic commerce for 10 million African freelancers: PayPal in, shillings out, tax ready. Built with PayPal, Gemini, WhatsApp and Daraja."

## Pre-recording checklist
- Deploy on Vercel (or run `ngrok http 3000`) and set `APP_URL` to the https address.
- PayPal app: add webhook `APP_URL/api/paypal/webhook` for `PAYMENT.CAPTURE.COMPLETED`, copy the Webhook ID.
- Meta developer dashboard > WhatsApp > Configuration: callback URL `APP_URL/api/whatsapp/webhook`, verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe to the `messages` field.
- API Setup page: add your phone as a recipient, copy the Phone number ID and a fresh access token (temporary tokens last 24 hours).
- Right before recording, send `hi` from your phone to the WhatsApp test number so the 24-hour window is open.
- Keep `DARAJA_MODE=mock` for the take. Switch to `live` only if the sandbox is healthy; it falls back to mock automatically.
- Do a dry run, then clear the table in Supabase for a clean recording.

