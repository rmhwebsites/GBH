import { Resend } from "resend";

// Initialize Resend client (only on server side)
export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM =
  process.env.EMAIL_FROM || "GBH Capital <onboarding@resend.dev>";
