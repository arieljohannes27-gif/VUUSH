import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config.js";
import { assertPaystackConfigured, paystackRequest } from "./paystack-client.js";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  ParsedWebhookEvent,
  PaymentProvider,
  RefundInput,
  RefundResult,
} from "./provider.js";

type ChargeAuthData = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  authorization?: { authorization_code?: string };
};

type VerifyData = ChargeAuthData & {
  gateway_response?: string;
};

type RefundData = {
  id: number;
  status: string;
  transaction?: { reference?: string };
};

type InitializeData = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

function isAuthorizationCode(methodRef: string): boolean {
  return methodRef.startsWith("AUTH_") || methodRef.startsWith("authorization:");
}

function authorizationCodeFrom(methodRef: string): string {
  if (methodRef.startsWith("authorization:")) {
    return methodRef.slice("authorization:".length);
  }
  return methodRef;
}

function mapChargeStatus(status: string): CreatePaymentResult["status"] {
  const s = status.toLowerCase();
  if (s === "success" || s === "successful") return "captured";
  if (s === "failed" || s === "reversed") return "failed";
  if (s === "abandoned" || s === "ongoing" || s === "pending") return "processing";
  return "processing";
}

/**
 * Paystack SA adapter (ZAR beachhead). Never accepts or stores card PANs.
 * methodRef = AUTH_* → charge_authorization; else → verify transaction reference.
 */
export class PaystackProvider implements PaymentProvider {
  readonly name = "paystack";

  constructor() {
    assertPaystackConfigured();
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (input.currency.toUpperCase() !== "ZAR") {
      return {
        providerPaymentId: `psk_reject_${input.idempotencyKey}`,
        status: "failed",
        failureCode: "currency_not_supported",
      };
    }

    const methodRef = input.methodRef?.trim() ?? "";
    if (!methodRef || methodRef === "tok_dev") {
      return {
        providerPaymentId: `psk_need_ref_${input.idempotencyKey}`,
        status: "failed",
        failureCode: "paystack_method_ref_required",
      };
    }
    if (methodRef === "tok_fail") {
      return {
        providerPaymentId: `psk_fail_${input.idempotencyKey}`,
        status: "failed",
        failureCode: "card_declined_stub",
      };
    }

    const email = input.payerEmail?.trim();
    if (!email) {
      return {
        providerPaymentId: `psk_no_email_${input.idempotencyKey}`,
        status: "failed",
        failureCode: "payer_email_required",
      };
    }

    if (isAuthorizationCode(methodRef)) {
      return this.chargeAuthorization({
        authorizationCode: authorizationCodeFrom(methodRef),
        email,
        amountCents: input.amountCents,
        currency: "ZAR",
        reference: this.safeReference(input.idempotencyKey),
        jobId: input.jobId,
      });
    }

    return this.verifyReference({
      reference: methodRef,
      expectedAmountCents: input.amountCents,
      expectedCurrency: "ZAR",
    });
  }

  async initializeCheckout(input: {
    amountCents: number;
    currency: string;
    email: string;
    jobId: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    reference: string;
    authorizationUrl: string;
    accessCode: string;
    publicKey: string;
  }> {
    if (input.currency.toUpperCase() !== "ZAR") {
      throw new Error("currency_not_supported");
    }
    const reference = this.safeReference(input.idempotencyKey);
    const body: Record<string, unknown> = {
      email: input.email,
      amount: input.amountCents,
      currency: "ZAR",
      reference,
      metadata: {
        jobId: input.jobId,
        ...(input.metadata ?? {}),
      },
    };
    if (env.PAYSTACK_CALLBACK_URL) {
      body.callback_url = env.PAYSTACK_CALLBACK_URL;
    }

    const res = await paystackRequest<InitializeData>("/transaction/initialize", {
      method: "POST",
      body,
      idempotencyKey: input.idempotencyKey,
    });

    return {
      reference: res.data.reference,
      authorizationUrl: res.data.authorization_url,
      accessCode: res.data.access_code,
      publicKey: env.PAYSTACK_PUBLIC_KEY,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    try {
      const res = await paystackRequest<RefundData>("/refund", {
        method: "POST",
        body: {
          transaction: input.providerPaymentId,
          amount: input.amountCents,
          merchant_note: input.reasonCode,
        },
        idempotencyKey: input.idempotencyKey,
      });
      const ok =
        res.data.status === "processed" ||
        res.data.status === "pending" ||
        res.data.status === "processing";
      return {
        providerRefundId: String(res.data.id),
        status: ok ? "succeeded" : "failed",
        failureCode: ok ? undefined : `refund_${res.data.status}`,
      };
    } catch (err) {
      return {
        providerRefundId: `psk_ref_fail_${Date.now()}`,
        status: "failed",
        failureCode: err instanceof Error ? err.message : "refund_failed",
      };
    }
  }

  parseWebhook(
    rawBody: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): ParsedWebhookEvent {
    const secret = assertPaystackConfigured();
    const signature = headerValue(headers, "x-paystack-signature");
    if (!signature) {
      throw new Error("paystack_webhook_signature_missing");
    }

    const raw =
      typeof rawBody === "string"
        ? rawBody
        : JSON.stringify(rawBody ?? {});
    const expected = createHmac("sha512", secret).update(raw).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("paystack_webhook_signature_invalid");
    }

    const body =
      typeof rawBody === "string"
        ? (JSON.parse(rawBody) as Record<string, unknown>)
        : ((rawBody ?? {}) as Record<string, unknown>);

    const eventType = String(body.event ?? "unknown");
    const data = (body.data ?? {}) as Record<string, unknown>;
    const providerPaymentId = data.reference
      ? String(data.reference)
      : undefined;
    const dataId = data.id != null ? String(data.id) : "";
    const providerEventId =
      dataId.length > 0
        ? `${eventType}:${dataId}`
        : createHmac("sha256", secret).update(raw).digest("hex");

    let status: string | undefined;
    if (eventType === "charge.success") status = "captured";
    else if (eventType === "charge.failed") status = "failed";
    else if (typeof data.status === "string") {
      status = mapChargeStatus(data.status);
    }

    return {
      providerEventId,
      eventType,
      providerPaymentId,
      status,
      payload: body,
    };
  }

  private async chargeAuthorization(input: {
    authorizationCode: string;
    email: string;
    amountCents: number;
    currency: string;
    reference: string;
    jobId: string;
  }): Promise<CreatePaymentResult> {
    try {
      const res = await paystackRequest<ChargeAuthData>(
        "/transaction/charge_authorization",
        {
          method: "POST",
          body: {
            authorization_code: input.authorizationCode,
            email: input.email,
            amount: input.amountCents,
            currency: input.currency,
            reference: input.reference,
            metadata: { jobId: input.jobId },
          },
          idempotencyKey: input.reference,
        },
      );
      const status = mapChargeStatus(res.data.status);
      return {
        providerPaymentId: res.data.reference,
        status,
        providerMethodRef:
          res.data.authorization?.authorization_code ?? input.authorizationCode,
        failureCode: status === "failed" ? "charge_failed" : undefined,
        raw: res.data as unknown as Record<string, unknown>,
      };
    } catch (err) {
      return {
        providerPaymentId: input.reference,
        status: "failed",
        failureCode: err instanceof Error ? err.message : "charge_failed",
      };
    }
  }

  private async verifyReference(input: {
    reference: string;
    expectedAmountCents: number;
    expectedCurrency: string;
  }): Promise<CreatePaymentResult> {
    try {
      const res = await paystackRequest<VerifyData>(
        `/transaction/verify/${encodeURIComponent(input.reference)}`,
      );
      const status = mapChargeStatus(res.data.status);
      if (status === "captured") {
        if (res.data.amount !== input.expectedAmountCents) {
          return {
            providerPaymentId: res.data.reference,
            status: "failed",
            failureCode: "amount_mismatch",
            raw: res.data as unknown as Record<string, unknown>,
          };
        }
        if (res.data.currency.toUpperCase() !== input.expectedCurrency) {
          return {
            providerPaymentId: res.data.reference,
            status: "failed",
            failureCode: "currency_mismatch",
            raw: res.data as unknown as Record<string, unknown>,
          };
        }
      }
      return {
        providerPaymentId: res.data.reference,
        status,
        providerMethodRef: res.data.authorization?.authorization_code,
        failureCode:
          status === "failed"
            ? res.data.gateway_response ?? "verify_failed"
            : undefined,
        raw: res.data as unknown as Record<string, unknown>,
      };
    } catch (err) {
      return {
        providerPaymentId: input.reference,
        status: "failed",
        failureCode: err instanceof Error ? err.message : "verify_failed",
      };
    }
  }

  /** Paystack references: alphanumeric, `-`, `.`, `=` only. */
  private safeReference(key: string): string {
    const cleaned = key.replace(/[^a-zA-Z0-9\-.=]/g, "-").slice(0, 80);
    return cleaned.length > 0 ? cleaned : `vuush-${Date.now()}`;
  }
}
