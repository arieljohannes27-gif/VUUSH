import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgres://swift:swift@localhost:55432/swift_platform"),
  CORS_ORIGINS: z.string().optional().default(""),
  AUTH_PEPPER: z
    .string()
    .min(16)
    .default("dev-only-change-me-auth-pepper"),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  MFA_TICKET_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  PSP_PROVIDER: z.enum(["dev_stub", "paystack"]).default("dev_stub"),
  PSP_WEBHOOK_SECRET: z.string().default("dev-webhook-secret"),
  /** Paystack secret key (sk_test_… / sk_live_…). Required when PSP_PROVIDER=paystack. */
  PAYSTACK_SECRET_KEY: z.string().optional().default(""),
  /** Paystack public key (pk_test_… / pk_live_…) — client checkout. */
  PAYSTACK_PUBLIC_KEY: z.string().optional().default(""),
  /** Optional override for initialize callback_url. */
  PAYSTACK_CALLBACK_URL: z.string().optional().default(""),
  /**
   * Live mode gate. sk_live keys are rejected unless true.
   * Sandbox (sk_test) always allowed when provider=paystack.
   */
  PAYSTACK_LIVE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /**
   * Optional sandbox fallback when a driver has no payout_recipient_code.
   * Production should set codes per driver profile.
   */
  PAYSTACK_DEFAULT_TRANSFER_RECIPIENT: z.string().optional().default(""),
  TRACK_FRESH_SECONDS: z.coerce.number().int().positive().default(45),
  TRACK_STALE_SECONDS: z.coerce.number().int().positive().default(90),
  TRACK_LOST_SECONDS: z.coerce.number().int().positive().default(180),
  TRACK_TELEPORT_KM: z.coerce.number().positive().default(8),
  TRACK_MAX_SPEED_MPS: z.coerce.number().positive().default(55),
  /** Max metres from job dropoff to allow complete delivery. */
  PROOF_DROPOFF_RADIUS_M: z.coerce.number().positive().default(150),
  /**
   * OTP email delivery.
   * - console: local/dev only (prints code to server logs)
   * - resend: production email via Resend API
   */
  OTP_EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional().default(""),
  OTP_EMAIL_FROM: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten());
  process.exit(1);
}

export const env = parsed.data;

const isProdLike =
  env.NODE_ENV === "production" || env.NODE_ENV === "staging";

if (
  isProdLike &&
  env.AUTH_PEPPER === "dev-only-change-me-auth-pepper"
) {
  console.error("AUTH_PEPPER must be set to a strong secret in production");
  process.exit(1);
}

if (isProdLike && !env.CORS_ORIGINS.trim()) {
  console.error(
    "CORS_ORIGINS must be set in staging/production (comma-separated HTTPS origins)",
  );
  process.exit(1);
}

if (isProdLike && env.OTP_EMAIL_PROVIDER === "console") {
  console.error(
    "OTP_EMAIL_PROVIDER=console is not allowed in staging/production — set resend + RESEND_API_KEY + OTP_EMAIL_FROM",
  );
  process.exit(1);
}

if (
  isProdLike &&
  env.OTP_EMAIL_PROVIDER === "resend" &&
  (!env.RESEND_API_KEY.trim() || !env.OTP_EMAIL_FROM.trim())
) {
  console.error(
    "RESEND_API_KEY and OTP_EMAIL_FROM are required when OTP_EMAIL_PROVIDER=resend",
  );
  process.exit(1);
}

export function corsOriginList(): string[] | true {
  const raw = env.CORS_ORIGINS.trim();
  if (!raw) {
    // Dev only — production refuses to boot with empty CORS (see checks above).
    return true;
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function isDev(): boolean {
  return env.NODE_ENV === "development" || env.NODE_ENV === "test";
}
