import { Resend } from "resend";

// Lazy-init Resend client (avoids crashing at import time if key is missing)
let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error("RESEND_API_KEY is not set");
    }
    _resend = new Resend(key);
  }
  return _resend;
}

export const EMAIL_FROM =
  process.env.EMAIL_FROM || "GBH Capital <onboarding@resend.dev>";
