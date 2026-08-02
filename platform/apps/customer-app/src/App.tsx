import { useEffect, useMemo, useState } from "react";
import { SwiftMap, type MapLine, type MapMarker } from "./maps";
import {
  cancelJob,
  confirmJob,
  createDraft,
  fetchCatalog,
  fetchJobDriverProfile,
  fetchMe,
  fetchProjection,
  formatMoney,
  getJob,
  listJobs,
  getSupportCase,
  listSupportCases,
  openSupport,
  quoteJob,
  replySupport,
  requestMutation,
  type DriverProfessional,
  type Job,
  type Projection,
  type Quote,
  type SessionUser,
  type SupportCase,
} from "./api";
import { CustomerAuth } from "./CustomerAuth";
import { humanAuthError } from "@vuush/auth";
import {
  pathFromRoute,
  routeFromPath,
  routesEqual,
  type BookStep,
  type CustomerRoute,
  type Tab,
} from "./route";

const TOKEN_KEY = "vuush.customer.token";
const TOKEN_KEY_LEGACY = "swift.customer.token";
const ACTIVE = new Set([
  "CONFIRMED",
  "ASSIGNED",
  "EN_ROUTE_PICKUP",
  "ARRIVED_PICKUP",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVED_DROPOFF",
]);

const JOB_STATE_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  QUOTED: "Quoted",
  CONFIRMED: "Confirmed",
  ASSIGNED: "Driver assigned",
  EN_ROUTE_PICKUP: "Heading to pickup",
  ARRIVED_PICKUP: "At pickup",
  PICKED_UP: "Picked up",
  EN_ROUTE_DROPOFF: "On the way",
  ARRIVED_DROPOFF: "Arriving",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  FAILED: "Couldn’t complete",
};

function humanJobState(state: string): string {
  if (JOB_STATE_LABELS[state]) return JOB_STATE_LABELS[state];
  return state
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const INTEGRITY_LABELS: Record<string, string> = {
  fresh: "Live",
  ok: "Live",
  stale: "Updating",
  lost: "Signal lost",
  absent: "Waiting for location",
  degraded: "Location uncertain",
  conflicted: "Checking location",
};

function humanIntegrity(integrity: string): string {
  return INTEGRITY_LABELS[integrity] ?? integrity.replaceAll("_", " ");
}

const BOOK_STEP_LABELS: Record<BookStep, string> = {
  route: "Step 1 of 4 · Where",
  package: "Step 2 of 4 · Package",
  quote: "Step 3 of 4 · Quote",
  done: "Step 4 of 4 · Done",
};

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
    <p className="brand-lockup">
      <span className="brand-mark" aria-hidden="true" />
      <span className="brand-wordmark">VUUSH</span>
    </p>
  );
}

export default function App() {
  const initialRoute = routeFromPath(window.location.pathname);
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    if (initialRoute.screen === "activity") return "activity";
    if (initialRoute.screen === "support" || initialRoute.screen === "support-case")
      return "support";
    if (initialRoute.screen === "profile") return "profile";
    return "home";
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [zones, setZones] = useState<Array<{ code: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [booking, setBooking] = useState(
    () => initialRoute.screen === "book",
  );
  const [bookStep, setBookStep] = useState<BookStep>(() =>
    initialRoute.screen === "book" ? initialRoute.step : "route",
  );
  const [pickupAddress, setPickupAddress] = useState("1 Long Street, Cape Town");
  const [dropoffAddress, setDropoffAddress] = useState("50 Main Road, Sea Point");
  const [pickupZone, setPickupZone] = useState("CPT-CBD");
  const [dropoffZone, setDropoffZone] = useState("CPT-ATL");
  const [packageClass, setPackageClass] = useState<"small" | "medium" | "large">(
    "small",
  );
  const [recipientName, setRecipientName] = useState("Ada");
  const [draftJob, setDraftJob] = useState<Job | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  const [trackJobId, setTrackJobId] = useState<string | null>(() =>
    initialRoute.screen === "track" ? initialRoute.jobId : null,
  );
  const [trackJob, setTrackJob] = useState<Job | null>(null);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [mutationAddress, setMutationAddress] = useState("");
  const [mutationZone, setMutationZone] = useState("CPT-ATL");

  const [supportSubject, setSupportSubject] = useState("Help with a delivery");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportJobId, setSupportJobId] = useState("");
  const [myCases, setMyCases] = useState<SupportCase[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(() =>
    initialRoute.screen === "support-case" ? initialRoute.caseId : null,
  );
  const [caseThread, setCaseThread] = useState<Awaited<
    ReturnType<typeof getSupportCase>
  > | null>(null);
  const [caseReply, setCaseReply] = useState("");

  function currentRoute(): CustomerRoute {
    if (tab === "activity") return { screen: "activity" };
    if (tab === "profile") return { screen: "profile" };
    if (tab === "support") {
      return activeCaseId
        ? { screen: "support-case", caseId: activeCaseId }
        : { screen: "support" };
    }
    if (trackJobId) return { screen: "track", jobId: trackJobId };
    if (booking) return { screen: "book", step: bookStep };
    return { screen: "home" };
  }

  function applyRoute(route: CustomerRoute) {
    switch (route.screen) {
      case "home":
        setTab("home");
        setBooking(false);
        setTrackJobId(null);
        setTrackJob(null);
        setProjection(null);
        setActiveCaseId(null);
        setCaseThread(null);
        break;
      case "book":
        setTab("home");
        setBooking(true);
        setBookStep(route.step);
        setTrackJobId(null);
        setTrackJob(null);
        setProjection(null);
        break;
      case "track":
        setTab("home");
        setBooking(false);
        setTrackJobId(route.jobId);
        setTrackJob(null);
        setProjection(null);
        break;
      case "activity":
        setTab("activity");
        setBooking(false);
        setTrackJobId(null);
        setTrackJob(null);
        setProjection(null);
        break;
      case "support":
        setTab("support");
        setActiveCaseId(null);
        setCaseThread(null);
        setBooking(false);
        setTrackJobId(null);
        break;
      case "support-case":
        setTab("support");
        setActiveCaseId(route.caseId);
        setBooking(false);
        setTrackJobId(null);
        break;
      case "profile":
        setTab("profile");
        setBooking(false);
        setTrackJobId(null);
        break;
    }
  }

  function go(route: CustomerRoute, opts?: { replace?: boolean }) {
    const path = pathFromRoute(route);
    const same = routesEqual(route, currentRoute());
    applyRoute(route);
    if (same && window.location.pathname === path) return;
    if (opts?.replace) {
      window.history.replaceState({ route }, "", path);
    } else {
      window.history.pushState({ route }, "", path);
    }
  }

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    go({ screen: "home" }, { replace: true });
  }

  useEffect(() => {
    const path = pathFromRoute(currentRoute());
    if (window.location.pathname !== path) {
      window.history.replaceState({ route: currentRoute() }, "", path);
    }

    function onPopState() {
      applyRoute(routeFromPath(window.location.pathname));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Mount-only: wire browser Back/Forward once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token || !activeCaseId) return;
    let cancelled = false;
    void (async () => {
      try {
        const thread = await getSupportCase(token, activeCaseId);
        if (!cancelled) setCaseThread(thread);
      } catch {
        /* keep list; user can retry */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeCaseId]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(
        humanAuthError(err instanceof Error ? err.message : "request_failed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function refreshJobs(access: string) {
    const res = await listJobs(access);
    setJobs(res.jobs);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMe(token);
        if (cancelled) return;
        setUser(me.user);
        const catalog = await fetchCatalog();
        if (cancelled) return;
        setZones(catalog.zones);
        if (catalog.zones[0]) {
          setPickupZone((z) => z || catalog.zones[0].code);
          setDropoffZone((z) => z || catalog.zones[1]?.code || catalog.zones[0].code);
        }
        await refreshJobs(token);
      } catch {
        if (cancelled) return;
        clearStoredToken();
        setToken(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !trackJobId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const detail = await getJob(token, trackJobId);
        const proj = await fetchProjection(token, trackJobId);
        if (cancelled) return;
        setTrackJob(detail.job);
        setProjection(proj.projection);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "track_failed");
        }
      }
    };
    void load();
    const id = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [token, trackJobId]);

  const activeJobs = jobs.filter((j) => ACTIVE.has(j.state));

  function startBooking() {
    setDraftJob(null);
    setQuote(null);
    go({ screen: "book", step: "route" });
  }

  async function submitRoute() {
    await run(async () => {
      if (!token) return;
      go({ screen: "book", step: "package" });
    });
  }

  async function submitPackage() {
    await run(async () => {
      if (!token) return;
      const created = await createDraft(token, {
        serviceTypeCode: "standard",
        packageClass,
        pickupAddress: pickupAddress.trim(),
        pickupZoneCode: pickupZone,
        pickupLat: -33.9249,
        pickupLng: 18.4241,
        dropoffAddress: dropoffAddress.trim(),
        dropoffZoneCode: dropoffZone,
        dropoffLat: -33.916,
        dropoffLng: 18.388,
        recipientName: recipientName.trim() || "Recipient",
        recipientPhone: "+27000000000",
        prohibitedGoodsDeclared: true,
        containsProhibitedGoods: false,
      });
      setDraftJob(created.job);
      const quoted = await quoteJob(token, created.job.id);
      setDraftJob(quoted.job);
      setQuote(quoted.quote);
      go({ screen: "book", step: "quote" });
    });
  }

  async function submitConfirm() {
    await run(async () => {
      if (!token || !draftJob) return;
      const confirmed = await confirmJob(token, draftJob.id);
      setDraftJob(confirmed.job);
      go({ screen: "book", step: "done" });
      setNotice("Booking confirmed. Payment recorded.");
      await refreshJobs(token);
    });
  }

  async function openTrack(jobId: string) {
    go({ screen: "track", jobId });
  }

  async function handleCancel() {
    if (!token || !trackJob) return;
    await run(async () => {
      await cancelJob(token, trackJob.id);
      setNotice("Delivery cancelled.");
      go({ screen: "home" });
      await refreshJobs(token);
    });
  }

  async function handleMutation() {
    if (!token || !trackJob || !mutationAddress.trim()) return;
    await run(async () => {
      await requestMutation(
        token,
        trackJob.id,
        mutationAddress.trim(),
        mutationZone,
      );
      setNotice("Change request sent. Waiting on dispatch / driver.");
      setMutationAddress("");
    });
  }

  async function refreshCases(access: string) {
    const res = await listSupportCases(access);
    setMyCases(res.cases);
  }

  async function handleSupport() {
    if (!token || !supportMessage.trim()) return;
    await run(async () => {
      const res = await openSupport(
        token,
        supportSubject.trim(),
        supportMessage.trim(),
        supportJobId || undefined,
      );
      setSupportMessage("");
      setNotice(`Support case ${res.case.publicCode} opened.`);
      await refreshCases(token);
      go({ screen: "support-case", caseId: res.case.caseId });
    });
  }

  async function openCase(caseId: string) {
    if (!token) return;
    go({ screen: "support-case", caseId });
  }

  function signOut() {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setJobs([]);
    setTrackJobId(null);
    window.history.replaceState({}, "", "/");
  }

  if (!token || !user) {
    return (
      <div className="app auth-mode">
        <CustomerAuth
          onAuthed={(accessToken, nextUser) => {
            writeStoredToken(accessToken);
            setToken(accessToken);
            setUser(nextUser);
            setNotice("Signed in.");
            go({ screen: "home" }, { replace: true });
          }}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {error && <div className="banner banner-error">{error}</div>}
      {notice && <div className="banner banner-ok">{notice}</div>}

      <div className="app-shell">
        <div className="topbar">
          <BrandLockup />
          <button className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>

        {tab === "home" && !booking && !trackJobId && (
          <div className="stack">
            <div className="hero">
              <h2>Send a delivery</h2>
              <p>Book, pay, and track with honest status — never fake motion.</p>
              <button className="btn btn-primary btn-block" onClick={startBooking}>
                New delivery
              </button>
            </div>

            {activeJobs.length === 0 ? (
              <p className="muted">No active deliveries.</p>
            ) : (
              <div className="stack">
                <h3>Active</h3>
                <ul className="list">
                  {activeJobs.map((job) => (
                    <li key={job.id}>
                      <button className="list-item" onClick={() => openTrack(job.id)}>
                        <div>
                          <strong>{job.publicCode}</strong>
                          <div className="muted">{job.dropoffAddress}</div>
                        </div>
                        <span className="status-pill">{humanJobState(job.state)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === "home" && booking && (
          <div className="stack">
            <div>
              <div className="steps" aria-hidden>
                <span className="on" />
                <span className={["package", "quote", "done"].includes(bookStep) ? "on" : ""} />
                <span className={["quote", "done"].includes(bookStep) ? "on" : ""} />
                <span className={bookStep === "done" ? "on" : ""} />
              </div>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                {BOOK_STEP_LABELS[bookStep]}
              </p>
            </div>

            {bookStep === "route" && (
              <div className="panel stack">
                <h2>Where to?</h2>
                <div>
                  <label className="label">Pickup address</label>
                  <input className="field" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} />
                </div>
                <div>
                  <label className="label">Pickup zone</label>
                  <select className="field" value={pickupZone} onChange={(e) => setPickupZone(e.target.value)}>
                    {zones.map((z) => (
                      <option key={z.code} value={z.code}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Dropoff address</label>
                  <input className="field" value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)} />
                </div>
                <div>
                  <label className="label">Dropoff zone</label>
                  <select className="field" value={dropoffZone} onChange={(e) => setDropoffZone(e.target.value)}>
                    {zones.map((z) => (
                      <option key={z.code} value={z.code}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row">
                  <button className="btn btn-ghost" onClick={goBack}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" disabled={busy} onClick={submitRoute}>
                    Continue
                  </button>
                </div>
              </div>
            )}

            {bookStep === "package" && (
              <div className="panel stack">
                <h2>Package</h2>
                <div>
                  <label className="label">Size</label>
                  <select
                    className="field"
                    value={packageClass}
                    onChange={(e) =>
                      setPackageClass(e.target.value as "small" | "medium" | "large")
                    }
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
                <div>
                  <label className="label">Recipient name</label>
                  <input className="field" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                </div>
                <p className="muted">You confirm this is not prohibited goods.</p>
                <div className="row">
                  <button className="btn btn-ghost" onClick={goBack}>
                    Back
                  </button>
                  <button className="btn btn-primary" disabled={busy} onClick={submitPackage}>
                    Get quote
                  </button>
                </div>
              </div>
            )}

            {bookStep === "quote" && quote && draftJob && (
              <div className="panel stack">
                <h2>Quote</h2>
                <p className="price">{formatMoney(quote.totalCents, quote.currency)}</p>
                <p className="muted">Expires {new Date(quote.expiresAt).toLocaleTimeString()}</p>
                <p className="address">
                  <strong>Pickup</strong>
                  {draftJob.pickupAddress}
                </p>
                <p className="address">
                  <strong>Dropoff</strong>
                  {draftJob.dropoffAddress}
                </p>
                <p className="muted">You’ll confirm and pay on this step.</p>
                <div className="row">
                  <button className="btn btn-ghost" onClick={goBack}>
                    Back
                  </button>
                  <button className="btn btn-primary" disabled={busy} onClick={submitConfirm}>
                    Pay & confirm
                  </button>
                </div>
              </div>
            )}

            {bookStep === "done" && draftJob && (
              <div className="panel stack">
                <span className="status-pill ok">Confirmed</span>
                <h2>{draftJob.publicCode}</h2>
                <p className="muted">We’re lining up a driver. Track for truthful updates.</p>
                <button className="btn btn-primary btn-block" onClick={() => openTrack(draftJob.id)}>
                  Track delivery
                </button>
                <button
                  className="btn btn-secondary btn-block"
                  onClick={() => {
                    setDraftJob(null);
                    go({ screen: "home" });
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "home" && trackJobId && !trackJob && (
          <div className="panel stack">
            <p className="muted" style={{ margin: 0 }}>
              Loading delivery…
            </p>
            <button className="btn btn-ghost" type="button" onClick={goBack}>
              Back
            </button>
          </div>
        )}

        {tab === "home" && trackJobId && trackJob && token && (
          <TrackStage
            token={token}
            job={trackJob}
            projection={projection}
            zones={zones}
            busy={busy}
            mutationAddress={mutationAddress}
            mutationZone={mutationZone}
            setMutationAddress={setMutationAddress}
            setMutationZone={setMutationZone}
            onBack={goBack}
            onMutation={handleMutation}
            onCancel={handleCancel}
          />
        )}

        {tab === "activity" && (
          <div className="stack">
            <h2>Activity</h2>
            {jobs.length === 0 ? (
              <div className="panel">
                <p className="muted">No deliveries yet.</p>
              </div>
            ) : (
              <ul className="list">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <button className="list-item" onClick={() => openTrack(job.id)}>
                      <div>
                        <strong>{job.publicCode}</strong>
                        <div className="muted">{job.dropoffAddress}</div>
                      </div>
                        <span className="status-pill">{humanJobState(job.state)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        )}

        {tab === "support" && (
          <div className="stack">
            {!activeCaseId ? (
              <>
                <div className="panel stack">
                  <h2>Support</h2>
                  <p className="muted">Tell us what’s wrong. We’ll open a case with your account.</p>
                  <div>
                    <label className="label">Subject</label>
                    <input
                      className="field"
                      value={supportSubject}
                      onChange={(e) => setSupportSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Job code (optional)</label>
                    <select
                      className="field"
                      value={supportJobId}
                      onChange={(e) => setSupportJobId(e.target.value)}
                    >
                      <option value="">No job linked</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.publicCode}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Message</label>
                    <textarea
                      className="field"
                      rows={4}
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="What happened?"
                    />
                  </div>
                  <button className="btn btn-primary btn-block" disabled={busy} onClick={handleSupport}>
                    Open case
                  </button>
                </div>
                {myCases.length > 0 && (
                  <ul className="list">
                    {myCases.map((c) => (
                      <li key={c.id}>
                        <button className="list-item" onClick={() => void openCase(c.id)}>
                          <div>
                            <strong>{c.publicCode}</strong>
                            <div className="muted">{c.subject}</div>
                          </div>
                          <span className="status-pill">{c.status}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              caseThread && (
                <div className="stack">
                  <button
                    className="btn btn-ghost"
                    onClick={goBack}
                  >
                    ← Back
                  </button>
                  <div className="panel stack">
                    <h2>{caseThread.case.publicCode}</h2>
                    <p className="muted">{caseThread.case.subject}</p>
                    {caseThread.messages.map((m) => (
                      <div key={m.id}>
                        <div className="muted">
                          {m.authorKind} · {new Date(m.createdAt).toLocaleString()}
                        </div>
                        <p style={{ margin: "4px 0 12px" }}>{m.body}</p>
                      </div>
                    ))}
                    {caseThread.case.status !== "resolved" && (
                      <>
                        <textarea
                          className="field"
                          rows={3}
                          value={caseReply}
                          onChange={(e) => setCaseReply(e.target.value)}
                          placeholder="Add a message"
                        />
                        <button
                          className="btn btn-primary btn-block"
                          disabled={busy || !caseReply.trim()}
                          onClick={() =>
                            void run(async () => {
                              if (!token || !activeCaseId) return;
                              await replySupport(token, activeCaseId, caseReply.trim());
                              setCaseReply("");
                              setCaseThread(await getSupportCase(token, activeCaseId));
                            })
                          }
                        >
                          Send
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {tab === "profile" && (
          <div className="stack">
            <div className="panel stack">
              <h2>Profile</h2>
              <p className="mono">{user.email}</p>
              <button className="btn btn-secondary btn-block" type="button" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      <nav className="nav" aria-label="Customer">
        <button
          className={tab === "home" ? "active" : ""}
          onClick={() => {
            if (booking && !window.confirm("Leave this booking?")) return;
            go({ screen: "home" });
          }}
        >
          Home
        </button>
        <button
          className={tab === "activity" ? "active" : ""}
          onClick={() => {
            go({ screen: "activity" });
            if (token) void refreshJobs(token);
          }}
        >
          Activity
        </button>
        <button
          className={tab === "support" ? "active" : ""}
          onClick={() => {
            go({ screen: "support" });
            if (token) void refreshCases(token);
          }}
        >
          Support
        </button>
        <button
          className={tab === "profile" ? "active" : ""}
          onClick={() => go({ screen: "profile" })}
        >
          Profile
        </button>
      </nav>
    </div>
  );
}

function TrackStage(props: {
  token: string;
  job: Job;
  projection: Projection | null;
  zones: Array<{ code: string; name: string }>;
  busy: boolean;
  mutationAddress: string;
  mutationZone: string;
  setMutationAddress: (v: string) => void;
  setMutationZone: (v: string) => void;
  onBack: () => void;
  onMutation: () => void;
  onCancel: () => void;
}) {
  const {
    token,
    job,
    projection,
    zones,
    busy,
    mutationAddress,
    mutationZone,
    setMutationAddress,
    setMutationZone,
    onBack,
    onMutation,
    onCancel,
  } = props;

  const [driver, setDriver] = useState<DriverProfessional | null>(null);
  const [changeDestOpen, setChangeDestOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetchJobDriverProfile(token, job.id);
        if (!cancelled) setDriver(res.driver);
      } catch {
        if (!cancelled) setDriver(null);
      }
    };
    void load();
    const t = window.setInterval(() => void load(), 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [token, job.id, job.state]);

  const markers = useMemo(() => {
    const list: MapMarker[] = [];
    if (job.pickupLat != null && job.pickupLng != null) {
      list.push({
        id: "pickup",
        lat: job.pickupLat,
        lng: job.pickupLng,
        kind: "pickup",
      });
    }
    if (job.dropoffLat != null && job.dropoffLng != null) {
      list.push({
        id: "dropoff",
        lat: job.dropoffLat,
        lng: job.dropoffLng,
        kind: "dropoff",
      });
    }
    if (projection?.lastKnown) {
      const live = Boolean(
        projection.showLiveMotion && projection.allowLiveMarker !== false,
      );
      list.push({
        id: "vehicle",
        lat: projection.lastKnown.lat,
        lng: projection.lastKnown.lng,
        kind: "vehicle",
        live,
      });
    }
    return list;
  }, [job, projection]);

  const lines = useMemo(() => {
    const out: MapLine[] = [];
    if (
      job.pickupLat != null &&
      job.pickupLng != null &&
      job.dropoffLat != null &&
      job.dropoffLng != null
    ) {
      out.push({
        id: "route",
        coords: [
          [job.pickupLng, job.pickupLat],
          [job.dropoffLng, job.dropoffLat],
        ],
      });
    }
    return out;
  }, [job]);

  const integrity = projection?.integrityClass ?? "absent";
  const warn =
    integrity === "lost" ||
    integrity === "conflicted" ||
    integrity === "degraded" ||
    Boolean(projection?.incidentPause);

  return (
    <div className="track-stage">
      <div className="track-map-wrap">
        <SwiftMap className="track-map" markers={markers} lines={lines} />
        <button className="btn btn-secondary track-back" type="button" onClick={onBack}>
          ← Back
        </button>
      </div>

      <div className={`track-sheet panel stack${warn ? " banner-warn" : ""}`}>
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ margin: 0, flex: 1 }}>{job.publicCode}</h2>
          <span className="status-pill">{humanJobState(job.state)}</span>
        </div>
        {projection && (
          <>
            <span
              className={`status-pill ${
                projection.showLiveMotion
                  ? "ok"
                  : projection.integrityClass === "absent"
                    ? ""
                    : "warn"
              }`}
            >
              {humanIntegrity(projection.integrityClass)}
            </span>
            <p style={{ margin: 0 }}>{projection.customerMessage}</p>
          </>
        )}
        {projection?.incidentPause ? (
          <div className="banner banner-warn" role="status">
            <strong>Delivery paused</strong>
            <p style={{ margin: "6px 0 0" }}>{projection.incidentPause.message}</p>
            <p className="muted mono" style={{ margin: "6px 0 0" }}>
              Ref {projection.incidentPause.publicCode}
            </p>
          </div>
        ) : null}
        {!projection?.showLiveMotion && projection?.allowLiveMarker === false && (
          <p className="muted" style={{ margin: 0 }}>
            Map stays still — we won’t invent movement.
          </p>
        )}
        {driver && <CustomerDriverCard driver={driver} />}
        <p className="address" style={{ margin: 0 }}>
          <strong>Pickup</strong>
          {job.pickupAddress}
        </p>
        <p className="address" style={{ margin: 0 }}>
          <strong>Dropoff</strong>
          {job.dropoffAddress}
        </p>

        {ACTIVE.has(job.state) && (
          <div className="stack">
            <button
              className="btn btn-secondary btn-block"
              type="button"
              onClick={() => setChangeDestOpen((o) => !o)}
            >
              Change destination
            </button>
            {changeDestOpen && (
              <>
                <input
                  className="field"
                  placeholder="New dropoff address"
                  value={mutationAddress}
                  onChange={(e) => setMutationAddress(e.target.value)}
                />
                <select
                  className="field"
                  value={mutationZone}
                  onChange={(e) => setMutationZone(e.target.value)}
                >
                  {zones.map((z) => (
                    <option key={z.code} value={z.code}>
                      {z.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-secondary btn-block" disabled={busy} onClick={onMutation}>
                  Request change
                </button>
              </>
            )}
          </div>
        )}

        {["DRAFT", "QUOTED", "CONFIRMED", "ASSIGNED"].includes(job.state) && (
          <button className="btn btn-ghost btn-block" disabled={busy} onClick={onCancel}>
            Cancel delivery
          </button>
        )}
      </div>
    </div>
  );
}

function CustomerDriverCard(props: { driver: DriverProfessional }) {
  const { driver } = props;
  const initial = (driver.publicName || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="driver-card">
      <div className="driver-card-head">
        {driver.photoUrl ? (
          <img
            className="driver-avatar"
            src={driver.photoUrl}
            alt=""
            width={56}
            height={56}
          />
        ) : (
          <div className="driver-avatar driver-avatar-fallback" aria-hidden>
            {initial}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 17 }}>Your driver · {driver.publicName}</strong>
            {driver.docsVerified && (
              <span className="status-pill ok">Verified</span>
            )}
          </div>
          {driver.bio && (
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {driver.bio}
            </p>
          )}
        </div>
      </div>
      <dl className="driver-meta">
        {driver.phone && (
          <>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${driver.phone.replace(/\s/g, "")}`}>{driver.phone}</a>
            </dd>
          </>
        )}
        {driver.email && (
          <>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${driver.email}`}>{driver.email}</a>
            </dd>
          </>
        )}
        {(driver.vehicleLabel || driver.vehicleClass) && (
          <>
            <dt>Vehicle</dt>
            <dd>
              {driver.vehicleLabel ?? driver.vehicleClass}
              {driver.vehiclePlate ? ` · ${driver.vehiclePlate}` : ""}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
