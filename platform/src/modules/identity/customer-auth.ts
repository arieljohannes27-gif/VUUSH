import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { roleBindings, users } from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import { assertPasswordPolicy } from "../../shared/auth/password-policy.js";
import { hashPassword } from "./crypto.js";
import { emailLookupCandidates } from "./email-aliases.js";
import { inArray } from "drizzle-orm";
import { requestOtp, createSessionForUser, getUserRoles } from "./service.js";
import { consumeOtpChallenge } from "./service.js";

/**
 * Customer self-serve: register with email/phone + password, verify once via OTP.
 */
export async function registerCustomer(input: {
  email?: string;
  phone?: string;
  password: string;
  displayName?: string;
  correlationId?: string;
}) {
  assertPasswordPolicy(input.password);
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim().replace(/\s+/g, "") || null;
  if (!email && !phone) {
    return { ok: false as const, error: "validation_error" };
  }

  if (email) {
    const existing = await db.query.users.findFirst({
      where: inArray(users.email, emailLookupCandidates(email)),
    });
    if (existing?.passwordHash) {
      return { ok: false as const, error: "email_taken" };
    }
  }
  if (phone) {
    const existingPhone = await db.query.users.findFirst({
      where: eq(users.phone, phone),
    });
    if (existingPhone?.passwordHash) {
      return { ok: false as const, error: "phone_taken" };
    }
  }

  let user =
    (email
      ? await db.query.users.findFirst({
          where: inArray(users.email, emailLookupCandidates(email)),
        })
      : null) ??
    (phone
      ? await db.query.users.findFirst({
          where: eq(users.phone, phone),
        })
      : null);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email,
        phone,
        displayName:
          input.displayName?.trim() || email || phone || "Customer",
        passwordHash: hashPassword(input.password),
        status: "active",
      })
      .returning();
    await db.insert(roleBindings).values({
      userId: user.id,
      role: "customer",
      scopeType: "self",
      scopeId: user.id,
    });
  } else {
    await db
      .update(users)
      .set({
        passwordHash: hashPassword(input.password),
        email: email ?? user.email,
        phone: phone ?? user.phone,
        displayName:
          input.displayName?.trim() || user.displayName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    user = (await db.query.users.findFirst({ where: eq(users.id, user.id) }))!;
    const roles = await getUserRoles(user.id);
    if (!roles.includes("customer")) {
      await db.insert(roleBindings).values({
        userId: user.id,
        role: "customer",
        scopeType: "self",
        scopeId: user.id,
      });
    }
  }

  const channel = email ? ("email" as const) : ("phone" as const);
  const destination = (email ?? phone)!;
  let otp: { challengeId: string; expiresAt: Date; devCode?: string };
  try {
    otp = await requestOtp({
      channel,
      destination,
      correlationId: input.correlationId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "otp_delivery_failed";
    return { ok: false as const, error: message, userId: user.id };
  }

  await writeAuditEvent({
    actorType: "user",
    actorId: user.id,
    action: "CUSTOMER_REGISTER_STARTED",
    subjectType: "user",
    subjectId: user.id,
    correlationId: input.correlationId,
  });

  return {
    ok: true as const,
    userId: user.id,
    challengeId: otp.challengeId,
    expiresAt: otp.expiresAt,
    ...(otp.devCode ? { devCode: otp.devCode } : {}),
  };
}

export async function verifyCustomerRegister(input: {
  challengeId: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}) {
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
          where: eq(users.phone, consumed.destination.replace(/\s+/g, "")),
        });

  if (!user?.passwordHash) {
    return { ok: false as const, error: "not_found" };
  }

  const roles = await getUserRoles(user.id);
  const session = await createSessionForUser({
    userId: user.id,
    mfaSatisfied: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
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
  };
}
