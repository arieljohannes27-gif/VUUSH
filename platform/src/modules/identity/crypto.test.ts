import { describe, expect, it } from "vitest";
import {
  generateTotpSecret,
  hashSecret,
  safeEqual,
  verifyTotp,
} from "./crypto.js";
import { createHmac } from "node:crypto";
import { base32Decode } from "./crypto.js";

function currentTotp(secretBase32: string): string {
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

describe("identity crypto", () => {
  it("hashes secrets stably", () => {
    expect(hashSecret("123456")).toEqual(hashSecret("123456"));
    expect(hashSecret("123456")).not.toEqual(hashSecret("000000"));
  });

  it("safeEqual works", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });

  it("verifies totp for current window", () => {
    const secret = generateTotpSecret();
    const token = currentTotp(secret);
    expect(verifyTotp(secret, token)).toBe(true);
    expect(verifyTotp(secret, "000000")).toBe(false);
  });
});
