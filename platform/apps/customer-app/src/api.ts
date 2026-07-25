export type SessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  roles: string[];
};

export type Job = {
  id: string;
  publicCode: string;
  state: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupZoneCode: string;
  dropoffZoneCode: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  packageClass: string;
  paymentStatus: string;
  recipientName: string | null;
  createdAt: string;
};

export type Quote = {
  id: string;
  totalCents: number;
  currency: string;
  expiresAt: string;
  breakdown?: Record<string, unknown>;
};

export type Projection = {
  jobId: string;
  active: boolean;
  integrityClass: string;
  allowLiveMarker: boolean;
  showLiveMotion?: boolean;
  lastKnown: { lat: number; lng: number; at: string | null } | null;
  customerMessage: string;
  incidentPause?: {
    publicCode: string;
    categoryBucket: string;
    message: string;
    playbook: string;
    securityRestricted: boolean;
  } | null;
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
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;

  const res = await fetch(apiUrl(path), {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `request_failed_${res.status}`);
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
  }>("/v1/auth/otp/verify", {
    body: { challengeId, code },
  });
}

export async function fetchMe(token: string) {
  return api<{ user: SessionUser }>("/v1/me", { token });
}

export async function fetchCatalog() {
  return api<{
    zones: Array<{ code: string; name: string }>;
    serviceTypes: Array<{ code: string; name: string }>;
  }>("/v1/catalog");
}

export async function listJobs(token: string) {
  return api<{ jobs: Job[] }>("/v1/jobs", { token });
}

export async function getJob(token: string, jobId: string) {
  return api<{ job: Job; quote: Quote | null }>(`/v1/jobs/${jobId}`, { token });
}

export async function createDraft(
  token: string,
  body: Record<string, unknown>,
) {
  return api<{ job: Job }>("/v1/jobs", { token, body });
}

export async function quoteJob(token: string, jobId: string) {
  return api<{ job: Job; quote: Quote }>(`/v1/jobs/${jobId}/quote`, {
    token,
    body: {},
  });
}

export async function confirmJob(token: string, jobId: string) {
  return api<{ job: Job }>(`/v1/jobs/${jobId}/confirm`, {
    token,
    body: { methodRef: "tok_dev" },
  });
}

export async function cancelJob(token: string, jobId: string) {
  return api<{ job: Job }>(`/v1/jobs/${jobId}/cancel`, {
    token,
    body: {},
  });
}

export async function fetchProjection(token: string, jobId: string) {
  return api<{ projection: Projection }>(
    `/v1/tracking/jobs/${jobId}/projection`,
    { token },
  );
}

export type DriverProfessional = {
  publicName: string;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  vehicleClass: string;
  vehicleLabel: string | null;
  vehiclePlate: string | null;
  bio: string | null;
  homeZoneCode: string | null;
  eligibilityStatus: string;
  licenceStatus: string;
  vehicleDocStatus: string;
  insuranceStatus: string;
  docsVerified: boolean;
};

export async function fetchJobDriverProfile(token: string, jobId: string) {
  return api<{
    driver: DriverProfessional | null;
    assignmentStatus?: string;
  }>(`/v1/jobs/${jobId}/driver-profile`, { token });
}

export async function requestMutation(
  token: string,
  jobId: string,
  dropoffAddress: string,
  dropoffZoneCode: string,
  note?: string,
) {
  return api(`/v1/jobs/${jobId}/mutations`, {
    token,
    body: { dropoffAddress, dropoffZoneCode, note },
  });
}

export type SupportCase = {
  id: string;
  publicCode: string;
  subject: string;
  status: string;
  jobId: string | null;
  createdAt: string;
};

export async function openSupport(
  token: string,
  subject: string,
  message: string,
  jobId?: string,
) {
  return api<{ case: { caseId: string; publicCode: string; status: string } }>(
    "/v1/support/cases",
    {
      token,
      body: { subject, message, jobId },
    },
  );
}

export async function listSupportCases(token: string) {
  return api<{ cases: SupportCase[] }>("/v1/support/cases", { token });
}

export async function getSupportCase(token: string, caseId: string) {
  return api<{
    case: SupportCase;
    messages: Array<{
      id: string;
      authorKind: string;
      body: string;
      createdAt: string;
    }>;
  }>(`/v1/support/cases/${caseId}`, { token });
}

export async function replySupport(token: string, caseId: string, body: string) {
  return api(`/v1/support/cases/${caseId}/messages`, {
    token,
    body: { body },
  });
}

export function formatMoney(cents: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
