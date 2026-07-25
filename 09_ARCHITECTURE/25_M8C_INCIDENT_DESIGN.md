# M8c — Incidents & Emergency · Design

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED  
**Approved:** 2026-07-23  
**Module:** M8c (Phase 10)  
**Depends on:** M0, M3, M4 (holds) · M5 (location) · M6 Driver Emergency stub · M4a Dispatch · M8a Support · DS v1  
**Users:** U04 Driver · U05 Dispatcher · U07 Support · U08 Ops (ack) · U09 Admin (flags)  
**Phase gate:** Design locked. Implementation in `platform/`.

---

## 0. Executive position

M6 already ships a **Driver Emergency stub** (category → `INCIDENT_HOLD` + audit). M8c makes worst-case playbooks **real in data**: durable incident entities, a Dispatch incident board, honest customer pause copy, notify hooks, and non-punitive medical treatment.

> People before parcels.  
> Emergency is never decorative.  
> Holds are the freeze; incidents are the case file.

**Done when (Atlas):** *WC-01 / WC-02 states enforceable in data + notify path.*

### Board challenges

| Temptation | Verdict | Why |
|------------|---------|-----|
| Fake “911 connected” theatre | **Reject** | Honesty > spectacle; open external dial / copy |
| Punish driver for medical diversion | **Reject** | WC-D2 / medical protection class |
| Let Support silently clear S1 threat | **Reject** | Authority matrix; Dispatch/Ops own safety holds |
| Build full Ops Command Centre (W3) | **Defer** | Wave-1 = incident spine + desks, not KPI theatre |
| Auto-close incidents on hold release | **Reject** | Explicit resolve with reason |

---

## 1. What exists today (baseline)

| Piece | Status |
|-------|--------|
| Driver Emergency hub (Medical / Threat / Accident / Assault) | Stub — M6 |
| `POST /v1/drivers/me/emergency` | Hold + audit only |
| `INCIDENT_HOLD` on active job | Yes |
| Incident entity / board / notify | **Missing** |
| Customer “paused for safety” copy | Partial / generic |
| WC-02 “do not return to depot” flag | **Missing** |

---

## 2. Product promise (Wave-1)

| Promise | Meaning |
|---------|---------|
| One-thumb Emergency | Remains; now creates a first-class **incident** |
| Freeze truth | Job(s) on hold; assignment blocked; customer sees pause (not fake ETA) |
| Dispatch sees crises | Incident board + detail with location, category, linked jobs |
| Playbook-aware | Medical vs Threat paths differ (severity, copy, restrictions) |
| Notify path | Dev/log + in-app banners; SMS/push stubbed as outbox events |
| Non-punitive medical | Flag on incident; no auto earnings clawback |
| Audit everything | Open, acknowledge, escalate, resolve, notify |

---

## 3. Incident model

### Entity `incidents`

| Field | Notes |
|-------|-------|
| `id` | UUID |
| `publicCode` | `IN-XXXXXX` |
| `category` | `medical` \| `threat` \| `accident` \| `assault` |
| `severity` | `s1` (threat/assault default) · `s2` (accident) · `medical` |
| `status` | `open` → `acknowledged` → `escalated` → `resolved` \| `cancelled` |
| `driverUserId` | Declaring driver |
| `jobId` | Active job at declare (nullable if off-job) |
| `holdId` | Linked `job_holds` row when created |
| `lat` / `lng` | Last known at declare |
| `note` | Driver optional note |
| `playbook` | `WC-01` \| `WC-02` \| `WC-23` \| `GENERAL` (derived from category) |
| `securityRestricted` | bool — threat/assault: limit customer detail |
| `doNotNormalReturn` | bool — WC-02: parcel must not return via normal chain |
| `nonPunitive` | bool — true for medical |
| `acknowledgedByUserId` / `acknowledgedAt` | Dispatch |
| `resolvedByUserId` / `resolvedAt` / `resolutionCode` / `resolutionNote` | |
| `createdAt` / `updatedAt` | |

### Entity `incident_events` (append-only timeline)

`opened` · `acknowledged` · `location_ping` · `customer_notified` · `escalated` · `hold_placed` · `hold_released` · `resolved` · `note_added`

### Notify outbox `incident_notifications`

| Field | Notes |
|-------|-------|
| `channel` | `in_app` \| `sms` \| `email` \| `push` (Wave-1: mostly `in_app` + log) |
| `audience` | `dispatch` \| `support` \| `customer` \| `ops` |
| `status` | `queued` → `sent` \| `failed` |
| `payload` | JSON template vars |

Wave-1 **notify path** = write outbox + mark `sent` via console logger (same pattern as OTP `[swift-otp]`). Real SMS/push vendors later.

---

## 4. Playbook mapping

| Category | Playbook | Severity | Customer copy intent | Special rules |
|----------|----------|----------|----------------------|---------------|
| `medical` | WC-01 | medical | Paused — driver medical emergency; parcel securing; next update window | `nonPunitive=true`; hospital divert authorised |
| `threat` | WC-02 | s1 | Security pause — limited detail | `securityRestricted=true`; `doNotNormalReturn=true`; external emergency first |
| `assault` | GENERAL→S1 | s1 | Safety pause — limited detail | `securityRestricted=true` |
| `accident` | WC-23 | s2 | Delayed — safety incident; we will update | Backup allocation may follow (existing M4) |

**Threat / WC-02 UI rule:** Driver app shows “Call local emergency services first” + Emergency control; SWIFT never claims it dialled 10111/911 for them.

---

## 5. Screens & surfaces

### Driver (enhance M6)

| ID | Change |
|----|--------|
| SC-DR-016 | Unchanged hub; respect `driver_emergency_enabled` flag |
| SC-DR-017 | **Emergency active** — incident code, status, “help path started”, calm instructions per category |

### Dispatch (M4a)

| ID | Screen | Wave-1 |
|----|--------|--------|
| SC-DI-0xx | **Incident board** | Open / ack’d incidents; severity chips |
| SC-DI-0xx | **Incident detail** | Timeline, map pin if coords, linked job, actions: Acknowledge, Escalate, Notify customer, Resolve, Release hold (with guardrails) |

### Customer (M2)

| ID | Change |
|----|--------|
| SC-CU-012-ish | Track / job detail: **paused banner** when `INCIDENT_HOLD` — playbook-safe copy (no threat specifics if restricted) |

### Support (M8a)

| Change | Read-only incident pane on case if linked job has open incident; escalate already creates holds — link to incident if present |

### Admin

| Flag | `driver_emergency_enabled` already exists |

**No new Admin app** in M8c. **No Ops dashboard (W3).**

---

## 6. API surface (proposed)

### Driver

| Method | Path | Notes |
|--------|------|-------|
| POST | `/v1/drivers/me/emergency` | **Upgrade:** create incident + hold + events + notify outbox; return `{ incident, hold }` |
| GET | `/v1/drivers/me/incidents/active` | Open incident for current driver |

### Dispatch / Ops staff

| Method | Path |
|--------|------|
| GET | `/v1/dispatch/incidents` |
| GET | `/v1/dispatch/incidents/:id` |
| POST | `/v1/dispatch/incidents/:id/acknowledge` |
| POST | `/v1/dispatch/incidents/:id/escalate` |
| POST | `/v1/dispatch/incidents/:id/notify-customer` |
| POST | `/v1/dispatch/incidents/:id/resolve` |
| POST | `/v1/dispatch/incidents/:id/notes` |

Roles: `dispatcher`, `operations_manager`, `administrator`.

### Customer (read)

| Method | Path |
|--------|------|
| GET | `/v1/jobs/:id` / tracking projection | Include `incidentPause?: { publicCode, categoryBucket, message }` |

`categoryBucket`: `medical` \| `safety` \| `delay` (never leak “explosive” to customer).

---

## 7. State machine

```
open
  → acknowledged   (dispatcher claims)
  → escalated      (ops / S1 path; still open until resolved)
  → resolved       (resolutionCode required)
  → cancelled      (false alarm; rare; audited)
```

**Hold rules**

- Opening emergency with active job → ensure `INCIDENT_HOLD`.  
- Resolve medical/accident may **suggest** release hold (explicit action).  
- Resolve threat/assault: hold release requires `resolutionCode` ∈ allow-list + confirm; `doNotNormalReturn` stays on job metadata until Ops clears (flag on incident + job payload).  
- Cannot assign/offer while hold active (already true).

---

## 8. Resolution codes (seed via M8b reason domain or incident-specific)

| Code | Use |
|------|-----|
| `medical_cleared` | Driver OK; resume or reassign |
| `backup_completed` | Custody handed off |
| `false_alarm` | Cancelled / resolved benign |
| `external_emergency_handled` | WC-02 / assault after services |
| `customer_cancelled_after_incident` | |
| `job_failed_safe` | Undeliverable post-incident |

---

## 9. UX / Design System

- **Danger** only on Emergency declare + S1 banners — never ornamental.  
- Dispatch incident board: dense table; severity chip; no map theatre required (pin link via Google Maps URL OK).  
- Customer pause: calm surface banner, no countdown fake ETA.  
- Driver Emergency active: full-bleed confirm state; large “I’m safe / need follow-up” is **out** of Wave-1 (resolve is staff-side).

---

## 10. Out of scope (explicit)

- Live 911/10111 telephony integration  
- Wearable / dead-man watchdog hardware  
- Full S1 war-room / Ops dashboard (W3)  
- Insurance claim system  
- Multi-vehicle contamination graph UI  
- Automatic earnings medical top-up calculation (flag only; Finance later)  
- Push when app killed (needs mobile push vendor)

---

## 11. Implementation sketch (after approval)

1. Migration `0009_m8c_incidents.sql` — `incidents`, `incident_events`, `incident_notifications`  
2. `platform/src/modules/incidents/` service + routes  
3. Upgrade `declareDriverEmergency` to create incident  
4. Dispatch console: Incidents rail/board + detail actions  
5. Customer + tracking projection: pause message  
6. Support desk: show linked incident if any  
7. `npm run smoke:m8c` — medical + threat paths  
8. Notes → `26_M8C_INCIDENT_NOTES.md`

**Suggested port:** no new app — extend Dispatch `:5173`.

---

## 12. Decisions

| ID | Decision |
|----|----------|
| IC-D1 | Incident is first-class; hold remains the freeze mechanism |
| IC-D2 | WC-01 medical → non-punitive; WC-02 threat → securityRestricted + doNotNormalReturn |
| IC-D3 | Notify path = outbox + log in Wave-1; vendors later |
| IC-D4 | Customer never sees weapon/explosive wording |
| IC-D5 | Dispatch owns ack/resolve; Support read + case link |
| IC-D6 | No new Admin surface; reuse emergency flag |
| IC-D7 | Upgrade existing Driver Emergency API — don’t fork |

---

## 13. Risks

| Risk | Mitigation |
|------|------------|
| Staff clear threat holds too fast | Resolve guards + audit + doNotNormalReturn sticky |
| Driver spam emergencies | Rate-limit soft; still always allow declare |
| Customer panic from vague copy | Scripted pause templates per bucket |
| Stub → full regression | Smoke WC-01 + WC-02 paths |

---

## 14. Assumptions

| # | Assumption |
|---|------------|
| IC-A1 | One active job per driver in Wave-1 dogfood (multi-job: hold all later) |
| IC-A2 | External emergency call is driver’s phone, not SWIFT telephony |
| IC-A3 | Beachhead city procedures documented offline for dispatchers |

---

## 15. Approval gate

Reply with one of:

- `APPROVE M8C` — implement Wave-1 incidents + Emergency upgrade  
- `APPROVE M8C WITH AMENDMENTS: …`  
- `REVISE: …`  

---

**End of M8c Incidents & Emergency Design**
