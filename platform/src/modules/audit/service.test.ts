import { describe, expect, it } from "vitest";
import { z } from "zod";

/** Unit-level guard: audit payload shape stays JSON-safe for PR25. */
const auditPayloadSchema = z.record(z.unknown());

describe("audit payload contract", () => {
  it("accepts structured JSON objects", () => {
    const result = auditPayloadSchema.safeParse({
      source: "m0_probe",
      jobId: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-objects", () => {
    expect(auditPayloadSchema.safeParse("nope").success).toBe(false);
  });
});
