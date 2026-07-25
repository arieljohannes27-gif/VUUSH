# M8c — Incidents & Emergency (Implementation Notes)

**Status:** WAVE-1 DELIVERED  
**Depends on:** M4 holds · M6 Emergency stub · Design `25_M8C_INCIDENT_DESIGN.md` (**APPROVED** 2026-07-23)  
**Smoke:** `npm run smoke:m8c`  
**Migration:** `0009_m8c_incidents.sql`

## Done gate (Wave-1)

- [x] `incidents` + events + notify outbox  
- [x] Driver Emergency creates incident (WC-01/WC-02 mapping)  
- [x] `INCIDENT_HOLD` + Dispatch incident board (ack / escalate / notify / resolve)  
- [x] Customer projection `incidentPause` (no threat specifics)  
- [x] Threat `doNotNormalReturn` blocks casual hold release  
- [x] Medical `nonPunitive` flag  
- [x] Notify path logs `[swift-incident]` and marks sent  

## APIs

| Method | Path |
|--------|------|
| POST | `/v1/drivers/me/emergency` |
| GET | `/v1/drivers/me/incidents/active` |
| GET | `/v1/dispatch/incidents` |
| GET | `/v1/dispatch/incidents/:id` |
| POST | `.../acknowledge` · `escalate` · `notify-customer` · `notes` · `resolve` |

## UI

- Driver SOS → active incident panel  
- Dispatch stage → Incidents list + detail actions  
- Customer track → pause banner when incident open  
