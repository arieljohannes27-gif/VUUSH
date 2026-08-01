import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { driverProfiles, roleBindings, users } from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import { upsertDriverProfile } from "../dispatch/service.js";
import { assertPasswordPolicy } from "../../shared/auth/password-policy.js";
import { hashPassword } from "./crypto.js";
import {
  assertPdfOrImageDataUrl,
  assertPhotoDataUrl,
} from "./doc-validate.js";
import { emailLookupCandidates } from "./email-aliases.js";
import { loginWithPassword } from "./password-auth.js";
import { requestOtp, verifyOtp } from "./service.js";

export async function signupDriver(input: {
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
  vehiclePhotoUrl?: string;
  idDocUrl?: string;
  licenceDocUrl?: string;
  selfiePhotoUrl?: string;
  vehicleInsuranceDocUrl?: string;
  goodsInsuranceDocUrl?: string;
  policeClearanceDocUrl?: string;
  applicationNote?: string;
  correlationId?: string;
}) {
  const email = input.email.trim().toLowerCase();
  try {
    assertPasswordPolicy(input.password);
  } catch (err) {
    const code = err instanceof Error ? err.message : "password_too_weak";
    return { ok: false as const, error: code };
  }

  const idDoc = assertPdfOrImageDataUrl(input.idDocUrl, "id_doc_required");
  if (typeof idDoc !== "string") return idDoc;
  const licenceDoc = assertPdfOrImageDataUrl(
    input.licenceDocUrl,
    "licence_doc_required",
  );
  if (typeof licenceDoc !== "string") return licenceDoc;
  const selfie = assertPhotoDataUrl(input.selfiePhotoUrl, "selfie_required");
  if (typeof selfie !== "string") return selfie;
  const vehiclePhoto = assertPhotoDataUrl(
    input.vehiclePhotoUrl,
    "vehicle_photo_required",
  );
  if (typeof vehiclePhoto !== "string") return vehiclePhoto;
  const vehicleIns = assertPdfOrImageDataUrl(
    input.vehicleInsuranceDocUrl,
    "vehicle_insurance_required",
  );
  if (typeof vehicleIns !== "string") return vehicleIns;
  const goodsIns = assertPdfOrImageDataUrl(
    input.goodsInsuranceDocUrl,
    "goods_insurance_required",
  );
  if (typeof goodsIns !== "string") return goodsIns;
  const police = assertPdfOrImageDataUrl(
    input.policeClearanceDocUrl,
    "police_clearance_required",
  );
  if (typeof police !== "string") return police;

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
    licenceRef: input.licenceRef?.trim() || "see_licence_doc",
    insuranceRef: input.insuranceRef?.trim() || "goods_cover_r100000",
    permitRef: input.permitRef?.trim() || null,
    applicationNote:
      input.applicationNote?.trim() ||
      "Goods-in-transit cover declared ≥ R100 000",
    vehiclePlate: input.vehiclePlate?.trim() || null,
    vehicleLabel: input.vehicleLabel?.trim() || null,
    vehiclePhotoUrl: vehiclePhoto,
    idDocUrl: idDoc,
    licenceDocUrl: licenceDoc,
    selfiePhotoUrl: selfie,
    vehicleInsuranceDocUrl: vehicleIns,
    goodsInsuranceDocUrl: goodsIns,
    policeClearanceDocUrl: police,
    publicName: input.displayName.trim() || null,
    correlationId: input.correlationId,
  });

  await db
    .update(driverProfiles)
    .set({
      licenceStatus: "uploaded",
      insuranceStatus: "uploaded",
      vehicleDocStatus: "uploaded",
      updatedAt: new Date(),
    })
    .where(eq(driverProfiles.userId, user.id));

  let otp: {
    challengeId: string;
    expiresAt: Date;
    devCode?: string;
  };
  try {
    otp = await requestOtp({
      channel: "email",
      destination: email,
      correlationId: input.correlationId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "otp_delivery_failed";
    return {
      ok: false as const,
      error: message,
      userId: user.id,
    };
  }

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
    skipStaffMfa: true,
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
  return loginWithPassword({
    identifier: input.email,
    password: input.password,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    correlationId: input.correlationId,
  });
}
