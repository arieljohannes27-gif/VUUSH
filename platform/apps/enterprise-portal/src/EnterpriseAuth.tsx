import { useState } from "react";
import {
  completeEnterpriseRegister,
  loginWithPassword,
  startEnterpriseRegister,
  type OrgMembership,
  type SessionUser,
} from "./api";

function humanAuthError(code: string) {
  const map: Record<string, string> = {
    invalid_credentials: "Wrong email or password.",
    user_inactive: "This account is inactive.",
    no_org_membership: "This account is not linked to a company yet.",
    org_not_active: "Your company account is still under review.",
    email_taken: "That email already has an account. Sign in instead.",
    org_name_taken: "That company name is already registered.",
    passwords_do_not_match: "Passwords do not match.",
    password_too_short: "Password must be at least 8 characters.",
    invalid_code: "That email code is wrong or expired.",
    challenge_invalid_or_expired: "That email code expired. Start again.",
    otp_delivery_failed: "Could not send the email code. Try again.",
    otp_email_not_configured:
      "Email sign-up is not configured on the server yet.",
    validation_error: "Please check the form and try again.",
    mfa_required: "Use the Admin or Dispatch portal for staff sign-in.",
    mfa_enroll_required: "Use the Admin or Dispatch portal for staff sign-in.",
    company_doc_invalid: "Upload a PDF or image for the company document.",
  };
  if (map[code]) return map[code];
  if (code.startsWith("mfa_")) {
    return "Use the Admin or Dispatch portal for staff sign-in.";
  }
  return code.replaceAll("_", " ");
}

async function readFileAsDataUrl(file: File | null) {
  if (!file) return "";
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("company_doc_invalid"));
    reader.readAsDataURL(file);
  });
}

export function EnterpriseAuth({
  onAuthed,
}: {
  onAuthed: (token: string, orgId: string | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [signupStep, setSignupStep] = useState<1 | 2 | 3 | 4>(1);
  const [signup, setSignup] = useState({
    companyName: "",
    displayName: "",
    email: "",
    password: "",
    confirm: "",
    billingEmail: "",
    billingContactName: "",
    payMode: "statement" as "statement" | "card",
    registrationNumber: "",
    vatNumber: "",
    companyDocUrl: "",
  });
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "request_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="bar">
        <div className="lockup">
          <span className="mark" aria-hidden="true" />
          <span className="word">VUUSH</span>
        </div>
        <span className="meta">Enterprise</span>
      </header>
      <main className="auth">
        <p className="brand">VUUSH</p>
        <h1>{authMode === "signup" ? "Create company" : "Sign in"}</h1>
        <p className="lede">
          {authMode === "signup"
            ? "Business access — email, password, and company details. No authenticator."
            : "Business customers sign in with work email and password."}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Auth mode">
          <button
            type="button"
            className={authMode === "signin" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setAuthMode("signin");
              setError(null);
              setPendingReview(false);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={authMode === "signup" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setAuthMode("signup");
              setSignupStep(1);
              setChallengeId(null);
              setOtp("");
              setDevCode(null);
              setError(null);
              setPendingReview(false);
            }}
          >
            Register
          </button>
        </div>

        {pendingReview ? (
          <div className="stack">
            <p className="lede">
              Thanks — your company is waiting for VUUSH Admin approval. You can
              sign in with your email and password after it is approved.
            </p>
            <button
              type="button"
              className="cta"
              onClick={() => {
                setPendingReview(false);
                setAuthMode("signin");
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : null}

        {authMode === "signin" && !pendingReview ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const res = await loginWithPassword(email.trim(), password);
                if (
                  res.status !== "authenticated" ||
                  !res.session?.accessToken
                ) {
                  throw new Error(res.status || "auth_failed");
                }
                await onAuthed(res.session.accessToken, null);
              });
            }}
          >
            <label className="label" htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              className="field"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="field"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            {error ? <p className="error">{humanAuthError(error)}</p> : null}
            <button className="cta" type="submit" disabled={busy}>
              Sign in
            </button>
          </form>
        ) : null}

        {authMode === "signup" && !pendingReview ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (signupStep === 1) {
                  const res = await startEnterpriseRegister({
                    companyName: signup.companyName.trim(),
                    displayName: signup.displayName.trim(),
                    email: signup.email.trim(),
                  });
                  setChallengeId(res.challengeId);
                  setDevCode(res.devCode ?? null);
                  if (res.devCode) setOtp(res.devCode);
                  setSignupStep(2);
                  return;
                }
                if (signupStep === 2) {
                  if (!challengeId) {
                    throw new Error("challenge_invalid_or_expired");
                  }
                  if (signup.password !== signup.confirm) {
                    throw new Error("passwords_do_not_match");
                  }
                  setSignupStep(3);
                  return;
                }
                if (signupStep === 3) {
                  setSignupStep(4);
                  return;
                }
                if (!challengeId) {
                  throw new Error("challenge_invalid_or_expired");
                }
                const res = await completeEnterpriseRegister({
                  challengeId,
                  code: otp.trim(),
                  companyName: signup.companyName.trim(),
                  displayName: signup.displayName.trim(),
                  email: signup.email.trim(),
                  password: signup.password,
                  billingEmail:
                    signup.billingEmail.trim() || signup.email.trim(),
                  billingContactName:
                    signup.billingContactName.trim() ||
                    signup.displayName.trim(),
                  payMode: signup.payMode,
                  registrationNumber:
                    signup.registrationNumber.trim() || undefined,
                  vatNumber: signup.vatNumber.trim() || undefined,
                  companyDocUrl: signup.companyDocUrl || undefined,
                });
                if (res.status === "pending_review") {
                  setPendingReview(true);
                  setAuthMode("signin");
                  return;
                }
                if (
                  res.status !== "authenticated" ||
                  !res.session?.accessToken
                ) {
                  throw new Error(res.status || "auth_failed");
                }
                await onAuthed(res.session.accessToken, res.org.id);
              });
            }}
          >
            <p className="meta">Step {signupStep} of 4</p>

            {signupStep === 1 ? (
              <>
                <label className="label" htmlFor="company">
                  Company name
                </label>
                <input
                  id="company"
                  className="field"
                  value={signup.companyName}
                  onChange={(e) =>
                    setSignup((s) => ({ ...s, companyName: e.target.value }))
                  }
                  required
                  minLength={2}
                />
                <label className="label" htmlFor="display">
                  Your name
                </label>
                <input
                  id="display"
                  className="field"
                  value={signup.displayName}
                  onChange={(e) =>
                    setSignup((s) => ({ ...s, displayName: e.target.value }))
                  }
                  required
                  minLength={2}
                />
                <label className="label" htmlFor="signup-email">
                  Work email
                </label>
                <input
                  id="signup-email"
                  className="field"
                  type="email"
                  autoComplete="email"
                  value={signup.email}
                  onChange={(e) =>
                    setSignup((s) => ({ ...s, email: e.target.value }))
                  }
                  required
                />
              </>
            ) : null}

            {signupStep === 2 ? (
              <>
                <p className="lede">
                  We sent a one-time code to verify your email. Then choose a
                  password.
                </p>
                <label className="label" htmlFor="otp">
                  Email code
                </label>
                <input
                  id="otp"
                  className="field"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  autoComplete="one-time-code"
                />
                {devCode ? <p className="meta">Dev code: {devCode}</p> : null}
                <label className="label" htmlFor="signup-password">
                  Password (min 8)
                </label>
                <input
                  id="signup-password"
                  className="field"
                  type="password"
                  autoComplete="new-password"
                  value={signup.password}
                  onChange={(e) =>
                    setSignup((s) => ({ ...s, password: e.target.value }))
                  }
                  required
                  minLength={8}
                />
                <label className="label" htmlFor="signup-confirm">
                  Confirm password
                </label>
                <input
                  id="signup-confirm"
                  className="field"
                  type="password"
                  autoComplete="new-password"
                  value={signup.confirm}
                  onChange={(e) =>
                    setSignup((s) => ({ ...s, confirm: e.target.value }))
                  }
                  required
                  minLength={8}
                />
              </>
            ) : null}

            {signupStep === 3 ? (
              <>
                <label className="label" htmlFor="billing-email">
                  Billing email
                </label>
                <input
                  id="billing-email"
                  className="field"
                  type="email"
                  value={signup.billingEmail}
                  onChange={(e) =>
                    setSignup((s) => ({ ...s, billingEmail: e.target.value }))
                  }
                  placeholder={signup.email}
                />
                <label className="label" htmlFor="billing-contact">
                  Billing contact name
                </label>
                <input
                  id="billing-contact"
                  className="field"
                  value={signup.billingContactName}
                  onChange={(e) =>
                    setSignup((s) => ({
                      ...s,
                      billingContactName: e.target.value,
                    }))
                  }
                  placeholder={signup.displayName}
                />
                <label className="label" htmlFor="pay-mode">
                  Payment style
                </label>
                <select
                  id="pay-mode"
                  className="field"
                  value={signup.payMode}
                  onChange={(e) =>
                    setSignup((s) => ({
                      ...s,
                      payMode: e.target.value as "statement" | "card",
                    }))
                  }
                >
                  <option value="statement">Weekly statement</option>
                  <option value="card">Card per job</option>
                </select>
                <label className="label" htmlFor="reg-no">
                  Company registration number (optional)
                </label>
                <input
                  id="reg-no"
                  className="field"
                  value={signup.registrationNumber}
                  onChange={(e) =>
                    setSignup((s) => ({
                      ...s,
                      registrationNumber: e.target.value,
                    }))
                  }
                />
                <label className="label" htmlFor="vat">
                  VAT number (optional)
                </label>
                <input
                  id="vat"
                  className="field"
                  value={signup.vatNumber}
                  onChange={(e) =>
                    setSignup((s) => ({ ...s, vatNumber: e.target.value }))
                  }
                />
              </>
            ) : null}

            {signupStep === 4 ? (
              <>
                <p className="lede">
                  Optional company document (PDF or image). Skip if you do not
                  have it yet.
                </p>
                <label className="label" htmlFor="company-doc">
                  Company document
                </label>
                <input
                  id="company-doc"
                  className="field"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    void readFileAsDataUrl(file)
                      .then((url) =>
                        setSignup((s) => ({ ...s, companyDocUrl: url })),
                      )
                      .catch(() => setError("company_doc_invalid"));
                  }}
                />
              </>
            ) : null}

            {error ? <p className="error">{humanAuthError(error)}</p> : null}
            <button className="cta" type="submit" disabled={busy}>
              {busy
                ? "Working…"
                : signupStep === 1
                  ? "Send email code"
                  : signupStep === 4
                    ? "Create company"
                    : "Continue"}
            </button>
            {signupStep > 1 ? (
              <button
                type="button"
                className="text-link"
                onClick={() =>
                  setSignupStep((s) =>
                    s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s,
                  )
                }
              >
                Back
              </button>
            ) : null}
          </form>
        ) : null}
      </main>
    </div>
  );
}

export type { OrgMembership, SessionUser };
