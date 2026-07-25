import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { pricingParams } from "../../db/schema.js";

export const DEFAULT_DRIVER_SHARE = 0.75;
export const DRIVER_SHARE_PARAM_KEY = "driver_share";

/** Driver share of quote total (0–1). Admin pricing param; default 75%. */
export async function resolveDriverShare(): Promise<number> {
  const row = await db.query.pricingParams.findFirst({
    where: eq(pricingParams.key, DRIVER_SHARE_PARAM_KEY),
  });
  const raw = row?.valueJson?.share;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1) return DEFAULT_DRIVER_SHARE;
  return n;
}
