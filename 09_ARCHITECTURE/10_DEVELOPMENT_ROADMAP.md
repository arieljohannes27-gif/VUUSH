# Phase 10 — Development Roadmap

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED  
**Approved:** 2026-07-20  
**Depends on:** Phases 1–8 approved · Phase 9 (**APPROVED** 2026-07-20)  
**Phase gate:** Architecture programme Phases 1–10 complete as baseline. Amendments require explicit revision. Implementation planning may begin from M0 without reopening earlier phases unless decisions change.

---

## 0. Executive Position

Phases 1–9 defined the company, products, people, processes, systems, data, security, design, and screens. Phase 10 breaks the software into **build modules**, estimates **complexity**, maps **dependencies**, and recommends **implementation order**.

### Board challenges

| Temptation | Verdict | Why |
|------------|---------|-----|
| Build all 10 modules in parallel | **Reject** | Solo/small team death spiral |
| Start with AI & analytics | **Reject** | No spine, no truth |
| “MVP” that skips Emergency / audit / degraded tracking | **Reject** | Violates approved 4B/7/9 |
| Big-bang microservices | **Reject** | Phase 5 modular platform stands |
| **Wave-aligned modules; critical path first; complexity honest** | **Adopt** | Ship trust in one metro |

### Roadmap thesis

> Implement the **job spine** before the theatre.  
> Every module must leave the system **more trustworthy**, not merely more featured.  
> Estimates are **relative complexity**, not fixed calendar promises (team size unknown).

### Complexity scale

| Score | Meaning |
|-------|---------|
| **XS** | Days for a strong engineer; thin surface |
| **S** | ~1–2 weeks |
| **M** | ~2–4 weeks |
| **L** | ~1–2 months |
| **XL** | Multi-month / multi-person; high risk |
| **XXL** | Programme-scale; do not start early |

*Assumes one competent Tech Lead + founder oversight; calendar stretches if solo coding.*

---

## 1. Module Catalogue (Official 10 + Foundation)

The brief listed Modules 1–10. We add **Module 0** (platform foundation) because Auth alone cannot stand without it.

| Module | Name | Primary Atlas links |
|--------|------|---------------------|
| **M0** | Platform foundation | Phase 5–7, PR25 spine |
| **M1** | Authentication & identity | Phase 7, PR01, PR24 users |
| **M2** | Customer App | P01, SC-CU-*, PR03–04, PR10, PR23 views |
| **M3** | Booking engine | PR03, PR04, Jobs module |
| **M4** | Dispatch engine | PR05, PR06, PR18, SC-DI-* |
| **M5** | GPS / tracking | PR23, Tracking engine |
| **M6** | Driver App | P02, SC-DR-*, PR07–09, PR22/21 |
| **M7** | Enterprise Portal | P03, PR24, SC-EN-* |
| **M8** | Payments & settlements | PR10, PR11, PR14, SC-FI-* |
| **M9** | AI assist | P09, Phase 5 AI Engine |
| **M10** | Analytics & BI | P11, PR25 reporting, warehouse |

### Supporting modules (not optional forever — scheduled)

| Module | Name | When |
|--------|------|------|
| **M4a** | Dispatcher Console UI | With/just after M4 |
| **M6a** | Execution & proof (POD) | With M6 |
| **M8a** | Support Centre | Parallel late W1 |
| **M8b** | Admin Portal (min) | Early W1 (config) |
| **M8c** | Incidents & Emergency backend | With M4/M6 |
| **M11** | Fleet Dashboard | W3 |
| **M12** | Ops Dashboard | W3 |

---

## 2. Module Specs

### M0 — Platform foundation

| | |
|--|--|
| **Purpose** | Repo, environments, API skeleton, DB, event/audit table, secrets, CI, observability, object storage |
| **Complexity** | **L** |
| **Depends on** | Nothing (start) |
| **Unlocks** | Everything |
| **Done when** | Deploy to staging; health checks; audit event write path; secrets not in git |

### M1 — Authentication & identity

| | |
|--|--|
| **Purpose** | Users, OTP/session, roles, staff MFA path, device basics |
| **Complexity** | **M–L** |
| **Depends on** | M0 |
| **Unlocks** | All apps |
| **Done when** | Customer/driver/staff can sign in; session revoke; role bindings enforced on a sample API |

### M2 — Customer App

| | |
|--|--|
| **Purpose** | Mobile client for book/track/support/profile (W1 screens) |
| **Complexity** | **XL** (client + integration) |
| **Depends on** | M1, M3, M5 (track), M8 (pay), notifications |
| **Unlocks** | Demand side beachhead |
| **Done when** | Happy path + degraded track + mutation request + support entry on device |

*Note: UI shell can start after M1; full done needs M3/M5/M8.*

### M3 — Booking engine

| | |
|--|--|
| **Purpose** | Job draft→quote→confirm; pricing engine; serviceability; declarations |
| **Complexity** | **L** |
| **Depends on** | M0, M1, config (zones/tiers) from Admin min |
| **Unlocks** | M2 booking, M4 intake, M7 later |
| **Done when** | Quote components persisted; confirm creates Job + audit; illegal transitions blocked |

### M4 — Dispatch engine

| | |
|--|--|
| **Purpose** | Eligibility, assign/reassign, backup, override reason codes; queues |
| **Complexity** | **XL** |
| **Depends on** | M3, M1 (drivers), M5 (location freshness helpful), duty status |
| **Unlocks** | M6 execution, M4a console |
| **Done when** | Job can be assigned; backup path; holds respected; audit on overrides |

### M4a — Dispatcher Console

| | |
|--|--|
| **Purpose** | Desktop board: map, queues, incidents, mutations |
| **Complexity** | **L–XL** |
| **Depends on** | M4, M5, M8c |
| **Done when** | Dispatcher can run a shift without WhatsApp as system of record |

### M5 — GPS / tracking

| | |
|--|--|
| **Purpose** | Ingest, session, freshness/lost/conflicted, customer-safe projections |
| **Complexity** | **L–XL** |
| **Depends on** | M0, M3 (job), M6 producer |
| **Unlocks** | Honest track UX; dispatch lost-signal tasks |
| **Done when** | PR23 states work; no fake motion on LOST; Dispatch alert on lost custody |

### M6 — Driver App

| | |
|--|--|
| **Purpose** | Duty, jobs, nav handoff, exceptions, **Emergency**, mutation accept, earnings read |
| **Complexity** | **XL** |
| **Depends on** | M1, M4, M5, M6a, M8 (earnings), M8c |
| **Done when** | Complete pickup→POD; failed attempt; Emergency medical path; offline banner |

### M6a — Execution & proof

| | |
|--|--|
| **Purpose** | Pickup/dropoff verification; POD artefacts; fail reasons |
| **Complexity** | **L** |
| **Depends on** | M3, object storage (M0) |
| **Done when** | Cannot `DELIVERED` without sufficient proof |

### M7 — Enterprise Portal

| | |
|--|--|
| **Purpose** | Org lifecycle UI, multi-user book/monitor, invoices view, API settings |
| **Complexity** | **XL** |
| **Depends on** | M1, M3, M5, M8, PR24 backend |
| **Done when** | Pilot org can book, approve (if enabled), track, see invoice |

### M8 — Payments & settlements

| | |
|--|--|
| **Purpose** | PSP charges, webhooks, refunds/credits, earning lines, payout batches |
| **Complexity** | **XL** |
| **Depends on** | M0, M3; PSP account |
| **Unlocks** | Real money; driver pay; enterprise invoice |
| **Done when** | Pay-on-confirm; idempotent webhooks; payout batch with freeze hooks; no PAN stored |

### M8a — Support Centre

| | |
|--|--|
| **Purpose** | Cases linked to jobs; credits; claims intake; escalation |
| **Complexity** | **L** |
| **Depends on** | M1, M3, M8 (credits) |
| **Done when** | Agent can resolve with timeline truth |

### M8b — Admin Portal (minimum)

| | |
|--|--|
| **Purpose** | Flags, zones, reason codes, staff roles, audit search |
| **Complexity** | **L** |
| **Depends on** | M0, M1 |
| **Done when** | City can be configured without code deploy for common toggles |

### M8c — Incidents & Emergency backend

| | |
|--|--|
| **Purpose** | Incident entities, holds, paging hooks, Emergency API |
| **Complexity** | **M–L** |
| **Depends on** | M0, M3, M4 |
| **Done when** | WC-01/WC-02 states enforceable in data + notify path |

### M9 — AI assist

| | |
|--|--|
| **Purpose** | Suggestions for dispatch/ops; explain + accept/reject |
| **Complexity** | **XL** (data+eval) |
| **Depends on** | Mature event history from M3–M6, M4a |
| **Done when** | Suggest-only in console; never silent mutate; audited decisions |

### M10 — Analytics & BI

| | |
|--|--|
| **Purpose** | ETL/warehouse, governed metrics, exec boards |
| **Complexity** | **L–XL** |
| **Depends on** | Stable events from W1 modules |
| **Done when** | Promise KPIs with as-of; no OLTP hammering |

### M11 / M12 — Fleet & Ops dashboards

| | Complexity | Depends |
|--|------------|---------|
| Fleet | **L** | M1 drivers/fleet, M6, M8 |
| Ops | **L** | M10 projections or OLTP aggregates |

---

## 3. Dependency Graph

```text
M0 Platform
 └── M1 Auth
      ├── M8b Admin (min) ──────────────┐
      ├── M3 Booking/Pricing <───────────┤
      │     ├── M8 Payments/Settlements  │
      │     ├── M8c Incidents            │
      │     ├── M4 Dispatch ─────────────┤
      │     │     ├── M4a Dispatcher UI  │
      │     │     └── M6 Driver App <── M5 Tracking
      │     │            └── M6a Proof   │
      │     ├── M2 Customer App <────────┘
      │     └── M8a Support
      ├── M7 Enterprise (after M3+M5+M8 solid)
      ├── M11 Fleet (W3)
      ├── M12 Ops (W3)
      ├── M9 AI (W4)
      └── M10 Analytics (W4; thin ops metrics earlier OK)
```

---

## 4. Recommended Implementation Order

### Phase A — Foundation (must be first)

1. **M0** Platform  
2. **M1** Auth  
3. **M8b** Admin min (zones, flags, reason codes, roles)  

### Phase B — Spine (promise path)

4. **M3** Booking + pricing  
5. **M8** Payments (pay-on-confirm path) — *can stub PSP in staging first, but design for real*  
6. **M8c** Incidents/holds/Emergency API  
7. **M4** Dispatch engine  
8. **M5** Tracking ingest + integrity  
9. **M6a** Proof/POD  
10. **M6** Driver App  
11. **M4a** Dispatcher Console  
12. **M2** Customer App (complete integration)  
13. **M8a** Support Centre  

**Beachhead internal dogfood gate:** founders/ops run scripted jobs end-to-end with Emergency + lost-signal drills.

**Beachhead UX insert (approved 2026-07-23):** **M5b Maps Experience** — live customer map + driver auto-nav (`28_MAPS_EXPERIENCE_DESIGN.md`). Ships before Phase C money depth.

### Phase C — Money & B2B depth (W2)

14. Harden **M8** settlements/payouts/invoices  
15. **M7** Enterprise Portal (+ PR24 APIs)  
16. Audit packs (**PR25** assembly) in Admin · Finance Dashboard depth (`38_WAVE2_FINANCE_DESIGN.md`)  

**Gate:** Wave 2 Finance fully complete before any e-hailing design deep-dive.

### Phase C+ — E-hailing (parked · design after Finance)

- **Wave E** people mobility — parked brief `39_WAVE_EHAILING_PARKED.md`  
- **No coding** until Wave E design is written and **APPROVED TO BUILD**  
- Do not bend the parcel job spine while Finance is open  

### Phase D — Supply & ops maturity (W3)

17. **M11** Fleet Dashboard  
18. **M12** Ops Dashboard  

### Phase E — Intelligence (W4)

19. **M10** Analytics/BI (governed)  
20. **M9** AI assist  

---

## 5. Mapping to Original “10 Modules”

| Brief module | Atlas order recommendation | Complexity |
|--------------|----------------------------|------------|
| 1 Authentication | **#2** (after M0) | M–L |
| 2 Customer App | **#12** (shell earlier OK) | XL |
| 3 Booking Engine | **#4** | L |
| 4 Dispatch Engine | **#7** | XL |
| 5 GPS Tracking | **#8** | L–XL |
| 6 Driver App | **#10** | XL |
| 7 Enterprise Portal | **#15** | XL |
| 8 Payments | **#5** (charge path early; payouts deepen later) | XL |
| 9 AI | **#20 last** | XL |
| 10 Analytics | **#19** (after data exists) | L–XL |

**Critical path insight:** Customer App is not first. **Auth → Booking → Pay → Dispatch → Track → Driver → Dispatch UI → Customer** is the trust chain.

---

## 6. Parallelisation (small team)

| If team of… | Parallel tracks |
|-------------|-----------------|
| **1 (founder + later hire)** | Strict serial A→B; no M7/M9 |
| **2 (Tech Lead + you)** | Track 1 backend spine; Track 2 Admin + Customer shell |
| **3 (+ Designer)** | Designer runs Phase 8/9 mockups ahead of M2/M6; eng on spine |
| **5 (recommended hire set)** | Ops defines drills; Tech Lead spine; Designer apps; you Atlas/QA gates |

Never parallelise M9/M10 with unfinished M4/M5.

---

## 7. Definition of Done — Wave 1 Release Candidate

Wave 1 RC requires **all** of:

- [ ] OTP auth customer + driver + staff MFA for admin/dispatch  
- [ ] Book → pay → assign → pickup proof → deliver POD → earnings line  
- [ ] Degraded/lost tracking honest UX  
- [ ] Emergency medical path + incident hold + customer pause copy  
- [ ] Destination mutation with reprice + driver accept  
- [ ] Backup allocation with custody handoff  
- [ ] Support case linked to job + ruled credit  
- [ ] Audit events on transitions/overrides/money  
- [ ] No PAN storage; PSP webhooks idempotent  
- [ ] Admin: zones, flags, reason codes  
- [ ] Scripted drills: WC-01, WC-02 (tabletop), WC-03, lost signal  

Until then: **no public “live city” claims.**

---

## 8. Risk Register (Build)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Underestimating Dispatch+Tracking | Timeline slip | Keep XL buffer; cut Enterprise first |
| PSP/KYC delays | Blocked money | Start PSP onboarding during M0 |
| Scope creep from M7/M9 | Broken W1 | Phase 10 order is gated |
| Solo founder burnout | Quality drop | Hire Tech Lead before M4/M6 peak |
| Skipping audit “to go faster” | Unrecoverable trust debt | Done definition includes audit |
| Maps/SMS vendor flakiness | UX pain | Degraded modes already specified — implement them |

---

## 9. Assumptions

| # | Assumption |
|---|------------|
| RM-A1 | Modular monolith per Phase 5 |
| RM-A2 | Cross-platform mobile |
| RM-A3 | One beachhead city first |
| RM-A4 | Complexity scores assume competent Tech Lead availability |
| RM-A5 | Calendar dates set only after hiring + PSP + beachhead geography locked |
| RM-A6 | No Bitcoin/COD in Wave 1 |

---

## 10. Decisions Log (Phase 10)

| ID | Decision |
|----|----------|
| RM-D1 | Add M0 foundation before Auth |
| RM-D2 | Official order: Foundation → Spine → W2 Enterprise/Finance depth → W3 Fleet/Ops → W4 AI/Analytics |
| RM-D3 | Customer App completes after Driver+Dispatch+Track path exists |
| RM-D4 | Payments charge path early; payout sophistication can trail slightly but freezes required with incidents |
| RM-D5 | AI and BI last among the ten |
| RM-D6 | Wave 1 RC checklist is the release gate — not “feature count” |
| RM-D7 | Supporting modules M4a/M6a/M8a/M8b/M8c are mandatory for promise, not optional polish |

---

## 11. What Happens After Phase 10 Approval

Architecture programme **baseline complete**. Next workstreams (outside this gated phase doc):

1. Lock beachhead city/country  
2. Hire per “first 5” guidance (Ops + Tech Lead first)  
3. Choose concrete stack/vendors in Tech Stack handbook (cloud, PSP, maps, SMS)  
4. Open implementation backlog from M0  
5. Design tooling mockups from Phase 8–9  
6. **Still:** no skipping Atlas when coding  

---

## 12. Approval Checklist

- [ ] Module catalogue + complexities accepted  
- [ ] Implementation order accepted  
- [ ] Wave 1 RC checklist accepted as release gate  
- [ ] AI/Analytics deferred to W4 accepted  
- [ ] Assumptions RM-A1–RM-A6 accepted or amended  

**Approval response options:**  
`APPROVE PHASE 10` · `APPROVE PHASE 10 WITH AMENDMENTS: …` · `REVISE: …`

On approval: **Project Atlas architecture Phases 1–10 are complete as baseline.**
