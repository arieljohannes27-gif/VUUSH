# Wave-1 RC Drill — Dogfood Playbook

**SWIFT Technologies · Project Atlas**  
**Status:** ACTIVE — run before any `city_live` claim  
**Authority:** Phase 10 §7 Definition of Done  
**Date opened:** 2026-07-23  

---

## 0. How to use

1. API on `:3000` · apps on `:5173–5177`  
2. Run **automated pack**: `npm run smoke:rc`  
3. Walk **human UI drills** A–E below (checkbox as you go)  
4. Log fails in §6 — do **not** flip Admin `city_live` until clear  

**Accounts (dev OTP):** any `@swift.local` email · staff MFA as usual  
Suggested: `cust-rc@swift.local` · `driver1-m4@swift.local` · `dispatcher@swift.local` · `support@swift.local` · `admin@swift.local`

| App | URL |
|-----|-----|
| Dispatch | http://localhost:5173 |
| Driver | http://localhost:5174 |
| Customer | http://localhost:5175 |
| Support | http://localhost:5176 |
| Admin | http://localhost:5177 |

---

## 1. Automated pack (`npm run smoke:rc`)

Runs existing module smokes in order. Each must print `OK`.

| # | Smoke | Covers |
|---|-------|--------|
| 1 | `smoke:m1` | OTP / identity |
| 2 | `smoke:m3` + `smoke:m8` | Book + pay stub · Harden finance reads · incident auto-freeze |
| 3 | `smoke:m4` | Dispatch assign |
| 4 | `smoke:m5` | Tracking integrity |
| 5 | `smoke:m6a` + `smoke:m6` | POD + driver home |
| 6 | `smoke:m2` | Customer app APIs |
| 7 | `smoke:m8a` | Support + refund |
| 8 | `smoke:m8b` | Admin flags / zones |
| 9 | `smoke:m8c` | WC-01 + WC-02 API paths |

- [x] Automated pack green — 2026-07-23 (`npm run smoke:rc`)  

---

## 2. Human drill A — Happy path (trust chain)

**Promise:** Book → pay → offer → accept → pickup proof → deliver POD → earnings  

1. Customer: book CPT-CBD → CPT-ATL, quote, pay (`tok_dev`)  
2. Driver: sign in as the **same** driver you will offer to → **Go on duty**  
3. Dispatch: select job (payment **captured**) → Send offer  
4. Driver: hear ring / Accept countdown → **Accept**  
5. Driver Job: Navigate pickup → arrive → pickup proof note → transit → dropoff → POD  
6. Driver Pay: earnings line present  
7. Customer: track stays honest (no fake motion)  

- [x] A complete — 2026-07-24 (founder dogfood)  

---

## 3. Human drill B — WC-01 Medical (tabletop + live)

**Promise:** People before parcels · non-punitive · customer pause  

1. With active job, Driver **SOS → Medical**  
2. Confirm incident `IN-…`, playbook WC-01, job on `INCIDENT_HOLD`  
3. Dispatch: Incidents → Acknowledge  
4. Customer track: pause banner (medical wording, no blame)  
5. Dispatch: Resolve `medical_cleared` + release hold  
6. Confirm driver is **not** punished in UI copy  

- [ ] B complete  

---

## 4. Human drill C — WC-02 Threat

**Promise:** External services first · limited customer copy · no casual return  

1. Active job → Driver **SOS → Threat**  
2. Driver screen: call local emergency guidance  
3. Incident: `doNotNormalReturn` · customer bucket `safety` (no “explosive”)  
4. Dispatch: attempt resolve with wrong code + release → **blocked**  
5. Resolve `external_emergency_handled` + release  

- [ ] C complete  

---

## 5. Human drill D — Degraded / lost signal

1. During active tracking, stop pings / kill network briefly  
2. Dispatch board: integrity not inventing motion  
3. Customer: degraded/stale/lost message honest  
4. If lost-signal task appears → Ack  

- [ ] D complete  

---

## 6. Human drill E — Support + Admin gates

1. Customer opens support case on a job  
2. Support: reply → escalate (hold) or refund (if captured) → resolve  
3. Admin: confirm zones/flags/reason codes load  
4. Admin: turn `booking_enabled` **off** → confirm new confirm fails → turn **on** again  
5. Leave `city_live` **false**  

- [ ] E complete  

---

## 7. Phase 10 RC checklist (map)

| RC item | Drill |
|---------|-------|
| OTP + staff MFA | Auto + login |
| Book → pay → assign → POD → earnings | A |
| Degraded/lost tracking | D |
| Emergency medical + pause | B (+ `smoke:m8c`) |
| Destination mutation + driver accept | Manual gap — see §8 |
| Backup + custody handoff | Manual gap — see §8 |
| Support case + credit | E (+ `smoke:m8a`) |
| Audit on money/overrides | Auto smokes |
| No PAN / PSP stub idempotent | `smoke:m8` (stub OK for RC dogfood; Harden H1–H5) |
| Admin zones/flags/reasons | E (+ `smoke:m8b`) |
| Scripted WC-01/02 + lost | B, C, D |

---

## 8. Known RC gaps (do not claim live city)

| Gap | Status |
|-----|--------|
| Real PSP (not `dev_stub`) | **Harden H1–H5 delivered** — Paystack adapter + payouts + Admin Money (`31_M8_HARDEN_NOTES.md`). RC dogfood stays on `dev_stub`. Live/sandbox Paystack needs business KYC + `PSP_PROVIDER=paystack` (+ live gate). Optional note: `PAYSTACK_SMOKE=1`. |
| Maps provider (beyond Google Maps URL) | **M5b delivered** — `29_MAPS_EXPERIENCE_NOTES.md` (OpenFreeMap + auto-nav) |
| Push when Driver app closed | Open |
| Mutation accept UI polish drill | Re-run once in UI |
| Backup custody UI drill | Re-run once in UI |
| Figma DS library | Open |

---

## 9. Pass / fail log

| Date | Auto | A | B | C | D | E | Notes |
|------|------|---|---|---|---|---|-------|
| 2026-07-24 | ✓ | ✓ | | | | | Happy path dogfood (Dave · maps · POD) |

**Gate:** All of §1–§6 checked · §8 acknowledged · then Admin may consider `city_live` (still requires founder call).

---

**End of Wave-1 RC Drill**
