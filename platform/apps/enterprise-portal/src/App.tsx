import { useEffect, useState } from "react";
import {
  approveJob,
  confirmEnterpriseJob,
  createApiKey,
  createJob,
  createMultiStopJob,
  createSite,
  fetchApiKeys,
  fetchApprovals,
  fetchCatalog,
  fetchEnterpriseHome,
  fetchEnterpriseSession,
  fetchJobs,
  fetchMembers,
  fetchSites,
  fetchStatements,
  fetchZones,
  formatZar,
  generateStatement,
  inviteMember,
  quoteEnterpriseJob,
  rejectJob,
  requestOtp,
  revokeApiKey,
  setApprovalThreshold,
  verifyOtp,
  type EnterpriseJob,
  type EnterpriseQuote,
  type OrgMember,
  type OrgMembership,
  type OrgSite,
  type SessionUser,
} from "./api";

type Nav =
  | "home"
  | "ship"
  | "approvals"
  | "billing"
  | "keys"
  | "sites"
  | "people";
type BookStep = "form" | "quote" | "done";
type ShipMode = "single" | "multi";

const TOKEN_KEY = "vuush.enterprise.token";
const ORG_KEY = "vuush.enterprise.org";

function readToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function writeToken(value: string) {
  localStorage.setItem(TOKEN_KEY, value);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
function readOrgId() {
  return localStorage.getItem(ORG_KEY);
}
function writeOrgId(value: string) {
  localStorage.setItem(ORG_KEY, value);
}

function canManageSites(role: string) {
  return role === "org_admin" || role === "booker";
}
function canManagePeople(role: string) {
  return role === "org_admin";
}
function canBook(role: string) {
  return role === "org_admin" || role === "booker";
}
function canApprove(role: string) {
  return role === "org_admin" || role === "approver";
}
function canManageOrg(role: string) {
  return role === "org_admin";
}

function downloadCsv(filename: string, csvBody: string) {
  const blob = new Blob([csvBody], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [user, setUser] = useState<SessionUser | null>(null);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(() => readOrgId());
  const [nav, setNav] = useState<Nav>("home");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  const [home, setHome] = useState<Awaited<
    ReturnType<typeof fetchEnterpriseHome>
  > | null>(null);
  const [sites, setSites] = useState<OrgSite[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [zones, setZones] = useState<Array<{ code: string; name: string }>>([]);
  const [jobs, setJobs] = useState<EnterpriseJob[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<EnterpriseJob[]>([]);
  const [statements, setStatements] = useState<
    Awaited<ReturnType<typeof fetchStatements>>["statements"]
  >([]);
  const [apiKeys, setApiKeys] = useState<
    Awaited<ReturnType<typeof fetchApiKeys>>["keys"]
  >([]);
  const [serviceTypes, setServiceTypes] = useState<
    Array<{ code: string; name: string }>
  >([]);
  const [bookStep, setBookStep] = useState<BookStep>("form");
  const [shipMode, setShipMode] = useState<ShipMode>("single");
  const [draftJob, setDraftJob] = useState<EnterpriseJob | null>(null);
  const [quote, setQuote] = useState<EnterpriseQuote | null>(null);
  const [sentForApproval, setSentForApproval] = useState(false);
  const [bookForm, setBookForm] = useState({
    pickupSiteId: "",
    pickupAddress: "",
    pickupZoneCode: "",
    dropoffAddress: "",
    dropoffZoneCode: "",
    packageClass: "small" as "small" | "medium" | "large",
    serviceTypeCode: "",
    recipientName: "",
  });
  const [multiForm, setMultiForm] = useState({
    addresses: "",
    zoneCode: "",
    packageClass: "small" as "small" | "medium" | "large",
    serviceTypeCode: "",
  });
  const [thresholdRands, setThresholdRands] = useState("");
  const [keyName, setKeyName] = useState("");

  const [siteForm, setSiteForm] = useState({
    label: "",
    address: "",
    zoneCode: "",
    kind: "warehouse" as "warehouse" | "store" | "other",
  });
  const [inviteForm, setInviteForm] = useState({
    email: "",
    displayName: "",
    role: "booker" as "org_admin" | "booker" | "approver" | "viewer",
  });

  const active = memberships.find((m) => m.orgId === orgId) ?? memberships[0];
  const role = active?.role ?? "";

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

  async function bootstrap(accessToken: string, preferredOrg?: string | null) {
    const session = await fetchEnterpriseSession(accessToken);
    setUser(session.user);
    setMemberships(session.memberships);
    const nextOrg =
      session.memberships.find((m) => m.orgId === preferredOrg)?.orgId ??
      session.memberships[0]?.orgId ??
      null;
    if (nextOrg) {
      setOrgId(nextOrg);
      writeOrgId(nextOrg);
    }
  }

  useEffect(() => {
    if (!token) return;
    void run(async () => {
      await bootstrap(token, orgId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !orgId || !user) return;
    void run(async () => {
      if (nav === "home") setHome(await fetchEnterpriseHome(token, orgId));
      if (nav === "ship") {
        setJobs((await fetchJobs(token, orgId)).jobs);
        setSites((await fetchSites(token, orgId)).sites);
        const catalog = await fetchCatalog(token, orgId);
        setServiceTypes(catalog.serviceTypes);
        setZones(catalog.zones);
        if (!bookForm.serviceTypeCode && catalog.serviceTypes[0]) {
          setBookForm((f) => ({
            ...f,
            serviceTypeCode: catalog.serviceTypes[0].code,
            pickupZoneCode: f.pickupZoneCode || catalog.zones[0]?.code || "",
            dropoffZoneCode:
              f.dropoffZoneCode ||
              catalog.zones[1]?.code ||
              catalog.zones[0]?.code ||
              "",
          }));
        }
        if (!multiForm.serviceTypeCode && catalog.serviceTypes[0]) {
          setMultiForm((f) => ({
            ...f,
            serviceTypeCode: catalog.serviceTypes[0].code,
            zoneCode: f.zoneCode || catalog.zones[0]?.code || "",
          }));
        }
      }
      if (nav === "approvals") {
        setPendingApprovals((await fetchApprovals(token, orgId)).jobs);
      }
      if (nav === "billing") {
        setStatements((await fetchStatements(token, orgId)).statements);
      }
      if (nav === "keys") {
        setApiKeys((await fetchApiKeys(token, orgId)).keys);
      }
      if (nav === "sites") {
        setSites((await fetchSites(token, orgId)).sites);
        setZones((await fetchZones(token, orgId)).zones);
      }
      if (nav === "people") setMembers((await fetchMembers(token, orgId)).members);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, orgId, nav, user?.id]);

  if (!token || !user || !active) {
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
          <h1>Sign in</h1>
          <p className="lede">Org Admin and team members use email codes.</p>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (!challengeId) {
                  const res = await requestOtp(email.trim());
                  setChallengeId(res.challengeId);
                  setDevCode(res.devCode ?? null);
                  if (res.devCode) setOtp(res.devCode);
                  return;
                }
                const res = await verifyOtp(challengeId, otp.trim());
                if (res.status !== "authenticated" || !res.session?.accessToken) {
                  throw new Error(res.status || "auth_failed");
                }
                writeToken(res.session.accessToken);
                setToken(res.session.accessToken);
                await bootstrap(res.session.accessToken);
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
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={Boolean(challengeId)}
              required
            />
            {challengeId ? (
              <>
                <label className="label" htmlFor="otp">
                  Code
                </label>
                <input
                  id="otp"
                  className="field"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
              </>
            ) : null}
            {devCode ? <p className="hint">Dev code: {devCode}</p> : null}
            {error ? <p className="error">{error}</p> : null}
            <button className="cta" type="submit" disabled={busy}>
              {challengeId ? "Enter" : "Send code"}
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="bar">
        <div className="lockup">
          <span className="mark" aria-hidden="true" />
          <span className="word">VUUSH</span>
        </div>
        <nav className="nav" aria-label="Primary">
          {(
            [
              ["home", "Home"],
              ["ship", "Ship"],
              ["approvals", "Approvals"],
              ["billing", "Billing"],
              ["keys", "Keys"],
              ["sites", "Sites"],
              ["people", "People"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={nav === id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setNotice(null);
                setNav(id);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="bar-right">
          {memberships.length > 1 ? (
            <select
              className="org-select"
              value={active.orgId}
              onChange={(e) => {
                writeOrgId(e.target.value);
                setOrgId(e.target.value);
              }}
              aria-label="Organisation"
            >
              {memberships.map((m) => (
                <option key={m.orgId} value={m.orgId}>
                  {m.orgName}
                </option>
              ))}
            </select>
          ) : (
            <span className="meta">{active.orgName}</span>
          )}
          <button
            type="button"
            className="nav-item"
            onClick={() => {
              clearToken();
              setToken(null);
              setUser(null);
              setMemberships([]);
              setChallengeId(null);
              setOtp("");
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="main">
        {error ? <p className="error">{error}</p> : null}
        {notice ? <p className="hint">{notice}</p> : null}

        {nav === "home" && home ? (
          <section className="stack">
            <p className="eyebrow">{home.org.cityCode}</p>
            <h1>{home.org.name}</h1>
            <p className="lede">
              You are signed in as {role.replaceAll("_", " ")}. Pay mode:{" "}
              {home.org.payMode}. Book under Ship — statement orgs confirm
              without a card.
            </p>
            <ul className="stat-list">
              <li>
                <span className="stat-n">{home.stats.liveShipments}</span>
                <span className="stat-l">Live shipments</span>
              </li>
              <li>
                <span className="stat-n">{home.stats.todayShipments}</span>
                <span className="stat-l">Created today</span>
              </li>
              <li>
                <span className="stat-n">{home.stats.pendingApprovals}</span>
                <span className="stat-l">Pending approvals</span>
              </li>
              <li>
                <span className="stat-n">{home.stats.sites}</span>
                <span className="stat-l">Sites</span>
              </li>
              <li>
                <span className="stat-n">{home.stats.members}</span>
                <span className="stat-l">People</span>
              </li>
            </ul>
          </section>
        ) : null}

        {nav === "ship" ? (
          <section className="stack">
            <h1>Shipments</h1>
            <p className="lede">
              Single-stop and multi-stop bookings for this organisation. Weekly
              statement billing — no card at confirm.
            </p>

            {canBook(role) ? (
              <div className="panel stack">
                {bookStep === "form" ? (
                  <>
                    <div className="stack">
                      <button
                        type="button"
                        className={
                          shipMode === "single" ? "nav-item active" : "nav-item"
                        }
                        onClick={() => setShipMode("single")}
                      >
                        Single stop
                      </button>
                      <button
                        type="button"
                        className={
                          shipMode === "multi" ? "nav-item active" : "nav-item"
                        }
                        onClick={() => setShipMode("multi")}
                      >
                        Multi stop
                      </button>
                    </div>

                    {shipMode === "single" ? (
                      <form
                        className="stack"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void run(async () => {
                            const created = await createJob(token, active.orgId, {
                              serviceTypeCode: bookForm.serviceTypeCode,
                              packageClass: bookForm.packageClass,
                              pickupAddress: bookForm.pickupAddress.trim(),
                              pickupZoneCode: bookForm.pickupZoneCode,
                              dropoffAddress: bookForm.dropoffAddress.trim(),
                              dropoffZoneCode: bookForm.dropoffZoneCode,
                              recipientName:
                                bookForm.recipientName.trim() || undefined,
                              prohibitedGoodsDeclared: true,
                            });
                            const quoted = await quoteEnterpriseJob(
                              token,
                              active.orgId,
                              created.job.id,
                            );
                            setDraftJob(quoted.job);
                            setQuote(quoted.quote);
                            setSentForApproval(false);
                            setBookStep("quote");
                          });
                        }}
                      >
                        <h2>New shipment</h2>
                        {sites.length > 0 ? (
                          <>
                            <label className="label" htmlFor="pickup-site">
                              Pickup from site
                            </label>
                            <select
                              id="pickup-site"
                              className="field"
                              value={bookForm.pickupSiteId}
                              onChange={(e) => {
                                const site = sites.find(
                                  (s) => s.id === e.target.value,
                                );
                                setBookForm((f) => ({
                                  ...f,
                                  pickupSiteId: e.target.value,
                                  pickupAddress: site?.address ?? f.pickupAddress,
                                  pickupZoneCode:
                                    site?.zoneCode ?? f.pickupZoneCode,
                                }));
                              }}
                            >
                              <option value="">Manual address…</option>
                              {sites.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </>
                        ) : null}
                        <label className="label" htmlFor="pickup-addr">
                          Pickup address
                        </label>
                        <input
                          id="pickup-addr"
                          className="field"
                          value={bookForm.pickupAddress}
                          onChange={(e) =>
                            setBookForm((f) => ({
                              ...f,
                              pickupAddress: e.target.value,
                            }))
                          }
                          required
                        />
                        <label className="label" htmlFor="pickup-zone">
                          Pickup zone
                        </label>
                        <select
                          id="pickup-zone"
                          className="field"
                          value={bookForm.pickupZoneCode}
                          onChange={(e) =>
                            setBookForm((f) => ({
                              ...f,
                              pickupZoneCode: e.target.value,
                            }))
                          }
                          required
                        >
                          {zones.map((z) => (
                            <option key={z.code} value={z.code}>
                              {z.code} — {z.name}
                            </option>
                          ))}
                        </select>
                        <label className="label" htmlFor="drop-addr">
                          Dropoff address
                        </label>
                        <input
                          id="drop-addr"
                          className="field"
                          value={bookForm.dropoffAddress}
                          onChange={(e) =>
                            setBookForm((f) => ({
                              ...f,
                              dropoffAddress: e.target.value,
                            }))
                          }
                          required
                        />
                        <label className="label" htmlFor="drop-zone">
                          Dropoff zone
                        </label>
                        <select
                          id="drop-zone"
                          className="field"
                          value={bookForm.dropoffZoneCode}
                          onChange={(e) =>
                            setBookForm((f) => ({
                              ...f,
                              dropoffZoneCode: e.target.value,
                            }))
                          }
                          required
                        >
                          {zones.map((z) => (
                            <option key={z.code} value={z.code}>
                              {z.code} — {z.name}
                            </option>
                          ))}
                        </select>
                        <label className="label" htmlFor="pkg">
                          Package
                        </label>
                        <select
                          id="pkg"
                          className="field"
                          value={bookForm.packageClass}
                          onChange={(e) =>
                            setBookForm((f) => ({
                              ...f,
                              packageClass: e.target
                                .value as typeof f.packageClass,
                            }))
                          }
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                        <label className="label" htmlFor="svc">
                          Service
                        </label>
                        <select
                          id="svc"
                          className="field"
                          value={bookForm.serviceTypeCode}
                          onChange={(e) =>
                            setBookForm((f) => ({
                              ...f,
                              serviceTypeCode: e.target.value,
                            }))
                          }
                          required
                        >
                          {serviceTypes.map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <label className="label" htmlFor="recip">
                          Recipient
                        </label>
                        <input
                          id="recip"
                          className="field"
                          value={bookForm.recipientName}
                          onChange={(e) =>
                            setBookForm((f) => ({
                              ...f,
                              recipientName: e.target.value,
                            }))
                          }
                        />
                        <p className="hint">
                          I declare this shipment has no prohibited goods.
                        </p>
                        <button className="cta" type="submit" disabled={busy}>
                          Get quote
                        </button>
                      </form>
                    ) : (
                      <form
                        className="stack"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void run(async () => {
                            const lines = multiForm.addresses
                              .split("\n")
                              .map((line) => line.trim())
                              .filter(Boolean);
                            if (lines.length < 2) {
                              throw new Error(
                                "Enter at least two addresses (one per line).",
                              );
                            }
                            const created = await createMultiStopJob(
                              token,
                              active.orgId,
                              {
                                serviceTypeCode: multiForm.serviceTypeCode,
                                packageClass: multiForm.packageClass,
                                stops: lines.map((address) => ({
                                  address,
                                  zoneCode: multiForm.zoneCode,
                                })),
                                prohibitedGoodsDeclared: true,
                              },
                            );
                            const quoted = await quoteEnterpriseJob(
                              token,
                              active.orgId,
                              created.job.id,
                            );
                            setDraftJob(quoted.job);
                            setQuote(quoted.quote);
                            setSentForApproval(false);
                            setBookStep("quote");
                          });
                        }}
                      >
                        <h2>Multi-stop shipment</h2>
                        <p className="muted">
                          Stops run in your stop order — we do not reorder the
                          route.
                        </p>
                        <label className="label" htmlFor="multi-addrs">
                          Addresses (one per line, your stop order)
                        </label>
                        <textarea
                          id="multi-addrs"
                          className="field"
                          rows={6}
                          value={multiForm.addresses}
                          onChange={(e) =>
                            setMultiForm((f) => ({
                              ...f,
                              addresses: e.target.value,
                            }))
                          }
                          required
                        />
                        <label className="label" htmlFor="multi-zone">
                          Zone for all stops
                        </label>
                        <select
                          id="multi-zone"
                          className="field"
                          value={multiForm.zoneCode}
                          onChange={(e) =>
                            setMultiForm((f) => ({
                              ...f,
                              zoneCode: e.target.value,
                            }))
                          }
                          required
                        >
                          {zones.map((z) => (
                            <option key={z.code} value={z.code}>
                              {z.code} — {z.name}
                            </option>
                          ))}
                        </select>
                        <label className="label" htmlFor="multi-pkg">
                          Package
                        </label>
                        <select
                          id="multi-pkg"
                          className="field"
                          value={multiForm.packageClass}
                          onChange={(e) =>
                            setMultiForm((f) => ({
                              ...f,
                              packageClass: e.target
                                .value as typeof f.packageClass,
                            }))
                          }
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                        <label className="label" htmlFor="multi-svc">
                          Service
                        </label>
                        <select
                          id="multi-svc"
                          className="field"
                          value={multiForm.serviceTypeCode}
                          onChange={(e) =>
                            setMultiForm((f) => ({
                              ...f,
                              serviceTypeCode: e.target.value,
                            }))
                          }
                          required
                        >
                          {serviceTypes.map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <p className="hint">
                          I declare this shipment has no prohibited goods.
                        </p>
                        <button className="cta" type="submit" disabled={busy}>
                          Get quote
                        </button>
                      </form>
                    )}
                  </>
                ) : null}

                {bookStep === "quote" && draftJob && quote ? (
                  <div className="stack">
                    <h2>Quote</h2>
                    <p>
                      {formatZar(quote.totalCents)} ·{" "}
                      {quote.distanceKm.toFixed(1)} km
                    </p>
                    <p className="muted">
                      {draftJob.pickupAddress} → {draftJob.dropoffAddress}
                    </p>
                    <button
                      className="cta"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const res = await confirmEnterpriseJob(
                            token,
                            active.orgId,
                            draftJob.id,
                          );
                          setDraftJob(res.job);
                          setQuote(res.quote);
                          setSentForApproval(Boolean(res.needsApproval));
                          setBookStep("done");
                          setJobs((await fetchJobs(token, active.orgId)).jobs);
                        })
                      }
                    >
                      Confirm shipment
                    </button>
                    <button
                      className="nav-item"
                      type="button"
                      onClick={() => {
                        setBookStep("form");
                        setDraftJob(null);
                        setQuote(null);
                        setSentForApproval(false);
                      }}
                    >
                      Back
                    </button>
                  </div>
                ) : null}

                {bookStep === "done" && draftJob ? (
                  <div className="stack">
                    {sentForApproval ? (
                      <>
                        <h2>Sent for approval</h2>
                        <p className="muted">
                          {draftJob.publicCode} · {draftJob.state}
                        </p>
                      </>
                    ) : (
                      <>
                        <h2>Confirmed</h2>
                        <p>
                          {draftJob.publicCode} · {draftJob.state} ·{" "}
                          {draftJob.paymentStatus}
                        </p>
                      </>
                    )}
                    <button
                      className="cta"
                      type="button"
                      onClick={() => {
                        setBookStep("form");
                        setDraftJob(null);
                        setQuote(null);
                        setSentForApproval(false);
                        setBookForm((f) => ({
                          ...f,
                          dropoffAddress: "",
                          recipientName: "",
                        }));
                        setMultiForm((f) => ({ ...f, addresses: "" }));
                      }}
                    >
                      Book another
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="muted">
                Viewers and approvers cannot create shipments.
              </p>
            )}

            <ul className="plain-list">
              {jobs.length === 0 ? (
                <li className="muted">No shipments yet.</li>
              ) : (
                jobs.map((j) => (
                  <li key={j.id}>
                    <strong>{j.publicCode}</strong>
                    <span className="muted">
                      {" "}
                      · {j.state} · {j.paymentStatus}
                    </span>
                    <div className="muted">
                      {j.pickupAddress} → {j.dropoffAddress}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {nav === "approvals" ? (
          <section className="stack">
            <h1>Approvals</h1>
            <p className="lede">
              Jobs waiting for an approver before they go live.
            </p>

            {canManageOrg(role) ? (
              <form
                className="panel stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const trimmed = thresholdRands.trim();
                    const cents =
                      trimmed === ""
                        ? null
                        : Math.round(Number(trimmed) * 100);
                    if (cents !== null && Number.isNaN(cents)) {
                      throw new Error("Enter a valid amount in rands.");
                    }
                    await setApprovalThreshold(token, active.orgId, cents);
                    setNotice(
                      cents === null
                        ? "Approval threshold cleared."
                        : `Approval threshold set to ${formatZar(cents)}.`,
                    );
                  });
                }}
              >
                <h2>Approval threshold</h2>
                <label className="label" htmlFor="threshold">
                  Amount in rands (leave blank to clear)
                </label>
                <input
                  id="threshold"
                  className="field"
                  type="number"
                  min="0"
                  step="0.01"
                  value={thresholdRands}
                  onChange={(e) => setThresholdRands(e.target.value)}
                  placeholder="e.g. 500"
                />
                <button className="cta" type="submit" disabled={busy}>
                  Save threshold
                </button>
              </form>
            ) : null}

            <ul className="plain-list">
              {pendingApprovals.length === 0 ? (
                <li className="muted">No pending approvals.</li>
              ) : (
                pendingApprovals.map((j) => (
                  <li key={j.id}>
                    <strong>{j.publicCode}</strong>
                    <span className="muted"> · {j.state}</span>
                    <div className="muted">
                      {j.pickupAddress} → {j.dropoffAddress}
                    </div>
                    {canApprove(role) ? (
                      <div className="stack">
                        <button
                          type="button"
                          className="cta"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await approveJob(token, active.orgId, j.id);
                              setPendingApprovals(
                                (await fetchApprovals(token, active.orgId)).jobs,
                              );
                            })
                          }
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="nav-item"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await rejectJob(token, active.orgId, j.id);
                              setPendingApprovals(
                                (await fetchApprovals(token, active.orgId)).jobs,
                              );
                            })
                          }
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {nav === "billing" ? (
          <section className="stack">
            <h1>Billing</h1>
            <p className="lede">Weekly statements for this organisation.</p>

            {canManageOrg(role) ? (
              <button
                type="button"
                className="cta"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await generateStatement(token, active.orgId);
                    setStatements(
                      (await fetchStatements(token, active.orgId)).statements,
                    );
                    setNotice("Statement generated.");
                  })
                }
              >
                Generate statement
              </button>
            ) : null}

            <ul className="plain-list">
              {statements.length === 0 ? (
                <li className="muted">No statements yet.</li>
              ) : (
                statements.map((s) => (
                  <li key={s.id}>
                    <strong>{formatZar(s.totalCents)}</strong>
                    <span className="muted">
                      {" "}
                      · {s.status} · {s.periodStart.slice(0, 10)} →{" "}
                      {s.periodEnd.slice(0, 10)}
                    </span>
                    {s.csvBody ? (
                      <div>
                        <button
                          type="button"
                          className="nav-item"
                          onClick={() =>
                            downloadCsv(
                              `statement-${s.id.slice(0, 8)}.csv`,
                              s.csvBody!,
                            )
                          }
                        >
                          Download CSV
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {nav === "keys" ? (
          <section className="stack">
            <h1>API keys</h1>
            <p className="lede">
              Keys for systems that book on behalf of this org.
            </p>

            {canManageOrg(role) ? (
              <form
                className="panel stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const res = await createApiKey(
                      token,
                      active.orgId,
                      keyName.trim() || "API key",
                    );
                    setKeyName("");
                    setApiKeys((await fetchApiKeys(token, active.orgId)).keys);
                    setNotice(
                      `Copy this secret now — it will not be shown again: ${res.secret}`,
                    );
                  });
                }}
              >
                <h2>Create key</h2>
                <label className="label" htmlFor="key-name">
                  Name
                </label>
                <input
                  id="key-name"
                  className="field"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="Warehouse integration"
                  required
                />
                <button className="cta" type="submit" disabled={busy}>
                  Create key
                </button>
              </form>
            ) : (
              <p className="muted">Only Org Admins can manage API keys.</p>
            )}

            <ul className="plain-list">
              {apiKeys.length === 0 ? (
                <li className="muted">No keys yet.</li>
              ) : (
                apiKeys.map((k) => (
                  <li key={k.id}>
                    <strong>{k.name}</strong>
                    <span className="muted">
                      {" "}
                      · {k.keyPrefix}…
                      {k.revokedAt ? " · revoked" : ""}
                    </span>
                    {canManageOrg(role) && !k.revokedAt ? (
                      <div>
                        <button
                          type="button"
                          className="nav-item"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await revokeApiKey(token, active.orgId, k.id);
                              setApiKeys(
                                (await fetchApiKeys(token, active.orgId)).keys,
                              );
                            })
                          }
                        >
                          Revoke
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {nav === "sites" ? (
          <section className="stack">
            <h1>Sites</h1>
            <p className="lede">
              Warehouses, stores, and saved addresses for Cape Town runs.
            </p>

            {canManageSites(role) ? (
              <form
                className="panel stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await createSite(token, active.orgId, {
                      label: siteForm.label.trim(),
                      address: siteForm.address.trim(),
                      zoneCode: siteForm.zoneCode || null,
                      kind: siteForm.kind,
                    });
                    setSiteForm({
                      label: "",
                      address: "",
                      zoneCode: "",
                      kind: "warehouse",
                    });
                    setSites((await fetchSites(token, active.orgId)).sites);
                  });
                }}
              >
                <h2>Add site</h2>
                <label className="label" htmlFor="site-label">
                  Label
                </label>
                <input
                  id="site-label"
                  className="field"
                  value={siteForm.label}
                  onChange={(e) =>
                    setSiteForm((f) => ({ ...f, label: e.target.value }))
                  }
                  placeholder="Main warehouse"
                  required
                />
                <label className="label" htmlFor="site-address">
                  Address
                </label>
                <input
                  id="site-address"
                  className="field"
                  value={siteForm.address}
                  onChange={(e) =>
                    setSiteForm((f) => ({ ...f, address: e.target.value }))
                  }
                  required
                />
                <label className="label" htmlFor="site-kind">
                  Kind
                </label>
                <select
                  id="site-kind"
                  className="field"
                  value={siteForm.kind}
                  onChange={(e) =>
                    setSiteForm((f) => ({
                      ...f,
                      kind: e.target.value as typeof f.kind,
                    }))
                  }
                >
                  <option value="warehouse">Warehouse</option>
                  <option value="store">Store</option>
                  <option value="other">Other</option>
                </select>
                <label className="label" htmlFor="site-zone">
                  Zone
                </label>
                <select
                  id="site-zone"
                  className="field"
                  value={siteForm.zoneCode}
                  onChange={(e) =>
                    setSiteForm((f) => ({ ...f, zoneCode: e.target.value }))
                  }
                >
                  <option value="">Optional…</option>
                  {zones.map((z) => (
                    <option key={z.code} value={z.code}>
                      {z.code} — {z.name}
                    </option>
                  ))}
                </select>
                <button className="cta" type="submit" disabled={busy}>
                  Save site
                </button>
              </form>
            ) : null}

            <ul className="plain-list">
              {sites.length === 0 ? (
                <li className="muted">No sites yet.</li>
              ) : (
                sites.map((s) => (
                  <li key={s.id}>
                    <strong>{s.label}</strong>
                    <span className="muted">
                      {" "}
                      · {s.kind}
                      {s.zoneCode ? ` · ${s.zoneCode}` : ""}
                    </span>
                    <div className="muted">{s.address}</div>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {nav === "people" ? (
          <section className="stack">
            <h1>People</h1>
            <p className="lede">Who can book, approve, and watch for this org.</p>

            {canManagePeople(role) ? (
              <form
                className="panel stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await inviteMember(token, active.orgId, {
                      email: inviteForm.email.trim(),
                      displayName: inviteForm.displayName.trim() || undefined,
                      role: inviteForm.role,
                    });
                    setInviteForm({
                      email: "",
                      displayName: "",
                      role: "booker",
                    });
                    setMembers((await fetchMembers(token, active.orgId)).members);
                  });
                }}
              >
                <h2>Invite</h2>
                <label className="label" htmlFor="inv-email">
                  Email
                </label>
                <input
                  id="inv-email"
                  className="field"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, email: e.target.value }))
                  }
                  required
                />
                <label className="label" htmlFor="inv-name">
                  Name
                </label>
                <input
                  id="inv-name"
                  className="field"
                  value={inviteForm.displayName}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, displayName: e.target.value }))
                  }
                />
                <label className="label" htmlFor="inv-role">
                  Role
                </label>
                <select
                  id="inv-role"
                  className="field"
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm((f) => ({
                      ...f,
                      role: e.target.value as typeof f.role,
                    }))
                  }
                >
                  <option value="booker">Booker</option>
                  <option value="approver">Approver</option>
                  <option value="viewer">Viewer</option>
                  <option value="org_admin">Org Admin</option>
                </select>
                <button className="cta" type="submit" disabled={busy}>
                  Send invite
                </button>
              </form>
            ) : (
              <p className="muted">Only Org Admins can invite people.</p>
            )}

            <ul className="plain-list">
              {members.map((m) => (
                <li key={m.membershipId}>
                  <strong>{m.displayName || m.email || m.userId}</strong>
                  <span className="muted"> · {m.role.replaceAll("_", " ")}</span>
                  <div className="muted">{m.email}</div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
