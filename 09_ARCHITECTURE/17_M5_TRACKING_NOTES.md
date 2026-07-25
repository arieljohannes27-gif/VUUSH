# M5 — GPS / Tracking (Implementation Notes)

**Status:** DELIVERED (Wave 1 slice)  
**Depends on:** M0, M3, M4 (active assignment)  
**Code:** `platform/src/modules/tracking/`  
**Smoke:** `npm run smoke:m5`

## Done gate (Atlas)

- [x] PR23 session lifecycle: streaming → degraded → lost / conflicted → end  
- [x] No fake motion on LOST/CONFLICTED (customer projection flags)  
- [x] Dispatch lost-signal tasks (SC-DI-011) + ack  
- [x] Board positions for console (real last-known only)

## Integrity thresholds (env)

| Env | Default | Meaning |
|-----|---------|---------|
| `TRACK_FRESH_SECONDS` | 45 | Fresh window |
| `TRACK_STALE_SECONDS` | 90 | Stale / degraded |
| `TRACK_LOST_SECONDS` | 180 | Absent → lost task |
| `TRACK_TELEPORT_KM` | 8 | Teleport distance gate |
| `TRACK_MAX_SPEED_MPS` | 55 | Impossible speed gate |

## API

| Method | Path |
|--------|------|
| POST | `/v1/tracking/sessions/start` |
| POST | `/v1/tracking/sessions/:id/signals` |
| POST | `/v1/tracking/sessions/:id/end` |
| GET | `/v1/tracking/jobs/:id/projection` (customer-safe) |
| GET | `/v1/tracking/jobs/:id` (staff) |
| GET | `/v1/dispatch/board-positions` |
| GET | `/v1/dispatch/lost-signal-tasks` |
| POST | `/v1/dispatch/lost-signal-tasks/:id/ack` |

## Deferred

- Real map vendor tiles (DES-A4)  
- Driver app producer (M6)  
- Heartbeat worker as separate process (evaluate runs on read/ingest)
