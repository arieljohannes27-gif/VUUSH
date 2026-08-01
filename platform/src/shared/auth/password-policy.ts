/**
 * Shared password policy for all VUUSH apps.
 * Enforced on signup, reset, and change — not on legacy login.
 */

export const PASSWORD_MIN_LENGTH = 12;

const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /[0-9]/;
const SPECIAL = /[^A-Za-z0-9]/;

export type PasswordCheck = {
  ok: boolean;
  code?: string;
  score: 0 | 1 | 2 | 3 | 4;
  checks: {
    length: boolean;
    upper: boolean;
    lower: boolean;
    digit: boolean;
    special: boolean;
  };
};

export function evaluatePassword(password: string): PasswordCheck {
  const checks = {
    length: password.length >= PASSWORD_MIN_LENGTH,
    upper: UPPER.test(password),
    lower: LOWER.test(password),
    digit: DIGIT.test(password),
    special: SPECIAL.test(password),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const score = Math.min(4, passed) as 0 | 1 | 2 | 3 | 4;
  if (!checks.length) {
    return { ok: false, code: "password_too_short", score, checks };
  }
  if (!checks.upper || !checks.lower || !checks.digit || !checks.special) {
    return { ok: false, code: "password_too_weak", score, checks };
  }
  return { ok: true, score, checks };
}

export function assertPasswordPolicy(password: string): void {
  const result = evaluatePassword(password);
  if (!result.ok) {
    throw new Error(result.code ?? "password_too_weak");
  }
}

export function passwordStrengthLabel(score: number): string {
  if (score <= 1) return "Weak";
  if (score === 2) return "Fair";
  if (score === 3) return "Good";
  return "Strong";
}
