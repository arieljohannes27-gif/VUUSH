# M4 — Dispatch Engine (Implementation Notes)

**Status:** DELIVERED (Wave 1 slice)  
**Depends on:** M0, M1, M3, M8 (payment gate on assign)  
**Code:** `platform/src/modules/dispatch/`  
**Smoke:** `npm run smoke:m4`

## Scope shipped

| Capability | Notes |
|------------|--------|
| Driver profile + duty | Eligibility + vehicle class + on/off duty |
| Dispatch queue | `CONFIRMED` / `SCHEDULED` jobs + hold flags |
| Eligible set | On-duty, eligible, vehicle↔package gate, soft zone match |
| Assign | Direct (city mode) or `requireAccept` offer |
| Accept / reject | Driver ack path |
| Reassign | Mandatory `reasonCode` + audit |
| Backup (PR18) | Supersede prior; optional `custodyHandoffRequired` |
| Holds | Block assign/reassign/backup while active |
| One open assignment | Partial unique index on offered/active per job |

## Explicitly deferred

- Full PR06 route optimisation / multi-stop sequencing  
- Live GPS freshness (M5)  
- Dispatcher Console UI (M4a)  
- Full incident/Emergency API (M8c) — holds are the hook for now  

## API surface

| Method | Path |
|--------|------|
| POST | `/v1/dispatch/drivers` |
| POST | `/v1/drivers/me/duty` |
| GET | `/v1/dispatch/queue` |
| GET | `/v1/dispatch/jobs/:id` |
| GET | `/v1/dispatch/jobs/:id/eligible-drivers` |
| POST | `/v1/dispatch/jobs/:id/assign` |
| POST | `/v1/dispatch/jobs/:id/reassign` |
| POST | `/v1/dispatch/jobs/:id/backup` |
| POST | `/v1/dispatch/jobs/:id/holds` |
| POST | `/v1/dispatch/holds/:id/release` |
| POST | `/v1/dispatch/assignments/:id/accept` |
| POST | `/v1/dispatch/assignments/:id/reject` |

Roles: `dispatcher` / `operations_manager` / `administrator` for staff actions.
