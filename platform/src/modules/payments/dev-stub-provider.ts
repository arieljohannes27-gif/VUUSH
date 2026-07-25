import { createHash, randomBytes } from "node:crypto";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  ParsedWebhookEvent,
  PaymentProvider,
  RefundInput,
  RefundResult,
} from "./provider.js";

/**
 * Local PSP stand-in. Never handles card PANs.
 * Swap via PSP_PROVIDER when a real adapter is approved in Atlas.
 */
export class DevStubProvider implements PaymentProvider {
  readonly name = "dev_stub";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (input.methodRef === "tok_fail") {
      return {
        providerPaymentId: `dev_pay_fail_${randomBytes(4).toString("hex")}`,
        status: "failed",
        failureCode: "card_declined_stub",
      };
    }
    return {
      providerPaymentId: `dev_pay_${randomBytes(6).toString("hex")}`,
      status: "captured",
      providerMethodRef: input.methodRef ?? "tok_dev_default",
      raw: { mode: "dev_stub", jobId: input.jobId },
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      providerRefundId: `dev_ref_${randomBytes(6).toString("hex")}`,
      status: "succeeded",
      failureCode: undefined,
    };
  }

  parseWebhook(
    rawBody: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): ParsedWebhookEvent {
    const body = (rawBody ?? {}) as Record<string, unknown>;
    const providerEventId =
      String(body.eventId ?? body.id ?? "") ||
      createHash("sha256").update(JSON.stringify(body)).digest("hex");
    return {
      providerEventId,
      eventType: String(body.type ?? "payment.updated"),
      providerPaymentId: body.providerPaymentId
        ? String(body.providerPaymentId)
        : undefined,
      status: body.status ? String(body.status) : undefined,
      payload: body,
    };
  }
}
