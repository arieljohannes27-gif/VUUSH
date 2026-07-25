# M5b — Maps Experience · Design

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED  
**Approved:** 2026-07-23 (founder: Ariel Johannes)  
**Module:** M5b Maps Experience (extends M5 · M2 · M6 · M4a)  
**Depends on:** M5 tracking integrity · M6 Driver · M2 Customer · M4a Dispatch · DS v1  
**Users:** U03 Customer · U04 Driver · U05 Dispatcher (board map)  
**Phase gate:** Design locked. Implementation in `platform/` only after this doc.

---

## 0. Executive position

Wave-1 proved the trust chain with **honest tracking APIs** and a **Google Maps URL handoff**. That is not enough.

Uber/Bolt drivers live in the map. Customers trust what they **see moving**. Busy Cape Town roads demand **automation** — not extra taps.

> Maps are the cockpit, not a link.  
> Live motion only when integrity is fresh.  
> Accept a trip → navigation opens. Hands stay on the wheel.

**Done when:** Customer track is a full-bleed live map when GPS is fresh; Driver accept/active-job entry auto-opens navigation to the current stop; degraded/lost still never invents motion (DES-D4).

### Board challenges

| Temptation | Verdict | Why |
|------------|---------|-----|
| Fake smooth vehicle animation when signal is stale/lost | **Reject** | DES-D4 · trust > theatre |
| Full in-app turn-by-turn on web Wave-1 | **Defer** | True TBT needs native SDK; auto-open system nav is the W1 win |
| Build maps before integrity polish | **Reject** | M5 thresholds stay law |
| Pretty map that hides holds / incidents | **Reject** | Pause banner still owns the story |
| Dispatch “Uber theatre” board as M5b core | **Defer** | Thin board map OK; ops map depth = later |
| Block M5b until real PSP | **Reject** | Maps are beachhead feel; money can stay stub |

---

## 1. What exists today (baseline)

| Piece | Status |
|-------|--------|
| Tracking sessions + integrity classes | M5 delivered |
| Customer projection (`showLiveMotion`, `allowLiveMarker`, lastKnown) | API yes · **UI placeholder** |
| Driver Navigate | External Google Maps **link** (manual tap) |
| Auto-open nav on accept / job switch | **Missing** |
| In-app map tiles (driver / customer / dispatch) | **Missing** |
| Map vendor account | Open (DES-A4) |

---

## 2. Product promise

| Promise | Meaning |
|---------|---------|
| **Customer live stage** | Track screen = attractive full-bleed map + route context; vehicle moves when fresh |
| **Honest when broken** | Degraded / lost / conflicted / incident pause → last pin + copy; marker frozen |
| **Driver cockpit** | Active job screen is map-first; chrome is secondary |
| **Auto-nav** | Accept offer **or** switch into active trip → system maps open to **current stop** with zero second tap when platform allows |
| **Stop awareness** | Pickup leg → nav to pickup; after pickup proof → auto-nav to dropoff |
| **Dispatch glance** | Board positions render on a real map (real last-known only) |

---

## 3. Vendor & architecture

### 3.1 Split: display vs navigation

| Layer | Wave-1 choice | Role |
|-------|---------------|------|
| **Display map** | MapLibre GL + vector tiles **or** Google Maps JS (pick one in notes; prefer MapLibre for cost/control) | Customer live track · Driver overview · Dispatch board |
| **Turn-by-turn** | **System navigation** — Google Maps / Apple Maps deep link (platform-aware) | Driver driving |
| **Native in-app TBT** | Deferred (React Native / Capacitor shell later) | Wave-2+ |

Wave-1 does **not** pretend to be a navigation SDK. It **automates the handoff** Uber-style drivers already trust, and makes **watching** beautiful.

### 3.2 Platform constraints (web)

- Browser popup blockers: auto-open must fire from the **same user gesture** as Accept (or “Open job”) whenever possible.  
- If blocked: full-screen **“Maps ready — Tap to navigate”** interstitial with one giant CTA (same destination URL). Never silent fail.  
- Prefer `geo:` / Apple Maps on iOS Safari; Google Maps URL elsewhere; optional Waze later.  
- PWA / installed shortcut: same rules.

### 3.3 Data already owned by Atlas

Reuse M5 projection — do not invent parallel GPS truth:

| Flag | Map behaviour |
|------|----------------|
| `showLiveMotion === true` | Animate marker along real updates |
| `allowLiveMarker` + not live | Show last-known pin, no animation |
| integrity `absent` / `conflicted` | Frozen pin + warn chrome |
| `incidentPause` | Banner over map; no ETA theatre |

Poll / SSE interval: keep current client cadence; marker interpolation **only between consecutive fresh points**, capped so we never overshoot lastKnown.

---

## 4. Screen contracts

### 4.1 Customer — SC-CU-011 Track (rebuild)

**Composition:** One viewport = map stage.

| Element | Rule |
|---------|------|
| Map | Full-bleed edge-to-edge; route line pickup→dropoff when known |
| Vehicle | Marker only when allowed; motion only when `showLiveMotion` |
| Chrome | Bottom sheet: status, integrity chip, ETA confidence, support |
| Pause | Incident / hold banner above sheet — never under map chrome |
| Degraded | SC-CU-012 treatment on same map (frozen) |

**Attractiveness bar:** Comparable calm quality to rideshare track — not a grey box with coordinates.

### 4.2 Driver — SC-DR-008 / 011 Navigate (rebuild)

**Composition:** Map-first cockpit while job active.

| Element | Rule |
|---------|------|
| Map | Full-bleed; current stop highlighted; next address readable at a glance |
| Primary | Current stop CTA already satisfied by auto-nav; in-app map is orientation |
| Secondary | Proof / arrive / fail — bottom sheet, large hit targets |
| Emergency | Remains one-thumb reachable over map |

### 4.3 Auto-nav triggers (non-negotiable)

| Event | Destination | Behaviour |
|-------|-------------|-----------|
| Offer **Accept** succeeds | Pickup lat/lng (fallback address) | Open system maps **immediately** |
| Driver opens / switches to active job (en-route pickup) | Pickup | Auto-open (or one-tap recover) |
| Pickup proof succeeds → in transit | Dropoff | Auto-open to dropoff |
| Reassign / backup becomes active for this driver | Current stop for new assignment | Auto-open |
| App resume with active job + nav not yet confirmed this session | Current stop | Offer recover CTA if auto blocked |

Log audit-friendly client event `nav_handoff_opened` / `nav_handoff_blocked` (dev log OK Wave-1).

### 4.4 Dispatch — SC-DI-002 Board (thin)

Replace honest placeholder with real tiles + last-known markers from `/v1/dispatch/board-positions`. No fake motion. Lost = grey pin + integrity label.

---

## 5. API / platform changes (minimal)

Mostly client. Server only if needed:

| Change | Notes |
|--------|-------|
| Projection | Already sufficient; optional `routePreview` polyline later |
| `GET .../projection` | Ensure lat/lng + integrity always present for map clients |
| Driver home / active job payload | Include `navTarget: { lat, lng, address, leg: pickup\|dropoff }` so UI never guesses |
| Feature flag | `maps_experience_enabled` (Admin) — kill switch |

No new GPS truth model. No PAN. No fake ETA from map vendor.

---

## 6. Design system (maps)

| Token / rule | Application |
|--------------|-------------|
| DS v1 sapphire / charcoal / silver | Marker, route, sheet |
| No purple glow / dark-mode default | Follow DES |
| Motion 150–250ms | Sheet; marker ease only on real deltas |
| Typography | Status in sheet; map labels vendor-minimal |
| Brand | Customer track: SWIFT wordmark discreet on sheet, not sticker on map |

Forbidden: emoji traffic, neon polylines, “searching…” fake driver roam.

---

## 7. Implementation slices

| Slice | Deliverable | Smoke / drill |
|-------|-------------|----------------|
| **S0** | Vendor key env · Map shell component · flag | Render map in Customer track |
| **S1** | Customer live marker + integrity freeze | Extend `smoke:m2` / UI drill A+D |
| **S2** | Driver map cockpit + `navTarget` | UI |
| **S3** | Auto-nav on accept + post-pickup | UI drill A (hands-busy) |
| **S4** | Dispatch board tiles | UI drill D |
| **S5** | Notes + RC drill update | `29_MAPS_EXPERIENCE_NOTES.md` |

Build order: **S0 → S1 → S3 → S2 → S4** (auto-nav is the road-safety win; ship S3 as soon as accept gesture exists).

---

## 8. Explicit non-goals (this module)

- Native turn-by-turn voice inside SWIFT  
- Offline tile packs  
- Multi-stop routing optimisation AI  
- Sharing live location outside job session  
- Replacing M5 integrity thresholds  
- Finance / PSP work  

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Popup blocker kills auto-nav | Same-gesture open + recover interstitial |
| Vendor cost | MapLibre + self-hostable tiles path preferred; cache keys in env |
| Battery / ping rate | Keep M5 cadence; no 1Hz client spam |
| Drivers prefer Waze | Settings later; Wave-1 Google/Apple |
| Pretty map distracts from Emergency | Emergency z-index + always reachable |

---

## 10. RC / roadmap impact

- Updates `27_WAVE1_RC_DRILL.md` §8: Maps provider moves from “Open” → **In design / implementing**  
- Human drill A gains: auto-nav on accept; Customer sees live map when fresh  
- Human drill D unchanged in spirit (honest freeze)  
- **M8 Harden** and **M7** remain next money/B2B designs — M5b is a beachhead UX insert, not a Wave-2 product  

---

## 11. Approval

| | |
|--|--|
| **Status** | **APPROVED** |
| **Date** | 2026-07-23 |
| **Authority** | Founder + Architecture Board |
| **Next** | Implement S0–S5 in `platform/`; publish `29_MAPS_EXPERIENCE_NOTES.md` |

---

**End of M5b Maps Experience Design**
