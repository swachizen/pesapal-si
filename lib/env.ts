import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[env] Missing ${name}. See .env.example.`);
  return value;
}

function optional(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

/** Lazy getters: nothing throws at import or build time, only when a value is used. */
export const env = {
  get appUrl() {
    return optional("APP_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get appSecret() {
    return required("APP_SECRET");
  },
  get demoEnabled() {
    return optional("DEMO_MODE", "on") !== "off";
  },
  get businessName() {
    return optional("BUSINESS_NAME", "Your Studio Name");
  },
  get businessEmail() {
    return optional("BUSINESS_EMAIL", "");
  },
  get businessLocation() {
    return optional("BUSINESS_LOCATION", "Mombasa, Kenya");
  },
  get kraPin() {
    return optional("KRA_PIN", "A000000000X");
  },
  get totRate() {
    const n = Number(optional("KRA_TOT_RATE", "0.03"));
    return Number.isFinite(n) && n >= 0 ? n : 0.03;
  },

  get paypalBase() {
    return optional("PAYPAL_ENV", "sandbox") === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  },
  get paypalClientId() {
    return required("PAYPAL_CLIENT_ID");
  },
  get paypalClientSecret() {
    return required("PAYPAL_CLIENT_SECRET");
  },
  get paypalWebhookId() {
    return optional("PAYPAL_WEBHOOK_ID");
  },
  get paypalSkipVerify() {
    return optional("PAYPAL_SKIP_VERIFY") === "true";
  },
  get paypalFeePercent() {
    const n = Number(optional("PAYPAL_FEE_PERCENT", "4.4"));
    return Number.isFinite(n) && n >= 0 ? n : 4.4;
  },
  get fallbackFx() {
    const n = Number(optional("FALLBACK_FX_KES", "129"));
    return Number.isFinite(n) && n > 0 ? n : 129;
  },

  get hasGemini() {
    return optional("GOOGLE_GENERATIVE_AI_API_KEY").length > 0;
  },
  get geminiModel() {
    return optional("GEMINI_MODEL", "gemini-3.8-flash");
  },

  get whatsappToken() {
    return optional("WHATSAPP_ACCESS_TOKEN");
  },
  get whatsappPhoneId() {
    return optional("WHATSAPP_PHONE_NUMBER_ID");
  },
  get whatsappVerifyToken() {
    return optional("WHATSAPP_VERIFY_TOKEN");
  },
  get whatsappAppSecret() {
    return optional("WHATSAPP_APP_SECRET");
  },
  get whatsappApiVersion() {
    return optional("WHATSAPP_API_VERSION", "v23.0");
  },
  /** Owner number as digits with country code, e.g. 2547XXXXXXXX. */
  get ownerWhatsapp() {
    const d = optional("OWNER_WHATSAPP").replace(/\D/g, "");
    return d.startsWith("0") ? `254${d.slice(1)}` : d;
  },
  get whatsappConfigured() {
    return (
      optional("WHATSAPP_ACCESS_TOKEN").length > 0 &&
      optional("WHATSAPP_PHONE_NUMBER_ID").length > 0 &&
      optional("OWNER_WHATSAPP").length > 0
    );
  },

  get darajaMode() {
    return optional("DARAJA_MODE", "mock");
  },
  get darajaBase() {
    return optional("DARAJA_BASE", "https://sandbox.safaricom.co.ke").replace(/\/$/, "");
  },
  get darajaKey() {
    return optional("DARAJA_CONSUMER_KEY");
  },
  get darajaSecret() {
    return optional("DARAJA_CONSUMER_SECRET");
  },
  get darajaShortcode() {
    return optional("DARAJA_SHORTCODE", "600999");
  },
  get darajaInitiator() {
    return optional("DARAJA_INITIATOR", "testapi");
  },
  get darajaCredential() {
    return optional("DARAJA_SECURITY_CREDENTIAL");
  },
  get payoutPhone() {
    return optional("MPESA_PAYOUT_PHONE");
  },

  get resendKey() {
    return optional("RESEND_API_KEY");
  },
  get emailFrom() {
    return optional("EMAIL_FROM", "PesaPal AI <onboarding@resend.dev>");
  },
  get demoClientEmail() {
    return optional("DEMO_CLIENT_EMAIL");
  },
};

