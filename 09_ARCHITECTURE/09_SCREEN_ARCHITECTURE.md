# Phase 9 — Screen Architecture

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED  
**Approved:** 2026-07-20  
**Depends on:** Phases 1–7 approved · Phase 8 (**APPROVED** 2026-07-20)  
**Phase gate:** Phase 9 locked as baseline. Amendments require explicit revision. Phase 10 unlocked.

---

## 0. Executive Position

Phase 8 defined the design system. Phase 9 inventories **every Wave-relevant screen**: purpose, primary user, key actions, and critical states. This is an information architecture of screens—not pixel mockups and not code.

### Board challenges

| Temptation | Verdict | Why |
|------------|---------|-----|
| Hundreds of speculative screens before Wave 1 | **Reject** | Dilutes craft |
| Missing Emergency / hold / mutation screens | **Reject** | 4B becomes fiction |
| Same layout copy-pasted across roles | **Reject** | Overwhelms drivers; under-powers dispatch |
| **Wave-tagged screen catalogue; purpose-first; critical states named** | **Adopt** | Buildable honesty |

### Screen thesis

> Every screen has **one job**.  
> If it needs a manual, it fails SWIFT.  
> Critical states (hold, degraded tracking, Emergency, mutation) are first-class screens/flows—not afterthoughts.

### Legend

| Tag | Meaning |
|-----|---------|
| **W1** | Required for Wave 1 beachhead promise |
| **W2** | Enterprise / finance depth |
| **W3** | Fleet / ops maturity |
| **W4** | AI / BI maturity |
| **P** | Pattern (sheet/modal) reused |

IDs: `SC-{Product}-{###}`

---

## 1. Customer App (P01)

**Users:** U01 Customer, Recipient mode  
**Nav (W1):** Home · Activity · Support · Profile

| ID | Screen | Wave | Purpose |
|----|--------|------|---------|
| SC-CU-001 | Splash / Session restore | W1 | Brand calm entry; route to auth or home |
| SC-CU-002 | Welcome / Sign in | W1 | Start auth (OTP) with minimal friction |
| SC-CU-003 | OTP verify | W1 | Confirm identity |
| SC-CU-004 | Home | W1 | Primary CTA: Send a delivery; show active job card if any |
| SC-CU-005 | New delivery — route | W1 | Capture pickup & dropoff |
| SC-CU-006 | New delivery — package | W1 | Size/class, prohibited goods declaration |
| SC-CU-007 | New delivery — schedule | W1 | ASAP / window / tier |
| SC-CU-008 | Quote review | W1 | Itemised calm price; confirm intent |
| SC-CU-009 | Payment method | W1 | Pay via PSP; no PAN display beyond masked |
| SC-CU-010 | Booking confirmed | W1 | Truthful next step; tracking entry |
| SC-CU-011 | Track delivery | W1 | Live/degraded status; ETA confidence; timeline |
| SC-CU-012 | Tracking degraded / paused | W1 | Honest last-known; hold copy (no fake motion) |
| SC-CU-013 | Delivery completed | W1 | POD summary; rate prompt |
| SC-CU-014 | Failed attempt — next action | W1 | Reattempt / instructions / support |
| SC-CU-015 | Change destination request | W1 | PR20 mutation; show price delta |
| SC-CU-016 | Mutation pending / result | W1 | Waiting on driver/dispatch; outcome |
| SC-CU-017 | Cancel delivery | W1 | Policy clarity; confirm |
| SC-CU-018 | Activity list | W1 | Past/active jobs |
| SC-CU-019 | Job detail (history) | W1 | Timeline + receipts entry |
| SC-CU-020 | Addresses | W1 | Saved address book |
| SC-CU-021 | Support hub | W1 | Help + open case with job context |
| SC-CU-022 | Support case thread | W1 | Message status; expectations |
| SC-CU-023 | Profile & settings | W1 | Account, notifications, legal |
| SC-CU-024 | Recipient inbound view | W1 | Track inbound; access notes (bounded) |
| SC-CU-025 | Rate delivery | W1 | Score + tags |
| SC-CU-026 | Notifications inbox | W2 | Durable messages if push missed |

**Critical states to design:** payment failed · quote expired · unserviceable zone · incident hold · security-limited copy.

---

## 2. Driver App (P02)

**Users:** U03 Driver  
**Nav (W1):** Duty/Jobs · Earnings · Support · Profile · **Emergency always reachable on custody**

| ID | Screen | Wave | Purpose |
|----|--------|------|---------|
| SC-DR-001 | Sign in / OTP | W1 | Driver auth |
| SC-DR-002 | Onboarding checklist | W1 | Docs upload status; blockers clear |
| SC-DR-003 | Document capture | W1 | Licence/vehicle uploads |
| SC-DR-004 | Waiting for approval | W1 | Calm pending state |
| SC-DR-005 | Home — off duty | W1 | Go on duty CTA |
| SC-DR-006 | Home — on duty idle | W1 | Waiting for assignment; readiness |
| SC-DR-007 | Job offer / assigned job | W1 | Accept/ack; earnings preview; navigate |
| SC-DR-008 | Navigate to pickup | W1 | Map + contact shipper |
| SC-DR-009 | Arrived pickup | W1 | Verification entry |
| SC-DR-010 | Pickup verification | W1 | Proof steps by tier |
| SC-DR-011 | In transit | W1 | Next stop; contact; exception entry |
| SC-DR-012 | Arrived dropoff | W1 | POD entry |
| SC-DR-013 | Delivery confirmation / POD | W1 | Capture proof; complete |
| SC-DR-014 | Failed attempt | W1 | Reason codes + evidence |
| SC-DR-015 | Exception declare | W1 | Access, contact, refuse goods, etc. |
| SC-DR-016 | **Emergency hub** | W1 | Medical / Threat / Accident / Assault — one thumb |
| SC-DR-017 | Emergency active | W1 | Confirm help path; location sharing; no punish UX |
| SC-DR-018 | Destination change request | W1 | Accept/decline mutation + earnings delta |
| SC-DR-019 | Backup handoff | W1 | Custody verify transfer |
| SC-DR-020 | Earnings home | W1 | Period summary |
| SC-DR-021 | Earnings job detail | W1 | Transparent calculation |
| SC-DR-022 | Job history | W1 | Past jobs |
| SC-DR-023 | Support | W1 | Driver help |
| SC-DR-024 | Profile / vehicle / docs | W1 | Eligibility status |
| SC-DR-025 | Offline / signal degraded banner+sheet | W1 | What to do; queued actions |

**Critical states:** offline with custody · medical hold · threat freeze · payout frozen notice.

---

## 3. Enterprise Portal (P03)

**Users:** U02 (Booker, Approver, Org Admin, Viewer), U10 limited  
**Nav (W2 core; pilot subset W1 if needed):** Overview · Shipments · Directory · Billing · Users · Settings · Support

| ID | Screen | Wave | Purpose |
|----|--------|------|---------|
| SC-EN-001 | Login | W2 | Auth |
| SC-EN-002 | Org switcher / home overview | W2 | Volume health; CTAs |
| SC-EN-003 | Create shipment | W2 | Booking wizard (mirrors customer rules) |
| SC-EN-004 | Approval queue | W2 | Approver decisions |
| SC-EN-005 | Shipments list | W2 | Filter by state/site |
| SC-EN-006 | Shipment detail / track | W2 | Timeline; collaborate on exceptions |
| SC-EN-007 | Mutation request | W2 | Change destination with commercial delta |
| SC-EN-008 | Sites & addresses | W2 | Location book |
| SC-EN-009 | Users & roles | W2 | Invites; Org Admin |
| SC-EN-010 | Billing & invoices | W2 | Statements; download |
| SC-EN-011 | Invoice detail | W2 | Line reconciliation |
| SC-EN-012 | Contract / SLA view (read) | W2 | What was promised |
| SC-EN-013 | API / integration settings | W2 | Keys (masked); webhooks |
| SC-EN-014 | Support | W2 | Enterprise case entry |
| SC-EN-015 | Pilot dashboard | W2 | Success metrics vs criteria |
| SC-EN-016 | Notifications preferences | W2 | Distribution lists |

---

## 4. Dispatcher Console (P04)

**Users:** U05  
**Layout:** Map + queues + detail drawer (desktop-class)

| ID | Screen | Wave | Purpose |
|----|--------|------|---------|
| SC-DI-001 | Login (MFA) | W1 | Staff auth |
| SC-DI-002 | Dispatch board | W1 | Live map + unassigned/at-risk queues |
| SC-DI-003 | Job detail drawer | W1 | Timeline, contacts, actions |
| SC-DI-004 | Assign / reassign | W1 | Eligible drivers; reason on override |
| SC-DI-005 | Backup allocation | W1 | PR18 prioritised recovery |
| SC-DI-006 | Exception queue | W1 | Failed attempts, contact issues |
| SC-DI-007 | Mutation approval queue | W1 | PR20 feasibility |
| SC-DI-008 | Incident board | W1 | Holds; S2/S1 entries |
| SC-DI-009 | Incident detail | W1 | Linked jobs; actions; comms log |
| SC-DI-010 | Driver panel | W1 | Duty, eligibility, active jobs |
| SC-DI-011 | Lost-signal tasks | W1 | PR23 recovery list |
| SC-DI-012 | Shift handover notes | W1 | Open risks |
| SC-DI-013 | AI suggestions panel | W4 | Suggest-only; accept/reject |

---

## 5. Operations Dashboard (P05)

**Users:** U06

| ID | Screen | Wave | Purpose |
|----|--------|------|---------|
| SC-OP-001 | Ops home KPIs | W3 | Promise metrics; as-of stamp |
| SC-OP-002 | Zone / city health | W3 | Coverage vs demand |
| SC-OP-003 | Exception trends | W3 | Repeat failure causes |
| SC-OP-004 | Incident review | W3 | Post-incident list |
| SC-OP-005 | Capacity planner view | W3 | Supply posture |
| SC-OP-006 | Launch readiness checklist | W3 | City gate status |

---

## 6. Finance Dashboard (P06)

**Users:** U08

| ID | Screen | Wave | Purpose |
|----|--------|------|---------|
| SC-FI-001 | Finance home | W2 | Attention queues (failed pays, disputes) |
| SC-FI-002 | Job commercial ledger | W2 | Job ↔ charge ↔ earning |
| SC-FI-003 | Payments list | W2 | PSP statuses |
| SC-FI-004 | Invoices list | W2 | Enterprise invoicing |
| SC-FI-005 | Invoice builder / detail | W2 | Lines; send; credit notes |
| SC-FI-006 | Payout batches | W2 | Create/run/settle |
| SC-FI-007 | Payout batch detail | W2 | Per driver/fleet items; freezes |
| SC-FI-008 | Adjustments / credits queue | W2 | Approve above threshold |
| SC-FI-009 | Claims finance view | W2 | Outcomes ↔ ledger |
| SC-FI-010 | Reconciliation | W2 | Unreconciled aging |
| SC-FI-011 | Exports | W2 | Accounting export |

---

## 7. Fleet Dashboard (P07)

**Users:** U04

| ID | Screen | Wave | Purpose |
|----|--------|------|---------|
| SC-FL-001 | Fleet home | W3 | Compliance + today’s capacity |
| SC-FL-002 | Drivers roster | W3 | Status; invite |
| SC-FL-003 | Driver detail | W3 | Docs; performance summary |
| SC-FL-004 | Vehicles | W3 | Class; insurance; photos |
| SC-FL-005 | Jobs visibility | W3 | Fleet’s jobs (no cross-fleet) |
| SC-FL-006 | Earnings / statements | W3 | Fleet payouts |
| SC-FL-007 | Document expiry alerts | W3 | Compliance risk |

---

## 8. Admin Portal (P08)

**Users:** U09 (and founder-as-admin)

| ID | Screen | Wave | Purpose |
|----|--------|------|---------|
| SC-AD-001 | Admin home | W1 | Config health; alerts |
| SC-AD-002 | Staff users & roles | W1 | Joiner/leaver; MFA status |
| SC-AD-003 | Feature flags | W1 | COD off; city toggles |
| SC-AD-004 | Zones / serviceability | W1 | Map polygons / zones |
| SC-AD-005 | Service types & tiers | W1 | Catalogue |
| SC-AD-006 | Reason codes catalogue | W1 | Including 4B codes |
| SC-AD-007 | Pricing parameters | W1 | Floors; components (governed) |
| SC-AD-008 | Prohibited goods policy | W1 | Declarations list |
| SC-AD-009 | Notification templates | W1 | Versioned copy |
| SC-AD-010 | Org accounts admin | W2 | Enterprise lifecycle controls |
| SC-AD-011 | Audit search | W1 | PR25 queries |
| SC-AD-012 | Audit pack request | W2 | Generate evidence packs |
| SC-AD-013 | Break-glass console | W1 | Time-bound; heavily warned |
| SC-AD-014 | API keys (platform) | W2 | Enterprise integration admin |

---

## 9. Support Centre (P10)

**Users:** U07

| ID | Screen | Wave | Purpose |
|----|--------|------|---------|
| SC-SU-001 | Case inbox | W1 | Queue by channel/SLA |
| SC-SU-002 | Case detail | W1 | Thread + linked job truth |
| SC-SU-003 | Job timeline pane | W1 | Read-only spine + evidence |
| SC-SU-004 | Credit / refund action | W1 | Authority matrix UI |
| SC-SU-005 | Open claim | W1 | PR15 intake |
| SC-SU-006 | Escalate to dispatch/ops | W1 | Structured handoff |
| SC-SU-007 | Knowledge snippets | W1 | Macros aligned to voice |
| SC-SU-008 | Customer / driver profile pane | W1 | Scoped PII |
| SC-SU-009 | QA review (later) | W3 | Quality sampling |

---

## 10. AI Operations Centre (P09)

| ID | Screen | Wave | Purpose |
|----|--------|------|---------|
| SC-AI-001 | Suggestions inbox | W4 | Ranked assists |
| SC-AI-002 | Suggestion detail | W4 | Explanation; accept/reject audit |
| SC-AI-003 | Model health (basic) | W4 | Drift/eval placeholders |

*Wave 1–3: embed lightweight suggestions inside Dispatch (SC-DI-013) rather than full centre.*

---

## 11. Business Intelligence (P11)

| ID | Screen | Wave | Purpose |
|----|--------|------|---------|
| SC-BI-001 | Executive promise board | W4 | On-time, trust proxies, as-of |
| SC-BI-002 | Demand / retention | W4 | Cohorts |
| SC-BI-003 | Supply health | W4 | Drivers/fleets |
| SC-BI-004 | Enterprise account health | W4 | Logo performance |
| SC-BI-005 | Finance summary | W4 | Margin classes (careful access) |
| SC-BI-006 | Metric dictionary | W4 | Governed definitions (PR25) |

---

## 12. Cross-Cutting Patterns (P)

| ID | Pattern | Purpose |
|----|---------|---------|
| SC-P-001 | Confirm dialog | Irreversible actions |
| SC-P-002 | Reason code picker | Overrides, failures |
| SC-P-003 | Evidence capture | Photo/signature/OTP |
| SC-P-004 | Honest status banner | Holds, degraded, delayed |
| SC-P-005 | Price delta sheet | Mutations / fees |
| SC-P-006 | Empty state | Next action teaching |
| SC-P-007 | Permission denied | Calm, not accusatory |
| SC-P-008 | MFA challenge | Staff step-up |

---

## 13. Screen → Process Map (selected)

| Screens | Processes |
|---------|-----------|
| SC-CU-005–010 | PR03, PR04, PR10 |
| SC-CU-011–012, SC-DI-011 | PR23 |
| SC-DR-008–014 | PR07–PR09, PR08, PR16 |
| SC-DR-016–017 | PR22, PR21, PR19 |
| SC-CU-015–016, SC-DR-018, SC-DI-007 | PR20 |
| SC-DI-004–005 | PR05, PR18 |
| SC-SU-* | PR13–PR15 |
| SC-FI-* | PR10, PR11, PR14 |
| SC-AD-011–012 | PR25 |
| SC-EN-009–015 | PR24 |

---

## 14. Wave Screen Counts (approx)

| Wave | Focus | Approx screens |
|------|-------|----------------|
| W1 | Customer, Driver, Dispatch, Admin min, Support min | ~70 |
| W2 | Enterprise, Finance deepen | +25 |
| W3 | Fleet, Ops | +15 |
| W4 | AI, BI | +10 |

Counts are directional for planning—not vanity.

---

## 15. Decisions Log (Phase 9)

| ID | Decision |
|----|----------|
| SCR-D1 | Purpose-first catalogue with wave tags |
| SCR-D2 | Emergency, degraded tracking, mutation, incident boards are W1-mandatory where listed |
| SCR-D3 | AI Centre deferred as standalone; suggestions may embed in Dispatch earlier |
| SCR-D4 | Recipient uses Customer App mode, not separate app screenset |
| SCR-D5 | Dispatch is desktop-class split view |
| SCR-D6 | Finance irreversible actions always use confirm + reason patterns |
| SCR-D7 | Phase 9 does not invent screens that contradict Phase 8 density rules |

---

## 16. Risks

| Risk | Mitigation |
|------|------------|
| Scope creep adding W4 screens into W1 | Wave tags enforced in Phase 10 |
| Designer skips degraded/Emergency | Gate mockups against SC-DR-016/017 & SC-CU-012 |
| Enterprise portal before dispatch works | Sequencing: W1 control plane first |
| Screen list treated as pixel-perfect | Reminder: purpose IA only |

---

## 17. Assumptions

| # | Assumption |
|---|------------|
| SCR-A1 | Cross-platform mobile; web for control products |
| SCR-A2 | W1 may ship Enterprise as thin pilot later in wave if SMB-first |
| SCR-A3 | Contact-centre softphone UI may be vendor-embedded beside Support Centre |
| SCR-A4 | Exact visual mockups follow in design tooling after approval |
| SCR-A5 | Solo founder may use Admin+Dispatch heavily until hires |

---

## 18. Out of Scope

- Figma pixels · component code · copy finalisation in all languages · Phase 10 estimates  

---

## 19. Approval Checklist

- [ ] Product screen catalogues accepted for CU/DR/EN/DI/OP/FI/FL/AD/SU/AI/BI  
- [ ] W1 critical screens (Emergency, holds, degraded track, mutation) accepted  
- [ ] Wave tagging accepted as build boundary  
- [ ] Assumptions SCR-A1–SCR-A5 accepted or amended  
- [ ] Ready to open Phase 10 — Development Roadmap  

**Approval response options:**  
`APPROVE PHASE 9` · `APPROVE PHASE 9 WITH AMENDMENTS: …` · `REVISE: …`
