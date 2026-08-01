/**
 * Canonical auth error → user-facing message.
 * Never show snake_case codes in product UI.
 */

export const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  incorrect_password: "Incorrect email or password.",
  user_inactive: "Your account has been disabled.",
  account_pending: "Your account is awaiting approval.",
  account_rejected: "Your application was not approved.",
  account_suspended: "Your account has been suspended.",
  account_blocked: "Your account has been blocked.",
  account_disabled: "Your account has been disabled.",
  password_too_short: "Password must be at least 12 characters.",
  password_too_weak:
    "Password needs uppercase, lowercase, a number, and a special character.",
  passwords_do_not_match: "Passwords do not match.",
  email_taken: "That email already has an account. Sign in instead.",
  phone_taken: "That phone number already has an account. Sign in instead.",
  org_name_taken: "That company name is already registered.",
  no_org_membership:
    "This account is not linked to a company yet. Contact your VUUSH account manager.",
  org_not_active: "Your company account is not active yet.",
  enterprise_invite_only:
    "Enterprise access is set up after review. Submit an application or contact sales.",
  invalid_code: "That verification code is wrong.",
  challenge_invalid_or_expired:
    "The verification code has expired. Please request a new code.",
  challenge_locked: "Too many attempts. Please request a new code.",
  otp_delivery_failed: "We could not send the verification code. Try again.",
  otp_email_not_configured: "Email verification is not configured yet.",
  otp_sms_not_configured: "SMS verification is not configured yet.",
  mfa_required: "Enter the code from your authenticator app.",
  mfa_enroll_required: "Set up your authenticator app to continue.",
  mfa_ticket_invalid: "That security step expired. Sign in again.",
  mfa_code_invalid: "That authenticator code is wrong. Try again.",
  validation_error: "Please check the form and try again.",
  unauthorized: "Please sign in again.",
  forbidden: "You do not have access to this.",
  not_found: "We could not find that account.",
  rate_limited: "Too many tries. Wait a moment and try again.",
  internal_error: "Something went wrong. Please try again.",
  login_incomplete: "Sign-in did not finish. Please try again.",
  reset_token_invalid: "That reset link is invalid or expired. Request a new one.",
  password_reset_sent:
    "If that account exists, we sent a verification code.",
  company_doc_invalid: "Upload a PDF or image for the company document.",
};

export function humanAuthError(code: string | null | undefined): string {
  if (!code) return AUTH_MESSAGES.internal_error;
  const normalized = code.trim();
  if (AUTH_MESSAGES[normalized]) return AUTH_MESSAGES[normalized];
  if (normalized.startsWith("mfa_")) {
    return "Complete authenticator setup to continue.";
  }
  if (normalized.includes(" ") && !normalized.includes("_")) {
    return normalized;
  }
  return "Something went wrong. Please try again.";
}

/** Map raw user.status to a login error code. */
export function statusToAuthError(status: string): string | null {
  switch (status) {
    case "active":
    case "approved":
      return null;
    case "pending":
    case "pending_review":
      return "account_pending";
    case "rejected":
      return "account_rejected";
    case "suspended":
      return "account_suspended";
    case "blocked":
      return "account_blocked";
    case "disabled":
    case "inactive":
      return "account_disabled";
    default:
      return "user_inactive";
  }
}
