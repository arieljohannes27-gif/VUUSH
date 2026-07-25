export type CreatePaymentInput = {
  amountCents: number;
  currency: string;
  jobId: string;
  payerUserId: string;
  /** Required for Paystack charge / initialize. */
  payerEmail?: string;
  idempotencyKey: string;
  /**
   * Tokenized method ref from PSP — never a PAN.
   * Paystack: `AUTH_…` authorization code, or a transaction reference to verify.
   */
  methodRef?: string;
};

export type CreatePaymentResult = {
  providerPaymentId: string;
  status: "requires_action" | "processing" | "captured" | "failed";
  providerMethodRef?: string;
  failureCode?: string;
  raw?: Record<string, unknown>;
};

export type RefundInput = {
  providerPaymentId: string;
  amountCents: number;
  reasonCode: string;
  idempotencyKey: string;
};

export type RefundResult = {
  providerRefundId: string;
  status: "succeeded" | "failed";
  failureCode?: string;
};

export type ParsedWebhookEvent = {
  providerEventId: string;
  eventType: string;
  providerPaymentId?: string;
  status?: string;
  payload: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  refund(input: RefundInput): Promise<RefundResult>;
  parseWebhook(
    rawBody: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): ParsedWebhookEvent;
}
