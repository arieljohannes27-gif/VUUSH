import { db } from "../../db/client.js";
import { auditEvents, type NewAuditEvent } from "../../db/schema.js";

export type WriteAuditInput = {
  actorType: string;
  actorId?: string | null;
  action: string;
  subjectType: string;
  subjectId?: string | null;
  reasonCode?: string | null;
  correlationId?: string | null;
  payload?: Record<string, unknown>;
};

export async function writeAuditEvent(input: WriteAuditInput) {
  const row: NewAuditEvent = {
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    subjectType: input.subjectType,
    subjectId: input.subjectId ?? null,
    reasonCode: input.reasonCode ?? null,
    correlationId: input.correlationId ?? null,
    payload: input.payload ?? {},
  };

  const [created] = await db.insert(auditEvents).values(row).returning();
  return created;
}
