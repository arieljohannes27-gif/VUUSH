export type SessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  roles: string[];
};

export type SupportCase = {
  id: string;
  publicCode: string;
  subject: string;
  status: string;
  channel: string;
  priority: string;
  jobId: string | null;
  claimOpened: boolean;
  openedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type SupportMessage = {
  id: string;
  caseId: string;
  authorUserId: string | null;
  authorKind: string;
  body: string;
  createdAt: string;
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
  return api("/v1/dev/assign-role", { body: { userId, role } });
}

export async function resetStaffMfa(email: string) {
  return api("/v1/dev/reset-mfa", { body: { email } });
}

export async function fetchDeskCases(token: string) {
  return api<{ cases: SupportCase[] }>("/v1/support/desk/cases", { token });
}

export async function fetchDeskCase(token: string, caseId: string) {
  return api<{
    case: SupportCase;
    messages: SupportMessage[];
    job: {
      id: string;
      publicCode: string;
      state: string;
      pickupAddress: string;
      dropoffAddress: string;
      paymentStatus: string;
    } | null;
    payments: Array<{ id: string; amountCents: number; status: string; currency: string }>;
    timeline: Array<{
      id: string;
      action: string;
      occurredAt: string;
      reasonCode: string | null;
    }>;
    opener: {
      id: string;
      email: string | null;
      phone: string | null;
      displayName: string | null;
    } | null;
  }>(`/v1/support/desk/cases/${caseId}`, { token });
}

export async function replyCase(token: string, caseId: string, body: string) {
  return api(`/v1/support/cases/${caseId}/messages`, {
    token,
    body: { body },
  });
}

export async function resolveCase(token: string, caseId: string, note?: string) {
  return api(`/v1/support/desk/cases/${caseId}/resolve`, {
    token,
    body: { note },
  });
}

export async function escalateCase(
  token: string,
  caseId: string,
  reasonCode: string,
  note?: string,
) {
  return api(`/v1/support/desk/cases/${caseId}/escalate`, {
    token,
    body: { reasonCode, note },
  });
}

export async function openClaim(token: string, caseId: string, note: string) {
  return api(`/v1/support/desk/cases/${caseId}/claim`, {
    token,
    body: { note },
  });
}

export async function refundCase(
  token: string,
  caseId: string,
  reasonCode: string,
) {
  return api(`/v1/support/desk/cases/${caseId}/refund`, {
    token,
    body: { reasonCode },
  });
}

export function formatMoney(cents: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
