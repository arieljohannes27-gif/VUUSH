import { describe, expect, it } from "vitest";
import { DevStubProvider } from "./dev-stub-provider.js";

describe("DevStubProvider", () => {
  const psp = new DevStubProvider();

  it("captures a default payment without PAN fields", async () => {
    const result = await psp.createPayment({
      amountCents: 5000,
      currency: "ZAR",
      jobId: "job-1",
      payerUserId: "user-1",
      idempotencyKey: "k1",
      methodRef: "tok_dev",
    });
    expect(result.status).toBe("captured");
    expect(result.providerPaymentId).toMatch(/^dev_pay_/);
    expect(JSON.stringify(result)).not.toMatch(/pan|cvv|card_number/i);
  });

  it("declines tok_fail", async () => {
    const result = await psp.createPayment({
      amountCents: 100,
      currency: "ZAR",
      jobId: "job-2",
      payerUserId: "user-1",
      idempotencyKey: "k2",
      methodRef: "tok_fail",
    });
    expect(result.status).toBe("failed");
    expect(result.failureCode).toBe("card_declined_stub");
  });

  it("parses webhook event ids stably", () => {
    const a = psp.parseWebhook(
      { eventId: "evt_1", type: "payment.updated", status: "captured" },
      {},
    );
    const b = psp.parseWebhook(
      { eventId: "evt_1", type: "payment.updated", status: "captured" },
      {},
    );
    expect(a.providerEventId).toBe("evt_1");
    expect(b.providerEventId).toBe(a.providerEventId);
  });
});
