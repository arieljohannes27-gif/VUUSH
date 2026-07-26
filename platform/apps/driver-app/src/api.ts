export type SessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  roles: string[];
};

export type DriverProfile = {
  id: string;
  userId: string;
  eligibilityStatus: string;
  applicationStatus?: string;
  vehicleClass: string;
  homeZoneCode: string | null;
  onDuty: boolean;
  onDutyAt: string | null;
  publicName?: string | null;
  photoUrl?: string | null;
  phonePublic?: string | null;
  vehiclePlate?: string | null;
  vehicleLabel?: string | null;
  vehiclePhotoUrl?: string | null;
  idDocUrl?: string | null;
  licenceDocUrl?: string | null;
  selfiePhotoUrl?: string | null;
  vehicleInsuranceDocUrl?: string | null;
  goodsInsuranceDocUrl?: string | null;
  policeClearanceDocUrl?: string | null;
  bio?: string | null;
  licenceStatus?: string;
  vehicleDocStatus?: string;
  insuranceStatus?: string;
  licenceRef?: string | null;
  insuranceRef?: string | null;
  permitRef?: string | null;
  applicationNote?: string | null;
  reviewReason?: string | null;
};

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

export type Job = {
  id: string;
  publicCode: string;
  state: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupZoneCode: string;
  dropoffZoneCode: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  packageClass: string;
  recipientName: string | null;
  recipientPhone: string | null;
};

export type Assignment = {
  id: string;
  jobId: string;
  driverUserId: string;
  status: string;
};

export type EarningLine = {
  id: string;
  jobId: string;
  amountCents: number;
  currency: string;
  status: string;
  frozen: boolean;
  createdAt: string;
  publicCode?: string;
  jobState?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  pickupZoneCode?: string;
  dropoffZoneCode?: string;
  packageClass?: string;
  recipientName?: string | null;
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
  }>("/v1/auth/otp/verify", {
    body: { challengeId, code },
  });
}

export async function signupDriver(body: {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  licenceRef?: string;
  insuranceRef?: string;
  permitRef?: string;
  vehiclePlate?: string;
  vehicleLabel?: string;
  vehicleClass?: string;
  vehiclePhotoUrl: string;
  idDocUrl: string;
  licenceDocUrl: string;
  selfiePhotoUrl: string;
  vehicleInsuranceDocUrl: string;
  goodsInsuranceDocUrl: string;
  policeClearanceDocUrl: string;
  applicationNote?: string;
}) {
  return api<{
    challengeId: string;
    devCode?: string;
    userId: string;
  }>("/v1/auth/drivers/signup", { body });
}

export async function verifyDriverSignup(challengeId: string, code: string) {
  return api<{
    status: string;
    session?: { accessToken: string };
    user?: SessionUser;
    profile?: DriverProfile | null;
  }>("/v1/auth/drivers/signup/verify", {
    body: { challengeId, code },
  });
}

export async function loginPassword(email: string, password: string) {
  return api<{
    status: string;
    session: { accessToken: string };
    user: SessionUser;
    profile?: DriverProfile | null;
  }>("/v1/auth/password/login", {
    body: { email, password },
  });
}

export async function fetchMe(token: string) {
  return api<{ user: SessionUser }>("/v1/me", { token });
}

export async function ensureDriver(userId: string) {
  return api<{ profile: DriverProfile }>("/v1/dev/ensure-driver", {
    body: { userId, vehicleClass: "car", homeZoneCode: "CPT-CBD" },
  });
}

export type NavTarget = {
  lat: number | null;
  lng: number | null;
  address: string;
  leg: "pickup" | "dropoff";
};

export async function fetchDriverHome(token: string) {
  return api<{
    profile: DriverProfile | null;
    assignment: Assignment | null;
    job: Job | null;
    navTarget: NavTarget | null;
  }>("/v1/drivers/me", { token });
}

export async function fetchBeachheadConfig() {
  return api<{ mapsExperienceEnabled: boolean }>("/v1/config/beachhead");
}

export async function setDuty(token: string, onDuty: boolean) {
  return api<{ profile: DriverProfile }>("/v1/drivers/me/duty", {
    token,
    body: { onDuty },
  });
}

export async function acceptAssignment(token: string, assignmentId: string) {
  return api<{ assignment: Assignment }>(
    `/v1/dispatch/assignments/${assignmentId}/accept`,
    { token, method: "POST", body: {} },
  );
}

export async function rejectAssignment(
  token: string,
  assignmentId: string,
  reasonCode = "driver_declined",
) {
  return api<{ assignment: Assignment }>(
    `/v1/dispatch/assignments/${assignmentId}/reject`,
    { token, body: { reasonCode } },
  );
}

export async function execStep(token: string, jobId: string, step: string, body?: unknown) {
  return api<{ job: Job }>(`/v1/jobs/${jobId}/execution/${step}`, {
    token,
    body: body ?? {},
  });
}

export async function addProof(
  token: string,
  jobId: string,
  kind: string,
  textContent: string,
  coords?: { lat: number; lng: number },
) {
  return api(`/v1/jobs/${jobId}/proofs`, {
    token,
    body: {
      kind,
      textContent,
      contentType: "text/plain",
      ...(coords ?? {}),
    },
  });
}

export async function startTracking(token: string, jobId: string) {
  return api<{ session: { id: string } }>("/v1/tracking/sessions/start", {
    token,
    body: { jobId },
  });
}

export async function pingSignal(
  token: string,
  sessionId: string,
  lat: number,
  lng: number,
) {
  return api(`/v1/tracking/sessions/${sessionId}/signals`, {
    token,
    body: { lat, lng, accuracyM: 12 },
  });
}

export async function fetchEarnings(token: string) {
  return api<{ earnings: EarningLine[] }>("/v1/drivers/me/earnings", { token });
}

export async function fetchDriverJobHistory(token: string, jobId: string) {
  return api<{
    job: Job & { state: string; publicCode: string };
    assignment: Assignment & { status: string; mode?: string; acceptedAt?: string | null };
    earning: EarningLine | null;
  }>(`/v1/drivers/me/jobs/${jobId}`, { token });
}

export async function fetchJobProofs(token: string, jobId: string) {
  return api<{
    proofs: Array<{
      id: string;
      kind: string;
      note: string | null;
      createdAt: string;
    }>;
  }>(`/v1/jobs/${jobId}/proofs`, { token });
}

export async function fetchDriverProfile(token: string) {
  return api<{
    profile: DriverProfile;
    user: {
      id: string;
      email: string | null;
      phone: string | null;
      displayName: string | null;
    };
    professional: DriverProfessional;
  }>("/v1/drivers/me/profile", { token });
}

export async function updateDriverProfile(
  token: string,
  body: Partial<{
    publicName: string | null;
    photoUrl: string | null;
    phonePublic: string | null;
    vehiclePlate: string | null;
    vehicleLabel: string | null;
    bio: string | null;
    vehicleClass: string;
    homeZoneCode: string | null;
    licenceStatus: string;
    vehicleDocStatus: string;
    insuranceStatus: string;
    displayName: string | null;
    phone: string | null;
  }>,
) {
  return api<{
    profile: DriverProfile;
    user: {
      id: string;
      email: string | null;
      phone: string | null;
      displayName: string | null;
    };
    professional: DriverProfessional;
  }>("/v1/drivers/me/profile", { token, method: "PATCH", body });
}

export async function declareEmergency(
  token: string,
  category: "medical" | "threat" | "accident" | "assault",
  note?: string,
  coords?: { lat: number; lng: number },
) {
  return api<{
    incident: {
      id: string;
      publicCode: string;
      category: string;
      status: string;
      playbook: string;
    };
    hold: { id: string } | null;
    jobId: string | null;
  }>("/v1/drivers/me/emergency", {
    token,
    body: { category, note, ...(coords ?? {}) },
  });
}

export async function fetchActiveIncident(token: string) {
  return api<{
    incident: {
      id: string;
      publicCode: string;
      category: string;
      status: string;
      playbook: string;
      note: string | null;
    } | null;
  }>("/v1/drivers/me/incidents/active", { token });
}

export function readGps(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("gps_unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("gps_denied")),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  });
}
