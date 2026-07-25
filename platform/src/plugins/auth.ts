import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveAccessToken } from "../modules/identity/service.js";

export type AuthUser = {
  id: string;
  phone: string | null;
  email: string | null;
  displayName: string | null;
  status: string;
  totpEnabled: boolean;
  roles: string[];
  sessionId: string;
};

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const token = bearerToken(request);
  if (!token) {
    return reply.status(401).send({ error: "unauthorized" });
  }
  const resolved = await resolveAccessToken(token);
  if (!resolved) {
    return reply.status(401).send({ error: "unauthorized" });
  }
  request.authUser = {
    id: resolved.user.id,
    phone: resolved.user.phone,
    email: resolved.user.email,
    displayName: resolved.user.displayName,
    status: resolved.user.status,
    totpEnabled: resolved.user.totpEnabled,
    roles: resolved.roles,
    sessionId: resolved.session.id,
  };
}

export function requireRoles(...allowed: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    const roles = request.authUser?.roles ?? [];
    const ok = allowed.some((r) => roles.includes(r));
    if (!ok) {
      return reply.status(403).send({ error: "forbidden", required: allowed });
    }
  };
}
