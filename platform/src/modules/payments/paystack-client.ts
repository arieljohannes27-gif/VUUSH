import { env } from "../../config.js";

const PAYSTACK_BASE = "https://api.paystack.co";

export type PaystackApiResult<T> = {
  status: boolean;
  message: string;
  data: T;
};

export function assertPaystackConfigured(): string {
  const key = env.PAYSTACK_SECRET_KEY?.trim() ?? "";
  if (!key) {
    throw new Error("paystack_secret_key_missing");
  }
  if (key.startsWith("sk_live") && !env.PAYSTACK_LIVE_ENABLED) {
    throw new Error("paystack_live_disabled");
  }
  if (!key.startsWith("sk_test") && !key.startsWith("sk_live")) {
    throw new Error("paystack_secret_key_invalid");
  }
  return key;
}

export async function paystackRequest<T>(
  path: string,
  init: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    idempotencyKey?: string;
  } = {},
): Promise<PaystackApiResult<T>> {
  const secret = assertPaystackConfigured();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    Accept: "application/json",
  };
  if (init.body) headers["Content-Type"] = "application/json";
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const json = (await res.json()) as PaystackApiResult<T>;
  if (!res.ok || json.status !== true) {
    const msg = json?.message ?? `paystack_http_${res.status}`;
    throw new Error(`paystack_api_error:${msg}`);
  }
  return json;
}
