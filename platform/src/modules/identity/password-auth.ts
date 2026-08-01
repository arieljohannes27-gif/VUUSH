import { eq, inArray } from "drizzle-orm";
import { env } from "../../config.js";
import { db } from "../../db/client.js";
import {
  driverProfiles,
  mfaTickets,
  sessions,
  users,
} from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import { statusToAuthError } from "../../shared/auth/messages.js";
import { assertPasswordPolicy } from "../../shared/auth/password-policy.js";
import {
  generateTotpSecret,
  hashPassword,
  hashSecret,
  newOpaqueToken,
  verifyPassword,
} from "./crypto.js";
import { emailLookupCandidates } from "./email-aliases.js";
import { requiresStaffMfa } from "./roles.js";
import {
  consumeOtpChallenge,
  createSessionForUser,
  getUserRoles,
  requestOtp,
} from "./service.js";

function normalizePhone(phone: string) {
  return phone.trim().replace(/\s+/g, "");
}

function publicUser(
  user: typeof users.$inferSelect,
  roles: string[],
) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    totpEnabled: user.totpEnabled,
    roles,
  };
}

async function createMfaTicket(userId: string, purpose: string) {
  const token = newOpaqueToken(24);
  const [ticket] = await db
    .insert(mfaTickets)
    .values({
      userId,
      purpose,
      tokenHash: hashSecret(token),
      expiresAt: new Date(Date.now() + env.MFA_TICKET_TTL_SECONDS * 1000),
    })
    .returning();
  return { ticketId: ticket.id, mfaToken: token, expiresAt: ticket.expiresAt };
}

export async function findUserByEmailOrPhone(identifier: string) {
  const raw = identifier.trim();
  if (!raw) return null;
  if (raw.includes("@")) {
    const email = raw.toLowerCase();
    return (
      (await db.query.users.findFirst({
        where: inArray(users.email, emailLookupCandidates(email)),
      })) ?? null
    );
  }
  const phone = normalizePhone(raw);
  return (
    (await db.query.users.findFirst({
      where: eq(users.phone, phone),
    })) ?? null
  );
}

/**
 * Unified password login for Driver, Customer, Enterprise, and Staff.
 * Staff always get MFA challenge — never a satisfied session without TOTP.
 */
export async function loginWithPassword(input: {
  identifier: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  /** When set, only these roles may complete login (portal gates). */
  requireAnyRole?: string[];
}) {
  const user = await findUserByEmailOrPhone(input.identifier);
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

  const statusError = statusToAuthError(user.status);
  if (statusError) {
    return { ok: false as const, error: statusError };
  }

  const roles = await getUserRoles(user.id);
  if (
    input.requireAnyRole &&
    input.requireAnyRole.length > 0 &&
    !roles.some((r) => input.requireAnyRole!.includes(r))
  ) {
    return { ok: false as const, error: "forbidden" };
  }

  const staff = requiresStaffMfa(roles);

  if (staff && user.totpEnabled && user.totpSecret) {
    const ticket = await createMfaTicket(user.id, "totp_login");
    await writeAuditEvent({
      actorType: "user",
      actorId: user.id,
      action: "AUTH_MFA_REQUIRED",
      subjectType: "user",
      subjectId: user.id,
      correlationId: input.correlationId,
      payload: { via: "password" },
    });
    return {
      ok: true as const,
      status: "mfa_required" as const,
      mfa: ticket,
      user: publicUser(user, roles),
    };
  }

  if (staff && !user.totpEnabled) {
    const enrollSecret = generateTotpSecret();
    await db
      .update(users)
      .set({ totpSecret: enrollSecret, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    const ticket = await createMfaTicket(user.id, "totp_enroll");
    return {
      ok: true as const,
      status: "mfa_enroll_required" as const,
      mfa: ticket,
      totpSecret: enrollSecret,
      totpOtpauth: `otpauth://totp/VUUSH:${encodeURIComponent(user.email ?? user.phone ?? user.id)}?secret=${enrollSecret}&issuer=VUUSH`,
      user: publicUser(user, roles),
    };
  }

  const session = await createSessionForUser({
    userId: user.id,
    mfaSatisfied: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    correlationId: input.correlationId,
  });

  const profile = roles.includes("driver")
    ? await db.query.driverProfiles.findFirst({
        where: eq(driverProfiles.userId, user.id),
      })
    : undefined;

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
    user: publicUser(user, roles),
    profile,
  };
}

/** @deprecated Use loginWithPassword — kept for call-site compatibility. */
export async function loginDriverPassword(input: {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}) {
  return loginWithPassword({
    identifier: input.email,
    password: input.password,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    correlationId: input.correlationId,
  });
}

export async function setUserPassword(input: {
  userId: string;
  password: string;
  correlationId?: string;
  enforcePolicy?: boolean;
}) {
  if (input.enforcePolicy !== false) {
    assertPasswordPolicy(input.password);
  }
  await db
    .update(users)
    .set({
      passwordHash: hashPassword(input.password),
      updatedAt: new Date(),
    })
    .where(eq(users.id, input.userId));
  await writeAuditEvent({
    actorType: "user",
    actorId: input.userId,
    action: "AUTH_PASSWORD_SET",
    subjectType: "user",
    subjectId: input.userId,
    correlationId: input.correlationId,
  });
}

export async function revokeAllSessionsForUser(input: {
  userId: string;
  correlationId?: string;
}) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.userId, input.userId));
  await writeAuditEvent({
    actorType: "user",
    actorId: input.userId,
    action: "AUTH_LOGOUT_ALL",
    subjectType: "user",
    subjectId: input.userId,
    correlationId: input.correlationId,
  });
}

/**
 * Start password reset: always return generic success to avoid account enumeration.
 */
export async function startPasswordReset(input: {
  identifier: string;
  correlationId?: string;
}) {
  const user = await findUserByEmailOrPhone(input.identifier);
  const generic = {
    ok: true as const,
    status: "password_reset_sent" as const,
    message: "If that account exists, we sent a verification code.",
  };
  if (!user) return generic;

  const channel = user.email ? ("email" as const) : ("phone" as const);
  const destination = user.email ?? user.phone;
  if (!destination) return generic;

  try {
    const otp = await requestOtp({
      channel,
      destination,
      correlationId: input.correlationId,
    });
    await writeAuditEvent({
      actorType: "system",
      action: "AUTH_PASSWORD_RESET_STARTED",
      subjectType: "user",
      subjectId: user.id,
      correlationId: input.correlationId,
      payload: { channel },
    });
    return {
      ...generic,
      challengeId: otp.challengeId,
      expiresAt: otp.expiresAt,
      ...(otp.devCode ? { devCode: otp.devCode } : {}),
    };
  } catch {
    return generic;
  }
}

export async function completePasswordReset(input: {
  challengeId: string;
  code: string;
  newPassword: string;
  correlationId?: string;
}) {
  assertPasswordPolicy(input.newPassword);
  const consumed = await consumeOtpChallenge({
    challengeId: input.challengeId,
    code: input.code,
    correlationId: input.correlationId,
  });
  if (!consumed.ok) return consumed;

  const user =
    consumed.channel === "email"
      ? await db.query.users.findFirst({
          where: inArray(
            users.email,
            emailLookupCandidates(consumed.destination),
          ),
        })
      : await db.query.users.findFirst({
          where: eq(users.phone, normalizePhone(consumed.destination)),
        });

  if (!user) {
    return { ok: false as const, error: "not_found" };
  }

  await setUserPassword({
    userId: user.id,
    password: input.newPassword,
    correlationId: input.correlationId,
  });
  await revokeAllSessionsForUser({
    userId: user.id,
    correlationId: input.correlationId,
  });

  return {
    ok: true as const,
    status: "password_reset" as const,
    userId: user.id,
  };
}
