import { describe, expect, it } from "vitest";
import { evaluatePassword } from "./password-policy.js";
import { humanAuthError } from "./messages.js";

describe("password policy", () => {
  it("rejects short passwords", () => {
    expect(evaluatePassword("Ab1!short").ok).toBe(false);
    expect(evaluatePassword("Ab1!short").code).toBe("password_too_short");
  });

  it("rejects weak long passwords", () => {
    expect(evaluatePassword("abcdefghijkl").ok).toBe(false);
    expect(evaluatePassword("ABCDEFGHIJKL1").ok).toBe(false);
  });

  it("accepts strong passwords", () => {
    const r = evaluatePassword("CorrectHorse1!");
    expect(r.ok).toBe(true);
    expect(r.score).toBe(4);
  });
});

describe("humanAuthError", () => {
  it("maps known codes", () => {
    expect(humanAuthError("invalid_credentials")).toMatch(/Incorrect/i);
  });

  it("never returns snake_case for unknown codes", () => {
    expect(humanAuthError("some_weird_error")).not.toContain("_");
  });
});
