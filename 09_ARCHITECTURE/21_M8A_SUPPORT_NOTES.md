# M8a — Support Centre (Implementation Notes)

**Status:** WAVE-1 DELIVERED  
**Depends on:** M1, M3, M8 (refunds)  
**UI:** `platform/apps/support-console/` → **http://localhost:5176**  
**Smoke:** `npm run smoke:m8a`  
**Run:** `npm run console:support`  
**Migration:** `0007_m8a_support.sql`

## Done gate (Wave-1)

- [x] Cases linked to jobs (optional) with public codes `SU-*`  
- [x] Threaded messages (customer / agent / system)  
- [x] Agent inbox + case detail with job timeline + payments  
- [x] Reply, resolve, escalate (dispatch hold), open claim, issue refund  
- [x] Customer can open case, list cases, reply in thread (M2 updated)

## Screen map (Atlas SC-SU-*)

| Atlas | Wave-1 |
|-------|--------|
| SC-SU-001 | Case inbox |
| SC-SU-002 | Case detail / thread |
| SC-SU-003 | Job timeline pane |
| SC-SU-004 | Refund action |
| SC-SU-005 | Open claim |
| SC-SU-006 | Escalate to dispatch |
| SC-SU-008 | Customer pane (email) |

Deferred: SLA clocks, knowledge macros, QA review, softphone embed.

## APIs

| Method | Path |
|--------|------|
| POST | `/v1/support/cases` |
| GET | `/v1/support/cases` |
| GET | `/v1/support/cases/:id` |
| POST | `/v1/support/cases/:id/messages` |
| GET | `/v1/support/desk/cases` |
| GET | `/v1/support/desk/cases/:id` |
| POST | `/v1/support/desk/cases/:id/resolve` |
| POST | `/v1/support/desk/cases/:id/escalate` |
| POST | `/v1/support/desk/cases/:id/claim` |
| POST | `/v1/support/desk/cases/:id/refund` |

## Ports

| App | URL |
|-----|-----|
| Dispatch | :5173 |
| Driver | :5174 |
| Customer | :5175 |
| Support | :5176 |
