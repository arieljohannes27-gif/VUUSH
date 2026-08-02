import { useEffect, useMemo, useState } from "react";
import {
  completePasswordReset,
  loginWithPassword,
  registerCustomer,
  startPasswordReset,
  verifyCustomerRegister,
  type SessionUser,
} from "./api";
import {
  evaluatePassword,
  humanAuthError,
  passwordStrengthLabel,
  type PasswordCheck,
} from "@vuush/auth";

type Mode = "signin" | "register" | "forgot";
type ForgotStep = "ask" | "code" | "done";

const REMEMBER_KEY = "vuush.customer.remember_id";

function looksLikePhone(value: string) {
  const v = value.trim();
  return !v.includes("@") && /\d{7,}/.test(v.replace(/[\s()+-]/g, ""));
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="auth-password-wrap">
        <input
          id={id}
          className="field"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
        />
        <button
          type="button"
          className="auth-show-pass"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

function StrengthMeter({ check }: { check: PasswordCheck }) {
  if (!check.checks.length && check.score === 0) return null;
  return (
    <div className="auth-strength" aria-live="polite">
      <div className="auth-strength-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={
              check.score >= n
                ? `auth-strength-bar on s${check.score}`
                : "auth-strength-bar"
            }
          />
        ))}
      </div>
      <p className="auth-strength-label">
        {passwordStrengthLabel(check.score)}
      </p>
      <ul className="auth-strength-list">
        <li className={check.checks.length ? "ok" : ""}>12+ characters</li>
        <li className={check.checks.upper ? "ok" : ""}>Uppercase letter</li>
        <li className={check.checks.lower ? "ok" : ""}>Lowercase letter</li>
        <li className={check.checks.digit ? "ok" : ""}>Number</li>
        <li className={check.checks.special ? "ok" : ""}>Special character</li>
      </ul>
    </div>
  );
}

export function CustomerAuth({
  onAuthed,
}: {
  onAuthed: (token: string, user: SessionUser) => void;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState(
    () => localStorage.getItem(REMEMBER_KEY) ?? "",
  );
  const [remember, setRemember] = useState(
    () => Boolean(localStorage.getItem(REMEMBER_KEY)),
  );
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("ask");

  const strength = useMemo(
    () =>
      evaluatePassword(
        mode === "forgot" ? newPassword : mode === "register" ? password : "",
      ),
    [mode, newPassword, password],
  );

  const confirmMatch =
    mode === "register"
      ? confirm.length === 0 || confirm === password
      : confirmNew.length === 0 || confirmNew === newPassword;

  useEffect(() => {
    setError(null);
    if (mode !== "forgot") {
      setForgotStep("ask");
      setChallengeId(null);
      setOtp("");
      setDevCode(null);
      setNewPassword("");
      setConfirmNew("");
    }
  }, [mode]);

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

  function switchMode(next: Mode) {
    setMode(next);
    setNotice(null);
    setError(null);
    setChallengeId(null);
    setOtp("");
    setDevCode(null);
    setPassword("");
    setConfirm("");
  }

  const title =
    mode === "register"
      ? "Create your account"
      : mode === "forgot"
        ? forgotStep === "done"
          ? "Password updated"
          : "Reset your password"
        : "Welcome back";

  const lede =
    mode === "register"
      ? challengeId
        ? "We sent a short code. Enter it once to activate your account."
        : "A few details and you’re ready to book."
      : mode === "forgot"
        ? forgotStep === "ask"
          ? "Enter the email or mobile number on your account."
          : forgotStep === "code"
            ? "Enter the code we sent, then choose a new password."
            : "You’re all set. Sign in with your new password."
        : "Sign in to book and track your deliveries.";

  return (
    <main className="auth-screen">
      <header className="auth-header">
        <p className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-wordmark">VUUSH</span>
        </p>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-lede">{lede}</p>
      </header>

      {mode !== "forgot" ? (
        <div className="auth-switch" role="tablist" aria-label="Account">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={mode === "signin" ? "active" : ""}
            onClick={() => switchMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => switchMode("register")}
          >
            Create account
          </button>
        </div>
      ) : null}

      {notice ? <p className="auth-notice">{notice}</p> : null}

      {mode === "signin" ? (
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const res = await loginWithPassword(identifier.trim(), password);
              if (
                res.status !== "authenticated" ||
                !res.session?.accessToken ||
                !res.user
              ) {
                throw new Error("unable_to_sign_in");
              }
              if (remember) {
                localStorage.setItem(REMEMBER_KEY, identifier.trim());
              } else {
                localStorage.removeItem(REMEMBER_KEY);
              }
              onAuthed(res.session.accessToken, res.user);
            });
          }}
        >
          <div className="auth-field">
            <label className="label" htmlFor="signin-id">
              Email or mobile number
            </label>
            <input
              id="signin-id"
              className="field"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              inputMode={looksLikePhone(identifier) ? "tel" : "email"}
              placeholder="name@email.com or +27…"
            />
          </div>
          <PasswordField
            id="signin-password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />
          <label className="auth-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember me
          </label>
          {error ? (
            <p className="auth-error" role="alert">
              {humanAuthError(error)}
            </p>
          ) : null}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <div className="auth-links">
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                switchMode("forgot");
                setForgotStep("ask");
              }}
            >
              Forgot password?
            </button>
            <button
              type="button"
              className="auth-link"
              onClick={() => switchMode("register")}
            >
              Create account
            </button>
          </div>
        </form>
      ) : null}

      {mode === "register" ? (
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!challengeId) {
                if (displayName.trim().length < 2) {
                  throw new Error("validation_error");
                }
                if (password !== confirm) {
                  throw new Error("passwords_do_not_match");
                }
                if (!strength.ok) {
                  throw new Error(strength.code ?? "password_too_weak");
                }
                const id = identifier.trim();
                const body = looksLikePhone(id)
                  ? {
                      phone: id,
                      password,
                      displayName: displayName.trim(),
                    }
                  : {
                      email: id,
                      password,
                      displayName: displayName.trim(),
                    };
                const res = await registerCustomer(body);
                setChallengeId(res.challengeId);
                setDevCode(res.devCode ?? null);
                if (res.devCode) setOtp(res.devCode);
                setNotice(
                  looksLikePhone(id)
                    ? "Check your phone for a verification code."
                    : "Check your email for a verification code.",
                );
                return;
              }
              const res = await verifyCustomerRegister(challengeId, otp.trim());
              if (
                res.status !== "authenticated" ||
                !res.session?.accessToken ||
                !res.user
              ) {
                throw new Error(res.status || "invalid_code");
              }
              onAuthed(res.session.accessToken, res.user);
            });
          }}
        >
          {!challengeId ? (
            <>
              <div className="auth-field">
                <label className="label" htmlFor="reg-name">
                  Full name
                </label>
                <input
                  id="reg-name"
                  className="field"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  minLength={2}
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                />
              </div>
              <div className="auth-field">
                <label className="label" htmlFor="reg-id">
                  Email address or mobile number
                </label>
                <input
                  id="reg-id"
                  className="field"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="name@email.com or +27…"
                />
              </div>
              <PasswordField
                id="reg-password"
                label="Password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                required
                minLength={12}
              />
              <StrengthMeter check={strength} />
              <PasswordField
                id="reg-confirm"
                label="Confirm password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                required
                minLength={12}
              />
              {!confirmMatch ? (
                <p className="auth-hint warn">Passwords do not match.</p>
              ) : null}
            </>
          ) : (
            <>
              <div className="auth-field">
                <label className="label" htmlFor="reg-otp">
                  Verification code
                </label>
                <input
                  id="reg-otp"
                  className="field"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                />
              </div>
              {devCode ? (
                <p className="auth-hint">Dev code: {devCode}</p>
              ) : null}
            </>
          )}
          {error ? (
            <p className="auth-error" role="alert">
              {humanAuthError(error)}
            </p>
          ) : null}
          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={busy || (!challengeId && (!strength.ok || !confirmMatch))}
          >
            {busy
              ? "Working…"
              : challengeId
                ? "Verify and continue"
                : "Create account"}
          </button>
          {challengeId ? (
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                setChallengeId(null);
                setOtp("");
                setDevCode(null);
                setNotice(null);
              }}
            >
              Use a different email or number
            </button>
          ) : null}
        </form>
      ) : null}

      {mode === "forgot" && forgotStep !== "done" ? (
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (forgotStep === "ask") {
                const res = await startPasswordReset(identifier.trim());
                setChallengeId(res.challengeId ?? "pending");
                if (res.devCode) {
                  setDevCode(res.devCode);
                  setOtp(res.devCode);
                }
                setForgotStep("code");
                setNotice(
                  "If that account exists, we sent a verification code.",
                );
                return;
              }
              if (newPassword !== confirmNew) {
                throw new Error("passwords_do_not_match");
              }
              if (!strength.ok) {
                throw new Error(strength.code ?? "password_too_weak");
              }
              if (!challengeId || challengeId === "pending") {
                throw new Error("challenge_invalid_or_expired");
              }
              await completePasswordReset({
                challengeId,
                code: otp.trim(),
                newPassword,
              });
              setForgotStep("done");
              setNotice("Your password was updated.");
              setPassword("");
              setOtp("");
              setChallengeId(null);
            });
          }}
        >
          {forgotStep === "ask" ? (
            <div className="auth-field">
              <label className="label" htmlFor="forgot-id">
                Email or mobile number
              </label>
              <input
                id="forgot-id"
                className="field"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
          ) : (
            <>
              <div className="auth-field">
                <label className="label" htmlFor="forgot-otp">
                  Verification code
                </label>
                <input
                  id="forgot-otp"
                  className="field"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
              {devCode ? (
                <p className="auth-hint">Dev code: {devCode}</p>
              ) : null}
              <PasswordField
                id="forgot-new"
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                required
                minLength={12}
              />
              <StrengthMeter check={strength} />
              <PasswordField
                id="forgot-confirm"
                label="Confirm new password"
                value={confirmNew}
                onChange={setConfirmNew}
                autoComplete="new-password"
                required
                minLength={12}
              />
              {!confirmMatch ? (
                <p className="auth-hint warn">Passwords do not match.</p>
              ) : null}
            </>
          )}
          {error ? (
            <p className="auth-error" role="alert">
              {humanAuthError(error)}
            </p>
          ) : null}
          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={
              busy ||
              (forgotStep === "code" && (!strength.ok || !confirmMatch))
            }
          >
            {busy
              ? "Working…"
              : forgotStep === "ask"
                ? "Send verification code"
                : "Update password"}
          </button>
          <button
            type="button"
            className="auth-link"
            onClick={() => switchMode("signin")}
          >
            Back to sign in
          </button>
        </form>
      ) : null}

      {mode === "forgot" && forgotStep === "done" ? (
        <div className="auth-form">
          <p className="auth-notice">
            Your password was updated. You can sign in now.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              switchMode("signin");
              setForgotStep("ask");
              setNotice(null);
            }}
          >
            Sign in
          </button>
        </div>
      ) : null}

      <p className="auth-trust">
        Your information is encrypted and protected.
      </p>
    </main>
  );
}
