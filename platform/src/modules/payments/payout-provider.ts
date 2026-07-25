export type CreateTransferInput = {
  amountCents: number;
  currency: string;
  driverUserId: string;
  /** Paystack RCP_… or stub rcp_* — never account numbers. */
  recipientCode: string;
  idempotencyKey: string;
  reason?: string;
};

export type CreateTransferResult = {
  providerTransferId: string;
  /** pending→processing→paid|failed */
  status: "processing" | "paid" | "failed";
  failureCode?: string;
  raw?: Record<string, unknown>;
};

export interface PayoutProvider {
  readonly name: string;
  createTransfer(input: CreateTransferInput): Promise<CreateTransferResult>;
}
