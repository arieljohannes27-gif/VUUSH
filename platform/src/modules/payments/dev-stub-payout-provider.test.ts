import { describe, expect, it } from "vitest";
import { DevStubPayoutProvider } from "./dev-stub-payout-provider.js";

describe("DevStubPayoutProvider", () => {
  const psp = new DevStubPayoutProvider();

  it("pays a default transfer without bank account fields", async () => {
    const result = await psp.createTransfer({
      amountCents: 7500,
      currency: "ZAR",
      driverUserId: "driver-1",
      recipientCode: "rcp_dev_abc",
      idempotencyKey: "payout:item-1",
    });
    expect(result.status).toBe("paid");
    expect(result.providerTransferId).toMatch(/^dev_tr_/);
    expect(JSON.stringify(result)).not.toMatch(/account_number|iban|pan/i);
  });

  it("declines rcp_fail without marking success", async () => {
    const result = await psp.createTransfer({
      amountCents: 100,
      currency: "ZAR",
      driverUserId: "driver-1",
      recipientCode: "rcp_fail",
      idempotencyKey: "payout:item-2",
    });
    expect(result.status).toBe("failed");
    expect(result.failureCode).toBe("transfer_declined_stub");
  });
});
