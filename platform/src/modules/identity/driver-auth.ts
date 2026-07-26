import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { driverProfiles, roleBindings, users } from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import { upsertDriverProfile } from "../dispatch/service.js";
import { hashPassword, verifyPassword } from "./crypto.js";
import {
  createSessionForUser,
  getUserRoles,
  requestOtp,
  verifyOtp,
} from "./service.js";

function emailLookupCandidates(email: string): string[] {
  const e = email.trim().toLowerCase();
  const out = [e];
  if (e.endsWith("@vuush.local")) {
    out.push(e.replace(/@vuush\.local$/, "@swift.local"));
  } else if (e.endsWith("@swift.local")) {
    out.push(e.replace(/@swift\.local$/, "@vuush.local"));
  }
  return [...new Set(out)];
}

export async function signupDriver(input: {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  licenceRef: string;
  insuranceRef: string;
  permitRef?: string;
  vehiclePlate?: string;
  vehicleLabel?: string;
  vehicleClass?: string;
  vehiclePhotoUrl?: string;
  applicationNote?: string;
  correlationId?: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (input.password.length < 8) {
    return { ok: false as const, error: "password_too_short" };
  }
  if (!input.licenceRef.trim() || !input.insuranceRef.trim()) {
    return { ok: false as const, error: "docs_required" };
  }
  if (!input.vehiclePhotoUrl?.startsWith("data:image/")) {
    return { ok: false as const, error: "vehicle_photo_required" };
  }
  if (input.vehiclePhotoUrl.length > 900_000) {
    return { ok: false as const, error: "vehicle_photo_too_large" };
  }

  const existing = await db.query.users.findFirst({
    where: inArray(users.email, emailLookupCandidates(email)),
  });
  if (existing?.passwordHash) {
    return { ok: false as const, error: "email_taken" };
  }

  let user = existing;
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email,
        phone: input.phone?.trim() || null,
        displayName: input.displayName.trim() || email,
        passwordHash: hashPassword(input.password),
      })
      .returning();
    await db.insert(roleBindings).values({
      userId: user.id,
      role: "driver",
      scopeType: "self",
      scopeId: user.id,
    });
  } else {
    const prior = user;
    await db
      .update(users)
      .set({
        passwordHash: hashPassword(input.password),
        displayName: input.displayName.trim() || prior.displayName,
        phone: input.phone?.trim() || prior.phone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, prior.id));
    user = (await db.query.users.findFirst({
      where: eq(users.id, prior.id),
    }))!;
  }

  await upsertDriverProfile({
    userId: user.id,
    vehicleClass: input.vehicleClass ?? "car",
    eligibilityStatus: "pending",
    applicationStatus: "pending_review",
    licenceRef: input.licenceRef.trim(),
    insuranceRef: input.insuranceRef.trim(),
    permitRef: input.permitRef?.trim() || null,
    applicationNote: input.applicationNote?.trim() || null,
    vehiclePlate: input.vehiclePlate?.trim() || null,
    vehicleLabel: input.vehicleLabel?.trim() || null,
    vehiclePhotoUrl: input.vehiclePhotoUrl,
    publicName: input.displayName.trim() || null,
    correlationId: input.correlationId,
  });

  await db
    .update(driverProfiles)
    .set({
      licenceStatus: "uploaded",
      insuranceStatus: "uploaded",
      vehicleDocStatus: input.permitRef?.trim() ? "uploaded" : "pending",
      updatedAt: new Date(),
    })
    .where(eq(driverProfiles.userId, user.id));

  const otp = await requestOtp({
    channel: "email",
    destination: email,
    correlationId: input.correlationId,
  });

  await writeAuditEvent({
    actorType: "user",
    actorId: user.id,
    action: "DRIVER_SIGNUP_STARTED",
    subjectType: "user",
    subjectId: user.id,
    correlationId: input.correlationId,
    payload: { email },
  });

  return {
    ok: true as const,
    userId: user.id,
    challengeId: otp.challengeId,
    expiresAt: otp.expiresAt,
    ...(otp.devCode ? { devCode: otp.devCode } : {}),
  };
}

export async function verifyDriverSignup(input: {
  challengeId: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}) {
  const result = await verifyOtp({
    challengeId: input.challengeId,
    code: input.code,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    correlationId: input.correlationId,
  });
  if (!result.ok) return result;
  if (result.status !== "authenticated" || !result.session || !result.user) {
    return { ok: false as const, error: "login_incomplete" };
  }

  const profile = await db.query.driverProfiles.findFirst({
    where: eq(driverProfiles.userId, result.user.id),
  });

  return {
    ok: true as const,
    status: "authenticated" as const,
    session: result.session,
    user: result.user,
    profile,
  };
}

export async function loginDriverPassword(input: {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const user = await db.query.users.findFirst({
    where: inArray(users.email, emailLookupCandidates(email)),
  });
  if (!user?.passwordHash) {
    return { ok: false as const, error: "invalid_credentials" };
  }
  if (!verifyPassword(input.password, user.passwordHash)) {
    await writeAuditEvent({
      actorType: "system",
      action: "AUTH_PASSWORD_FAILED",
      subjectType: "user",
      subjectId: user.id,
      correlationId: input.correlationId,
    });
    return { ok: false as const, error: "invalid_credentials" };
  }
  if (user.status !== "active") {
    return { ok: false as const, error: "user_inactive" };
  }

  const roles = await getUserRoles(user.id);
  const session = await createSessionForUser({
    userId: user.id,
    mfaSatisfied: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    correlationId: input.correlationId,
  });

  const profile = await db.query.driverProfiles.findFirst({
    where: eq(driverProfiles.userId, user.id),
  });

  await writeAuditEvent({
    actorType: "user",
    actorId: user.id,
    action: "AUTH_PASSWORD_OK",
    subjectType: "user",
    subjectId: user.id,
    correlationId: input.correlationId,
  });

  return {
    ok: true as const,
    status: "authenticated" as const,
    session,
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      totpEnabled: user.totpEnabled,
      roles,
    },
    profile,
  };
}
