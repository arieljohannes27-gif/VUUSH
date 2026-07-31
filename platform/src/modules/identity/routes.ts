import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRoles } from "../../plugins/auth.js";
import { isDev } from "../../config.js";
import { isRole } from "./roles.js";
import {
  loginDriverPassword,
  signupDriver,
  verifyDriverSignup,
} from "./driver-auth.js";
import {
  assignRole,
  refreshSession,
  requestOtp,
  resetStaffMfa,
  revokeSession,
  verifyMfa,
  verifyOtp,
} from "./service.js";

const otpRequestSchema = z.object({
  channel: z.enum(["phone", "email"]),
  destination: z.string().min(3).max(320),
});

const otpVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().min(4).max(12),
});

const mfaSchema = z.object({
  mfaToken: z.string().min(10),
  code: z.string().min(6).max(12),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.string(),
  scopeType: z.string().optional(),
  scopeId: z.string().nullable().optional(),
});

export async function identityRoutes(app: FastifyInstance) {
  await app.register(import("@fastify/rate-limit"), {
    global: false,
  });

  const authLimit = {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
      },
    },
  };

  const otpVerifyLimit = {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "1 minute",
      },
    },
  };
  app.post("/v1/auth/drivers/signup", async (request, reply) => {
    const parsed = z
      .object({
        email: z.string().email(),
        password: z.string().min(8).max(200),
        displayName: z.string().min(2).max(120),
        phone: z.string().min(7).max(40).optional(),
        licenceRef: z.string().max(200).optional(),
        insuranceRef: z.string().max(200).optional(),
        permitRef: z.string().max(200).optional(),
        vehiclePlate: z.string().max(40).optional(),
        vehicleLabel: z.string().max(120).optional(),
        vehicleClass: z.enum(["bike", "car", "van"]).optional(),
        vehiclePhotoUrl: z.string().min(32).max(900_000),
        idDocUrl: z.string().min(32).max(1_200_000),
        licenceDocUrl: z.string().min(32).max(1_200_000),
        selfiePhotoUrl: z.string().min(32).max(900_000),
        vehicleInsuranceDocUrl: z.string().min(32).max(1_200_000),
        goodsInsuranceDocUrl: z.string().min(32).max(1_200_000),
        policeClearanceDocUrl: z.string().min(32).max(1_200_000),
        applicationNote: z.string().max(500).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }
    const result = await signupDriver({
      ...parsed.data,
      correlationId: request.id,
    });
    if (!result.ok) {
      if (
        result.error === "otp_delivery_failed" ||
        result.error === "otp_email_not_configured"
      ) {
        return reply.status(503).send({
          error: result.error,
          userId: "userId" in result ? result.userId : undefined,
        });
      }
      return reply.status(400).send({ error: result.error });
    }
    return reply.status(201).send(result);
  });

  app.post("/v1/auth/drivers/signup/verify", async (request, reply) => {
    const parsed = otpVerifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }
    const result = await verifyDriverSignup({
      ...parsed.data,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
      correlationId: request.id,
    });
    if (!result.ok) {
      return reply.status(401).send({ error: result.error });
    }
    return reply.send(result);
  });

  app.post("/v1/auth/password/login", authLimit, async (request, reply) => {
    const parsed = z
      .object({
        email: z.string().email(),
        password: z.string().min(1).max(200),
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }
    const result = await loginDriverPassword({
      ...parsed.data,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
      correlationId: request.id,
    });
    if (!result.ok) {
      return reply.status(401).send({ error: result.error });
    }
    return reply.send(result);
  });

  app.post("/v1/auth/otp/request", authLimit, async (request, reply) => {
    const parsed = otpRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }
    try {
      const result = await requestOtp({
        ...parsed.data,
        correlationId: request.id,
      });
      return reply.status(201).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "otp_failed";
      if (
        message === "otp_email_not_configured" ||
        message === "otp_sms_not_configured" ||
        message === "otp_delivery_failed"
      ) {
        return reply.status(503).send({ error: message });
      }
      throw err;
    }
  });

  app.post("/v1/auth/otp/verify", otpVerifyLimit, async (request, reply) => {
    const parsed = otpVerifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }
    const result = await verifyOtp({
      ...parsed.data,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
      correlationId: request.id,
    });
    if (!result.ok) {
      return reply.status(401).send({ error: result.error });
    }
    return reply.send(result);
  });

  app.post("/v1/auth/mfa/verify", otpVerifyLimit, async (request, reply) => {
    const parsed = mfaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }
    const result = await verifyMfa({
      ...parsed.data,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
      correlationId: request.id,
    });
    if (!result.ok) {
      return reply.status(401).send({ error: result.error });
    }
    return reply.send({ status: "authenticated", ...result });
  });

  app.post("/v1/auth/token/refresh", authLimit, async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }
    const result = await refreshSession({
      refreshToken: parsed.data.refreshToken,
      correlationId: request.id,
    });
    if (!result.ok) {
      return reply.status(401).send({ error: result.error });
    }
    return reply.send({ status: "authenticated", ...result });
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    const body = z
      .object({
        refreshToken: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    const header = request.headers.authorization;
    const accessToken = header?.startsWith("Bearer ")
      ? header.slice(7)
      : undefined;
    await revokeSession({
      accessToken,
      refreshToken: body.success ? body.data.refreshToken : undefined,
      correlationId: request.id,
    });
    return reply.send({ ok: true });
  });

  app.get(
    "/v1/me",
    { preHandler: requireAuth },
    async (request) => ({ user: request.authUser }),
  );

  /** Sample RBAC-protected route (M1 done-gate). */
  app.get(
    "/v1/admin/ping",
    { preHandler: requireRoles("administrator", "operations_manager") },
    async (request) => ({
      ok: true,
      message: "admin area reachable",
      actor: request.authUser?.id,
      roles: request.authUser?.roles,
    }),
  );

  /**
   * Dev-only role assignment for founder seeding.
   * Disabled outside development/test.
   */
  app.post("/v1/dev/assign-role", async (request, reply) => {
    if (!isDev()) {
      return reply.status(404).send({ error: "not_found" });
    }
    const parsed = assignRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }
    if (!isRole(parsed.data.role)) {
      return reply.status(400).send({ error: "invalid_role" });
    }
    const binding = await assignRole({
      userId: parsed.data.userId,
      role: parsed.data.role,
      scopeType: parsed.data.scopeType,
      scopeId: parsed.data.scopeId,
      correlationId: request.id,
    });
    return reply.status(201).send({ binding });
  });

  /** Dev-only: clear staff TOTP so local console can re-enroll. */
  app.post("/v1/dev/reset-mfa", async (request, reply) => {
    if (!isDev()) {
      return reply.status(404).send({ error: "not_found" });
    }
    const parsed = z
      .object({ email: z.string().min(3).max(320) })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error" });
    }
    try {
      const result = await resetStaffMfa({
        email: parsed.data.email,
        correlationId: request.id,
      });
      return reply.send({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      return reply
        .status(message === "user_not_found" ? 404 : 400)
        .send({ error: message });
    }
  });
}
