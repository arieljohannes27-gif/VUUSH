import { useMemo, useState } from "react";
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
} from "@vuush/auth";

type Mode = "signin" | "register" | "forgot";

export function CustomerAuth({
  onAuthed,
}: {
  onAuthed: (token: string, user: SessionUser) => void;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const strength = useMemo(
    () =>
      evaluatePassword(
        mode === "forgot" ? newPassword : mode === "register" ? password : "",
      ),
    [mode, newPassword, password],
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

  const isPhone = !identifier.includes("@") && /\d/.test(identifier);

  return (
    <main className="auth">
      <p className="brand-lockup">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-wordmark">VUUSH</span>
      </p>
      <h1>
        {mode === "register"
          ? "Create account"
          : mode === "forgot"
            ? "Reset password"
            : "Sign in"}
      </h1>
      <p className="lede">
        {mode === "register"
          ? "Email or phone, password, and a one-time verification code."
          : mode === "forgot"
            ? "We send a code so you can choose a new password."
            : "Sign in with email or phone and your password. No authenticator."}
      </p>

      {mode !== "forgot" ? (
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            className={mode === "signin" ? "nav-item active" : "nav-item"}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "register" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setMode("register");
              setChallengeId(null);
            }}
          >
            Register
          </button>
        </div>
      ) : null}

      {mode === "signin" ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const res = await loginWithPassword(identifier.trim(), password);
              if (
                res.status !== "authenticated" ||
                !res.session?.accessToken ||
                !res.user
              ) {
                throw new Error(res.status || "auth_failed");
              }
              onAuthed(res.session.accessToken, res.user);
            });
          }}
        >
          <label className="label" htmlFor="id">
            Email or phone
          </label>
          <input
            id="id"
            className="field"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoComplete="username"
          />
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error ? <p className="error">{humanAuthError(error)}</p> : null}
          <button className="cta" type="submit" disabled={busy}>
            Sign in
          </button>
          <button
            type="button"
            className="text-link"
            onClick={() => setMode("forgot")}
          >
            Forgot password?
          </button>
        </form>
      ) : null}

      {mode === "register" ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!challengeId) {
                if (password !== confirm) {
                  throw new Error("passwords_do_not_match");
                }
                if (!strength.ok) {
                  throw new Error(strength.code ?? "password_too_weak");
                }
                const body = isPhone
                  ? { phone: identifier.trim(), password, displayName }
                  : { email: identifier.trim(), password, displayName };
                const res = await registerCustomer(body);
                setChallengeId(res.challengeId);
                setDevCode(res.devCode ?? null);
                if (res.devCode) setOtp(res.devCode);
                return;
              }
              const res = await verifyCustomerRegister(challengeId, otp.trim());
              if (
                res.status !== "authenticated" ||
                !res.session?.accessToken ||
                !res.user
              ) {
                throw new Error(res.status || "auth_failed");
              }
              onAuthed(res.session.accessToken, res.user);
            });
          }}
        >
          {!challengeId ? (
            <>
              <label className="label" htmlFor="reg-id">
                Email or phone
              </label>
              <input
                id="reg-id"
                className="field"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
              <label className="label" htmlFor="reg-name">
                Your name
              </label>
              <input
                id="reg-name"
                className="field"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <label className="label" htmlFor="reg-password">
                Password
              </label>
              <input
                id="reg-password"
                className="field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
              />
              <p className="meta">
                Strength: {passwordStrengthLabel(strength.score)}
              </p>
              <label className="label" htmlFor="reg-confirm">
                Confirm password
              </label>
              <input
                id="reg-confirm"
                className="field"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={12}
              />
            </>
          ) : (
            <>
              <label className="label" htmlFor="reg-otp">
                Verification code
              </label>
              <input
                id="reg-otp"
                className="field"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
              {devCode ? <p className="meta">Dev code: {devCode}</p> : null}
            </>
          )}
          {error ? <p className="error">{humanAuthError(error)}</p> : null}
          <button className="cta" type="submit" disabled={busy}>
            {challengeId ? "Verify and continue" : "Send verification code"}
          </button>
        </form>
      ) : null}

      {mode === "forgot" ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!challengeId) {
                const res = await startPasswordReset(identifier.trim());
                setChallengeId(res.challengeId ?? "pending");
                if (res.devCode) {
                  setDevCode(res.devCode);
                  setOtp(res.devCode);
                }
                return;
              }
              if (!strength.ok) {
                throw new Error(strength.code ?? "password_too_weak");
              }
              await completePasswordReset({
                challengeId,
                code: otp.trim(),
                newPassword,
              });
              setMode("signin");
              setChallengeId(null);
              setPassword("");
            });
          }}
        >
          <label className="label" htmlFor="forgot-id">
            Email or phone
          </label>
          <input
            id="forgot-id"
            className="field"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            disabled={Boolean(challengeId)}
          />
          {challengeId ? (
            <>
              <label className="label" htmlFor="forgot-otp">
                Code
              </label>
              <input
                id="forgot-otp"
                className="field"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
              {devCode ? <p className="meta">Dev code: {devCode}</p> : null}
              <label className="label" htmlFor="forgot-new">
                New password
              </label>
              <input
                id="forgot-new"
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
            </>
          ) : null}
          {error ? <p className="error">{humanAuthError(error)}</p> : null}
          <button className="cta" type="submit" disabled={busy}>
            {challengeId ? "Save new password" : "Send reset code"}
          </button>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setMode("signin");
              setChallengeId(null);
            }}
          >
            Back to sign in
          </button>
        </form>
      ) : null}
    </main>
  );
}
