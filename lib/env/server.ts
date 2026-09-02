import "server-only";

import { z } from "zod";

const optionalSecret = (minimumLength = 1) =>
  z.preprocess((value) => value === "" ? undefined : value, z.string().min(minimumLength).optional());
const optionalNotificationProvider=z.preprocess(
  (value)=>value===""?undefined:value,
  z.enum(["disabled","console"]).optional(),
);

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret(),
  STRIPE_SECRET_KEY: optionalSecret(),
  STRIPE_WEBHOOK_SECRET: optionalSecret(),
  BILLING_RECONCILIATION_SECRET: optionalSecret(24),
  OPENAI_API_KEY: optionalSecret(),
  RESEND_API_KEY: optionalSecret(),
  TWILIO_ACCOUNT_SID: optionalSecret(),
  TWILIO_AUTH_TOKEN: optionalSecret(),
  NOTIFICATION_LINK_ENCRYPTION_KEY: optionalSecret(),
  NOTIFICATION_CRON_SECRET: optionalSecret(24),
  EMAIL_PROVIDER:optionalNotificationProvider,
  SMS_PROVIDER:optionalNotificationProvider,
});

export const serverEnv = serverSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  BILLING_RECONCILIATION_SECRET: process.env.BILLING_RECONCILIATION_SECRET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  NOTIFICATION_LINK_ENCRYPTION_KEY:process.env.NOTIFICATION_LINK_ENCRYPTION_KEY,
  NOTIFICATION_CRON_SECRET:process.env.NOTIFICATION_CRON_SECRET,
  EMAIL_PROVIDER:process.env.EMAIL_PROVIDER,
  SMS_PROVIDER:process.env.SMS_PROVIDER,
});
