import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isDev } from "../../config.js";
import { writeAuditEvent } from "./service.js";

const bodySchema = z.object({
  actorType: z.string().min(1),
  actorId: z.string().optional().nullable(),
  action: z.string().min(1),
  subjectType: z.string().min(1),
  subjectId: z.string().optional().nullable(),
  reasonCode: z.string().optional().nullable(),
  payload: z.record(z.unknown()).optional(),
});

/**
 * M0 probe endpoint — local/dev only. Disabled in staging/production.
 */
export async function auditRoutes(app: FastifyInstance) {
  app.post("/internal/audit-events", async (request, reply) => {
    if (!isDev()) {
      return reply.status(404).send({ error: "not_found" });
    }
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }

    const correlationId =
      (request.headers["x-correlation-id"] as string | undefined) ??
      request.id;

    const event = await writeAuditEvent({
      ...parsed.data,
      correlationId,
    });

    return reply.status(201).send({ event });
  });
}
