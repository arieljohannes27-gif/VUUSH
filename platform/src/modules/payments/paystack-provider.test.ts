import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "sk_test_unit_fixture_key_not_real";

describe("PaystackProvider", () => {
  beforeEach(() => {
    vi.stubEnv("PSP_PROVIDER", "paystack");
    vi.stubEnv("PAYSTACK_SECRET_KEY", SECRET);
    vi.stubEnv("PAYSTACK_PUBLIC_KEY", "pk_test_unit");
    vi.stubEnv("PAYSTACK_LIVE_ENABLED", "false");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadProvider() {
    const { PaystackProvider } = await import("./paystack-provider.js");
    return new PaystackProvider();
  }

  it("charges an authorization code and captures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: true,
          message: "Charge attempted",
          data: {
            id: 101,
            status: "success",
            reference: "job-confirm-ref-1",
            amount: 5000,
            currency: "ZAR",
            authorization: { authorization_code: "AUTH_abc" },
          },
        }),
      })),
    );

    const psp = await loadProvider();
    const result = await psp.createPayment({
      amountCents: 5000,
      currency: "ZAR",
      jobId: "job-1",
      payerUserId: "user-1",
      payerEmail: "payer@vuush.local",
      idempotencyKey: "job_confirm:job-1:quote-1",
      methodRef: "AUTH_abc",
    });

    expect(result.status).toBe("captured");
    expect(result.providerPaymentId).toBe("job-confirm-ref-1");
    expect(result.providerMethodRef).toBe("AUTH_abc");
    expect(JSON.stringify(result)).not.toMatch(/pan|cvv|card_number/i);
  });

  it("verifies a transaction reference", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: true,
          message: "Verification successful",
          data: {
            id: 202,
            status: "success",
            reference: "psk_ref_xyz",
            amount: 1200,
            currency: "ZAR",
            authorization: { authorization_code: "AUTH_saved" },
          },
        }),
      })),
    );

    const psp = await loadProvider();
    const result = await psp.createPayment({
      amountCents: 1200,
      currency: "ZAR",
      jobId: "job-2",
      payerUserId: "user-1",
      payerEmail: "payer@vuush.local",
      idempotencyKey: "k2",
      methodRef: "psk_ref_xyz",
    });

    expect(result.status).toBe("captured");
    expect(result.providerMethodRef).toBe("AUTH_saved");
  });

  it("rejects non-ZAR and missing method refs without calling Paystack", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const psp = await loadProvider();

    const currency = await psp.createPayment({
      amountCents: 100,
      currency: "USD",
      jobId: "j",
      payerUserId: "u",
      payerEmail: "a@b.c",
      idempotencyKey: "k",
      methodRef: "AUTH_x",
    });
    expect(currency.status).toBe("failed");
    expect(currency.failureCode).toBe("currency_not_supported");

    const missing = await psp.createPayment({
      amountCents: 100,
      currency: "ZAR",
      jobId: "j",
      payerUserId: "u",
      payerEmail: "a@b.c",
      idempotencyKey: "k2",
      methodRef: "tok_dev",
    });
    expect(missing.failureCode).toBe("paystack_method_ref_required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses and verifies webhook signatures", async () => {
    const psp = await loadProvider();
    const body = {
      event: "charge.success",
      data: { id: 909, reference: "psk_ref_wh", status: "success" },
    };
    const raw = JSON.stringify(body);
    const signature = createHmac("sha512", SECRET).update(raw).digest("hex");

    const parsed = psp.parseWebhook(raw, {
      "x-paystack-signature": signature,
    });
    expect(parsed.eventType).toBe("charge.success");
    expect(parsed.status).toBe("captured");
    expect(parsed.providerPaymentId).toBe("psk_ref_wh");
    expect(parsed.providerEventId).toBe("charge.success:909");

    expect(() =>
      psp.parseWebhook(raw, { "x-paystack-signature": "deadbeef" }),
    ).toThrow(/signature_invalid/);
  });
});
