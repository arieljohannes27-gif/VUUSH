# M6a — Execution & Proof / POD (Implementation Notes)

**Status:** DELIVERED  
**Depends on:** M3, M4 (active assignment)  
**Code:** `platform/src/modules/execution/`  
**Smoke:** `npm run smoke:m6a`

## Done gate

- [x] Cannot `DELIVERED` without delivery proof (photo / signature / OTP)  
- [x] Cannot `PICKED_UP` without pickup proof (photo / ack)  
- [x] GPS required on successful delivery  
- [x] Driver must be within dropoff geofence (`PROOF_DROPOFF_RADIUS_M`, default 150m)  
- [x] Failed attempt with reason code  
- [x] Proofs stored as private object keys (local `.data/proofs`, not public URLs)

## Execution path

`ASSIGNED → EN_ROUTE_PICKUP → ARRIVED_PICKUP → PICKED_UP → IN_TRANSIT → ARRIVED_DROPOFF → DELIVERED | FAILED_ATTEMPT`

## API

| Method | Path |
|--------|------|
| POST | `/v1/jobs/:id/proofs` |
| GET | `/v1/jobs/:id/proofs` |
| POST | `/v1/jobs/:id/execution/en-route-pickup` |
| POST | `/v1/jobs/:id/execution/arrive-pickup` |
| POST | `/v1/jobs/:id/execution/pickup` |
| POST | `/v1/jobs/:id/execution/arrive-dropoff` |
| POST | `/v1/jobs/:id/execution/deliver` |
| POST | `/v1/jobs/:id/execution/fail-attempt` |

## Deferred

- Cloud object storage + short-TTL signed URLs  
- Full Driver App polish (M6 Wave-1 UI shipped — see `19_M6_DRIVER_APP_NOTES.md`)  
- Multi-piece partial delivery rules  
