import { DevStubProvider } from "./dev-stub-provider.js";
import { DevStubPayoutProvider } from "./dev-stub-payout-provider.js";
import { PaystackProvider } from "./paystack-provider.js";
import { PaystackPayoutProvider } from "./paystack-payout-provider.js";
import type { PaymentProvider } from "./provider.js";
import type { PayoutProvider } from "./payout-provider.js";
import { env } from "../../config.js";

export function getPaymentProvider(): PaymentProvider {
  switch (env.PSP_PROVIDER) {
    case "dev_stub":
      return new DevStubProvider();
    case "paystack":
      return new PaystackProvider();
    default:
      throw new Error(`unsupported_psp_provider:${env.PSP_PROVIDER}`);
  }
}

export function getPaystackProvider(): PaystackProvider {
  const provider = getPaymentProvider();
  if (!(provider instanceof PaystackProvider)) {
    throw new Error("paystack_provider_required");
  }
  return provider;
}

/** Payout rail follows the same PSP_PROVIDER switch (shared or stub). */
export function getPayoutProvider(): PayoutProvider {
  switch (env.PSP_PROVIDER) {
    case "paystack":
      return new PaystackPayoutProvider();
    case "dev_stub":
    default:
      return new DevStubPayoutProvider();
  }
}
