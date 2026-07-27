export type SessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  roles: string[];
};

export type OrgMembership = {
  orgId: string;
  orgName: string;
  orgStatus: string;
  cityCode: string;
  payMode: string;
  role: string;
  membershipId: string;
};

export type OrgSite = {
  id: string;
  orgId: string;
  label: string;
  address: string;
  zoneCode: string | null;
  kind: string;
  createdAt: string;
};

export type OrgMember = {
  membershipId: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  role: string;
  createdAt: string;
};

type ApiOptions = {
  method?: string;
  token?: string | null;
  orgId?: string | null;
  body?: unknown;
};

function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}${path}`;
}

async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.orgId) headers["x-org-id"] = opts.orgId;
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

export async function fetchEnterpriseSession(token: string) {
  return api<{ user: SessionUser; memberships: OrgMembership[] }>(
    "/v1/enterprise/session",
    { token },
  );
}

export async function fetchEnterpriseHome(token: string, orgId: string) {
  return api<{
    org: { id: string; name: string; cityCode: string; payMode: string };
    role: string;
    stats: {
      sites: number;
      members: number;
      liveShipments: number;
      todayShipments: number;
      pendingApprovals: number;
    };
  }>("/v1/enterprise/home", { token, orgId });
}

export async function fetchSites(token: string, orgId: string) {
  return api<{ sites: OrgSite[] }>("/v1/enterprise/sites", { token, orgId });
}

export async function createSite(
  token: string,
  orgId: string,
  body: {
    label: string;
    address: string;
    zoneCode?: string | null;
    kind?: "warehouse" | "store" | "other";
  },
) {
  return api<{ site: OrgSite }>("/v1/enterprise/sites", {
    token,
    orgId,
    body,
  });
}

export async function fetchMembers(token: string, orgId: string) {
  return api<{ members: OrgMember[] }>("/v1/enterprise/members", {
    token,
    orgId,
  });
}

export async function inviteMember(
  token: string,
  orgId: string,
  body: {
    email: string;
    displayName?: string;
    role?: "org_admin" | "booker" | "approver" | "viewer";
  },
) {
  return api("/v1/enterprise/members/invite", { token, orgId, body });
}

export async function fetchZones(token: string, orgId: string) {
  return api<{
    zones: Array<{ code: string; name: string; city: string }>;
  }>("/v1/enterprise/zones", { token, orgId });
}

export type EnterpriseJob = {
  id: string;
  publicCode: string;
  state: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupZoneCode: string;
  dropoffZoneCode: string;
  packageClass: string;
  paymentStatus: string;
  createdAt: string;
};

export type EnterpriseQuote = {
  id: string;
  totalCents: number;
  currency: string;
  distanceKm: number;
  expiresAt: string;
};

export async function fetchCatalog(token: string, orgId: string) {
  return api<{
    serviceTypes: Array<{ code: string; name: string }>;
    zones: Array<{ code: string; name: string }>;
  }>("/v1/enterprise/catalog", { token, orgId });
}

export async function fetchJobs(token: string, orgId: string) {
  return api<{ jobs: EnterpriseJob[] }>("/v1/enterprise/jobs", { token, orgId });
}

export async function createJob(
  token: string,
  orgId: string,
  body: {
    serviceTypeCode: string;
    packageClass?: "small" | "medium" | "large";
    pickupAddress: string;
    pickupZoneCode: string;
    dropoffAddress: string;
    dropoffZoneCode: string;
    recipientName?: string;
    notes?: string;
    prohibitedGoodsDeclared: true;
  },
) {
  return api<{ job: EnterpriseJob }>("/v1/enterprise/jobs", {
    token,
    orgId,
    body,
  });
}

export async function quoteEnterpriseJob(
  token: string,
  orgId: string,
  jobId: string,
) {
  return api<{ job: EnterpriseJob; quote: EnterpriseQuote }>(
    `/v1/enterprise/jobs/${jobId}/quote`,
    { token, orgId, body: {} },
  );
}

export async function confirmEnterpriseJob(
  token: string,
  orgId: string,
  jobId: string,
) {
  return api<{
    job: EnterpriseJob;
    quote: EnterpriseQuote;
    needsApproval?: boolean;
  }>(`/v1/enterprise/jobs/${jobId}/confirm`, { token, orgId, body: {} });
}

export function formatZar(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

export async function fetchApprovals(token: string, orgId: string) {
  return api<{ jobs: EnterpriseJob[] }>("/v1/enterprise/approvals", {
    token,
    orgId,
  });
}

export async function approveJob(token: string, orgId: string, jobId: string) {
  return api(`/v1/enterprise/jobs/${jobId}/approve`, {
    token,
    orgId,
    body: {},
  });
}

export async function rejectJob(token: string, orgId: string, jobId: string) {
  return api(`/v1/enterprise/jobs/${jobId}/reject`, {
    token,
    orgId,
    body: {},
  });
}

export async function setApprovalThreshold(
  token: string,
  orgId: string,
  approvalThresholdCents: number | null,
) {
  return api<{ org: { approvalThresholdCents: number | null } }>(
    "/v1/enterprise/settings",
    {
      token,
      orgId,
      method: "PATCH",
      body: { approvalThresholdCents },
    },
  );
}

export async function fetchStatements(token: string, orgId: string) {
  return api<{
    statements: Array<{
      id: string;
      totalCents: number;
      currency: string;
      status: string;
      csvBody: string | null;
      periodStart: string;
      periodEnd: string;
      createdAt: string;
    }>;
  }>("/v1/enterprise/statements", { token, orgId });
}

export async function generateStatement(token: string, orgId: string) {
  return api("/v1/enterprise/statements/generate", { token, orgId, body: {} });
}

export async function fetchApiKeys(token: string, orgId: string) {
  return api<{
    keys: Array<{
      id: string;
      name: string;
      keyPrefix: string;
      createdAt: string;
      revokedAt: string | null;
    }>;
  }>("/v1/enterprise/api-keys", { token, orgId });
}

export async function createApiKey(token: string, orgId: string, name: string) {
  return api<{
    key: { id: string; name: string; keyPrefix: string };
    secret: string;
  }>("/v1/enterprise/api-keys", { token, orgId, body: { name } });
}

export async function revokeApiKey(token: string, orgId: string, keyId: string) {
  return api(`/v1/enterprise/api-keys/${keyId}/revoke`, {
    token,
    orgId,
    body: {},
  });
}

export async function createMultiStopJob(
  token: string,
  orgId: string,
  body: {
    serviceTypeCode: string;
    packageClass?: "small" | "medium" | "large";
    stops: Array<{ label?: string; address: string; zoneCode?: string }>;
    prohibitedGoodsDeclared: true;
  },
) {
  return api<{ job: EnterpriseJob }>("/v1/enterprise/jobs/multi-stop", {
    token,
    orgId,
    body,
  });
}
