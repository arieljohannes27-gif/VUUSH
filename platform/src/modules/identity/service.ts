import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { env, isDev } from "../../config.js";
import { db } from "../../db/client.js";
import {
  mfaTickets,
  otpChallenges,
  roleBindings,
  sessions,
  users,
} from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import {
  generateOtpCode,
  generateTotpSecret,
  hashSecret,
  newOpaqueToken,
  verifyTotp,
} from "./crypto.js";
import { isRole, requiresStaffMfa, type Role } from "./roles.js";
import { deliverOtp } from "./otp-delivery.js";
import { emailLookupCandidates } from "./email-aliases.js";

function normalizeDestination(channel: "phone" | "email", destination: string) {
  const trimmed = destination.trim();
  if (channel === "email") return trimmed.toLowerCase();
  return trimmed.replace(/\s+/g, "");
}

export async function requestOtp(input: {
  channel: "phone" | "email";
  destination: string;
  correlationId?: string;
}) {
  const destination = normalizeDestination(input.channel, input.destination);
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  const [challenge] = await db
    .insert(otpChallenges)
    .values({
      channel: input.channel,
      destination,
      codeHash: hashSecret(code),
      expiresAt,
    })
    .returning();

  await writeAuditEvent({
    actorType: "system",
    action: "AUTH_OTP_REQUESTED",
    subjectType: "otp_challenge",
    subjectId: challenge.id,
    correlationId: input.correlationId,
    payload: { channel: input.channel },
  });

  // Create user + founding role early so verify does not race access checks.
  if (input.channel === "email") {
    const user = await findOrCreateUser("email", destination);
    await ensureFoundingDispatcherAccess(user);
  }

  try {
    await deliverOtp({
      channel: input.channel,
      destination,
      code,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "otp_delivery_failed";
    throw new Error(message);
  }

  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    ...(isDev() ? { devCode: code } : {}),
  };
}

async function findOrCreateUser(channel: "phone" | "email", destination: string) {
  if (channel === "phone") {
    const existing = await db.query.users.findFirst({
      where: eq(users.phone, destination),
    });
    if (existing) return existing;
    const [created] = await db
      .insert(users)
      .values({ phone: destination, displayName: destination })
      .returning();
    await db.insert(roleBindings).values({
      userId: created.id,
      role: "customer",
      scopeType: "self",
      scopeId: created.id,
    });
    return created;
  }

  const candidates = emailLookupCandidates(destination);
  const existing = await db.query.users.findFirst({
    where: inArray(users.email, candidates),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({ email: destination, displayName: destination })
    .returning();
  await db.insert(roleBindings).values({
    userId: created.id,
    role: "customer",
    scopeType: "self",
    scopeId: created.id,
  });
  return created;
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(roleBindings)
    .where(eq(roleBindings.userId, userId));
  return rows.map((r) => r.role);
}

/** One-time founder bootstrap via FOUNDING_DISPATCHER_EMAIL. */
export async function ensureFoundingDispatcherAccess(user: {
  id: string;
  email: string | null;
}) {
  const founding = env.FOUNDING_DISPATCHER_EMAIL.trim().toLowerCase();
  if (!founding || !user.email) return false;
  if (user.email.trim().toLowerCase() !== founding) return false;

  const roles = await getUserRoles(user.id);
  if (
    roles.includes("dispatcher") ||
    roles.includes("administrator") ||
    roles.includes("operations_manager")
  ) {
    return true;
  }

  // Direct insert — avoid unique/scope edge cases from older assign paths.
  await db
    .insert(roleBindings)
    .values({
      userId: user.id,
      role: "dispatcher",
      scopeType: "platform",
      scopeId: user.id,
    })
    .onConflictDoNothing();

  await db
    .insert(roleBindings)
    .values({
      userId: user.id,
      role: "administrator",
      scopeType: "platform",
      scopeId: user.id,
    })
    .onConflictDoNothing();

  await writeAuditEvent({
    actorType: "system",
    action: "FOUNDING_DISPATCHER_BOOTSTRAP",
    subjectType: "user",
    subjectId: user.id,
    payload: { email: user.email },
  });

  const next = await getUserRoles(user.id);
  return (
    next.includes("dispatcher") ||
    next.includes("administrator") ||
    next.includes("operations_manager")
  );
}

export async function createSessionForUser(input: {
  userId: string;
  mfaSatisfied: boolean;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}) {
  const accessToken = newOpaqueToken();
  const refreshToken = newOpaqueToken();
  const now = Date.now();
  const [session] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      accessTokenHash: hashSecret(accessToken),
      refreshTokenHash: hashSecret(refreshToken),
      mfaSatisfied: input.mfaSatisfied,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      expiresAt: new Date(now + env.ACCESS_TTL_SECONDS * 1000),
      refreshExpiresAt: new Date(now + env.REFRESH_TTL_SECONDS * 1000),
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.userId,
    action: "AUTH_SESSION_CREATED",
    subjectType: "session",
    subjectId: session.id,
    correlationId: input.correlationId,
    payload: { mfaSatisfied: input.mfaSatisfied },
  });

  return {
    sessionId: session.id,
    accessToken,
    refreshToken,
    accessExpiresAt: session.expiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
    mfaSatisfied: session.mfaSatisfied,
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

export async function verifyOtp(input: {
  challengeId: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  /** Driver signup/login OTP must not force staff TOTP mid-flow. */
  skipStaffMfa?: boolean;
}) {
  const consumed = await consumeOtpChallenge({
    challengeId: input.challengeId,
    code: input.code,
    correlationId: input.correlationId,
  });
  if (!consumed.ok) return consumed;

  const channel = consumed.channel;
  const user = await findOrCreateUser(channel, consumed.destination);
  if (user.status !== "active") {
    return { ok: false as const, error: "user_inactive" };
  }

  await ensureFoundingDispatcherAccess(user);

  const roles = await getUserRoles(user.id);
  const staff = !input.skipStaffMfa && requiresStaffMfa(roles);

  if (staff && user.totpEnabled && user.totpSecret) {
    const ticket = await createMfaTicket(user.id, "totp_login");
    await writeAuditEvent({
      actorType: "user",
      actorId: user.id,
      action: "AUTH_MFA_REQUIRED",
      subjectType: "user",
      subjectId: user.id,
      correlationId: input.correlationId,
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
    mfaSatisfied: !staff,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    correlationId: input.correlationId,
  });

  return {
    ok: true as const,
    status: "authenticated" as const,
    session,
    user: publicUser(user, roles),
  };
}

/** Validate + consume an OTP challenge without creating a session. */
export async function consumeOtpChallenge(input: {
  challengeId: string;
  code: string;
  correlationId?: string;
}) {
  const challenge = await db.query.otpChallenges.findFirst({
    where: eq(otpChallenges.id, input.challengeId),
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) {
    return { ok: false as const, error: "challenge_invalid_or_expired" };
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    return { ok: false as const, error: "challenge_locked" };
  }

  const valid = hashSecret(input.code.trim()) === challenge.codeHash;
  await db
    .update(otpChallenges)
    .set({ attempts: challenge.attempts + 1 })
    .where(eq(otpChallenges.id, challenge.id));

  if (!valid) {
    await writeAuditEvent({
      actorType: "system",
      action: "AUTH_OTP_FAILED",
      subjectType: "otp_challenge",
      subjectId: challenge.id,
      correlationId: input.correlationId,
    });
    return { ok: false as const, error: "invalid_code" };
  }

  await db
    .update(otpChallenges)
    .set({ consumedAt: new Date() })
    .where(eq(otpChallenges.id, challenge.id));

  return {
    ok: true as const,
    channel: challenge.channel as "phone" | "email",
    destination: challenge.destination,
  };
}

export async function verifyMfa(input: {
  mfaToken: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}) {
  const tokenHash = hashSecret(input.mfaToken);
  const ticket = await db.query.mfaTickets.findFirst({
    where: and(
      eq(mfaTickets.tokenHash, tokenHash),
      isNull(mfaTickets.consumedAt),
      gt(mfaTickets.expiresAt, new Date()),
    ),
  });
  if (!ticket) return { ok: false as const, error: "mfa_ticket_invalid" };

  const user = await db.query.users.findFirst({
    where: eq(users.id, ticket.userId),
  });
  if (!user?.totpSecret) return { ok: false as const, error: "mfa_not_configured" };

  const codeOk = verifyTotp(user.totpSecret, input.code.trim());
  if (!codeOk) {
    await writeAuditEvent({
      actorType: "user",
      actorId: user.id,
      action: "AUTH_MFA_FAILED",
      subjectType: "user",
      subjectId: user.id,
      correlationId: input.correlationId,
    });
    return { ok: false as const, error: "invalid_mfa_code" };
  }

  await db
    .update(mfaTickets)
    .set({ consumedAt: new Date() })
    .where(eq(mfaTickets.id, ticket.id));

  if (ticket.purpose === "totp_enroll") {
    await db
      .update(users)
      .set({ totpEnabled: true, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  await ensureFoundingDispatcherAccess(user);

  const roles = await getUserRoles(user.id);
  const session = await createSessionForUser({
    userId: user.id,
    mfaSatisfied: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    correlationId: input.correlationId,
  });

  await writeAuditEvent({
    actorType: "user",
    actorId: user.id,
    action: "AUTH_MFA_OK",
    subjectType: "session",
    subjectId: session.sessionId,
    correlationId: input.correlationId,
  });

  return {
    ok: true as const,
    session,
    user: publicUser(user, roles),
  };
}

export async function refreshSession(input: {
  refreshToken: string;
  correlationId?: string;
}) {
  const hash = hashSecret(input.refreshToken);
  const existing = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.refreshTokenHash, hash),
      isNull(sessions.revokedAt),
      gt(sessions.refreshExpiresAt, new Date()),
    ),
  });
  if (!existing) return { ok: false as const, error: "refresh_invalid" };

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, existing.id));

  const session = await createSessionForUser({
    userId: existing.userId,
    mfaSatisfied: existing.mfaSatisfied,
    ipAddress: existing.ipAddress ?? undefined,
    userAgent: existing.userAgent ?? undefined,
    correlationId: input.correlationId,
  });

  const user = await db.query.users.findFirst({
    where: eq(users.id, existing.userId),
  });
  const roles = await getUserRoles(existing.userId);

  return {
    ok: true as const,
    session,
    user: user ? publicUser(user, roles) : null,
  };
}

export async function revokeSession(input: {
  accessToken?: string;
  refreshToken?: string;
  correlationId?: string;
}) {
  let session =
    input.accessToken &&
    (await db.query.sessions.findFirst({
      where: eq(sessions.accessTokenHash, hashSecret(input.accessToken)),
    }));

  if (!session && input.refreshToken) {
    session = await db.query.sessions.findFirst({
      where: eq(sessions.refreshTokenHash, hashSecret(input.refreshToken)),
    });
  }

  if (!session || session.revokedAt) {
    return { ok: true as const };
  }

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, session.id));

  await writeAuditEvent({
    actorType: "user",
    actorId: session.userId,
    action: "AUTH_SESSION_REVOKED",
    subjectType: "session",
    subjectId: session.id,
    correlationId: input.correlationId,
  });

  return { ok: true as const };
}

export async function resolveAccessToken(accessToken: string) {
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.accessTokenHash, hashSecret(accessToken)),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, new Date()),
    ),
  });
  if (!session) return null;
  if (requiresStaffMfa(await getUserRoles(session.userId)) && !session.mfaSatisfied) {
    return null;
  }
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  if (!user || user.status !== "active") return null;
  const roles = await getUserRoles(user.id);
  return { session, user, roles };
}

export async function resetStaffMfa(input: {
  email: string;
  correlationId?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const user = await db.query.users.findFirst({
    where: inArray(users.email, emailLookupCandidates(email)),
  });
  if (!user) throw new Error("user_not_found");

  await db
    .update(users)
    .set({
      totpSecret: null,
      totpEnabled: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await writeAuditEvent({
    actorType: "system",
    action: "AUTH_MFA_RESET_DEV",
    subjectType: "user",
    subjectId: user.id,
    correlationId: input.correlationId,
    payload: { email },
  });

  return { userId: user.id, email };
}

/**
 * After proving email ownership with OTP, clear staff authenticator and
 * return a fresh enroll secret (lost-phone / never-saved-key recovery).
 */
export async function recoverStaffMfaWithOtp(input: {
  challengeId: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}) {
  const challenge = await db.query.otpChallenges.findFirst({
    where: eq(otpChallenges.id, input.challengeId),
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) {
    return { ok: false as const, error: "challenge_invalid_or_expired" };
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    return { ok: false as const, error: "challenge_locked" };
  }

  const valid = hashSecret(input.code.trim()) === challenge.codeHash;
  await db
    .update(otpChallenges)
    .set({ attempts: challenge.attempts + 1 })
    .where(eq(otpChallenges.id, challenge.id));

  if (!valid) {
    return { ok: false as const, error: "invalid_code" };
  }

  await db
    .update(otpChallenges)
    .set({ consumedAt: new Date() })
    .where(eq(otpChallenges.id, challenge.id));

  const channel = challenge.channel as "phone" | "email";
  const user = await findOrCreateUser(channel, challenge.destination);
  if (user.status !== "active") {
    return { ok: false as const, error: "user_inactive" };
  }

  await ensureFoundingDispatcherAccess(user);
  const roles = await getUserRoles(user.id);
  if (!requiresStaffMfa(roles)) {
    return { ok: false as const, error: "not_staff" };
  }

  const enrollSecret = generateTotpSecret();
  await db
    .update(users)
    .set({
      totpSecret: enrollSecret,
      totpEnabled: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  const ticket = await createMfaTicket(user.id, "totp_enroll");
  await writeAuditEvent({
    actorType: "user",
    actorId: user.id,
    action: "AUTH_MFA_RECOVER",
    subjectType: "user",
    subjectId: user.id,
    correlationId: input.correlationId,
    payload: { email: user.email },
  });

  return {
    ok: true as const,
    status: "mfa_enroll_required" as const,
    mfa: ticket,
    totpSecret: enrollSecret,
    totpOtpauth: `otpauth://totp/VUUSH:${encodeURIComponent(user.email ?? user.phone ?? user.id)}?secret=${enrollSecret}&issuer=VUUSH`,
    user: publicUser(user, roles),
  };
}

export async function assignRole(input: {
  userId: string;
  role: Role;
  scopeType?: string;
  scopeId?: string | null;
  actorId?: string;
  correlationId?: string;
}) {
  if (!isRole(input.role)) throw new Error("invalid_role");
  const scopeType = input.scopeType ?? "platform";
  const scopeId = input.scopeId ?? input.userId;

  const existing = await db
    .select()
    .from(roleBindings)
    .where(
      and(
        eq(roleBindings.userId, input.userId),
        eq(roleBindings.role, input.role),
        eq(roleBindings.scopeType, scopeType),
        eq(roleBindings.scopeId, scopeId),
      ),
    )
    .limit(1);

  const binding =
    existing[0] ??
    (
      await db
        .insert(roleBindings)
        .values({
          userId: input.userId,
          role: input.role,
          scopeType,
          scopeId,
        })
        .returning()
    )[0];

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorId,
    action: "AUTH_ROLE_ASSIGNED",
    subjectType: "user",
    subjectId: input.userId,
    correlationId: input.correlationId,
    payload: { role: input.role },
  });

  return binding;
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
