import { useEffect, useState } from "react";
import {
  assignDevRole,
  closeBreakGlass,
  assignDriverToEarning,
  createPayoutBatch,
  createZone,
  executePayoutBatch,
  fetchAdminHome,
  fetchAudit,
  fetchBreakGlass,
  fetchFinanceEarnings,
  fetchFlags,
  fetchJobMoney,
  fetchMe,
  fetchPayoutBatch,
  fetchPayoutBatches,
  fetchPricing,
  fetchProhibited,
  fetchReasonCodes,
  fetchServiceTypes,
  createOrganisation,
  fetchDriverApplications,
  fetchOrganisations,
  fetchStaff,
  fetchZones,
  freezeJobEarnings,
  grantRole,
  inviteOrgMember,
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
const TOKEN_KEY_LEGACY = "swift.admin.token";

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
  | "earnings"
  | "batches"
  | "job-money"
  | "audit"
  | "breakglass";

function formatZar(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
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
  const [email, setEmail] = useState("admin@vuush.local");
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

function askReason(defaultCode = "admin_change") {
  const reason = window.prompt("Reason code for this change", defaultCode);
  return reason?.trim() || null;
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

  type PlaceId = "home" | "city" | "money" | "people" | "activity";

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
      id: "money",
      label: "Money",
      items: [
        { id: "job-money", label: "Job money" },
        { id: "earnings", label: "Earnings" },
        { id: "batches", label: "Payouts" },
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

          {nav === "home" && home ? (
            <div className="stack">
              <header className="page-head">
                <h1>Home</h1>
                <p className="muted">How the city is configured right now.</p>
              </header>
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
                    const reason = askReason("zone_create");
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
                              const reason = askReason("zone_deactivate");
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
                      <td>{s.baseFeeCents}</td>
                      <td>{s.perKmFeeCents}</td>
                      <td>{s.priorityMultiplier}</td>
                      <td>{s.active ? "yes" : "no"}</td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const reason = askReason("service_toggle");
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
                          Toggle
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
                              const reason = askReason("reason_toggle");
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
                          Toggle
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
                M7 E0 — create Cape Town pilot orgs and invite an Org Admin. Portal booking comes in E1.
              </p>

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
                          ) : (
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
                              Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
                                const reason = askReason("role_grant");
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
                                const reason = askReason("role_revoke");
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
                              const reason = askReason("goods_toggle");
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
                          Toggle
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
                    const reason = window.prompt(
                      "Why are you opening emergency access?",
                      "incident_review",
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
              <h1>Job money</h1>
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
