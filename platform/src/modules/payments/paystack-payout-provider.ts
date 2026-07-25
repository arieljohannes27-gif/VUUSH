import { paystackRequest } from "./paystack-client.js";
import type {
  CreateTransferInput,
  CreateTransferResult,
  PayoutProvider,
} from "./payout-provider.js";

type TransferData = {
  id: number;
  transfer_code: string;
  status: string;
  reference?: string;
};

function mapTransferStatus(status: string): CreateTransferResult["status"] {
  const s = status.toLowerCase();
  if (s === "success" || s === "successful" || s === "received") return "paid";
  if (s === "failed" || s === "reversed" || s === "rejected") return "failed";
  // pending / otp / queued — in flight; do not mark earnings paid yet
  return "processing";
}

/**
 * Paystack Transfers (ZAR / BASA recipients). Uses recipient codes only.
 */
export class PaystackPayoutProvider implements PayoutProvider {
  readonly name = "paystack";

  async createTransfer(input: CreateTransferInput): Promise<CreateTransferResult> {
    if (input.currency.toUpperCase() !== "ZAR") {
      return {
        providerTransferId: `psk_tr_reject_${input.idempotencyKey}`,
        status: "failed",
        failureCode: "currency_not_supported",
      };
    }
    if (!input.recipientCode.startsWith("RCP_")) {
      return {
        providerTransferId: `psk_tr_norecip_${input.idempotencyKey}`,
        status: "failed",
        failureCode: "recipient_required",
      };
    }

    const reference = input.idempotencyKey
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, "-")
      .slice(0, 80);

    try {
      const res = await paystackRequest<TransferData>("/transfer", {
        method: "POST",
        body: {
          source: "balance",
          amount: input.amountCents,
          currency: "ZAR",
          recipient: input.recipientCode,
          reference,
          reason: input.reason ?? "VUUSH driver payout",
        },
        idempotencyKey: input.idempotencyKey,
      });

      const status = mapTransferStatus(res.data.status);
      return {
        providerTransferId: res.data.transfer_code || String(res.data.id),
        status,
        failureCode: status === "failed" ? `transfer_${res.data.status}` : undefined,
        raw: res.data as unknown as Record<string, unknown>,
      };
    } catch (err) {
      return {
        providerTransferId: `psk_tr_err_${reference}`,
        status: "failed",
        failureCode: err instanceof Error ? err.message : "transfer_failed",
      };
    }
  }
}
