import { useEffect, useState } from "react";
import {
  assignDevRole,
  escalateCase,
  fetchDeskCase,
  fetchDeskCases,
  fetchMe,
  formatMoney,
  openClaim,
  refundCase,
  replyCase,
  requestOtp,
  resetStaffMfa,
  resolveCase,
  verifyMfa,
  verifyOtp,
  type SessionUser,
  type SupportCase,
  type SupportMessage,
} from "./api";
import {
  clearTotpSecret,
  generateTotp,
  readTotpSecret,
  writeTotpSecret,
} from "./totp";

const TOKEN_KEY = "vuush.support.token";
const TOKEN_KEY_LEGACY = "swift.support.token";

function readStoredToken() {
  return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY_LEGACY);
}
function writeStoredToken(value: string) {
  localStorage.setItem(TOKEN_KEY, value);
  localStorage.removeItem(TOKEN_KEY_LEGACY);
}
function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY_LEGACY);
}

function BrandLockup() {
  return (
    <span className="brand-lockup">
      <span className="brand-mark" aria-hidden="true" />
      <span className="brand-wordmark">VUUSH</span>
    </span>
  );
}

async function finishStaffAuth(
  email: string,
  res: Awaited<ReturnType<typeof verifyOtp>>,
): Promise<{ token: string; user: SessionUser }> {
  if (res.status === "authenticated" && res.session?.accessToken && res.user) {
    return { token: res.session.accessToken, user: res.user };
  }
  if (
    (res.status === "mfa_enroll_required" || res.status === "mfa_required") &&
    res.mfa?.mfaToken
  ) {
    if (res.totpSecret) writeTotpSecret(email, res.totpSecret);
    const secret = res.totpSecret ?? readTotpSecret(email);
    if (!secret) {
      await resetStaffMfa(email);
      clearTotpSecret(email);
      throw new Error("mfa_reset_retry");
    }
    try {
      const totpCode = await generateTotp(secret);
      const mfa = await verifyMfa(res.mfa.mfaToken, totpCode);
      if (!mfa.session?.accessToken || !mfa.user) throw new Error("mfa_incomplete");
      return { token: mfa.session.accessToken, user: mfa.user };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (
        message === "invalid_mfa_code" ||
        message === "mfa_ticket_invalid" ||
        message === "mfa_not_configured"
      ) {
        clearTotpSecret(email);
        await resetStaffMfa(email);
        throw new Error("mfa_reset_retry");
      }
      throw err;
    }
  }
  throw new Error(res.status || "mfa_required_or_incomplete");
}

function Login({ onAuthed }: { onAuthed: (token: string, user: SessionUser) => void }) {
  const [email, setEmail] = useState("support@vuush.local");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [devHint, setDevHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await requestOtp(email.trim());
      setChallengeId(res.challengeId);
      if (res.devCode) {
        setDevHint(res.devCode);
        setCode(res.devCode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "otp_failed");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await verifyOtp(challengeId, code.trim());
      let { token, user } = await finishStaffAuth(email.trim(), res);
      if (!user.roles.includes("support_agent") && !user.roles.includes("administrator")) {
        await assignDevRole(user.id, "support_agent");
        user = (await fetchMe(token)).user;
      }
      onAuthed(token, user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "verify_failed";
      if (message === "mfa_reset_retry") {
        setChallengeId(null);
        setCode("");
        setDevHint(null);
        setError("Staff MFA reset. Send a new sign-in code.");
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-inner">
        <h1 className="login-brand">
          <BrandLockup />
        </h1>
        <p className="login-title">Support Centre</p>
        <p className="muted">Resolve with timeline truth. Calm precision.</p>
        {!challengeId ? (
          <form onSubmit={sendCode} className="stack" style={{ padding: 0 }}>
            <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <div className="banner banner-error">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              Send sign-in code
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="stack" style={{ padding: 0 }}>
            <input className="field" value={code} onChange={(e) => setCode(e.target.value)} />
            {devHint && <p className="muted">Dev code: {devHint}</p>}
            {error && <div className="banner banner-error">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              Sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<SessionUser | null>(null);
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchDeskCase>> | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshInbox(access: string) {
    const res = await fetchDeskCases(access);
    setCases(res.cases);
  }

  async function loadDetail(access: string, caseId: string) {
    const res = await fetchDeskCase(access, caseId);
    setDetail(res);
  }

  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      try {
        const me = await fetchMe(token);
        if (!alive) return;
        setUser(me.user);
        await refreshInbox(token);
      } catch {
        if (!alive) return;
        clearStoredToken();
        setToken(null);
      }
    })();
    const t = setInterval(() => {
      if (token) void refreshInbox(token).catch(() => undefined);
    }, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [token]);

  useEffect(() => {
    if (!token || !selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(token, selectedId).catch((err) =>
      setError(err instanceof Error ? err.message : "load_failed"),
    );
  }, [token, selectedId]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "request_failed");
    } finally {
      setBusy(false);
    }
  }

  if (!token || !user) {
    return (
      <Login
        onAuthed={(t, u) => {
          writeStoredToken(t);
          setToken(t);
          setUser(u);
        }}
      />
    );
  }

  return (
    <div className="app">
      {error && <div className="banner banner-error">{error}</div>}
      {notice && <div className="banner banner-ok">{notice}</div>}
      <header className="topbar">
        <div className="brand-row">
          <BrandLockup />
          <span className="brand-product">Support</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="muted">{user.email}</span>
          <button
            className="btn btn-ghost"
            onClick={() => {
              clearStoredToken();
              setToken(null);
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="board">
        <aside className="rail">
          <div className="rail-head">
            <h2>Inbox</h2>
            <p className="muted">{cases.length} open / pending / escalated</p>
          </div>
          <ul className="list">
            {cases.map((c) => (
              <li key={c.id}>
                <button
                  className={selectedId === c.id ? "active" : ""}
                  onClick={() => setSelectedId(c.id)}
                >
                  <strong>{c.publicCode}</strong>
                  <span className="muted">{c.subject}</span>
                  <span className={`status-pill ${c.status === "escalated" ? "warn" : ""}`}>
                    {c.status}
                    {c.claimOpened ? " · claim" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="main">
          {!detail ? (
            <div className="main-head">
              <h2>Select a case</h2>
              <p className="muted">Thread + job truth appear here.</p>
            </div>
          ) : (
            <>
              <div className="main-head">
                <h2>{detail.case.publicCode}</h2>
                <p className="muted">{detail.case.subject}</p>
              </div>
              <div className="thread">
                {detail.messages.map((m: SupportMessage) => (
                  <div key={m.id} className={`bubble ${m.authorKind}`}>
                    <div className="muted">
                      {m.authorKind} · {new Date(m.createdAt).toLocaleString()}
                    </div>
                    <div>{m.body}</div>
                  </div>
                ))}
              </div>
              {detail.case.status !== "resolved" && (
                <div className="composer">
                  <textarea
                    className="field"
                    rows={2}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply to customer…"
                  />
                  <button
                    className="btn btn-primary"
                    disabled={busy || !reply.trim()}
                    onClick={() =>
                      void run(async () => {
                        await replyCase(token, detail.case.id, reply.trim());
                        setReply("");
                        await loadDetail(token, detail.case.id);
                        await refreshInbox(token);
                        setNotice("Reply sent.");
                      })
                    }
                  >
                    Send
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="detail">
          <div className="pane-head">
            <h2>Truth</h2>
            <p className="muted">Job, pay, timeline</p>
          </div>
          {detail && (
            <div className="stack">
              {detail.opener && (
                <div>
                  <strong>Customer</strong>
                  <p className="muted">{detail.opener.email ?? detail.opener.phone}</p>
                </div>
              )}
              {detail.job ? (
                <div>
                  <strong>{detail.job.publicCode}</strong>
                  <p className="muted">{detail.job.state.replaceAll("_", " ")}</p>
                  <p className="muted">{detail.job.pickupAddress}</p>
                  <p className="muted">→ {detail.job.dropoffAddress}</p>
                  <p className="muted">Payment {detail.job.paymentStatus}</p>
                </div>
              ) : (
                <p className="muted">No job linked</p>
              )}

              {detail.payments.length > 0 && (
                <div>
                  <strong>Payments</strong>
                  {detail.payments.map((p) => (
                    <p key={p.id} className="muted">
                      {formatMoney(p.amountCents, p.currency)} · {p.status}
                    </p>
                  ))}
                </div>
              )}

              <div>
                <strong>Timeline</strong>
                <ul className="timeline">
                  {detail.timeline.map((t) => (
                    <li key={t.id}>
                      <div>{t.action}</div>
                      <div className="muted">
                        {new Date(t.occurredAt).toLocaleString()}
                        {t.reasonCode ? ` · ${t.reasonCode}` : ""}
                      </div>
                    </li>
                  ))}
                  {detail.timeline.length === 0 && <li className="muted">No job events yet</li>}
                </ul>
              </div>

              {detail.case.status !== "resolved" && (
                <>
                  <button
                    className="btn btn-secondary btn-block"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await resolveCase(token, detail.case.id, "Resolved by support");
                        await loadDetail(token, detail.case.id);
                        await refreshInbox(token);
                        setNotice("Case resolved.");
                      })
                    }
                  >
                    Resolve
                  </button>
                  <button
                    className="btn btn-secondary btn-block"
                    disabled={busy || !detail.job}
                    onClick={() =>
                      void run(async () => {
                        await escalateCase(
                          token,
                          detail.case.id,
                          "support_escalation",
                          "Needs dispatch help",
                        );
                        await loadDetail(token, detail.case.id);
                        await refreshInbox(token);
                        setNotice("Escalated to dispatch hold.");
                      })
                    }
                  >
                    Escalate to dispatch
                  </button>
                  <button
                    className="btn btn-secondary btn-block"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await openClaim(token, detail.case.id, "Loss / damage claim intake");
                        await loadDetail(token, detail.case.id);
                        setNotice("Claim opened.");
                      })
                    }
                  >
                    Open claim
                  </button>
                  <button
                    className="btn btn-primary btn-block"
                    disabled={busy || !detail.job}
                    onClick={() =>
                      void run(async () => {
                        await refundCase(token, detail.case.id, "support_goodwill");
                        await loadDetail(token, detail.case.id);
                        setNotice("Refund issued.");
                      })
                    }
                  >
                    Issue refund
                  </button>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
