# Technology Stack — M0 Lock

**SWIFT Technologies · Project Atlas**  
**Status:** LOCKED for Module 0 (Platform foundation)  
**Date:** 2026-07-20  
**Owner:** Ariel Johannes  

## Decision

Wave 1 implementation starts as a **TypeScript modular platform** (Phase 5), not microservices.

| Layer | Choice | Why |
|-------|--------|-----|
| Language | **TypeScript** (Node.js 22+) | One language across API and future web; hireable; matches solo→Tech Lead path |
| API framework | **Fastify** | Fast, schema-friendly, light enough for M0; clear plugin modules |
| ORM / SQL | **Drizzle** + **PostgreSQL 16** | Relational spine (Phase 6); typed migrations; not heavy |
| Validation | **Zod** | Runtime + type inference at boundaries |
| Local runtime | **Docker Compose** (Postgres) | Repeatable local “staging-like” DB |
| Secrets | **`.env` locally** (gitignored); cloud secrets manager later | Phase 7: never commit secrets |
| CI | **GitHub Actions** (lint/typecheck/test) | Gate before merge |
| Object storage | **Local filesystem stub** in M0; S3-compatible later | Enough for audit/docs path later |
| Observability | Structured **pino** logs + `/health` | Correlation-ready later |

## Explicitly deferred (not M0)

- Cloud vendor final pick (AWS/GCP/Azure)  
- PSP / maps / SMS vendors  
- Mobile app frameworks  
- Redis, Kafka, full warehouse  
- NestJS (may revisit if team prefers; Fastify modules are sufficient now)

## Code location

```text
platform/     ← M0+ implementation (modular monolith)
```

Atlas docs remain under `09_ARCHITECTURE/` and handbook folders. **Do not fork architecture truth into code comments only.**

## Amendment rule

Changing this stack requires an Atlas note and founder approval — not a silent rewrite mid-build.
