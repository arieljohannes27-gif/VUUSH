import { useEffect, useRef, useState } from "react";
import {
  assignDevRole,
  closeBreakGlass,
  approveAdjustment,
  assignDriverToEarning,
  createAuditPack,
  createCreditNote,
  createPayoutBatch,
  createReconcileItem,
  createZone,
  downloadAuditPack,
  downloadFinanceExport,
  executePayoutBatch,
  fetchAdjustments,
  fetchAdminHome,
  fetchAudit,
  fetchAuditPacks,
  fetchBreakGlass,
  fetchFinanceEarnings,
  fetchFinanceHome,
  fetchFinancePayments,
  fetchFinanceStatements,
  fetchFlags,
  fetchJobMoney,
  fetchMe,
  fetchPayoutBatch,
  fetchPayoutBatches,
  fetchPricing,
  fetchProhibited,
  fetchReasonCodes,
  fetchReconcileItems,
  fetchServiceTypes,
  createOrganisation,
  fetchDriverApplications,
  fetchOrganisation,
  fetchOrganisations,
  fetchStaff,
  fetchZones,
  freezeJobEarnings,
  generateFinanceStatement,
  grantRole,
  inviteOrgMember,
  matchReconcileItem,
  resetOrgMemberPassword,
  rejectAdjustment,
  reviewDriverApplication,
  updateOrganisation,
  openBreakGlass,
  patchFlag,
  patchPricingParam,
  patchProhibited,
  patchReasonCode,
  patchServiceType,
  patchZone,
  requestOtp,
  resetStaffMfa,
  revokeRole,
  verifyMfa,
  verifyOtp,
  waiveReconcileItem,
  type AdminOrganisation,
  type FinanceEarning,
  type PayoutBatch,
  type PayoutItem,
  type SessionUser,
} from "./api";
import {
  clearTotpSecret,
  generateTotp,
  readTotpSecret,
  writeTotpSecret,
} from "./totp";

const TOKEN_KEY = "vuush.admin.token";
const TOKEN_KEY_LEGACY = "swift.admin.token";

function DocLink({ label, url }: { label: string; url: string | null }) {
  if (!url) return <div className="muted">{label}: —</div>;
  const kind = url.startsWith("data:application/pdf") ? "PDF" : "photo";
  return (
    <div>
      <a href={url} target="_blank" rel="noreferrer">
        {label} ({kind})
      </a>
    </div>
  );
}

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

type Nav =
  | "home"
  | "staff"
  | "drivers"
  | "orgs"
  | "zones"
  | "services"
  | "reasons"
  | "flags"
  | "pricing"
  | "goods"
  | "finance-home"
  | "payments"
  | "earnings"
  | "batches"
  | "job-money"
  | "adjustments"
  | "statements"
  | "reconcile"
  | "exports"
  | "audit-packs"
  | "audit"
  | "breakglass";

function formatZar(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

function humanAuthError(code: string) {
  if (code === "Failed to fetch" || code.toLowerCase().includes("failed to fetch")) {
    return "Could not reach the server. Check your connection and try again.";
  }
  const map: Record<string, string> = {
    otp_failed: "Could not send a sign-in code. Try again.",
    otp_email_not_configured:
      "Sign-in email is not set up on the server yet.",
    otp_sms_not_configured: "Phone sign-in is not available yet.",
    otp_delivery_failed: "Could not deliver the sign-in code. Try again.",
    invalid_code: "That code is wrong or expired.",
    verify_failed: "Sign-in failed. Try again.",
    unauthorized: "You are not allowed to sign in here.",
    invalid_mfa_code: "That authenticator code is wrong. Try again.",
    mfa_ticket_invalid: "This sign-in step expired. Start again.",
    mfa_not_configured: "Authenticator is not set up. Ask an admin for help.",
    mfa_incomplete: "Authenticator step did not finish.",
    mfa_required: "Authenticator code required.",
    mfa_enroll_required: "Set up authenticator to continue.",
    mfa_required_or_incomplete: "Authenticator step did not finish.",
    mfa_reset_retry: "Staff MFA reset. Send a new sign-in code.",
    user_inactive: "This account is inactive.",
  };
  if (map[code]) return map[code];
  if (code.startsWith("mfa_")) return code.replaceAll("_", " ");
  return code.replaceAll("_", " ");
}

function driverLabel(input: {
  driverDisplayName?: string | null;
  driverEmail?: string | null;
  driverUserId?: string | null;
}) {
  if (input.driverDisplayName?.trim()) return input.driverDisplayName.trim();
  if (input.driverEmail?.trim()) return input.driverEmail.trim();
  if (input.driverUserId) return input.driverUserId;
  return "Unknown driver";
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
  const [email, setEmail] = useState("");
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
      setError(humanAuthError(err instanceof Error ? err.message : "otp_failed"));
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
      if (!user.roles.includes("administrator")) {
        await assignDevRole(user.id, "administrator");
        user = (await fetchMe(token)).user;
      }
      onAuthed(token, user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "verify_failed";
      if (message === "mfa_reset_retry") {
        setChallengeId(null);
        setCode("");
        setDevHint(null);
        setError(humanAuthError("mfa_reset_retry"));
      } else {
        setError(humanAuthError(message));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <p className="eyebrow">
          <BrandLockup />
        </p>
        <h1>Admin</h1>
        <p className="muted">Configurator access — MFA required for staff.</p>
        <form onSubmit={challengeId ? verify : sendCode} className="stack">
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          {challengeId ? (
            <label>
              One-time code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
              />
            </label>
          ) : null}
          {devHint ? <p className="hint">Dev code: {devHint}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-primary" disabled={busy} type="submit">
            {challengeId ? "Sign in" : "Send code"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Console({
  token,
  user,
  onSignOut,
}: {
  token: string;
  user: SessionUser;
  onSignOut: () => void;
}) {
  const [nav, setNav] = useState<Nav>("home");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reasonWaitRef = useRef<((value: string | null) => void) | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonValue, setReasonValue] = useState("");
  const [reasonTitle, setReasonTitle] = useState("Reason for this change");

  function askReason(defaultCode = "admin_change", title = "Reason for this change") {
    setReasonTitle(title);
    setReasonValue(defaultCode);
    setReasonOpen(true);
    return new Promise<string | null>((resolve) => {
      reasonWaitRef.current = resolve;
    });
  }

  function resolveReason(value: string | null) {
    const resolve = reasonWaitRef.current;
    reasonWaitRef.current = null;
    setReasonOpen(false);
    resolve?.(value);
  }
  const [home, setHome] = useState<Awaited<ReturnType<typeof fetchAdminHome>> | null>(null);
  const [flags, setFlags] = useState<Awaited<ReturnType<typeof fetchFlags>>["flags"]>([]);
  const [zones, setZones] = useState<Awaited<ReturnType<typeof fetchZones>>["zones"]>([]);
  const [services, setServices] = useState<
    Awaited<ReturnType<typeof fetchServiceTypes>>["serviceTypes"]
  >([]);
  const [reasons, setReasons] = useState<
    Awaited<ReturnType<typeof fetchReasonCodes>>["reasonCodes"]
  >([]);
  const [staff, setStaff] = useState<Awaited<ReturnType<typeof fetchStaff>>["staff"]>([]);
  const [driverApps, setDriverApps] = useState<
    Awaited<ReturnType<typeof fetchDriverApplications>>["applications"]
  >([]);
  const [orgs, setOrgs] = useState<AdminOrganisation[]>([]);
  const [orgForm, setOrgForm] = useState({
    name: "",
    billingEmail: "",
    inviteEmail: "",
    inviteName: "",
  });
  const [inviteOrgId, setInviteOrgId] = useState<string>("");
  const [orgDetailId, setOrgDetailId] = useState<string>("");
  const [orgMembers, setOrgMembers] = useState<
    Array<{
      membershipId: string;
      userId: string;
      email: string | null;
      displayName: string | null;
      role: string;
    }>
  >([]);
  const [tempPasswordNotice, setTempPasswordNotice] = useState<string | null>(
    null,
  );
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof fetchAudit>>["events"]>([]);
  const [auditQ, setAuditQ] = useState("");
  const [glass, setGlass] = useState<
    Awaited<ReturnType<typeof fetchBreakGlass>>["sessions"]
  >([]);
  const [pricing, setPricing] = useState<
    Awaited<ReturnType<typeof fetchPricing>>["params"]
  >([]);
  const [driverSharePct, setDriverSharePct] = useState("75");
  const [goods, setGoods] = useState<Awaited<ReturnType<typeof fetchProhibited>>["items"]>([]);
  const [zoneForm, setZoneForm] = useState({
    code: "",
    name: "",
    city: "Cape Town",
  });
  const [earnings, setEarnings] = useState<FinanceEarning[]>([]);
  const [earnDriver, setEarnDriver] = useState("");
  const [earnFrozen, setEarnFrozen] = useState("");
  const [earnStatus, setEarnStatus] = useState("pending");
  const [assignJobId, setAssignJobId] = useState<string | null>(null);
  const [assignDriverId, setAssignDriverId] = useState("");
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [batchDetail, setBatchDetail] = useState<{
    batch: PayoutBatch;
    items: PayoutItem[];
    earnings: FinanceEarning[];
  } | null>(null);
  const [batchDriver, setBatchDriver] = useState("");
  const [payableDrivers, setPayableDrivers] = useState<
    Array<{ id: string; label: string; pendingCents: number }>
  >([]);
  const [confirmPay, setConfirmPay] = useState(false);
  const [jobMoneyQ, setJobMoneyQ] = useState("");
  const [jobMoney, setJobMoney] = useState<Awaited<
    ReturnType<typeof fetchJobMoney>
  > | null>(null);
  const [financeHome, setFinanceHome] = useState<Awaited<
    ReturnType<typeof fetchFinanceHome>
  > | null>(null);
  const [financePayments, setFinancePayments] = useState<
    Awaited<ReturnType<typeof fetchFinancePayments>>["payments"]
  >([]);
  const [payStatusFilter, setPayStatusFilter] = useState("");
  const [adjustments, setAdjustments] = useState<
    Awaited<ReturnType<typeof fetchAdjustments>>["adjustments"]
  >([]);
  const [statements, setStatements] = useState<
    Awaited<ReturnType<typeof fetchFinanceStatements>>["statements"]
  >([]);
  const [statementOrgId, setStatementOrgId] = useState("");
  const [creditForm, setCreditForm] = useState({
    amountRands: "",
    reasonCode: "goodwill",
    orgId: "",
    jobId: "",
  });
  const [reconcileItems, setReconcileItems] = useState<
    Awaited<ReturnType<typeof fetchReconcileItems>>["items"]
  >([]);
  const [reconcileForm, setReconcileForm] = useState({
    source: "manual",
    amountRands: "",
    externalRef: "",
  });
  const [matchJobId, setMatchJobId] = useState<Record<string, string>>({});
  const [exportFrom, setExportFrom] = useState(() =>
    new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10),
  );
  const [exportTo, setExportTo] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [auditPacks, setAuditPacks] = useState<
    Awaited<ReturnType<typeof fetchAuditPacks>>["packs"]
  >([]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "action_failed");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (nav === "home") setHome(await fetchAdminHome(token));
    if (nav === "flags") setFlags((await fetchFlags(token)).flags);
    if (nav === "zones") setZones((await fetchZones(token)).zones);
    if (nav === "services") setServices((await fetchServiceTypes(token)).serviceTypes);
    if (nav === "reasons") setReasons((await fetchReasonCodes(token)).reasonCodes);
    if (nav === "staff") setStaff((await fetchStaff(token)).staff);
    if (nav === "drivers") {
      setDriverApps((await fetchDriverApplications(token, "pending_review")).applications);
    }
    if (nav === "orgs") {
      setOrgs((await fetchOrganisations(token)).organisations);
    }
    if (nav === "audit") setAudit((await fetchAudit(token, auditQ || undefined)).events);
    if (nav === "breakglass") setGlass((await fetchBreakGlass(token)).sessions);
    if (nav === "pricing") {
      const params = (await fetchPricing(token)).params;
      setPricing(params);
      const shareRow = params.find((p) => p.key === "driver_share");
      const share =
        typeof shareRow?.valueJson?.share === "number"
          ? shareRow.valueJson.share
          : 0.75;
      setDriverSharePct(String(Math.round(share * 100)));
    }
    if (nav === "goods") setGoods((await fetchProhibited(token)).items);
    if (nav === "finance-home") setFinanceHome(await fetchFinanceHome(token));
    if (nav === "payments") {
      setFinancePayments(
        (
          await fetchFinancePayments(token, {
            status: payStatusFilter || undefined,
          })
        ).payments,
      );
    }
    if (nav === "adjustments") {
      setAdjustments((await fetchAdjustments(token)).adjustments);
    }
    if (nav === "statements") {
      setStatements((await fetchFinanceStatements(token)).statements);
      setOrgs((await fetchOrganisations(token)).organisations);
    }
    if (nav === "reconcile") {
      setReconcileItems((await fetchReconcileItems(token, "open")).items);
    }
    if (nav === "audit-packs") {
      setAuditPacks((await fetchAuditPacks(token)).packs);
    }
    if (nav === "earnings") {
      setEarnings(
        (
          await fetchFinanceEarnings(token, {
            driverUserId: earnDriver.trim() || undefined,
            frozen: earnFrozen || undefined,
            status: earnStatus || undefined,
          })
        ).earnings,
      );
    }
    if (nav === "batches") {
      setBatches((await fetchPayoutBatches(token)).batches);
      if (batchDetail) {
        setBatchDetail(await fetchPayoutBatch(token, batchDetail.batch.id));
      }
      const pending = (
        await fetchFinanceEarnings(token, {
          status: "pending",
          frozen: "false",
        })
      ).earnings;
      const byDriver = new Map<
        string,
        { label: string; pendingCents: number }
      >();
      for (const row of pending) {
        if (!row.driverUserId) continue;
        const prev = byDriver.get(row.driverUserId);
        byDriver.set(row.driverUserId, {
          label: driverLabel(row),
          pendingCents: (prev?.pendingCents ?? 0) + row.amountCents,
        });
      }
      setPayableDrivers(
        [...byDriver.entries()].map(([id, v]) => ({
          id,
          label: v.label,
          pendingCents: v.pendingCents,
        })),
      );
    }
  }

  useEffect(() => {
    void run(refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, token]);

  type PlaceId = "home" | "city" | "finance" | "people" | "activity";

  const places: Array<{
    id: PlaceId;
    label: string;
    items: Array<{ id: Nav; label: string }>;
  }> = [
    { id: "home", label: "Home", items: [{ id: "home", label: "Home" }] },
    {
      id: "city",
      label: "City",
      items: [
        { id: "zones", label: "Zones" },
        { id: "services", label: "Service types" },
        { id: "reasons", label: "Reason codes" },
        { id: "pricing", label: "Pricing" },
        { id: "flags", label: "Flags" },
        { id: "goods", label: "Prohibited goods" },
      ],
    },
    {
      id: "finance",
      label: "Finance",
      items: [
        { id: "finance-home", label: "Home" },
        { id: "payments", label: "Payments" },
        { id: "job-money", label: "Job ledger" },
        { id: "earnings", label: "Earnings" },
        { id: "batches", label: "Payouts" },
        { id: "adjustments", label: "Adjustments" },
        { id: "statements", label: "Statements" },
        { id: "reconcile", label: "Reconcile" },
        { id: "exports", label: "Exports" },
      ],
    },
    {
      id: "people",
      label: "People",
      items: [
        { id: "drivers", label: "Drivers" },
        { id: "orgs", label: "Organisations" },
        { id: "staff", label: "Staff" },
      ],
    },
    {
      id: "activity",
      label: "Activity",
      items: [
        { id: "audit", label: "Audit" },
        { id: "audit-packs", label: "Audit packs" },
        { id: "breakglass", label: "Emergency access" },
      ],
    },
  ];

  const activePlace =
    places.find((p) => p.items.some((item) => item.id === nav)) ?? places[0];
  const showPlaceNav = activePlace.items.length > 1;

  function goToPlace(placeId: PlaceId) {
    const place = places.find((p) => p.id === placeId);
    if (!place) return;
    const alreadyHere = place.items.some((item) => item.id === nav);
    if (!alreadyHere) setNav(place.items[0].id);
  }

  return (
    <div className="app">
      {reasonOpen ? (
        <div className="reason-overlay" role="presentation">
          <div
            className="reason-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reason-dialog-title"
          >
            <h2 id="reason-dialog-title">{reasonTitle}</h2>
            <input
              className="field"
              value={reasonValue}
              onChange={(e) => setReasonValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  resolveReason(reasonValue.trim() || null);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  resolveReason(null);
                }
              }}
            />
            <div className="reason-dialog-actions">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => resolveReason(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => resolveReason(reasonValue.trim() || null)}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <header className="topbar">
        <div className="brand-row">
          <BrandLockup />
          <span className="product">Admin</span>
        </div>
        <div className="topbar-meta">
          <span className="muted">{user.email}</span>
          <button className="btn btn-ghost" type="button" onClick={() => void run(refresh)}>
            Refresh
          </button>
          <button className="btn btn-ghost" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="shell">
        <nav className="sidebar" aria-label="Admin">
          {places.map((place) => (
            <button
              key={place.id}
              type="button"
              className={`nav-place${activePlace.id === place.id ? " active" : ""}`}
              onClick={() => goToPlace(place.id)}
            >
              {place.label}
            </button>
          ))}
        </nav>

        <main className={`main${showPlaceNav ? " has-place-nav" : ""}`}>
          {showPlaceNav ? (
            <nav className="place-nav" aria-label={activePlace.label}>
              <p className="place-nav-title">{activePlace.label}</p>
              {activePlace.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`place-nav-item${nav === item.id ? " active" : ""}`}
                  onClick={() => setNav(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          ) : null}

          <div className="main-body">
          {error ? <div className="error banner">{error}</div> : null}

          {nav === "home" ? (
            <div className="stack">
              <header className="page-head">
                <h1>Home</h1>
                <p className="muted">How the city is configured right now.</p>
              </header>
              {!home ? (
                <p className="muted">Loading…</p>
              ) : (
                <>
              <dl className="stat-list">
                <div>
                  <dt>Zones active</dt>
                  <dd>{home.zonesActive}</dd>
                </div>
                <div>
                  <dt>Flags</dt>
                  <dd>{home.flags}</dd>
                </div>
                <div>
                  <dt>Reason codes</dt>
                  <dd>{home.reasonCodesActive}</dd>
                </div>
                <div>
                  <dt>Emergency access open</dt>
                  <dd>{home.openBreakGlass}</dd>
                </div>
              </dl>
              <section className="page-section">
                <h2>Recent audit</h2>
                {home.recentAudit.length === 0 ? (
                  <p className="muted">No recent events.</p>
                ) : (
                  <ul className="audit-list">
                    {home.recentAudit.map((e) => (
                      <li key={e.id}>
                        <span className="mono">{e.action}</span>
                        <span className="muted">
                          {e.subjectType}
                          {e.subjectId ? ` · ${e.subjectId.slice(0, 8)}` : ""}
                        </span>
                        <time className="muted">
                          {new Date(e.occurredAt).toLocaleString()}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
                </>
              )}
            </div>
          ) : null}

          {nav === "flags" ? (
            <div className="stack">
              <h1>Flags</h1>
              <p className="muted">
                On/off switches for big features. One click flips the switch. The
                change is saved and logged.
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>What it controls</th>
                    <th>Now</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {flags.map((f) => (
                    <tr key={f.key}>
                      <td>
                        <div>{f.description ?? f.key}</div>
                        <div className="mono muted">{f.key}</div>
                      </td>
                      <td>{f.enabled ? "On" : "Off"}</td>
                      <td>
                        <button
                          className={`btn ${f.enabled ? "btn-secondary" : "btn-primary"}`}
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const next = !f.enabled;
                              await patchFlag(token, f.key, next, "flag_toggle");
                              setFlags((prev) =>
                                prev.map((row) =>
                                  row.key === f.key
                                    ? { ...row, enabled: next }
                                    : row,
                                ),
                              );
                            })
                          }
                        >
                          {f.enabled ? "Turn off" : "Turn on"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {nav === "zones" ? (
            <div className="stack">
              <h1>Zones</h1>
              <p className="muted">Codes + city metadata (polygons deferred).</p>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const reason = await askReason("zone_create");
                    if (!reason) return;
                    await createZone(token, {
                      ...zoneForm,
                      active: true,
                      reasonCode: reason,
                    });
                    setZoneForm({ code: "", name: "", city: "Cape Town" });
                    await refresh();
                  });
                }}
              >
                <input
                  placeholder="Code"
                  value={zoneForm.code}
                  onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })}
                  required
                />
                <input
                  placeholder="Name"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  required
                />
                <input
                  placeholder="City"
                  value={zoneForm.city}
                  onChange={(e) => setZoneForm({ ...zoneForm, city: e.target.value })}
                  required
                />
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  Add zone
                </button>
              </form>
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>City</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z.id}>
                      <td className="mono">{z.code}</td>
                      <td>{z.name}</td>
                      <td>{z.city}</td>
                      <td>{z.active ? "yes" : "no"}</td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const reason = await askReason("zone_deactivate");
                              if (!reason) return;
                              await patchZone(token, z.id, {
                                code: z.code,
                                name: z.name,
                                city: z.city,
                                active: !z.active,
                                reasonCode: reason,
                              });
                              await refresh();
                            })
                          }
                        >
                          {z.active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {nav === "services" ? (
            <div className="stack">
              <h1>Service types</h1>
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Base</th>
                    <th>/km</th>
                    <th>Mult</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.id}>
                      <td className="mono">{s.code}</td>
                      <td>{s.name}</td>
                      <td>{formatZar(s.baseFeeCents)}</td>
                      <td>{formatZar(s.perKmFeeCents)}</td>
                      <td>{s.priorityMultiplier}</td>
                      <td>{s.active ? "yes" : "no"}</td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const reason = await askReason("service_toggle");
                              if (!reason) return;
                              await patchServiceType(token, s.id, {
                                ...s,
                                active: !s.active,
                                reasonCode: reason,
                              });
                              await refresh();
                            })
                          }
                        >
                          {s.active ? "Turn off" : "Turn on"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {nav === "reasons" ? (
            <div className="stack">
              <h1>Reason codes</h1>
              <table className="table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Code</th>
                    <th>Label</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {reasons.map((r) => (
                    <tr key={r.id}>
                      <td>{r.domain}</td>
                      <td className="mono">{r.code}</td>
                      <td>{r.label}</td>
                      <td>{r.active ? "yes" : "no"}</td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const reason = await askReason("reason_toggle");
                              if (!reason) return;
                              await patchReasonCode(token, r.id, {
                                code: r.code,
                                domain: r.domain,
                                label: r.label,
                                severity: r.severity,
                                active: !r.active,
                                reasonCode: reason,
                              });
                              await refresh();
                            })
                          }
                        >
                          {r.active ? "Turn off" : "Turn on"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {nav === "drivers" ? (
            <section className="stack">
              <h1>Driver applications</h1>
              <p className="muted">Pending clearance — licence, insurance, permits.</p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Docs</th>
                    <th>Vehicle</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {driverApps.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        No pending applications.
                      </td>
                    </tr>
                  ) : (
                    driverApps.map((d) => (
                      <tr key={d.userId}>
                        <td>
                          <div>{d.displayName || "—"}</div>
                          <div className="muted">{d.email}</div>
                          <div className="muted">{d.phone}</div>
                        </td>
                        <td>
                          <DocLink label="ID" url={d.idDocUrl} />
                          <DocLink label="Licence" url={d.licenceDocUrl} />
                          <DocLink label="Vehicle insurance" url={d.vehicleInsuranceDocUrl} />
                          <DocLink label="Goods ≥ R100k" url={d.goodsInsuranceDocUrl} />
                          <DocLink label="Police clearance" url={d.policeClearanceDocUrl} />
                        </td>
                        <td>
                          <div>
                            {d.vehicleClass} · {d.vehiclePlate || "—"}
                          </div>
                          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                            {d.selfiePhotoUrl && (
                              <img
                                src={d.selfiePhotoUrl}
                                alt="Selfie"
                                title="Live selfie"
                                style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6 }}
                              />
                            )}
                            {d.vehiclePhotoUrl && (
                              <img
                                src={d.vehiclePhotoUrl}
                                alt="Vehicle"
                                title="Live vehicle"
                                style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 6 }}
                              />
                            )}
                          </div>
                        </td>
                        <td className="row-actions">
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() =>
                              void run(async () => {
                                await reviewDriverApplication(token, d.userId, {
                                  decision: "approve",
                                  reasonCode: "clearance_ok",
                                  reasonNote: "Docs cleared",
                                });
                                await refresh();
                              })
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="btn"
                            type="button"
                            onClick={() =>
                              void run(async () => {
                                await reviewDriverApplication(token, d.userId, {
                                  decision: "reject",
                                  reasonCode: "clearance_fail",
                                  reasonNote: "Did not meet requirements",
                                });
                                await refresh();
                              })
                            }
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          ) : null}

          {nav === "orgs" ? (
            <section className="stack">
              <h1>Organisations</h1>
              <p className="muted">
                Approve new company registrations, invite people, or reset a
                forgotten password (temporary password only — old ones cannot be
                viewed).
              </p>
              {tempPasswordNotice ? (
                <p className="notice">{tempPasswordNotice}</p>
              ) : null}

              {orgs.some((o) => o.status === "pending_review") ? (
                <div className="panel stack">
                  <h2>Awaiting your approval</h2>
                  <p className="muted">
                    Companies that registered on Enterprise. Approve to open
                    portal access, or reject if the details look wrong.
                  </p>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Billing</th>
                        <th>Details</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {orgs
                        .filter((o) => o.status === "pending_review")
                        .map((o) => (
                          <tr key={o.id}>
                            <td>
                              <div>{o.name}</div>
                              <div className="muted">
                                {o.cityCode} · {o.payMode}
                              </div>
                            </td>
                            <td>
                              <div>{o.billingEmail || "—"}</div>
                              <div className="muted">
                                {o.billingContactName || "—"}
                              </div>
                            </td>
                            <td className="muted">
                              {[
                                o.registrationNumber
                                  ? `Reg ${o.registrationNumber}`
                                  : null,
                                o.vatNumber ? `VAT ${o.vatNumber}` : null,
                                `${o.memberCount} member${o.memberCount === 1 ? "" : "s"}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </td>
                            <td className="row-actions">
                              <button
                                className="btn btn-primary"
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    await updateOrganisation(token, o.id, {
                                      status: "active",
                                    });
                                    await refresh();
                                  })
                                }
                              >
                                Approve
                              </button>
                              <button
                                className="btn"
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    await updateOrganisation(token, o.id, {
                                      status: "rejected",
                                    });
                                    await refresh();
                                  })
                                }
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="panel stack">
                <h2>Create organisation</h2>
                <label className="label" htmlFor="org-name">
                  Company name
                </label>
                <input
                  id="org-name"
                  className="field"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Acme Warehouse CPT"
                />
                <label className="label" htmlFor="org-billing">
                  Billing email
                </label>
                <input
                  id="org-billing"
                  className="field"
                  value={orgForm.billingEmail}
                  onChange={(e) => setOrgForm((f) => ({ ...f, billingEmail: e.target.value }))}
                  placeholder="accounts@acme.co.za"
                />
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={busy || orgForm.name.trim().length < 2}
                  onClick={() =>
                    void run(async () => {
                      await createOrganisation(token, {
                        name: orgForm.name.trim(),
                        billingEmail: orgForm.billingEmail.trim() || undefined,
                        cityCode: "CPT",
                      });
                      setOrgForm((f) => ({ ...f, name: "", billingEmail: "" }));
                      await refresh();
                    })
                  }
                >
                  Create org
                </button>
              </div>

              <div className="panel stack">
                <h2>Invite Org Admin</h2>
                <label className="label" htmlFor="invite-org">
                  Organisation
                </label>
                <select
                  id="invite-org"
                  className="field"
                  value={inviteOrgId}
                  onChange={(e) => setInviteOrgId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <label className="label" htmlFor="invite-email">
                  Email
                </label>
                <input
                  id="invite-email"
                  className="field"
                  value={orgForm.inviteEmail}
                  onChange={(e) => setOrgForm((f) => ({ ...f, inviteEmail: e.target.value }))}
                  placeholder="ops@acme.co.za"
                />
                <label className="label" htmlFor="invite-name">
                  Display name
                </label>
                <input
                  id="invite-name"
                  className="field"
                  value={orgForm.inviteName}
                  onChange={(e) => setOrgForm((f) => ({ ...f, inviteName: e.target.value }))}
                />
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={busy || !inviteOrgId || !orgForm.inviteEmail.includes("@")}
                  onClick={() =>
                    void run(async () => {
                      await inviteOrgMember(token, inviteOrgId, {
                        email: orgForm.inviteEmail.trim(),
                        displayName: orgForm.inviteName.trim() || undefined,
                        role: "org_admin",
                      });
                      setOrgForm((f) => ({ ...f, inviteEmail: "", inviteName: "" }));
                      await refresh();
                    })
                  }
                >
                  Invite Org Admin
                </button>
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Organisation</th>
                    <th>Status</th>
                    <th>Members</th>
                    <th>Billing</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orgs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        No organisations yet.
                      </td>
                    </tr>
                  ) : (
                    orgs.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <div>{o.name}</div>
                          <div className="muted">{o.cityCode}</div>
                        </td>
                        <td>{o.status}</td>
                        <td>{o.memberCount}</td>
                        <td className="muted">{o.billingEmail || "—"}</td>
                        <td className="row-actions">
                          <button
                            className="btn"
                            type="button"
                            onClick={() =>
                              void run(async () => {
                                setOrgDetailId(o.id);
                                setInviteOrgId(o.id);
                                setTempPasswordNotice(null);
                                const detail = await fetchOrganisation(
                                  token,
                                  o.id,
                                );
                                setOrgMembers(detail.members);
                              })
                            }
                          >
                            Members
                          </button>
                          {o.status === "pending_review" ? (
                            <>
                              <button
                                className="btn btn-primary"
                                type="button"
                                onClick={() =>
                                  void run(async () => {
                                    await updateOrganisation(token, o.id, {
                                      status: "active",
                                    });
                                    await refresh();
                                  })
                                }
                              >
                                Approve
                              </button>
                              <button
                                className="btn"
                                type="button"
                                onClick={() =>
                                  void run(async () => {
                                    await updateOrganisation(token, o.id, {
                                      status: "rejected",
                                    });
                                    await refresh();
                                  })
                                }
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                          {o.status === "active" ? (
                            <button
                              className="btn"
                              type="button"
                              onClick={() =>
                                void run(async () => {
                                  await updateOrganisation(token, o.id, {
                                    status: "suspended",
                                  });
                                  await refresh();
                                })
                              }
                            >
                              Suspend
                            </button>
                          ) : null}
                          {o.status === "suspended" || o.status === "rejected" ? (
                            <button
                              className="btn btn-primary"
                              type="button"
                              onClick={() =>
                                void run(async () => {
                                  await updateOrganisation(token, o.id, {
                                    status: "active",
                                  });
                                  await refresh();
                                })
                              }
                            >
                              Activate
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {orgDetailId && orgMembers.length >= 0 ? (
                <div className="panel stack">
                  <h2>
                    Members —{" "}
                    {orgs.find((o) => o.id === orgDetailId)?.name ?? "Org"}
                  </h2>
                  <p className="muted">
                    Passwords are secret. Reset creates a new temporary password
                    you can tell the user once.
                  </p>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Person</th>
                        <th>Role</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {orgMembers.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="muted">
                            No members.
                          </td>
                        </tr>
                      ) : (
                        orgMembers.map((m) => (
                          <tr key={m.membershipId}>
                            <td>
                              <div>{m.displayName || m.email || m.userId}</div>
                              <div className="muted">{m.email}</div>
                            </td>
                            <td>{m.role}</td>
                            <td className="row-actions">
                              <button
                                className="btn"
                                type="button"
                                onClick={() =>
                                  void run(async () => {
                                    const res = await resetOrgMemberPassword(
                                      token,
                                      orgDetailId,
                                      m.userId,
                                    );
                                    setTempPasswordNotice(
                                      `Temporary password for ${res.email ?? m.email}: ${res.temporaryPassword} — show once, then they sign in and can change it later.`,
                                    );
                                  })
                                }
                              >
                                Reset password
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          ) : null}

          {nav === "staff" ? (
            <div className="stack">
              <h1>Staff & roles</h1>
              <p className="muted">Cannot revoke the last administrator.</p>
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>MFA</th>
                    <th>Roles</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div>{s.email ?? s.id.slice(0, 8)}</div>
                        <div className="muted mono">{s.id.slice(0, 8)}</div>
                      </td>
                      <td>{s.totpEnabled ? "on" : "off"}</td>
                      <td>{s.roles.join(", ")}</td>
                      <td className="actions-cell">
                        {!s.roles.includes("dispatcher") ? (
                          <button
                            className="btn btn-secondary"
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const reason = await askReason("role_grant");
                                if (!reason) return;
                                await grantRole(token, s.id, "dispatcher", reason);
                                await refresh();
                              })
                            }
                          >
                            + dispatcher
                          </button>
                        ) : (
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const reason = await askReason("role_revoke");
                                if (!reason) return;
                                await revokeRole(token, s.id, "dispatcher", reason);
                                await refresh();
                              })
                            }
                          >
                            − dispatcher
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {nav === "pricing" ? (
            <div className="stack">
              <h1>Pricing</h1>
              <p className="muted">
                What the driver earns from each job, and other city price settings.
              </p>

              <section className="page-section">
                <h2>Driver share</h2>
                <p className="muted">
                  Percent of the job price that goes to the driver. Rest stays with
                  VUUSH.
                </p>
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const pct = Number(driverSharePct);
                    if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
                      setError("Enter a number from 1 to 100");
                      return;
                    }
                    void run(async () => {
                      await patchPricingParam(
                        token,
                        "driver_share",
                        { share: pct / 100 },
                        "driver_share_update",
                      );
                      await refresh();
                    });
                  }}
                >
                  <label className="field-label">
                    Driver gets (%)
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={driverSharePct}
                      onChange={(e) => setDriverSharePct(e.target.value)}
                    />
                  </label>
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    Save
                  </button>
                </form>
              </section>

              <section className="page-section">
                <h2>Other settings</h2>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Value</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricing
                      .filter((p) => p.key !== "driver_share")
                      .map((p) => (
                        <tr key={p.key}>
                          <td className="mono">{p.key}</td>
                          <td className="mono">{JSON.stringify(p.valueJson)}</td>
                          <td>{p.description}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </section>
            </div>
          ) : null}

          {nav === "goods" ? (
            <div className="stack">
              <h1>Prohibited goods</h1>
              <table className="table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {goods.map((g) => (
                    <tr key={g.id}>
                      <td>{g.label}</td>
                      <td>{g.active ? "yes" : "no"}</td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const reason = await askReason("goods_toggle");
                              if (!reason) return;
                              await patchProhibited(token, g.id, {
                                label: g.label,
                                sortOrder: g.sortOrder,
                                active: !g.active,
                                reasonCode: reason,
                              });
                              await refresh();
                            })
                          }
                        >
                          {g.active ? "Turn off" : "Turn on"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {nav === "audit" ? (
            <div className="stack">
              <h1>Audit search</h1>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(refresh);
                }}
              >
                <input
                  placeholder="Search action / subject / actor"
                  value={auditQ}
                  onChange={(e) => setAuditQ(e.target.value)}
                />
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  Search
                </button>
              </form>
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Subject</th>
                    <th>Actor</th>
                    <th>Reason</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((e) => (
                    <tr key={e.id}>
                      <td className="mono">{e.action}</td>
                      <td>
                        {e.subjectType}
                        {e.subjectId ? ` · ${e.subjectId.slice(0, 8)}` : ""}
                      </td>
                      <td className="mono">{e.actorId?.slice(0, 8) ?? "—"}</td>
                      <td>{e.reasonCode ?? "—"}</td>
                      <td>{new Date(e.occurredAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {nav === "breakglass" ? (
            <div className="stack">
              <h1>Emergency access</h1>
              <p className="muted warn-copy">
                Time-bound privileged session (max 30 minutes). Heavily audited.
              </p>
              <button
                className="btn btn-danger"
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const reason = await askReason(
                      "incident_review",
                      "Why are you opening emergency access?",
                    );
                    if (!reason || reason.trim().length < 4) return;
                    await openBreakGlass(token, reason.trim());
                    await refresh();
                  })
                }
              >
                Open for 30 minutes
              </button>
              <table className="table">
                <thead>
                  <tr>
                    <th>Reason</th>
                    <th>Expires</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {glass.map((s) => (
                    <tr key={s.id}>
                      <td>{s.reason}</td>
                      <td>{new Date(s.expiresAt).toLocaleString()}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await closeBreakGlass(token, s.id);
                              await refresh();
                            })
                          }
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {nav === "finance-home" ? (
            <div className="stack finance-home">
              <header className="finance-home-head">
                <h1>Finance</h1>
                <p className="muted">
                  See what the company keeps. Then clear what needs you.
                </p>
              </header>
              {financeHome ? (
                <>
                  <section
                    className="income-board"
                    aria-label={financeHome.companyIncome.label}
                  >
                    <div className="income-board-main">
                      <div className="income-meta">
                        <p className="income-label">
                          {financeHome.companyIncome.label}
                        </p>
                        <p className="income-period">
                          {financeHome.companyIncome.periodLabel}
                          {financeHome.companyIncome.isDemo ? (
                            <span className="income-demo"> · Demo</span>
                          ) : null}
                        </p>
                      </div>
                      <p className="income-amount">
                        {formatZar(financeHome.companyIncome.amountCents)}
                      </p>
                      <p className="income-definition">
                        {financeHome.companyIncome.definition}
                      </p>
                    </div>
                    <ul className="income-supports">
                      {financeHome.companyIncome.supports.map((row) => (
                        <li key={row.key}>
                          <span className="income-support-label">
                            {row.label}
                            <span className="income-support-hint">{row.hint}</span>
                          </span>
                          <span className="income-support-value">
                            {formatZar(row.amountCents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="needs-board" aria-label="Needs you">
                    <div className="needs-board-head">
                      <h2>Needs you</h2>
                      <p className="muted">
                        Refunds above {formatZar(financeHome.thresholdCents)} wait
                        for Finance approve.
                      </p>
                    </div>
                    <ul className="needs-list">
                      {(
                        [
                          [
                            "Failed payments",
                            "Last 7 days",
                            String(financeHome.needsYou.failedPayments),
                            "payments" as Nav,
                          ],
                          [
                            "Frozen earnings",
                            formatZar(financeHome.needsYou.frozenEarningsCents),
                            String(financeHome.needsYou.frozenEarnings),
                            "earnings" as Nav,
                          ],
                          [
                            "Payouts",
                            "Failed or partial",
                            String(financeHome.needsYou.payoutBatchesAttention),
                            "batches" as Nav,
                          ],
                          [
                            "Reconcile",
                            "Open over 48 hours",
                            String(financeHome.needsYou.staleReconcile),
                            "reconcile" as Nav,
                          ],
                          [
                            "Adjustments",
                            "Waiting approve",
                            String(financeHome.needsYou.pendingAdjustments),
                            "adjustments" as Nav,
                          ],
                        ] as const
                      ).map(([label, hint, value, target]) => (
                        <li key={label}>
                          <button
                            type="button"
                            className="needs-row"
                            onClick={() => setNav(target)}
                          >
                            <span className="needs-copy">
                              <span className="needs-label">{label}</span>
                              <span className="needs-hint">{hint}</span>
                            </span>
                            <span className="needs-value">{value}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {Object.values(financeHome.needsYou).every((n) => n === 0) ? (
                      <p className="muted needs-quiet">
                        Finance is quiet. Nothing needs you.
                      </p>
                    ) : null}
                  </section>
                </>
              ) : (
                <p className="muted">Loading…</p>
              )}
            </div>
          ) : null}

          {nav === "payments" ? (
            <div className="stack">
              <h1>Payments</h1>
              <p className="muted">PSP status for consumer charges.</p>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(refresh);
                }}
              >
                <select
                  value={payStatusFilter}
                  onChange={(e) => setPayStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="failed">failed</option>
                  <option value="declined">declined</option>
                  <option value="pending">pending</option>
                  <option value="captured">captured</option>
                  <option value="refunded">refunded</option>
                </select>
                <button type="submit" disabled={busy}>
                  Refresh
                </button>
              </form>
              <table className="table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Provider</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {financePayments.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => {
                            setJobMoneyQ(p.jobPublicCode);
                            setNav("job-money");
                          }}
                        >
                          {p.jobPublicCode}
                        </button>
                      </td>
                      <td>{formatZar(p.amountCents)}</td>
                      <td>
                        {p.status}
                        {p.failureCode ? ` (${p.failureCode})` : ""}
                      </td>
                      <td>{p.provider}</td>
                      <td>{new Date(p.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {financePayments.length === 0 ? (
                <p className="muted">No payments match.</p>
              ) : null}
            </div>
          ) : null}

          {nav === "adjustments" ? (
            <div className="stack">
              <h1>Adjustments</h1>
              <p className="muted">
                Large Support refunds waiting for Finance approve or reject.
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Amount</th>
                    <th>Reason</th>
                    <th>Who</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{a.jobPublicCode}</td>
                      <td>{formatZar(a.amountCents)}</td>
                      <td>{a.reasonCode}</td>
                      <td>{a.requesterEmail ?? "—"}</td>
                      <td className="row-actions">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await approveAdjustment(token, a.id);
                              await refresh();
                            })
                          }
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await rejectAdjustment(token, a.id, "rejected");
                              await refresh();
                            })
                          }
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {adjustments.length === 0 ? (
                <p className="muted">No adjustments waiting.</p>
              ) : null}
            </div>
          ) : null}

          {nav === "statements" ? (
            <div className="stack">
              <h1>Statements</h1>
              <p className="muted">
                Organisation weekly statements. Enterprise can still download theirs.
              </p>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!statementOrgId) return;
                  void run(async () => {
                    await generateFinanceStatement(token, statementOrgId);
                    await refresh();
                  });
                }}
              >
                <select
                  value={statementOrgId}
                  onChange={(e) => setStatementOrgId(e.target.value)}
                >
                  <option value="">Organisation…</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={busy || !statementOrgId}>
                  Generate statement
                </button>
              </form>
              <table className="table">
                <thead>
                  <tr>
                    <th>Org</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {statements.map((s) => (
                    <tr key={s.id}>
                      <td>{s.orgName}</td>
                      <td>{formatZar(s.totalCents)}</td>
                      <td>{s.status}</td>
                      <td>{new Date(s.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <section className="page-section">
                <h2>Credit note</h2>
                <p className="muted">
                  Memo credit only — does not auto-refund the card.
                </p>
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const cents = Math.round(Number(creditForm.amountRands) * 100);
                    if (!Number.isFinite(cents) || cents <= 0) {
                      setError("Enter a credit amount in rands");
                      return;
                    }
                    void run(async () => {
                      await createCreditNote(token, {
                        amountCents: cents,
                        reasonCode: creditForm.reasonCode,
                        orgId: creditForm.orgId || undefined,
                        jobId: creditForm.jobId || undefined,
                      });
                      setCreditForm({
                        amountRands: "",
                        reasonCode: "goodwill",
                        orgId: "",
                        jobId: "",
                      });
                    });
                  }}
                >
                  <input
                    placeholder="Amount (R)"
                    value={creditForm.amountRands}
                    onChange={(e) =>
                      setCreditForm((f) => ({ ...f, amountRands: e.target.value }))
                    }
                  />
                  <input
                    placeholder="Reason code"
                    value={creditForm.reasonCode}
                    onChange={(e) =>
                      setCreditForm((f) => ({ ...f, reasonCode: e.target.value }))
                    }
                  />
                  <input
                    placeholder="Org id (optional)"
                    value={creditForm.orgId}
                    onChange={(e) =>
                      setCreditForm((f) => ({ ...f, orgId: e.target.value }))
                    }
                  />
                  <button type="submit" disabled={busy}>
                    Record credit
                  </button>
                </form>
              </section>
            </div>
          ) : null}

          {nav === "reconcile" ? (
            <div className="stack">
              <h1>Reconcile</h1>
              <p className="muted">Manual match — no auto engine.</p>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const cents = Math.round(Number(reconcileForm.amountRands) * 100);
                  if (!Number.isFinite(cents)) {
                    setError("Enter an amount in rands");
                    return;
                  }
                  void run(async () => {
                    await createReconcileItem(token, {
                      source: reconcileForm.source,
                      amountCents: cents,
                      externalRef: reconcileForm.externalRef || undefined,
                    });
                    setReconcileForm({
                      source: "manual",
                      amountRands: "",
                      externalRef: "",
                    });
                    await refresh();
                  });
                }}
              >
                <input
                  placeholder="Source"
                  value={reconcileForm.source}
                  onChange={(e) =>
                    setReconcileForm((f) => ({ ...f, source: e.target.value }))
                  }
                />
                <input
                  placeholder="Amount (R)"
                  value={reconcileForm.amountRands}
                  onChange={(e) =>
                    setReconcileForm((f) => ({ ...f, amountRands: e.target.value }))
                  }
                />
                <input
                  placeholder="External ref"
                  value={reconcileForm.externalRef}
                  onChange={(e) =>
                    setReconcileForm((f) => ({ ...f, externalRef: e.target.value }))
                  }
                />
                <button type="submit" disabled={busy}>
                  Add open item
                </button>
              </form>
              <table className="table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Amount</th>
                    <th>Ref</th>
                    <th>Match job id</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {reconcileItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.source}</td>
                      <td>{formatZar(item.amountCents)}</td>
                      <td className="mono">{item.externalRef ?? "—"}</td>
                      <td>
                        <input
                          placeholder="job uuid"
                          value={matchJobId[item.id] ?? ""}
                          onChange={(e) =>
                            setMatchJobId((m) => ({
                              ...m,
                              [item.id]: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="row-actions">
                        <button
                          type="button"
                          disabled={busy || !matchJobId[item.id]?.trim()}
                          onClick={() =>
                            void run(async () => {
                              await matchReconcileItem(
                                token,
                                item.id,
                                matchJobId[item.id]!.trim(),
                              );
                              await refresh();
                            })
                          }
                        >
                          Match
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await waiveReconcileItem(token, item.id, "waived");
                              await refresh();
                            })
                          }
                        >
                          Waive
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reconcileItems.length === 0 ? (
                <p className="muted">No open reconcile items.</p>
              ) : null}
            </div>
          ) : null}

          {nav === "exports" ? (
            <div className="stack">
              <h1>Exports</h1>
              <p className="muted">Download CSV zip for a date range.</p>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const blob = await downloadFinanceExport(token, {
                      from: new Date(exportFrom).toISOString(),
                      to: new Date(`${exportTo}T23:59:59`).toISOString(),
                      datasets: [
                        "payments",
                        "earnings",
                        "payout_batches",
                        "org_statements",
                        "credit_notes",
                        "reconcile_items",
                      ],
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "vuush-finance-export.zip";
                    a.click();
                    URL.revokeObjectURL(url);
                  });
                }}
              >
                <label>
                  From
                  <input
                    type="date"
                    value={exportFrom}
                    onChange={(e) => setExportFrom(e.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={exportTo}
                    onChange={(e) => setExportTo(e.target.value)}
                  />
                </label>
                <button type="submit" disabled={busy}>
                  Download zip
                </button>
              </form>
            </div>
          ) : null}

          {nav === "audit-packs" ? (
            <div className="stack">
              <h1>Audit packs</h1>
              <p className="muted">
                Diligence zip for a window — jobs, money, audit events.
              </p>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await createAuditPack(token, {
                      from: new Date(exportFrom).toISOString(),
                      to: new Date(`${exportTo}T23:59:59`).toISOString(),
                    });
                    await refresh();
                  });
                }}
              >
                <label>
                  From
                  <input
                    type="date"
                    value={exportFrom}
                    onChange={(e) => setExportFrom(e.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={exportTo}
                    onChange={(e) => setExportTo(e.target.value)}
                  />
                </label>
                <button type="submit" disabled={busy}>
                  Create pack
                </button>
              </form>
              <table className="table">
                <thead>
                  <tr>
                    <th>Range</th>
                    <th>Status</th>
                    <th>When</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {auditPacks.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {new Date(p.periodStart).toLocaleDateString()} –{" "}
                        {new Date(p.periodEnd).toLocaleDateString()}
                      </td>
                      <td>{p.status}</td>
                      <td>{new Date(p.createdAt).toLocaleString()}</td>
                      <td>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const blob = await downloadAuditPack(token, p.id);
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `vuush-audit-pack-${p.id.slice(0, 8)}.zip`;
                              a.click();
                              URL.revokeObjectURL(url);
                            })
                          }
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {nav === "earnings" ? (
            <div className="stack">
              <h1>Earnings</h1>
              <p className="muted">
                What drivers are owed. Filter by driver or freeze. Frozen lines never
                enter a payout.
              </p>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(refresh);
                }}
              >
                <input
                  placeholder="Driver user id (uuid)"
                  value={earnDriver}
                  onChange={(e) => setEarnDriver(e.target.value)}
                />
                <select
                  value={earnFrozen}
                  onChange={(e) => setEarnFrozen(e.target.value)}
                  aria-label="Frozen filter"
                >
                  <option value="">Frozen: all</option>
                  <option value="false">Unfrozen only</option>
                  <option value="true">Frozen only</option>
                </select>
                <select
                  value={earnStatus}
                  onChange={(e) => setEarnStatus(e.target.value)}
                  aria-label="Status filter"
                >
                  <option value="">Status: all</option>
                  <option value="pending">pending</option>
                  <option value="included">included</option>
                  <option value="paid">paid</option>
                </select>
                <button className="btn btn-secondary" type="submit" disabled={busy}>
                  Apply
                </button>
              </form>
              {assignJobId ? (
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const driverUserId = assignDriverId.trim();
                    if (!driverUserId) {
                      setError("Paste the driver’s user id first");
                      return;
                    }
                    void run(async () => {
                      await assignDriverToEarning(
                        token,
                        assignJobId,
                        driverUserId,
                      );
                      setAssignJobId(null);
                      setAssignDriverId("");
                      await refresh();
                    });
                  }}
                >
                  <p className="muted">
                    Assign a driver to this job’s earnings, then you can pay them.
                  </p>
                  <label className="field-label">
                    Driver user id
                    <input
                      value={assignDriverId}
                      onChange={(e) => setAssignDriverId(e.target.value)}
                      placeholder="Paste driver user id here"
                      autoFocus
                    />
                  </label>
                  <div className="actions-cell">
                    <button className="btn btn-primary" type="submit" disabled={busy}>
                      Save driver
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => {
                        setAssignJobId(null);
                        setAssignDriverId("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              <table className="table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Driver</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Frozen</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((row) => (
                    <tr key={row.id}>
                      <td className="mono">{row.jobPublicCode}</td>
                      <td>
                        {row.driverUserId ? (
                          <div>
                            <div>{driverLabel(row)}</div>
                            <div className="mono muted id-block">
                              {row.driverUserId}
                            </div>
                          </div>
                        ) : (
                          <span className="muted">Not assigned yet</span>
                        )}
                      </td>
                      <td>{formatZar(row.amountCents)}</td>
                      <td className="mono">{row.status}</td>
                      <td>
                        {row.frozen ? (
                          <span className="chip off">
                            {row.freezeReason ?? "frozen"}
                          </span>
                        ) : (
                          <span className="chip ok">open</span>
                        )}
                      </td>
                      <td className="actions-cell">
                        {!row.driverUserId ? (
                          <button
                            className="btn btn-secondary"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setAssignJobId(row.jobId);
                              setAssignDriverId("");
                              setError(null);
                            }}
                          >
                            Assign driver
                          </button>
                        ) : null}
                        {row.driverUserId &&
                        row.status === "pending" &&
                        !row.frozen ? (
                          <button
                            className="btn btn-primary"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              const driverId = row.driverUserId!;
                              void run(async () => {
                                const created = await createPayoutBatch(
                                  token,
                                  driverId,
                                );
                                setBatchDriver(driverId);
                                setConfirmPay(true);
                                setNav("batches");
                                setBatches(
                                  (await fetchPayoutBatches(token)).batches,
                                );
                                setBatchDetail(
                                  await fetchPayoutBatch(
                                    token,
                                    created.batch.id,
                                  ),
                                );
                              });
                            }}
                          >
                            Pay
                          </button>
                        ) : null}
                        {!row.frozen ? (
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await freezeJobEarnings(
                                  token,
                                  row.jobId,
                                  "manual_freeze",
                                );
                                await refresh();
                              })
                            }
                          >
                            Freeze
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {earnings.length === 0 ? (
                <p className="muted">No earnings match these filters.</p>
              ) : null}
            </div>
          ) : null}

          {nav === "batches" ? (
            <div className="stack">
              <h1>Payouts</h1>
              <p className="muted">
                Three steps: pick who to pay → check the summary → confirm pay.
              </p>

              {!batchDetail ? (
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const driverUserId = batchDriver.trim();
                    if (!driverUserId) return;
                    void run(async () => {
                      const created = await createPayoutBatch(
                        token,
                        driverUserId,
                      );
                      setConfirmPay(true);
                      setBatches((await fetchPayoutBatches(token)).batches);
                      setBatchDetail(
                        await fetchPayoutBatch(token, created.batch.id),
                      );
                    });
                  }}
                >
                  {payableDrivers.length > 0 ? (
                    <label className="field-label">
                      Who to pay
                      <select
                        value={batchDriver}
                        onChange={(e) => setBatchDriver(e.target.value)}
                        required
                      >
                        <option value="">Select a driver…</option>
                        {payableDrivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label} · {formatZar(d.pendingCents)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="muted">
                      Nobody is ready to pay. On Earnings, assign a driver first,
                      or use Pay on a row that already has one.
                    </p>
                  )}
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={busy || !batchDriver}
                  >
                    Review pay
                  </button>
                </form>
              ) : null}

              {batchDetail ? (
                <section className="page-section pay-summary">
                  <h2>
                    {confirmPay &&
                    (batchDetail.batch.status === "open" ||
                      batchDetail.batch.status === "processing")
                      ? "Check before you pay"
                      : "Payout summary"}
                  </h2>
                  {batchDetail.items.map((item) => (
                    <dl className="stat-list" key={item.id}>
                      <div>
                        <dt>Driver</dt>
                        <dd>{driverLabel(item)}</dd>
                      </div>
                      <div>
                        <dt>Email</dt>
                        <dd>{item.driverEmail ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Amount</dt>
                        <dd>{formatZar(item.amountCents)}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{batchDetail.batch.status}</dd>
                      </div>
                      <div>
                        <dt>Jobs</dt>
                        <dd>
                          {batchDetail.earnings.length > 0
                            ? batchDetail.earnings
                                .map((e) => e.jobPublicCode)
                                .join(", ")
                            : "—"}
                        </dd>
                      </div>
                      {item.providerTransferId ? (
                        <div>
                          <dt>Transfer ref</dt>
                          <dd className="mono">{item.providerTransferId}</dd>
                        </div>
                      ) : null}
                      {item.failureCode ? (
                        <div>
                          <dt>Failure</dt>
                          <dd className="mono">{item.failureCode}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ))}

                  {confirmPay &&
                  (batchDetail.batch.status === "open" ||
                    batchDetail.batch.status === "processing") ? (
                    <div className="actions-cell">
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await executePayoutBatch(
                              token,
                              batchDetail.batch.id,
                            );
                            setConfirmPay(false);
                            setBatchDetail(
                              await fetchPayoutBatch(
                                token,
                                batchDetail.batch.id,
                              ),
                            );
                            setBatches(
                              (await fetchPayoutBatches(token)).batches,
                            );
                          })
                        }
                      >
                        Confirm pay {formatZar(batchDetail.batch.totalCents)}
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setConfirmPay(false);
                          setBatchDetail(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="actions-cell">
                      {(batchDetail.batch.status === "open" ||
                        batchDetail.batch.status === "processing") && (
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={() => setConfirmPay(true)}
                        >
                          Pay this driver
                        </button>
                      )}
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => {
                          setConfirmPay(false);
                          setBatchDetail(null);
                        }}
                      >
                        Back
                      </button>
                    </div>
                  )}
                </section>
              ) : null}

              {batches.length > 0 ? (
                <section className="page-section">
                  <h2>Recent payouts</h2>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Status</th>
                        <th>Total</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((b) => (
                        <tr key={b.id}>
                          <td>{new Date(b.createdAt).toLocaleString()}</td>
                          <td>{b.status}</td>
                          <td>{formatZar(b.totalCents)}</td>
                          <td>
                            <button
                              className="btn btn-ghost"
                              type="button"
                              onClick={() =>
                                void run(async () => {
                                  setConfirmPay(false);
                                  setBatchDetail(
                                    await fetchPayoutBatch(token, b.id),
                                  );
                                })
                              }
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ) : null}
            </div>
          ) : null}

          {nav === "job-money" ? (
            <div className="stack">
              <h1>Job ledger</h1>
              <p className="muted">
                What the customer paid and what the driver earned on one job.
              </p>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = jobMoneyQ.trim();
                  if (!q) return;
                  void run(async () => {
                    setJobMoney(await fetchJobMoney(token, q));
                  });
                }}
              >
                <input
                  placeholder="Job id or public code"
                  value={jobMoneyQ}
                  onChange={(e) => setJobMoneyQ(e.target.value)}
                />
                <button className="btn btn-secondary" type="submit" disabled={busy}>
                  Look up
                </button>
              </form>
              {jobMoney ? (
                <>
                  <p>
                    <strong className="mono">{jobMoney.job.publicCode}</strong>
                    <span className="muted">
                      {" "}
                      · {jobMoney.job.state} · payment {jobMoney.job.paymentStatus}
                      {jobMoney.job.orgId
                        ? ` · org ${jobMoney.job.orgId.slice(0, 8)}…`
                        : ""}
                    </span>
                  </p>
                  <h2>Payments</h2>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobMoney.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="mono">{p.provider}</td>
                          <td>{formatZar(p.amountCents)}</td>
                          <td className="mono">{p.status}</td>
                          <td className="mono">
                            {p.providerPaymentId ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {jobMoney.payments.length === 0 ? (
                    <p className="muted">No payments.</p>
                  ) : null}
                  <h2>Earnings</h2>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Frozen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobMoney.earnings.map((e) => (
                        <tr key={e.id}>
                          <td className="mono">
                            {e.driverUserId
                              ? `${e.driverUserId.slice(0, 8)}…`
                              : "—"}
                          </td>
                          <td>{formatZar(e.amountCents)}</td>
                          <td className="mono">{e.status}</td>
                          <td>
                            {e.frozen ? (
                              <span className="chip off">
                                {e.freezeReason ?? "frozen"}
                              </span>
                            ) : (
                              <span className="chip ok">open</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {jobMoney.earnings.length === 0 ? (
                    <p className="muted">No earnings.</p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetchMe(token)
      .then((me) => setUser(me.user))
      .catch(() => {
        clearStoredToken();
        setToken(null);
      });
  }, [token]);

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
    <Console
      token={token}
      user={user}
      onSignOut={() => {
        clearStoredToken();
        setToken(null);
        setUser(null);
      }}
    />
  );
}
