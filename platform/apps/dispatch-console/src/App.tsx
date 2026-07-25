import { useEffect, useMemo, useState, useTransition } from "react";
import { SwiftMap, type MapMarker } from "./maps";
import {
  assignDevRole,
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
  resetStaffMfa,
  resolveIncident,
  verifyMfa,
  verifyOtp,
  type BoardPosition,
  type Driver,
  type IncidentRow,
  type QueueItem,
  type SessionUser,
} from "./api";
import {
  clearTotpSecret,
  generateTotp,
  readTotpSecret,
  writeTotpSecret,
} from "./totp";

const TOKEN_KEY = "vuush.dispatch.token";
const TOKEN_KEY_LEGACY = "swift.dispatch.token";

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

function driverLabel(d: {
  callsign?: string;
  displayName?: string | null;
  email?: string | null;
  vehicleClass: string;
  zoneMatch?: boolean;
  onDuty?: boolean;
}) {
  const name =
    d.callsign ||
    (d.displayName && !d.displayName.includes("@") ? d.displayName : null) ||
    d.email?.split("@")[0] ||
    "Driver";
  const bits = [name, d.vehicleClass];
  if (d.onDuty === false) bits.push("OFF DUTY");
  else if (d.onDuty) bits.push("on duty");
  if (d.zoneMatch) bits.push("zone match");
  if (d.email) bits.push(d.email);
  return bits.join(" · ");
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
    if (res.totpSecret) {
      writeTotpSecret(email, res.totpSecret);
    }
    let secret = res.totpSecret ?? readTotpSecret(email);
    if (!secret) {
      await resetStaffMfa(email);
      clearTotpSecret(email);
      throw new Error("mfa_reset_retry");
    }

    try {
      const totpCode = await generateTotp(secret);
      const mfa = await verifyMfa(res.mfa.mfaToken, totpCode);
      if (!mfa.session?.accessToken || !mfa.user) {
        throw new Error("mfa_incomplete");
      }
      return { token: mfa.session.accessToken, user: mfa.user };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      // Stale browser secret vs DB — common in local testing
      if (
        message === "invalid_mfa_code" ||
        message === "mfa_ticket_invalid" ||
        message === "mfa_not_configured"
      ) {
        localStorage.removeItem(storageKey);
        await resetStaffMfa(email);
        throw new Error("mfa_reset_retry");
      }
      throw err;
    }
  }

  throw new Error(res.status || "mfa_required_or_incomplete");
}

function Login({
  onAuthed,
}: {
  onAuthed: (token: string, user: SessionUser) => void;
}) {
  const [email, setEmail] = useState("dispatcher@vuush.local");
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
      if (
        !user.roles.includes("dispatcher") &&
        !user.roles.includes("administrator")
      ) {
        await assignDevRole(user.id, "dispatcher");
        const me = await fetchMe(token);
        user = me.user;
      }
      onAuthed(token, user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "verify_failed";
      if (message === "mfa_reset_retry") {
        setChallengeId(null);
        setCode("");
        setDevHint(null);
        setError(
          "Staff MFA was reset for this browser. Send a new sign-in code — enrollment will run again.",
        );
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
        <p className="login-title">Dispatch</p>
        <p className="login-promise">
          Your time back — from intention to completion.
        </p>
        {!challengeId ? (
          <form onSubmit={sendCode}>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>
            {error ? <div className="error">{error}</div> : null}
            <button className="btn btn-primary" disabled={busy} type="submit">
              Send sign-in code
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <div className="field">
              <label htmlFor="code">One-time code</label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
              />
            </div>
            {devHint ? (
              <p className="hint">
                Local code ready. Staff MFA completes automatically on this
                console.
              </p>
            ) : null}
            {error ? <div className="error">{error}</div> : null}
            <button className="btn btn-primary" disabled={busy} type="submit">
              Enter board
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setChallengeId(null);
                setCode("");
                setDevHint(null);
              }}
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
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof fetchJobDetail>
  > | null>(null);
  const [eligible, setEligible] = useState<
    Array<Driver & { zoneMatch: boolean }>
  >([]);
  const [driverId, setDriverId] = useState("");
  const [reason, setReason] = useState("ops_override");
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [incidentDetail, setIncidentDetail] = useState<Awaited<
    ReturnType<typeof fetchIncidentDetail>
  > | null>(null);

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
        "Payment is not ready for assignment (refunded or unpaid). Use a captured job — e.g. SW-6B8465 — or re-book/pay first.",
      assignment_already_open:
        "This job already has an open offer or active assignment.",
      illegal_transition: "Job state does not allow assignment right now.",
      driver_not_eligible: "Selected driver is not eligible for this package.",
      driver_profile_missing: "Selected driver has no profile.",
      driver_off_duty: "Selected driver is off duty.",
      vehicle_class_blocked: "Driver vehicle class cannot take this package.",
      job_on_hold: "Job is on hold — release the hold first.",
      validation_error: "Request was invalid (check driver selection).",
    };
    return map[code] ?? code;
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
            className="btn btn-ghost"
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

      <div className="board">
        <section className="rail" aria-label="Dispatch queue">
          <div className="rail-head">
            <h2>Queue</h2>
            <p>
              {queue.length === 0
                ? "Nothing waiting — when jobs confirm, they appear here."
                : `${queue.length} waiting for assignment`}
            </p>
          </div>
          <ul className="list">
            {queue.map((item) => (
              <li key={item.job.id}>
                <button
                  type="button"
                  className={`list-row${selectedId === item.job.id ? " active" : ""}`}
                  onClick={() => setSelectedId(item.job.id)}
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
                    {item.job.paymentStatus !== "captured" &&
                    item.job.paymentStatus !== "not_required"
                      ? ` · ${item.job.paymentStatus}`
                      : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="stage" aria-label="City overview">
          <div className="stage-map">
            <SwiftMap className="dispatch-map" markers={boardMarkers} interactive />
          </div>
          <div className="stage-note">
            <h3>City board</h3>
            <p>
              {positions.length === 0
                ? "No active tracking sessions. Markers appear only from real signals — never invented motion."
                : `${positions.length} active session${positions.length === 1 ? "" : "s"}. Fresh = live marker; degraded = last known; conflicted/lost = no live path.`}
            </p>
            {lostTasks.length > 0 ? (
              <div className="lost-strip">
                <p className="section-label">Lost signal</p>
                {lostTasks.map((t) => (
                  <div key={t.id} className="lost-row">
                    <span className="mono">{t.jobId.slice(0, 8)}</span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        void run(
                          () => ackLostTask(token, t.id),
                          "Lost-signal task acknowledged",
                        )
                      }
                    >
                      Ack
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="lost-strip">
              <p className="section-label">
                Incidents {incidents.length ? `(${incidents.length})` : ""}
              </p>
              {incidents.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  No open emergencies.
                </p>
              ) : (
                incidents.map((inc) => (
                  <button
                    key={inc.id}
                    type="button"
                    className={`list-row${incidentId === inc.id ? " active" : ""}`}
                    style={{ width: "100%", textAlign: "left", marginBottom: 4 }}
                    onClick={() => {
                      setIncidentId(inc.id);
                      setSelectedId(inc.jobId);
                    }}
                  >
                    <div className="list-primary">
                      <span className="pip danger" aria-hidden />
                      {inc.publicCode} · {inc.category}
                    </div>
                    <div className="list-secondary">
                      {inc.playbook} · {inc.status}
                      {inc.doNotNormalReturn ? " · no normal return" : ""}
                    </div>
                  </button>
                ))
              )}
            </div>
            {incidentDetail ? (
              <div className="lost-strip">
                <p className="section-label">Incident detail</p>
                <p className="muted" style={{ margin: "0 0 8px" }}>
                  {incidentDetail.incident.note || "No driver note."}
                  {incidentDetail.job
                    ? ` · Job ${incidentDetail.job.publicCode}`
                    : ""}
                </p>
                <div className="actions" style={{ flexWrap: "wrap" }}>
                  {incidentDetail.incident.status === "open" ? (
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={actionBusy}
                      onClick={() =>
                        void run(async () => {
                          await acknowledgeIncident(token, incidentDetail.incident.id);
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
                  <button
                    className="btn btn-secondary"
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
                    className="btn btn-secondary"
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
                    className="btn btn-ghost"
                    type="button"
                    disabled={actionBusy}
                    onClick={() =>
                      void run(async () => {
                        const code =
                          incidentDetail.incident.category === "medical"
                            ? "medical_cleared"
                            : incidentDetail.incident.category === "threat"
                              ? "external_emergency_handled"
                              : "backup_completed";
                        await resolveIncident(token, incidentDetail.incident.id, {
                          resolutionCode: code,
                          releaseHold: true,
                        });
                        setIncidentId(null);
                      }, "Incident resolved")
                    }
                  >
                    Resolve + release hold
                  </button>
                </div>
                <ul className="list" style={{ marginTop: 8 }}>
                  {incidentDetail.events.slice(0, 6).map((e) => (
                    <li key={e.id} className="list-secondary">
                      {e.kind} · {new Date(e.createdAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section className="detail-rail" aria-label="Job and drivers">
          <div className="rail-head">
            <h2>{selected ? "Job" : "Drivers"}</h2>
            <p>
              {selected
                ? selected.job.publicCode
                : "Duty and eligibility — select a job to assign"}
            </p>
          </div>

          {error ? (
            <div className="detail-body" style={{ paddingTop: 0 }}>
              <div className="error">{error}</div>
            </div>
          ) : null}

          {selected && detail ? (
            <div className="detail-body">
              {detail.holds[0] ? (
                <div className="banner hold" role="status">
                  Hold active ({detail.holds[0].holdType}). Assignment stays
                  blocked until released.
                </div>
              ) : null}
              {detail.job.paymentStatus !== "captured" &&
              detail.job.paymentStatus !== "not_required" ? (
                <div className="banner hold" role="alert">
                  Cannot assign — payment is{" "}
                  <strong>{detail.job.paymentStatus}</strong>. Send offer only
                  works when payment is captured (or not required). Pick another
                  job from the queue, or re-book and pay in the Customer app.
                </div>
              ) : null}

              <div className="facts">
                <div className="fact">
                  <span>State</span>
                  <span>{detail.job.state}</span>
                </div>
                <div className="fact">
                  <span>Pickup</span>
                  <span>{detail.job.pickupAddress}</span>
                </div>
                <div className="fact">
                  <span>Dropoff</span>
                  <span>{detail.job.dropoffAddress}</span>
                </div>
                <div className="fact">
                  <span>Package</span>
                  <span>{detail.job.packageClass}</span>
                </div>
                <div className="fact">
                  <span>Payment</span>
                  <span>{detail.job.paymentStatus}</span>
                </div>
                <div className="fact">
                  <span>Assignment</span>
                  <span className="mono">
                    {detail.assignment
                      ? `${detail.assignment.status} · ${detail.assignment.mode}`
                      : "none"}
                  </span>
                </div>
              </div>

              <p className="section-label">Assign</p>
              {detail.holds[0] ? (
                <p className="muted" style={{ marginBottom: 8 }}>
                  Job is on hold ({detail.holds[0].holdType}). Release the hold
                  before sending an offer.
                </p>
              ) : null}
              {detail.assignment ? (
                <p className="muted" style={{ marginBottom: 8 }}>
                  Already {detail.assignment.status}
                  {detail.assignment.mode ? ` (${detail.assignment.mode})` : ""}.
                  Decline/end that assignment before offering again, or use
                  Reassign.
                </p>
              ) : null}
              {eligible.length === 0 ? (
                <p className="muted" style={{ marginBottom: 8 }}>
                  No eligible drivers on duty. In the Driver app, sign in, tap
                  Go on duty, then hit Refresh here.
                </p>
              ) : null}
              <div className="field">
                <label htmlFor="driver">Eligible driver</label>
                <select
                  id="driver"
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  disabled={eligible.length === 0}
                >
                  {eligible.length === 0 ? (
                    <option value="">No eligible drivers on duty</option>
                  ) : null}
                  {eligible.map((d) => (
                    <option key={d.userId} value={d.userId}>
                      {driverLabel(d)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="actions">
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={
                    actionBusy ||
                    !driverId ||
                    Boolean(detail.holds[0]) ||
                    Boolean(detail.assignment) ||
                    (detail.job.paymentStatus !== "captured" &&
                      detail.job.paymentStatus !== "not_required")
                  }
                  title={
                    !driverId
                      ? "Select an on-duty driver"
                      : detail.holds[0]
                        ? "Release hold first"
                        : detail.assignment
                          ? "Assignment already open"
                          : detail.job.paymentStatus !== "captured" &&
                              detail.job.paymentStatus !== "not_required"
                            ? `Payment is ${detail.job.paymentStatus}`
                            : "Send offer to driver"
                  }
                  onClick={() =>
                    void run(
                      () => assignJob(token, selected.job.id, driverId, true),
                      "Offer sent — driver must accept",
                    )
                  }
                >
                  {actionBusy ? "Sending…" : "Send offer"}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={
                    actionBusy ||
                    !driverId ||
                    Boolean(detail.holds[0]) ||
                    Boolean(detail.assignment) ||
                    (detail.job.paymentStatus !== "captured" &&
                      detail.job.paymentStatus !== "not_required")
                  }
                  onClick={() =>
                    void run(
                      () => assignJob(token, selected.job.id, driverId, false),
                      "Assigned directly",
                    )
                  }
                >
                  Assign now
                </button>
              </div>

              <p className="section-label">More actions</p>
              <div className="field">
                <label htmlFor="reason">Reason code</label>
                <input
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="actions">
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={!driverId || Boolean(detail.holds[0])}
                  onClick={() =>
                    void run(
                      () =>
                        reassignJob(token, selected.job.id, driverId, reason),
                      "Reassigned",
                    )
                  }
                >
                  Reassign
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={!driverId || Boolean(detail.holds[0])}
                  onClick={() =>
                    void run(
                      () => backupJob(token, selected.job.id, driverId, reason),
                      "Backup assigned",
                    )
                  }
                >
                  Backup driver
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
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
                    className="btn btn-ghost"
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
            </div>
          ) : (
            <div>
              {drivers.length === 0 ? (
                <p className="empty">
                  No drivers yet. Run the M4 smoke script or register a driver
                  profile, then refresh.
                </p>
              ) : (
                <ul className="list">
                  {drivers.map((d) => (
                    <li key={d.id} className="driver-idle">
                      <div className="list-primary">
                        <span
                          className={`pip ${d.onDuty ? "success" : "signal"}`}
                          aria-hidden
                        />
                        {d.callsign || d.displayName || "Driver"} · {d.vehicleClass}
                      </div>
                      <div className="list-secondary">
                        {d.onDuty ? "On duty" : "Off duty"} ·{" "}
                        {d.eligibilityStatus}
                        {d.homeZoneCode ? ` · ${d.homeZoneCode}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error ? (
            <div className="detail-body">
              <div className="error">{error}</div>
            </div>
          ) : null}
        </section>
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<SessionUser | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetchMe(token)
      .then((me) => setUser(me.user))
      .catch(() => {
        clearStoredToken();
        setToken(null);
        setBootError("Session expired — sign in again.");
      });
  }, [token]);

  if (!token || !user) {
    return (
      <>
        {bootError ? <div className="toast">{bootError}</div> : null}
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
