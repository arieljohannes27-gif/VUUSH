export type SessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  roles: string[];
};

type ApiOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
};

/** Empty in local dev (Vite proxy). Set VITE_API_BASE_URL on Vercel → Railway. */
function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}${path}`;
}

async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;

  const res = await fetch(apiUrl(path), {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `request_failed_${res.status}`);
  }
  return data;
}

export async function requestOtp(destination: string) {
  return api<{ challengeId: string; devCode?: string }>("/v1/auth/otp/request", {
    body: { channel: "email", destination },
  });
}

export async function verifyOtp(challengeId: string, code: string) {
  return api<{
    status: string;
    session?: { accessToken: string };
    user?: SessionUser;
    mfa?: { mfaToken: string; ticketId: string; expiresAt: string };
    totpSecret?: string;
  }>("/v1/auth/otp/verify", {
    body: { challengeId, code },
  });
}

export async function verifyMfa(mfaToken: string, code: string) {
  return api<{
    status: string;
    session: { accessToken: string };
    user: SessionUser;
  }>("/v1/auth/mfa/verify", {
    body: { mfaToken, code },
  });
}

export async function fetchMe(token: string) {
  return api<{ user: SessionUser }>("/v1/me", { token });
}

export async function assignDevRole(userId: string, role: string) {
  return api("/v1/dev/assign-role", {
    body: { userId, role },
  });
}

export async function resetStaffMfa(email: string) {
  return api<{ ok: boolean; userId: string; email: string }>("/v1/dev/reset-mfa", {
    body: { email },
  });
}

export type QueueItem = {
  job: {
    id: string;
    publicCode: string;
    state: string;
    pickupAddress: string;
    dropoffAddress: string;
    pickupZoneCode: string;
    dropoffZoneCode: string;
    packageClass: string;
    paymentStatus: string;
  };
  onHold: boolean;
  holds: Array<{ id: string; holdType: string; reasonCode: string }>;
};

export async function fetchQueue(token: string) {
  return api<{ queue: QueueItem[] }>("/v1/dispatch/queue", { token });
}

export type Driver = {
  id: string;
  userId: string;
  eligibilityStatus: string;
  vehicleClass: string;
  homeZoneCode: string | null;
  onDuty: boolean;
  onDutyAt: string | null;
  email?: string | null;
  displayName?: string | null;
  callsign?: string;
};

export async function fetchDrivers(token: string) {
  return api<{ drivers: Driver[] }>("/v1/dispatch/drivers", { token });
}

export async function fetchEligible(token: string, jobId: string) {
  return api<{ drivers: Array<Driver & { zoneMatch: boolean }> }>(
    `/v1/dispatch/jobs/${jobId}/eligible-drivers`,
    { token },
  );
}

export async function fetchJobDetail(token: string, jobId: string) {
  return api<{
    job: QueueItem["job"] & { activeAssignmentId: string | null };
    assignment: {
      id: string;
      driverUserId: string;
      status: string;
      mode: string;
      reasonCode: string | null;
    } | null;
    holds: Array<{ id: string; holdType: string; reasonCode: string; active: boolean }>;
  }>(`/v1/dispatch/jobs/${jobId}`, { token });
}

export async function assignJob(
  token: string,
  jobId: string,
  driverUserId: string,
  requireAccept = true,
) {
  return api(`/v1/dispatch/jobs/${jobId}/assign`, {
    token,
    body: { driverUserId, requireAccept },
  });
}

export async function reassignJob(
  token: string,
  jobId: string,
  driverUserId: string,
  reasonCode: string,
) {
  return api(`/v1/dispatch/jobs/${jobId}/reassign`, {
    token,
    body: { driverUserId, reasonCode },
  });
}

export async function backupJob(
  token: string,
  jobId: string,
  driverUserId: string,
  reasonCode: string,
) {
  return api(`/v1/dispatch/jobs/${jobId}/backup`, {
    token,
    body: { driverUserId, reasonCode },
  });
}

export async function placeHold(
  token: string,
  jobId: string,
  reasonCode: string,
) {
  return api(`/v1/dispatch/jobs/${jobId}/holds`, {
    token,
    body: { holdType: "DISPATCH_HOLD", reasonCode },
  });
}

export async function releaseHold(token: string, holdId: string) {
  return api(`/v1/dispatch/holds/${holdId}/release`, {
    token,
    method: "POST",
    body: {},
  });
}

export type BoardPosition = {
  sessionId: string;
  jobId: string;
  status: string;
  integrityClass: string;
  lat: number | null;
  lng: number | null;
  at: string | null;
  allowLiveMarker: boolean;
  showLiveMotion: boolean;
};

export async function fetchBoardPositions(token: string) {
  return api<{ positions: BoardPosition[] }>("/v1/dispatch/board-positions", {
    token,
  });
}

export async function fetchLostTasks(token: string) {
  return api<{
    tasks: Array<{ id: string; jobId: string; sessionId: string; status: string }>;
  }>("/v1/dispatch/lost-signal-tasks", { token });
}

export async function ackLostTask(token: string, taskId: string) {
  return api(`/v1/dispatch/lost-signal-tasks/${taskId}/ack`, {
    token,
    method: "POST",
    body: {},
  });
}

export type IncidentRow = {
  id: string;
  publicCode: string;
  category: string;
  severity: string;
  status: string;
  playbook: string;
  jobId: string | null;
  driverUserId: string;
  doNotNormalReturn: boolean;
  nonPunitive: boolean;
  securityRestricted: boolean;
  createdAt: string;
};

export async function fetchIncidents(token: string) {
  return api<{ incidents: IncidentRow[] }>("/v1/dispatch/incidents", { token });
}

export async function fetchIncidentDetail(token: string, id: string) {
  return api<{
    incident: IncidentRow & {
      note: string | null;
      lat: number | null;
      lng: number | null;
      resolutionCode: string | null;
    };
    events: Array<{
      id: string;
      kind: string;
      createdAt: string;
      payload: Record<string, unknown>;
    }>;
    job: { id: string; publicCode: string; state: string } | null;
    hold: { id: string; active: boolean; holdType: string } | null;
  }>(`/v1/dispatch/incidents/${id}`, { token });
}

export async function acknowledgeIncident(token: string, id: string) {
  return api(`/v1/dispatch/incidents/${id}/acknowledge`, {
    token,
    method: "POST",
    body: {},
  });
}

export async function escalateIncident(token: string, id: string, note?: string) {
  return api(`/v1/dispatch/incidents/${id}/escalate`, {
    token,
    body: { note },
  });
}

export async function notifyIncidentCustomer(token: string, id: string) {
  return api(`/v1/dispatch/incidents/${id}/notify-customer`, {
    token,
    method: "POST",
    body: {},
  });
}

export async function resolveIncident(
  token: string,
  id: string,
  body: {
    resolutionCode: string;
    resolutionNote?: string;
    releaseHold?: boolean;
  },
) {
  return api(`/v1/dispatch/incidents/${id}/resolve`, {
    token,
    body,
  });
}
