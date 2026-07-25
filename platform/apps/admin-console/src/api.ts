export type SessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  roles: string[];
  totpEnabled?: boolean;
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

export async function fetchAdminHome(token: string) {
  return api<{
    zonesActive: number;
    flags: number;
    reasonCodesActive: number;
    openBreakGlass: number;
    recentAudit: Array<{
      id: string;
      action: string;
      subjectType: string;
      subjectId: string | null;
      occurredAt: string;
    }>;
  }>("/v1/admin/home", { token });
}

export async function fetchFlags(token: string) {
  return api<{
    flags: Array<{
      key: string;
      enabled: boolean;
      value: string | null;
      description: string | null;
    }>;
  }>("/v1/admin/flags", { token });
}

export async function patchFlag(
  token: string,
  key: string,
  enabled: boolean,
  reasonCode: string,
) {
  return api(`/v1/admin/flags/${encodeURIComponent(key)}`, {
    token,
    method: "PATCH",
    body: { enabled, reasonCode },
  });
}

export async function fetchZones(token: string) {
  return api<{
    zones: Array<{
      id: string;
      code: string;
      name: string;
      city: string;
      active: boolean;
    }>;
  }>("/v1/admin/zones", { token });
}

export async function createZone(
  token: string,
  body: {
    code: string;
    name: string;
    city: string;
    active: boolean;
    reasonCode: string;
  },
) {
  return api("/v1/admin/zones", { token, body });
}

export async function patchZone(
  token: string,
  id: string,
  body: {
    code: string;
    name: string;
    city: string;
    active: boolean;
    reasonCode: string;
  },
) {
  return api(`/v1/admin/zones/${id}`, { token, method: "PATCH", body });
}

export async function fetchServiceTypes(token: string) {
  return api<{
    serviceTypes: Array<{
      id: string;
      code: string;
      name: string;
      baseFeeCents: number;
      perKmFeeCents: number;
      priorityMultiplier: number;
      active: boolean;
    }>;
  }>("/v1/admin/service-types", { token });
}

export async function patchServiceType(
  token: string,
  id: string,
  body: Record<string, unknown>,
) {
  return api(`/v1/admin/service-types/${id}`, {
    token,
    method: "PATCH",
    body,
  });
}

export async function fetchReasonCodes(token: string) {
  return api<{
    reasonCodes: Array<{
      id: string;
      code: string;
      domain: string;
      label: string;
      active: boolean;
      severity: string;
    }>;
  }>("/v1/admin/reason-codes", { token });
}

export async function patchReasonCode(
  token: string,
  id: string,
  body: Record<string, unknown>,
) {
  return api(`/v1/admin/reason-codes/${id}`, {
    token,
    method: "PATCH",
    body,
  });
}

export async function fetchStaff(token: string) {
  return api<{
    staff: Array<{
      id: string;
      email: string | null;
      displayName: string | null;
      totpEnabled: boolean;
      status: string;
      roles: string[];
    }>;
  }>("/v1/admin/staff", { token });
}

export async function grantRole(
  token: string,
  userId: string,
  role: string,
  reasonCode: string,
) {
  return api(`/v1/admin/staff/${userId}/roles`, {
    token,
    body: { role, reasonCode },
  });
}

export async function revokeRole(
  token: string,
  userId: string,
  role: string,
  reasonCode: string,
) {
  return api(
    `/v1/admin/staff/${userId}/roles/${encodeURIComponent(role)}?reasonCode=${encodeURIComponent(reasonCode)}`,
    { token, method: "DELETE" },
  );
}

export async function fetchAudit(token: string, q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return api<{
    events: Array<{
      id: string;
      action: string;
      subjectType: string;
      subjectId: string | null;
      actorId: string | null;
      reasonCode: string | null;
      occurredAt: string;
    }>;
  }>(`/v1/admin/audit${qs}`, { token });
}

export async function fetchBreakGlass(token: string) {
  return api<{
    sessions: Array<{
      id: string;
      reason: string;
      expiresAt: string;
      createdAt: string;
    }>;
  }>("/v1/admin/break-glass", { token });
}

export async function openBreakGlass(token: string, reason: string) {
  return api("/v1/admin/break-glass", {
    token,
    body: { reason, minutes: 30 },
  });
}

export async function closeBreakGlass(token: string, id: string) {
  return api(`/v1/admin/break-glass/${id}/close`, {
    token,
    method: "POST",
    body: {},
  });
}

export async function fetchPricing(token: string) {
  return api<{
    params: Array<{
      key: string;
      valueJson: Record<string, unknown>;
      description: string | null;
    }>;
  }>("/v1/admin/pricing-params", { token });
}

export async function patchPricingParam(
  token: string,
  key: string,
  valueJson: Record<string, unknown>,
  reasonCode: string,
) {
  return api<{
    param: {
      key: string;
      valueJson: Record<string, unknown>;
      description: string | null;
    };
  }>(`/v1/admin/pricing-params/${encodeURIComponent(key)}`, {
    token,
    method: "PATCH",
    body: { valueJson, reasonCode },
  });
}

export async function fetchProhibited(token: string) {
  return api<{
    items: Array<{
      id: string;
      label: string;
      active: boolean;
      sortOrder: number;
    }>;
  }>("/v1/admin/prohibited-goods", { token });
}

export async function patchProhibited(
  token: string,
  id: string,
  body: Record<string, unknown>,
) {
  return api(`/v1/admin/prohibited-goods/${id}`, {
    token,
    method: "PATCH",
    body,
  });
}

export type FinanceEarning = {
  id: string;
  jobId: string;
  jobPublicCode: string;
  driverUserId: string | null;
  driverEmail?: string | null;
  driverDisplayName?: string | null;
  amountCents: number;
  currency: string;
  status: string;
  frozen: boolean;
  freezeReason: string | null;
  payoutItemId: string | null;
  createdAt: string;
};

export async function fetchFinanceEarnings(
  token: string,
  filters?: { driverUserId?: string; frozen?: string; status?: string },
) {
  const params = new URLSearchParams();
  if (filters?.driverUserId) params.set("driverUserId", filters.driverUserId);
  if (filters?.frozen) params.set("frozen", filters.frozen);
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString() ? `?${params}` : "";
  return api<{ earnings: FinanceEarning[] }>(`/v1/finance/earnings${qs}`, {
    token,
  });
}

export async function freezeJobEarnings(
  token: string,
  jobId: string,
  reason: string,
) {
  return api(`/v1/finance/earnings/${jobId}/freeze`, {
    token,
    body: { reason },
  });
}

export async function assignDriverToEarning(
  token: string,
  jobId: string,
  driverUserId: string,
) {
  return api(`/v1/finance/earnings/${jobId}/assign-driver`, {
    token,
    body: { driverUserId },
  });
}

export type PayoutBatch = {
  id: string;
  status: string;
  currency: string;
  totalCents: number;
  createdByUserId: string | null;
  executedAt: string | null;
  createdAt: string;
};

export type PayoutItem = {
  id: string;
  batchId: string;
  driverUserId: string;
  driverEmail?: string | null;
  driverDisplayName?: string | null;
  amountCents: number;
  currency: string;
  status: string;
  providerTransferId: string | null;
  failureCode: string | null;
  createdAt: string;
};

export async function fetchPayoutBatches(token: string) {
  return api<{ batches: PayoutBatch[] }>("/v1/finance/payout-batches", {
    token,
  });
}

export async function fetchPayoutBatch(token: string, batchId: string) {
  return api<{
    batch: PayoutBatch;
    items: PayoutItem[];
    earnings: FinanceEarning[];
  }>(`/v1/finance/payout-batches/${batchId}`, { token });
}

export async function createPayoutBatch(token: string, driverUserId: string) {
  return api<{
    batch: PayoutBatch;
    item: PayoutItem;
    lineCount: number;
  }>("/v1/finance/payout-batches", {
    token,
    body: { driverUserId },
  });
}

export async function executePayoutBatch(token: string, batchId: string) {
  return api<{ batch: PayoutBatch }>(
    `/v1/finance/payout-batches/${batchId}/execute`,
    { token, method: "POST", body: {} },
  );
}

export async function fetchJobMoney(token: string, jobIdOrCode: string) {
  return api<{
    job: {
      id: string;
      publicCode: string;
      state: string;
      paymentStatus: string;
    };
    payments: Array<{
      id: string;
      amountCents: number;
      currency: string;
      status: string;
      provider: string;
      providerPaymentId: string | null;
      failureCode: string | null;
      createdAt: string;
    }>;
    earnings: Array<{
      id: string;
      driverUserId: string | null;
      amountCents: number;
      currency: string;
      status: string;
      frozen: boolean;
      freezeReason: string | null;
      createdAt: string;
    }>;
  }>(`/v1/finance/jobs/${encodeURIComponent(jobIdOrCode)}/money`, { token });
}
