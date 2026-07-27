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
