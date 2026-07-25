# M6 — Driver App (Implementation Notes)

**Status:** WAVE-1 DELIVERED  
**Depends on:** M1, M4, M5, M6a, M8 (earnings read); Emergency full desk deferred to M8c  
**UI:** `platform/apps/driver-app/` → **http://localhost:5174**  
**Smoke:** `npm run smoke:m6`  
**Run:** `npm run console:driver` (API on `:3000`)

## Done gate (Wave-1)

- [x] OTP sign-in (driver)  
- [x] Off duty / on duty home  
- [x] Job offer accept / decline  
- [x] Active job: en-route → pickup proof → transit → dropoff → POD (geofence via M6a)  
- [x] Failed attempt reason codes  
- [x] Navigate handoff (external maps)  
- [x] Tracking session + periodic pings while job active  
- [x] Earnings read  
- [x] Emergency hub stub (medical / threat / accident / assault → `INCIDENT_HOLD` + audit)  
- [x] Offline / degraded banner  

## Screen map (Atlas SC-DR-*)

| Atlas | Wave-1 coverage |
|-------|-----------------|
| SC-DR-001 | Sign in / OTP |
| SC-DR-005/006 | Duty home |
| SC-DR-007 | Job offer |
| SC-DR-008–014 | Job execution + fail |
| SC-DR-016/017 | Emergency hub (stub active path) |
| SC-DR-020 | Earnings list |
| SC-DR-025 | Offline banner |

Deferred: onboarding doc *uploads* (002–004), mutation accept (018), backup handoff (019), rich history/support (021–023), full M8c incident desk.

## Professional profile (settings)

- Driver app: gear icon → edit public name, photo URL, phone, vehicle, bio; view doc statuses (licence / vehicle / insurance).
- Customer track: `GET /v1/jobs/:jobId/driver-profile` → professional card (name, photo, phone, email, vehicle, verified badge).
- Migration: `0010_driver_profile.sql` (Dave/Tom seeded).

## Driver APIs added

| Method | Path |
|--------|------|
| GET | `/v1/drivers/me` |
| GET / PATCH | `/v1/drivers/me/profile` |
| GET | `/v1/drivers/me/earnings` |
| POST | `/v1/drivers/me/duty` *(existing)* |
| POST | `/v1/drivers/me/emergency` |
| GET | `/v1/jobs/:jobId/driver-profile` *(customer-safe)* |

## Design

Phase 8 tokens (`tokens.css`) — white / silver / charcoal / sapphire; phone-first; lists not card stacks; brand-first sign-in.

## Deferred

- Native maps SDK / in-app nav  
- Camera capture (Wave-1 uses text proof notes)  
- Queued offline mutations  
- Full Emergency ops desk (M8c)  
- Document onboarding uploads  
