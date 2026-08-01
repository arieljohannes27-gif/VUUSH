import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SwiftMap, type MapMarker } from "./maps";
import {
  assignJob,
  acknowledgeIncident,
  backupJob,
  escalateIncident,
  fetchBoardPositions,
  fetchDrivers,
  fetchEligible,
  fetchIncidentDetail,
  fetchIncidents,
  fetchJobDetail,
  fetchLostTasks,
  fetchMe,
  fetchQueue,
  ackLostTask,
  notifyIncidentCustomer,
  placeHold,
  reassignJob,
  releaseHold,
  requestOtp,
  resolveIncident,
  verifyMfa,
  verifyOtp,
  type BoardPosition,
  type Driver,
  type IncidentRow,
  type QueueItem,
  type SessionUser,
} from "./api";

const TOKEN_KEY = "vuush.dispatch.token";
const TOKEN_KEY_LEGACY = "swift.dispatch.token";

/** Card paid, free job, or enterprise statement (pay later). */
function paymentReadyForOffer(paymentStatus: string) {
  return (
    paymentStatus === "captured" ||
    paymentStatus === "not_required" ||
    paymentStatus === "invoiced"
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

function BrandLockup({ compact }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup${compact ? " brand-lockup-compact" : ""}`}>
      <span className="brand-mark" aria-hidden="true" />
      <span className="brand-wordmark">VUUSH</span>
    </span>
  );
}

function driverName(d: {
  callsign?: string;
  displayName?: string | null;
  email?: string | null;
}) {
  return (
    d.callsign ||
    (d.displayName && !d.displayName.includes("@") ? d.displayName : null) ||
    d.email?.split("@")[0] ||
    "Driver"
  );
}

function driverOptionLabel(d: {
  callsign?: string;
  displayName?: string | null;
  email?: string | null;
  vehicleClass: string;
  zoneMatch?: boolean;
  onDuty?: boolean;
}) {
  const zone = d.zoneMatch ? " · zone" : "";
  const duty = d.onDuty === false ? " · off" : "";
  return `${driverName(d)} · ${d.vehicleClass}${zone}${duty}`;
}

function matchQuality(d: { zoneMatch?: boolean; onDuty?: boolean }) {
  if (d.zoneMatch && d.onDuty !== false) {
    return { label: "Strong match", detail: "On duty · zone fit" };
  }
  if (d.onDuty !== false) {
    return { label: "Eligible", detail: "On duty · vehicle fit" };
  }
  return { label: "Limited", detail: "Off duty" };
}

function humanState(state: string) {
  const map: Record<string, string> = {
    CONFIRMED: "Ready for assignment",
    OFFERED: "Offer out",
    ASSIGNED: "Assigned",
    EN_ROUTE_PICKUP: "En route to pickup",
    AT_PICKUP: "At pickup",
    PICKED_UP: "Picked up",
    EN_ROUTE_DROPOFF: "En route to dropoff",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    PENDING_APPROVAL: "Awaiting company approval",
  };
  return map[state] ?? state.replaceAll("_", " ").toLowerCase();
}

function humanPayment(status: string) {
  const map: Record<string, string> = {
    captured: "Payment captured",
    not_required: "Payment not required",
    invoiced: "On company statement",
    unauthorized: "Payment not authorised yet",
    pending: "Payment pending",
    refunded: "Payment refunded",
    failed: "Payment failed",
  };
  return map[status] ?? status.replaceAll("_", " ");
}

/** Short queue line for payment; null means ready — omit from the secondary line. */
function queuePaymentHint(paymentStatus: string): string | null {
  if (
    paymentReadyForOffer(paymentStatus) ||
    paymentStatus === "succeeded" ||
    paymentStatus === "paid"
  ) {
    return null;
  }
  const map: Record<string, string> = {
    unauthorized: "Payment needed",
    pending: "Payment pending",
    failed: "Payment failed",
  };
  return map[paymentStatus] ?? paymentStatus.replaceAll("_", " ");
}

const OVERRIDE_REASONS: Array<{ code: string; label: string }> = [
  { code: "ops_override", label: "Ops override" },
  { code: "reassign_capacity", label: "Capacity reassign" },
  { code: "backup_custody", label: "Backup custody" },
  { code: "DISPATCH_HOLD", label: "Dispatch hold" },
];

type InspectorTone = "ready" | "blocked" | "hold" | "assigned" | "neutral";

function inspectorSituation(detail: {
  job: { state: string; paymentStatus: string };
  assignment: { status: string; mode: string } | null;
  holds: Array<{ holdType: string }>;
}): { tone: InspectorTone; title: string; detail: string } {
  if (detail.holds[0]) {
    return {
      tone: "hold",
      title: "On hold",
      detail: `${detail.holds[0].holdType.replaceAll("_", " ")} — release before offering`,
    };
  }
  if (!paymentReadyForOffer(detail.job.paymentStatus)) {
    return {
      tone: "blocked",
      title: "Cannot assign yet",
      detail: `${humanPayment(detail.job.paymentStatus)}. Offer when payment is captured, not required, or invoiced.`,
    };
  }
  if (detail.assignment) {
    return {
      tone: "assigned",
      title: `Already ${detail.assignment.status.toLowerCase()}`,
      detail: detail.assignment.mode
        ? `${detail.assignment.mode} assignment open — reassign if needed`
        : "An assignment is already open — reassign if needed",
    };
  }
  return {
    tone: "ready",
    title: "Ready to assign",
    detail: `${humanState(detail.job.state)} · ${humanPayment(detail.job.paymentStatus)}`,
  };
}

function staffAllowed(user: SessionUser) {
  return (
    user.roles.includes("dispatcher") ||
    user.roles.includes("operations_manager") ||
    user.roles.includes("administrator")
  );
}

function humanAuthError(code: string) {
  const map: Record<string, string> = {
    otp_failed: "Could not send a sign-in code. Try again.",
    otp_email_not_configured:
      "Sign-in email is not set up on the server yet.",
    otp_sms_not_configured: "Phone sign-in is not available yet.",
    otp_delivery_failed: "Could not deliver the sign-in code. Try again.",
    invalid_code: "That code is wrong or expired.",
    invalid_mfa_code: "That authenticator code is wrong. Try again.",
    mfa_ticket_invalid: "This sign-in step expired. Start again.",
    mfa_not_configured: "Authenticator is not set up. Ask an admin for help.",
    mfa_incomplete: "Authenticator step did not finish.",
    not_staff:
      "Email worked, but this account has no Dispatch access yet. In Railway Variables set FOUNDING_DISPATCHER_EMAIL to your Gmail, redeploy, then try again.",
    user_inactive: "This account is inactive.",
  };
  return map[code] ?? code.replaceAll("_", " ");
}

function Login({
  onAuthed,
}: {
  onAuthed: (token: string, user: SessionUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [devHint, setDevHint] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaMode, setMfaMode] = useState<"enroll" | "verify" | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpOtpauth, setTotpOtpauth] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetToEmail() {
    setChallengeId(null);
    setCode("");
    setDevHint(null);
    setMfaToken(null);
    setMfaMode(null);
    setTotpSecret(null);
    setTotpOtpauth(null);
    setMfaCode("");
    setError(null);
  }

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
      setError(
        humanAuthError(err instanceof Error ? err.message : "otp_failed"),
      );
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
      if (res.status === "authenticated" && res.session?.accessToken && res.user) {
        if (!staffAllowed(res.user)) {
          setError(humanAuthError("not_staff"));
          return;
        }
        onAuthed(res.session.accessToken, res.user);
        return;
      }
      if (
        (res.status === "mfa_enroll_required" || res.status === "mfa_required") &&
        res.mfa?.mfaToken
      ) {
        if (!res.user || !staffAllowed(res.user)) {
          setError(humanAuthError("not_staff"));
          return;
        }
        setMfaToken(res.mfa.mfaToken);
        setMfaMode(res.status === "mfa_enroll_required" ? "enroll" : "verify");
        setTotpSecret(res.totpSecret ?? null);
        setTotpOtpauth(res.totpOtpauth ?? null);
        setMfaCode("");
        return;
      }
      setError(humanAuthError(res.status || "verify_failed"));
    } catch (err) {
      setError(
        humanAuthError(err instanceof Error ? err.message : "verify_failed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyAuthenticator(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setBusy(true);
    setError(null);
    try {
      const mfa = await verifyMfa(mfaToken, mfaCode.trim());
      if (!mfa.session?.accessToken || !mfa.user) {
        setError(humanAuthError("mfa_incomplete"));
        return;
      }
      if (!staffAllowed(mfa.user)) {
        setError(humanAuthError("not_staff"));
        return;
      }
      onAuthed(mfa.session.accessToken, mfa.user);
    } catch (err) {
      setError(
        humanAuthError(err instanceof Error ? err.message : "mfa_incomplete"),
      );
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
        <p className="login-title">Dispatch</p>
        <p className="login-promise">
          Your time back — from intention to completion.
        </p>

        {mfaMode && mfaToken ? (
          <form onSubmit={verifyAuthenticator}>
            {mfaMode === "enroll" ? (
              <div className="mfa-enroll">
                <p className="login-step-title">Set up authenticator</p>
                <p className="hint">
                  Add VUUSH in Google Authenticator, Authy, or 1Password using
                  this key. Then enter the 6-digit code.
                </p>
                {totpSecret ? (
                  <p className="mfa-secret" title="Authenticator secret">
                    <code>{totpSecret}</code>
                  </p>
                ) : null}
                {totpOtpauth ? (
                  <button
                    className="btn btn-ghost mfa-otpauth-copy"
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(totpOtpauth).catch(
                        () => undefined,
                      );
                    }}
                  >
                    Copy setup link
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <p className="login-step-title">Authenticator code</p>
                <p className="hint">
                  Open your authenticator app and enter the 6-digit code for
                  VUUSH.
                </p>
              </>
            )}
            <div className="field">
              <label htmlFor="mfa">6-digit code</label>
              <input
                id="mfa"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
              />
            </div>
            {error ? (
              <div className="error" role="alert">
                {error}
              </div>
            ) : null}
            <button className="btn btn-primary" disabled={busy} type="submit">
              {busy ? "Checking…" : "Continue"}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={resetToEmail}
            >
              Start over
            </button>
          </form>
        ) : !challengeId ? (
          <form onSubmit={sendCode}>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            {error ? (
              <div className="error" role="alert">
                {error}
              </div>
            ) : null}
            <button className="btn btn-primary" disabled={busy} type="submit">
              Send sign-in code
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <div className="field">
              <label htmlFor="code">Email code</label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
              />
            </div>
            {devHint ? (
              <p className="hint">Local code ready (development only).</p>
            ) : (
              <p className="hint">Check your email for the sign-in code.</p>
            )}
            {error ? (
              <div className="error" role="alert">
                {error}
              </div>
            ) : null}
            <button className="btn btn-primary" disabled={busy} type="submit">
              Continue
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={resetToEmail}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Board({
  token,
  user,
  onLogout,
}: {
  token: string;
  user: SessionUser;
  onLogout: () => void;
}) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [positions, setPositions] = useState<BoardPosition[]>([]);
  const [lostTasks, setLostTasks] = useState<
    Array<{ id: string; jobId: string; sessionId: string; status: string }>
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRailRef = useRef<HTMLElement | null>(null);
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof fetchJobDetail>
  > | null>(null);
  const [eligible, setEligible] = useState<
    Array<Driver & { zoneMatch: boolean }>
  >([]);
  const [driverId, setDriverId] = useState("");
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [incidentDetail, setIncidentDetail] = useState<Awaited<
    ReturnType<typeof fetchIncidentDetail>
  > | null>(null);
  const [opsOpen, setOpsOpen] = useState(false);

  const selected = useMemo(
    () => queue.find((q) => q.job.id === selectedId) ?? null,
    [queue, selectedId],
  );

  async function refresh() {
    const [q, d, p, t, inc] = await Promise.all([
      fetchQueue(token),
      fetchDrivers(token),
      fetchBoardPositions(token),
      fetchLostTasks(token),
      fetchIncidents(token),
    ]);
    setQueue(q.queue);
    setDrivers(d.drivers);
    setPositions(p.positions);
    setLostTasks(t.tasks);
    setIncidents(inc.incidents);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "load_failed");
      }
    })();
    const t = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [token]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setEligible([]);
      return;
    }
    // Keep the job panel pinned to the top — never under the map
    window.scrollTo(0, 0);
    detailRailRef.current?.scrollTo(0, 0);
    startTransition(() => {
      void (async () => {
        try {
          const [job, elig] = await Promise.all([
            fetchJobDetail(token, selectedId),
            fetchEligible(token, selectedId),
          ]);
          setDetail(job);
          setEligible(elig.drivers);
          setDriverId(elig.drivers[0]?.userId ?? "");
          setError(null);
          detailRailRef.current?.scrollTo(0, 0);
        } catch (err) {
          setError(err instanceof Error ? err.message : "detail_failed");
        }
      })();
    });
  }, [selectedId, token]);

  useEffect(() => {
    if (!incidentId) {
      setIncidentDetail(null);
      return;
    }
    void fetchIncidentDetail(token, incidentId)
      .then(setIncidentDetail)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "incident_failed"),
      );
  }, [incidentId, token]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  function humanError(code: string) {
    const map: Record<string, string> = {
      payment_not_ready:
        "Payment is not ready for assignment. Use a captured or invoiced job, or finish payment first.",
      assignment_already_open:
        "This job already has an open offer or active assignment.",
      illegal_transition: "Job state does not allow assignment right now.",
      driver_not_eligible: "Selected driver is not eligible for this package.",
      driver_profile_missing: "Selected driver has no profile.",
      driver_off_duty: "Selected driver is off duty.",
      vehicle_class_blocked: "Driver vehicle class cannot take this package.",
      job_on_hold: "Job is on hold — release the hold first.",
      validation_error: "Request was invalid (check driver selection).",
      unauthorized: "You are not allowed to do that action.",
      forbidden: "You are not allowed to do that action.",
    };
    return map[code] ?? code.replaceAll("_", " ");
  }

  async function run(action: () => Promise<unknown>, ok: string) {
    try {
      setError(null);
      setActionBusy(true);
      await action();
      await refresh();
      if (selectedId) {
        const [job, elig] = await Promise.all([
          fetchJobDetail(token, selectedId),
          fetchEligible(token, selectedId),
        ]);
        setDetail(job);
        setEligible(elig.drivers);
        if (!driverId && elig.drivers[0]) {
          setDriverId(elig.drivers[0].userId);
        }
      }
      flash(ok);
    } catch (err) {
      const code = err instanceof Error ? err.message : "action_failed";
      const msg = humanError(code);
      setError(msg);
      flash(msg);
    } finally {
      setActionBusy(false);
    }
  }

  const onDutyCount = drivers.filter((d) => d.onDuty).length;
  const liveSessionCount = positions.filter((p) => p.showLiveMotion).length;
  const attentionCount = incidents.length + lostTasks.length;
  const cityHealthy = attentionCount === 0;

  const selectedDriver =
    eligible.find((d) => d.userId === driverId) ?? null;
  const situation = detail ? inspectorSituation(detail) : null;
  const match = selectedDriver ? matchQuality(selectedDriver) : null;
  const canOffer =
    Boolean(detail) &&
    Boolean(driverId) &&
    !detail?.holds[0] &&
    !detail?.assignment &&
    paymentReadyForOffer(detail?.job.paymentStatus ?? "");

  const boardMarkers = useMemo(() => {
    const list: MapMarker[] = [];
    for (const p of positions) {
      if (p.lat == null || p.lng == null) continue;
      const live = Boolean(p.showLiveMotion && p.allowLiveMarker !== false);
      list.push({
        id: p.sessionId,
        lat: p.lat,
        lng: p.lng,
        kind: "vehicle",
        live,
      });
    }
    return list;
  }, [positions]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-brand">
          <BrandLockup compact />
          <span>Dispatch</span>
        </div>
        <div className="topbar-meta">
          <span>
            {user.email ?? user.id.slice(0, 8)} · {onDutyCount} on duty
          </span>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setSelectedId(null);
              setIncidentId(null);
              setIncidentDetail(null);
              setOpsOpen(false);
              setError(null);
              window.scrollTo(0, 0);
              detailRailRef.current?.scrollTo(0, 0);
            }}
          >
            Clear job
          </button>
          <button
            className="btn btn-quiet"
            type="button"
            onClick={() => void refresh()}
          >
            Refresh
          </button>
          <button className="btn btn-secondary" type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <div className={`board${selectedId ? " board--job-open" : ""}`}>
        <section className="rail" aria-label="Dispatch queue">
          <div className="rail-head">
            <h2>Queue</h2>
            <p>
              {queue.length === 0
                ? "Waiting for requests"
                : `${queue.length} waiting for assignment`}
            </p>
          </div>
          {queue.length === 0 ? (
            <p className="empty">
              No jobs waiting — new requests appear here.
            </p>
          ) : (
            <ul className="list">
              {queue.map((item) => {
                const payHint = queuePaymentHint(item.job.paymentStatus);
                return (
                  <li key={item.job.id}>
                    <button
                      type="button"
                      className={`list-row${selectedId === item.job.id ? " active" : ""}`}
                      onMouseDown={(e) => {
                        // Prevent focus scroll from shoving the board under the map
                        e.preventDefault();
                      }}
                      onClick={() => {
                        window.scrollTo(0, 0);
                        setOpsOpen(false);
                        setSelectedId(item.job.id);
                        requestAnimationFrame(() => {
                          detailRailRef.current?.scrollTo(0, 0);
                        });
                      }}
                    >
                      <div className="list-primary">
                        <span
                          className={`pip ${item.onHold ? "danger" : "signal"}`}
                          aria-hidden
                        />
                        {item.job.publicCode}
                      </div>
                      <div className="list-secondary">
                        {item.job.pickupZoneCode} → {item.job.dropoffZoneCode}
                        {item.onHold ? " · on hold" : ""}
                        {payHint ? ` · ${payHint}` : ""}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="stage" aria-label="City overview">
          <div className="stage-map">
            <SwiftMap className="dispatch-map" markers={boardMarkers} interactive />
          </div>

          {!selectedId || attentionCount > 0 ? (
            <div className="city-hud" aria-label="City health">
              {!selectedId ? (
                <button
                  type="button"
                  className={`city-hud-pill${cityHealthy ? "" : " city-hud-pill--attention"}${opsOpen ? " city-hud-pill--open" : ""}`}
                  aria-expanded={opsOpen}
                  onClick={() => setOpsOpen((open) => !open)}
                >
                  <span
                    className={`city-hud-dot${cityHealthy ? " city-hud-dot--ok" : " city-hud-dot--alert"}`}
                    aria-hidden
                  />
                  <span className="city-hud-copy">
                    <span className="city-hud-title">
                      {cityHealthy
                        ? "City healthy"
                        : `${attentionCount} need${attentionCount === 1 ? "s" : ""} attention`}
                    </span>
                    <span className="city-hud-meta">
                      {onDutyCount} on duty · {liveSessionCount} live
                      {positions.length > 0 &&
                      liveSessionCount !== positions.length
                        ? ` · ${positions.length} tracked`
                        : ""}
                      {queue.length > 0 ? ` · ${queue.length} in queue` : ""}
                    </span>
                  </span>
                  <span className="city-hud-chevron" aria-hidden>
                    {opsOpen ? "Close" : "Details"}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className={`city-hud-pill city-hud-pill--compact city-hud-pill--attention${opsOpen ? " city-hud-pill--open" : ""}`}
                  aria-expanded={opsOpen}
                  onClick={() => setOpsOpen((open) => !open)}
                >
                  <span className="city-hud-dot city-hud-dot--alert" aria-hidden />
                  <span className="city-hud-title">
                    {attentionCount} need{attentionCount === 1 ? "s" : ""}{" "}
                    attention
                  </span>
                </button>
              )}

              {opsOpen ? (
                <div className="city-ops" role="region" aria-label="Operations detail">
                  {!selectedId ? (
                    <div className="city-ops-section">
                      <p className="city-ops-kicker">Fleet</p>
                      <div className="city-ops-metrics">
                        <div>
                          <span>On duty</span>
                          <strong>{onDutyCount}</strong>
                        </div>
                        <div>
                          <span>Live</span>
                          <strong>{liveSessionCount}</strong>
                        </div>
                        <div>
                          <span>Tracked</span>
                          <strong>{positions.length}</strong>
                        </div>
                        <div>
                          <span>Queue</span>
                          <strong>{queue.length}</strong>
                        </div>
                      </div>
                      <p className="city-ops-note">
                        Markers come from real driver signals only — never invented motion.
                      </p>
                    </div>
                  ) : null}

                  {lostTasks.length > 0 ? (
                    <div className="city-ops-section">
                      <p className="city-ops-kicker">Lost signal</p>
                      <ul className="city-ops-list">
                        {lostTasks.map((t) => (
                          <li key={t.id} className="city-ops-row">
                            <span className="city-ops-row-label">
                              Job {t.jobId.slice(0, 8)}
                            </span>
                            <button
                              type="button"
                              className="btn btn-quiet"
                              onClick={() =>
                                void run(
                                  () => ackLostTask(token, t.id),
                                  "Lost-signal task acknowledged",
                                )
                              }
                            >
                              Acknowledge
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="city-ops-section">
                    <p className="city-ops-kicker">
                      Incidents
                      {incidents.length > 0 ? ` · ${incidents.length}` : ""}
                    </p>
                    {incidents.length === 0 ? (
                      <p className="city-ops-note">No open emergencies.</p>
                    ) : (
                      <ul className="city-ops-list">
                        {incidents.map((inc) => (
                          <li key={inc.id}>
                            <button
                              type="button"
                              className={`city-ops-incident${incidentId === inc.id ? " city-ops-incident--active" : ""}`}
                              onClick={() => {
                                setIncidentId((cur) =>
                                  cur === inc.id ? null : inc.id,
                                );
                              }}
                            >
                              <span className="city-ops-incident-title">
                                {inc.publicCode}
                                <span className="city-ops-incident-cat">
                                  {inc.category}
                                </span>
                              </span>
                              <span className="city-ops-incident-meta">
                                {inc.playbook} · {inc.status}
                                {inc.doNotNormalReturn
                                  ? " · no normal return"
                                  : ""}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {incidentDetail ? (
                    <div className="city-ops-section">
                      <p className="city-ops-kicker">Incident detail</p>
                      <p className="city-ops-note">
                        {incidentDetail.incident.note || "No driver note."}
                        {incidentDetail.job
                          ? ` · Job ${incidentDetail.job.publicCode}`
                          : ""}
                      </p>
                      <div className="city-ops-actions">
                        {incidentDetail.incident.status === "open" ? (
                          <button
                            className="btn btn-primary"
                            type="button"
                            disabled={actionBusy}
                            onClick={() =>
                              void run(async () => {
                                await acknowledgeIncident(
                                  token,
                                  incidentDetail.incident.id,
                                );
                                setIncidentDetail(
                                  await fetchIncidentDetail(
                                    token,
                                    incidentDetail.incident.id,
                                  ),
                                );
                              }, "Incident acknowledged")
                            }
                          >
                            Acknowledge
                          </button>
                        ) : null}
                        {incidentDetail.job ? (
                          <button
                            className="btn btn-quiet"
                            type="button"
                            onClick={() => {
                              setOpsOpen(false);
                              setSelectedId(incidentDetail.job!.id);
                              requestAnimationFrame(() => {
                                detailRailRef.current?.scrollTo(0, 0);
                              });
                            }}
                          >
                            Open job
                          </button>
                        ) : null}
                        <button
                          className="btn btn-quiet"
                          type="button"
                          disabled={actionBusy}
                          onClick={() =>
                            void run(async () => {
                              await escalateIncident(
                                token,
                                incidentDetail.incident.id,
                                "ops_escalate",
                              );
                              setIncidentDetail(
                                await fetchIncidentDetail(
                                  token,
                                  incidentDetail.incident.id,
                                ),
                              );
                            }, "Escalated")
                          }
                        >
                          Escalate
                        </button>
                        <button
                          className="btn btn-quiet"
                          type="button"
                          disabled={actionBusy}
                          onClick={() =>
                            void run(async () => {
                              await notifyIncidentCustomer(
                                token,
                                incidentDetail.incident.id,
                              );
                            }, "Customer notified")
                          }
                        >
                          Notify customer
                        </button>
                        <button
                          className="btn btn-quiet"
                          type="button"
                          disabled={actionBusy}
                          onClick={() =>
                            void run(async () => {
                              const code =
                                incidentDetail.incident.category === "medical"
                                  ? "medical_cleared"
                                  : incidentDetail.incident.category ===
                                      "threat"
                                    ? "external_emergency_handled"
                                    : "backup_completed";
                              await resolveIncident(
                                token,
                                incidentDetail.incident.id,
                                {
                                  resolutionCode: code,
                                  releaseHold: true,
                                },
                              );
                              setIncidentId(null);
                            }, "Incident resolved")
                          }
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section
          className="detail-rail inspector"
          aria-label="Job inspector"
          ref={detailRailRef}
        >
          <header className="inspector-head">
            <div className="inspector-head-copy">
              <p className="inspector-kicker">
                {selected ? "Job" : "Drivers"}
              </p>
              <h2 className="inspector-title">
                {selected ? selected.job.publicCode : "On duty"}
              </h2>
            </div>
            {selected ? (
              <button
                className="btn btn-quiet"
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setError(null);
                  detailRailRef.current?.scrollTo(0, 0);
                }}
              >
                Close
              </button>
            ) : null}
          </header>

          {selected && detail && situation ? (
                <div className="inspector-body">
                  <div
                    className={`inspector-status inspector-status--${situation.tone}`}
                    role="status"
                  >
                    <p className="inspector-status-title">{situation.title}</p>
                    <p className="inspector-status-detail">
                      {situation.detail}
                    </p>
                  </div>

                  {error ? (
                    <div className="inspector-status inspector-status--blocked" role="alert">
                      <p className="inspector-status-title">Action did not complete</p>
                      <p className="inspector-status-detail">{error}</p>
                    </div>
                  ) : null}

                  <section className="inspector-section" aria-label="Route">
                    <div className="inspector-route">
                      <div className="inspector-stop">
                        <p className="inspector-stop-label">Pickup</p>
                        <p className="inspector-stop-address">
                          {detail.job.pickupAddress}
                        </p>
                        <p className="inspector-stop-zone">
                          {detail.job.pickupZoneCode}
                        </p>
                      </div>
                      <div className="inspector-route-rule" aria-hidden />
                      <div className="inspector-stop">
                        <p className="inspector-stop-label">Dropoff</p>
                        <p className="inspector-stop-address">
                          {detail.job.dropoffAddress}
                        </p>
                        <p className="inspector-stop-zone">
                          {detail.job.dropoffZoneCode}
                        </p>
                      </div>
                    </div>
                    <div className="inspector-meta">
                      <div>
                        <span>Package</span>
                        <strong>{detail.job.packageClass}</strong>
                      </div>
                      <div>
                        <span>Payment</span>
                        <strong>{humanPayment(detail.job.paymentStatus)}</strong>
                      </div>
                    </div>
                  </section>

                  <section className="inspector-section" aria-label="Assign">
                    <h3 className="inspector-section-title">Driver</h3>

                    {eligible.length === 0 ? (
                      <p className="inspector-note">
                        No eligible drivers on duty. Ask a driver to go on
                        duty, then refresh.
                      </p>
                    ) : selectedDriver ? (
                      <div className="inspector-driver-card">
                        <div className="inspector-driver-card-top">
                          <div className="inspector-driver-card-identity">
                            <p className="inspector-driver-card-name">
                              {driverName(selectedDriver)}
                            </p>
                            <p className="inspector-driver-card-match">
                              {match?.label}
                            </p>
                          </div>
                          <p className="inspector-driver-card-hint">
                            {match?.detail}
                          </p>
                        </div>
                        <dl className="inspector-driver-attrs">
                          <div>
                            <dt>Vehicle</dt>
                            <dd>{selectedDriver.vehicleClass}</dd>
                          </div>
                          <div>
                            <dt>Zone</dt>
                            <dd>
                              {selectedDriver.homeZoneCode ?? "—"}
                              {selectedDriver.zoneMatch ? " · match" : ""}
                            </dd>
                          </div>
                          <div>
                            <dt>Availability</dt>
                            <dd>
                              {selectedDriver.onDuty === false
                                ? "Off duty"
                                : "On duty"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ) : (
                      <p className="inspector-note">Select a driver below.</p>
                    )}

                    {eligible.length > 0 ? (
                      <div className="field field-quiet">
                        <label htmlFor="driver">
                          {eligible.length === 1
                            ? "Only eligible driver"
                            : `Choose from ${eligible.length} eligible`}
                        </label>
                        <select
                          id="driver"
                          className="inspector-select"
                          value={driverId}
                          onChange={(e) => setDriverId(e.target.value)}
                        >
                          {eligible.map((d) => (
                            <option key={d.userId} value={d.userId}>
                              {driverOptionLabel(d)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <div className="inspector-primary-actions">
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={actionBusy || !canOffer}
                        title={
                          !driverId
                            ? "Select an on-duty driver"
                            : detail.holds[0]
                              ? "Release hold first"
                              : detail.assignment
                                ? "Assignment already open"
                                : !paymentReadyForOffer(detail.job.paymentStatus)
                                  ? humanPayment(detail.job.paymentStatus)
                                  : "Send offer to driver"
                        }
                        onClick={() =>
                          void run(
                            () =>
                              assignJob(
                                token,
                                selected.job.id,
                                driverId,
                                true,
                              ),
                            "Offer sent — driver must accept",
                          )
                        }
                      >
                        {actionBusy ? "Sending…" : "Send offer"}
                      </button>
                      <button
                        className="btn btn-ghost btn-assign-direct"
                        type="button"
                        disabled={actionBusy || !canOffer}
                        title="Assigns the driver immediately without an offer"
                        onClick={() =>
                          void run(
                            () =>
                              assignJob(
                                token,
                                selected.job.id,
                                driverId,
                                false,
                              ),
                            "Assigned directly",
                          )
                        }
                      >
                        Assign without offer
                      </button>
                    </div>
                  </section>

                  <section className="inspector-section inspector-section--muted" aria-label="More actions">
                    <h3 className="inspector-section-title">More</h3>
                    <div className="field field-quiet">
                      <label htmlFor="reason">Reason (required)</label>
                      <select
                        id="reason"
                        className="inspector-select"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                      >
                        <option value="">Select a reason…</option>
                        {OVERRIDE_REASONS.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="inspector-tertiary-actions">
                      <button
                        className="btn btn-quiet"
                        type="button"
                        disabled={
                          !driverId || !reason || Boolean(detail.holds[0])
                        }
                        onClick={() =>
                          void run(
                            () =>
                              reassignJob(
                                token,
                                selected.job.id,
                                driverId,
                                reason,
                              ),
                            "Reassigned",
                          )
                        }
                      >
                        Reassign
                      </button>
                      <button
                        className="btn btn-quiet"
                        type="button"
                        disabled={
                          !driverId || !reason || Boolean(detail.holds[0])
                        }
                        onClick={() =>
                          void run(
                            () =>
                              backupJob(
                                token,
                                selected.job.id,
                                driverId,
                                reason,
                              ),
                            "Backup assigned",
                          )
                        }
                      >
                        Backup
                      </button>
                      <button
                        className="btn btn-quiet"
                        type="button"
                        disabled={!reason}
                        onClick={() =>
                          void run(
                            () => placeHold(token, selected.job.id, reason),
                            "Hold placed",
                          )
                        }
                      >
                        Place hold
                      </button>
                      {detail.holds[0] ? (
                        <button
                          className="btn btn-quiet"
                          type="button"
                          onClick={() =>
                            void run(
                              () => releaseHold(token, detail.holds[0].id),
                              "Hold released",
                            )
                          }
                        >
                          Release hold
                        </button>
                      ) : null}
                    </div>
                  </section>
                </div>
          ) : (
            <div className="inspector-body">
              {error ? (
                <div className="inspector-status inspector-status--blocked" role="alert">
                  <p className="inspector-status-title">Could not load</p>
                  <p className="inspector-status-detail">{error}</p>
                </div>
              ) : null}
              {selected && !detail ? (
                <p className="inspector-lede">Loading job…</p>
              ) : !selected ? (
                <>
                  <p className="inspector-lede">
                    Select a job from the queue to inspect and assign.
                  </p>
                  {drivers.length === 0 ? (
                    <p className="empty">
                      No drivers yet. Register a driver profile, then refresh.
                    </p>
                  ) : (
                    <ul className="inspector-driver-list">
                      {drivers.map((d) => (
                        <li key={d.id} className="inspector-driver">
                          <div className="inspector-driver-name">
                            <span
                              className={`pip ${d.onDuty ? "success" : "signal"}`}
                              aria-hidden
                            />
                            <span>
                              {d.callsign || d.displayName || "Driver"}
                            </span>
                          </div>
                          <div className="inspector-driver-meta">
                            {d.vehicleClass} ·{" "}
                            {d.onDuty ? "On duty" : "Off duty"}
                            {d.homeZoneCode ? ` · ${d.homeZoneCode}` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}
            </div>
          )}
        </section>
      </div>
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<SessionUser | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [booting, setBooting] = useState(() => Boolean(readStoredToken()));

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }
    setBooting(true);
    void fetchMe(token)
      .then((me) => {
        if (!staffAllowed(me.user)) {
          clearStoredToken();
          setToken(null);
          setUser(null);
          setBootError(
            "This account is not allowed on Dispatch. Ask an admin for access.",
          );
          return;
        }
        setUser(me.user);
      })
      .catch(() => {
        clearStoredToken();
        setToken(null);
        setUser(null);
        setBootError("Session expired — sign in again.");
      })
      .finally(() => setBooting(false));
  }, [token]);

  if (booting) {
    return (
      <div className="login">
        <div className="login-inner">
          <p className="hint">Loading Dispatch…</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return (
      <>
        {bootError ? (
          <div className="toast" role="status">
            {bootError}
          </div>
        ) : null}
        <Login
          onAuthed={(nextToken, nextUser) => {
            writeStoredToken(nextToken);
            setToken(nextToken);
            setUser(nextUser);
            setBootError(null);
          }}
        />
      </>
    );
  }

  return (
    <Board
      token={token}
      user={user}
      onLogout={() => {
        clearStoredToken();
        setToken(null);
        setUser(null);
      }}
    />
  );
}
