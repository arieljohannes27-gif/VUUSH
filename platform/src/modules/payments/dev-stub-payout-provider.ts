import { randomBytes } from "node:crypto";
import type {
  CreateTransferInput,
  CreateTransferResult,
  PayoutProvider,
} from "./payout-provider.js";

/**
 * Local payout stand-in with deliberate failure modes.
 * recipientCode `rcp_fail` → failed (earnings must not become paid).
 */
export class DevStubPayoutProvider implements PayoutProvider {
  readonly name = "dev_stub";

  async createTransfer(input: CreateTransferInput): Promise<CreateTransferResult> {
    if (
      input.recipientCode === "rcp_fail" ||
      input.recipientCode.endsWith("_fail")
    ) {
      return {
        providerTransferId: `dev_tr_fail_${randomBytes(4).toString("hex")}`,
        status: "failed",
        failureCode: "transfer_declined_stub",
      };
    }
    if (input.currency.toUpperCase() !== "ZAR") {
      return {
        providerTransferId: `dev_tr_badcur_${randomBytes(3).toString("hex")}`,
        status: "failed",
        failureCode: "currency_not_supported",
      };
    }
    return {
      providerTransferId: `dev_tr_${randomBytes(6).toString("hex")}`,
      status: "paid",
      raw: { mode: "dev_stub", driverUserId: input.driverUserId },
    };
  }
}
