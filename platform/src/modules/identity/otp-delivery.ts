import { env, isDev } from "../../config.js";

/**
 * Deliver a one-time sign-in code.
 * Production email requires Resend. Codes are never logged outside development.
 */
export async function deliverOtp(input: {
  channel: "phone" | "email";
  destination: string;
  code: string;
}): Promise<void> {
  if (input.channel === "email") {
    await deliverEmailOtp(input.destination, input.code);
    return;
  }
  await deliverSmsOtp(input.destination, input.code);
}

async function deliverEmailOtp(destination: string, code: string) {
  const provider = env.OTP_EMAIL_PROVIDER;

  if (provider === "resend") {
    const key = env.RESEND_API_KEY.trim();
    const from = env.OTP_EMAIL_FROM.trim();
    if (!key || !from) {
      throw new Error("otp_email_not_configured");
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [destination],
        subject: "Your VUUSH sign-in code",
        text: `Your VUUSH sign-in code is ${code}.\n\nIt expires in a few minutes. If you did not request this, ignore this email.`,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[vuush-otp] resend_failed status=${res.status} body=${body.slice(0, 200)}`,
      );
      throw new Error("otp_delivery_failed");
    }
    console.info(`[vuush-otp] email_sent destination=${destination}`);
    return;
  }

  if (provider === "console" && isDev()) {
    console.info(
      `[vuush-otp] DEV email destination=${destination} code=${code}`,
    );
    return;
  }

  throw new Error("otp_email_not_configured");
}

async function deliverSmsOtp(destination: string, code: string) {
  if (isDev()) {
    console.info(
      `[vuush-otp] DEV sms destination=${destination} code=${code}`,
    );
    return;
  }
  throw new Error("otp_sms_not_configured");
}
