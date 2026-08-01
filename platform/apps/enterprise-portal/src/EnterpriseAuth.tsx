import { useMemo, useState } from "react";
import {
  completeEnterpriseRegister,
  completePasswordReset,
  loginWithPassword,
  startEnterpriseRegister,
  startPasswordReset,
  type OrgMembership,
  type SessionUser,
} from "./api";
import {
  evaluatePassword,
  humanAuthError,
  passwordStrengthLabel,
} from "@vuush/auth";

async function readFileAsDataUrl(file: File | null) {
  if (!file) return "";
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("company_doc_invalid"));
    reader.readAsDataURL(file);
  });
}

type Mode = "signin" | "apply" | "forgot" | "pending";

export function EnterpriseAuth({
  onAuthed,
}: {
  onAuthed: (token: string, orgId: string | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [applyStep, setApplyStep] = useState<1 | 2 | 3>(1);
  const [apply, setApply] = useState({
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
  const [resetChallengeId, setResetChallengeId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");

  const strength = useMemo(
    () => evaluatePassword(mode === "forgot" ? newPassword : apply.password),
    [mode, newPassword, apply.password],
  );

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
        <h1>
          {mode === "apply"
            ? "Apply for Enterprise"
            : mode === "forgot"
              ? "Reset password"
              : mode === "pending"
                ? "Application received"
                : "Sign in"}
        </h1>
        <p className="lede">
          {mode === "apply"
            ? "Submit your company details. VUUSH Admin reviews every application. No authenticator."
            : mode === "forgot"
              ? "We will email a code so you can choose a new password."
              : mode === "pending"
                ? "We will email you when your company is approved. Then sign in with your work email and password."
                : "Contracted organisations sign in with work email and password. No MFA."}
        </p>

        {mode === "signin" || mode === "apply" ? (
          <div className="auth-tabs" role="tablist" aria-label="Auth mode">
            <button
              type="button"
              className={mode === "signin" ? "nav-item active" : "nav-item"}
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "apply" ? "nav-item active" : "nav-item"}
              onClick={() => {
                setMode("apply");
                setApplyStep(1);
                setChallengeId(null);
                setOtp("");
                setDevCode(null);
                setError(null);
              }}
            >
              Apply
            </button>
          </div>
        ) : null}

        {mode === "pending" ? (
          <div className="stack">
            <button
              type="button"
              className="cta"
              onClick={() => setMode("signin")}
            >
              Back to sign in
            </button>
          </div>
        ) : null}

        {mode === "signin" ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const res = await loginWithPassword(email.trim(), password);
                if (
                  res.status === "mfa_required" ||
                  res.status === "mfa_enroll_required"
                ) {
                  throw new Error("mfa_required");
                }
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
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setMode("forgot");
                setError(null);
                setResetChallengeId(null);
              }}
            >
              Forgot password?
            </button>
          </form>
        ) : null}

        {mode === "forgot" ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (!resetChallengeId) {
                  const res = await startPasswordReset(email.trim());
                  setResetChallengeId(res.challengeId ?? "pending");
                  if (res.devCode) setOtp(res.devCode);
                  return;
                }
                if (newPassword !== confirmNew) {
                  throw new Error("passwords_do_not_match");
                }
                if (!strength.ok) {
                  throw new Error(strength.code ?? "password_too_weak");
                }
                await completePasswordReset({
                  challengeId: resetChallengeId,
                  code: otp.trim(),
                  newPassword,
                });
                setMode("signin");
                setPassword("");
                setError(null);
              });
            }}
          >
            <label className="label" htmlFor="reset-email">
              Work email
            </label>
            <input
              id="reset-email"
              className="field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={Boolean(resetChallengeId)}
            />
            {resetChallengeId ? (
              <>
                <label className="label" htmlFor="reset-otp">
                  Email code
                </label>
                <input
                  id="reset-otp"
                  className="field"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
                {devCode ? <p className="meta">Dev code: {devCode}</p> : null}
                <label className="label" htmlFor="new-password">
                  New password
                </label>
                <input
                  id="new-password"
                  className="field"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={12}
                />
                <p className="meta">
                  Strength: {passwordStrengthLabel(strength.score)}
                </p>
                <label className="label" htmlFor="confirm-new">
                  Confirm password
                </label>
                <input
                  id="confirm-new"
                  className="field"
                  type="password"
                  value={confirmNew}
                  onChange={(e) => setConfirmNew(e.target.value)}
                  required
                  minLength={12}
                />
              </>
            ) : null}
            {error ? <p className="error">{humanAuthError(error)}</p> : null}
            <button className="cta" type="submit" disabled={busy}>
              {resetChallengeId ? "Save new password" : "Send reset code"}
            </button>
            <button
              type="button"
              className="text-link"
              onClick={() => setMode("signin")}
            >
              Back to sign in
            </button>
          </form>
        ) : null}

        {mode === "apply" ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (applyStep === 1) {
                  const res = await startEnterpriseRegister({
                    companyName: apply.companyName.trim(),
                    displayName: apply.displayName.trim(),
                    email: apply.email.trim(),
                  });
                  setChallengeId(res.challengeId);
                  setDevCode(res.devCode ?? null);
                  if (res.devCode) setOtp(res.devCode);
                  setApplyStep(2);
                  return;
                }
                if (applyStep === 2) {
                  if (apply.password !== apply.confirm) {
                    throw new Error("passwords_do_not_match");
                  }
                  if (!strength.ok) {
                    throw new Error(strength.code ?? "password_too_weak");
                  }
                  setApplyStep(3);
                  return;
                }
                if (!challengeId) {
                  throw new Error("challenge_invalid_or_expired");
                }
                const res = await completeEnterpriseRegister({
                  challengeId,
                  code: otp.trim(),
                  companyName: apply.companyName.trim(),
                  displayName: apply.displayName.trim(),
                  email: apply.email.trim(),
                  password: apply.password,
                  billingEmail:
                    apply.billingEmail.trim() || apply.email.trim(),
                  billingContactName:
                    apply.billingContactName.trim() || apply.displayName.trim(),
                  payMode: apply.payMode,
                  registrationNumber:
                    apply.registrationNumber.trim() || undefined,
                  vatNumber: apply.vatNumber.trim() || undefined,
                  companyDocUrl: apply.companyDocUrl || undefined,
                });
                if (res.status === "pending_review") {
                  setMode("pending");
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
            <p className="meta">Step {applyStep} of 3</p>
            {applyStep === 1 ? (
              <>
                <label className="label" htmlFor="company">
                  Company name
                </label>
                <input
                  id="company"
                  className="field"
                  value={apply.companyName}
                  onChange={(e) =>
                    setApply((s) => ({ ...s, companyName: e.target.value }))
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
                  value={apply.displayName}
                  onChange={(e) =>
                    setApply((s) => ({ ...s, displayName: e.target.value }))
                  }
                  required
                  minLength={2}
                />
                <label className="label" htmlFor="apply-email">
                  Work email
                </label>
                <input
                  id="apply-email"
                  className="field"
                  type="email"
                  value={apply.email}
                  onChange={(e) =>
                    setApply((s) => ({ ...s, email: e.target.value }))
                  }
                  required
                />
              </>
            ) : null}
            {applyStep === 2 ? (
              <>
                <p className="lede">
                  Enter the email code, then choose a strong password (once —
                  not every login).
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
                />
                {devCode ? <p className="meta">Dev code: {devCode}</p> : null}
                <label className="label" htmlFor="apply-password">
                  Password
                </label>
                <input
                  id="apply-password"
                  className="field"
                  type="password"
                  value={apply.password}
                  onChange={(e) =>
                    setApply((s) => ({ ...s, password: e.target.value }))
                  }
                  required
                  minLength={12}
                />
                <p className="meta">
                  Strength: {passwordStrengthLabel(strength.score)} · 12+ chars,
                  upper, lower, number, symbol
                </p>
                <label className="label" htmlFor="apply-confirm">
                  Confirm password
                </label>
                <input
                  id="apply-confirm"
                  className="field"
                  type="password"
                  value={apply.confirm}
                  onChange={(e) =>
                    setApply((s) => ({ ...s, confirm: e.target.value }))
                  }
                  required
                  minLength={12}
                />
              </>
            ) : null}
            {applyStep === 3 ? (
              <>
                <label className="label" htmlFor="billing-email">
                  Billing email
                </label>
                <input
                  id="billing-email"
                  className="field"
                  type="email"
                  value={apply.billingEmail}
                  onChange={(e) =>
                    setApply((s) => ({ ...s, billingEmail: e.target.value }))
                  }
                  placeholder={apply.email}
                />
                <label className="label" htmlFor="billing-contact">
                  Billing contact
                </label>
                <input
                  id="billing-contact"
                  className="field"
                  value={apply.billingContactName}
                  onChange={(e) =>
                    setApply((s) => ({
                      ...s,
                      billingContactName: e.target.value,
                    }))
                  }
                />
                <label className="label" htmlFor="pay-mode">
                  Payment style
                </label>
                <select
                  id="pay-mode"
                  className="field"
                  value={apply.payMode}
                  onChange={(e) =>
                    setApply((s) => ({
                      ...s,
                      payMode: e.target.value as "statement" | "card",
                    }))
                  }
                >
                  <option value="statement">Weekly statement</option>
                  <option value="card">Card per job</option>
                </select>
                <label className="label" htmlFor="reg-no">
                  Company registration (optional)
                </label>
                <input
                  id="reg-no"
                  className="field"
                  value={apply.registrationNumber}
                  onChange={(e) =>
                    setApply((s) => ({
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
                  value={apply.vatNumber}
                  onChange={(e) =>
                    setApply((s) => ({ ...s, vatNumber: e.target.value }))
                  }
                />
                <label className="label" htmlFor="company-doc">
                  Company document (optional)
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
                        setApply((s) => ({ ...s, companyDocUrl: url })),
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
                : applyStep === 1
                  ? "Send email code"
                  : applyStep === 3
                    ? "Submit application"
                    : "Continue"}
            </button>
            {applyStep > 1 ? (
              <button
                type="button"
                className="text-link"
                onClick={() =>
                  setApplyStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))
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
