# Phase 4 — Process Architecture

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED (with 4B + 4C)  
**Approved:** 2026-07-20  
**Depends on:** Phase 1 (**APPROVED** 2026-07-16) · Phase 2 (**APPROVED** 2026-07-20) · Phase 3 (**APPROVED** 2026-07-20)  
**Companions (approved together):** `04B_WORST_CASE_SCENARIOS.md` · `04C_PROCESS_COMPLETENESS.md`  
**Phase gate:** Phase 4 family locked as baseline. Phase 5 unlocked.

---

## 0. Executive Position

Phases 1–3 defined the business model, products, and people. Phase 4 defines **how work flows**—the operational processes that make *Every Delivery. Every Time. Done Right.* true under pressure.

### Board challenges

| Temptation | Verdict | Why |
|------------|---------|-----|
| Happy-path only SOPs | **Reject** | Logistics is an exception business |
| WhatsApp as the real process | **Reject** | Destroys audit, SLA, and brand truth |
| Perfect optimisation before reliable assignment | **Reject** | Route theatre without control is vanity |
| Separate process truth per product | **Reject** | Phase 2 spine forbids it |
| **Explicit processes, owners, states, SLAs, exception forks** | **Adopt** | Trainable, auditable, automatable later |

### Process architecture thesis

> A process is a **named sequence of responsibilities** that moves a business object through lawful states.  
> Software encodes process; it does not invent it.  
> Every process has a **primary owner**, **entry criteria**, **exit criteria**, and **exception paths**.  
> **Happy path alone is invalid architecture.** Worst-case playbooks in `04B` are part of Phase 4.

### Notation used in this phase

| Element | Meaning |
|---------|---------|
| **Trigger** | What starts the process |
| **Actors** | Roles from Phase 3 |
| **Object** | Primary business record (Job, Case, Payout, …) |
| **Steps** | Ordered actions |
| **States** | Job/case states touched (align Phase 1 §8) |
| **SLA class** | Time expectation class (calibrated later) |
| **Systems** | Product surfaces involved (Phase 2) — not tech stack |

---

## 1. Process Catalogue

| ID | Process | Primary owner | Object |
|----|---------|---------------|--------|
| PR01 | Customer registration | Customer (+ Support/Admin assist) | User / Org (SMB) |
| PR02 | Driver onboarding | Ops / Fleet + Admin | Driver + Vehicle |
| PR03 | Booking | Customer / Enterprise | Job |
| PR04 | Pricing | Platform rules (Commercial/Admin) | Quote |
| PR05 | Dispatch & assignment | Dispatcher | Job + Assignment |
| PR06 | Route optimisation | Dispatcher + platform assist | Assignment / Route plan |
| PR07 | Pickup | Driver | Job |
| PR08 | Verification (pickup & dropoff) | Driver (+ tier rules) | Proof artefacts |
| PR09 | Delivery | Driver | Job |
| PR10 | Payment (customer charge) | Finance capability + Customer/Enterprise | Payment |
| PR11 | Settlement (driver/fleet payout) | Finance Officer | Payout |
| PR12 | Ratings | Customer / Driver (asymmetric) | Rating |
| PR13 | Customer support | Support Agent | Case |
| PR14 | Refunds & credits | Support + Finance | Adjustment |
| PR15 | Claims | Support + Finance (+ insurer) | Claim |
| PR16 | Failed deliveries | Driver + Dispatcher + Customer | Job |
| PR17 | Vehicle breakdown | Driver + Dispatcher | Incident + Job(s) |
| PR18 | Backup driver allocation | Dispatcher | Assignment |
| PR19 | Incident management | Ops Manager (+ severity path) | Incident |
| **PR20** | Mid-job mutation (destination/recipient/cancel-after-pickup) | Dispatcher + Support + paying authority | Job |
| **PR21** | Dangerous goods / security threat response | Driver + Dispatcher + Ops + authorities | Job + Incident |
| **PR22** | Driver incapacity / medical emergency mid-job | Driver + Dispatcher + Ops | Incident + Job(s) |
| **PR23** | In-transit tracking & signal integrity | Dispatcher (+ platform tracking) | Tracking session |
| **PR24** | Enterprise account lifecycle | Sales + Admin + Ops + Finance | Organisation |
| **PR25** | Reporting & audit operations | Admin + Finance + Ops (+ Compliance) | Reports / audit packs |

> **PR20–PR22** → `04B_WORST_CASE_SCENARIOS.md`  
> **PR23–PR25** → `04C_PROCESS_COMPLETENESS.md`

---

## 2. End-to-End Master Flow

```text
Register (PR01/PR02)
    → Book (PR03) → Price (PR04) → Confirm
        → Pay auth/capture rules (PR10)
            → Dispatch (PR05) → Route assist (PR06)
                → Pickup + Verify (PR07/PR08)
                    → Transit → Deliver + Verify (PR09/PR08)
                        → Complete → Settle (PR11) → Rate (PR12)
                              ↘ exceptions: PR16 / PR17 / PR18 / PR19
                              ↘ trust recovery: PR13 → PR14 / PR15
```

---

## 3. PR01 — Customer Registration

**Intent:** Create a trusted, usable shipper identity with minimal friction.

| | |
|--|--|
| **Trigger** | User opens Customer App / invited to SMB org |
| **Actors** | Customer; Support (assist); Admin (fraud/lock) |
| **Entry** | Valid phone/email channel available |
| **Exit** | Account active; can create Draft job (KYC depth by risk tier) |

**Steps**
1. Capture contact + auth (OTP / passwordless preferred direction)  
2. Accept terms (versioned)  
3. Profile basics (name; optional business name)  
4. Risk checks (device/velocity — detail Phase 7)  
5. Optional: add address book, payment method  
6. Activation → first-job nudge  

**Exceptions**
- OTP failure → retry / Support  
- Suspected fraud → hold + Admin review  
- Enterprise users → do **not** use this as full enterprise onboarding (see Enterprise join under PR03 companion)

**SLA class:** Activation in minutes for standard consumer/SMB.

---

## 4. PR02 — Driver Onboarding

**Intent:** Only eligible, safe, brand-fit drivers reach duty status.

| | |
|--|--|
| **Trigger** | Application via Driver App / fleet invite |
| **Actors** | Driver; Fleet Manager (if fleet); Ops; Admin |
| **Entry** | Application started in serviceable city |
| **Exit** | `ELIGIBLE` + can go on duty (or rejected with reason class) |

**Steps**
1. Application intake (identity, contacts, city)  
2. Document upload (ID, licence, vehicle docs, insurance as required)  
3. Vehicle profile (class, plate, photos)  
4. Automated validation + manual review queue  
5. Background / compliance checks per jurisdiction  
6. Standards acknowledgment (SOP, conduct, safety)  
7. Brief practical orientation (minimal, visual)  
8. Activate eligibility → first-job supervision rules optional  

**Exceptions**
- Expired/invalid docs → return to driver with checklist  
- Fail checks → reject or time-boxed reapply  
- Fleet-employed → Fleet Manager completes org linkage; platform still enforces eligibility  

**SLA class:** Review within published onboarding window (city-specific).

---

## 5. PR03 — Booking

**Intent:** Capture a complete, serviceable job intent.

| | |
|--|--|
| **Trigger** | Customer/Enterprise creates job |
| **Actors** | Customer; Enterprise Booker/Approver; platform |
| **Object** | Job (`DRAFT` → `QUOTED` → `CONFIRMED` / `SCHEDULED`) |
| **Exit** | Confirmed job ready for payment rules + dispatch |

**Steps**
1. Select service type / tier  
2. Enter pickup & dropoff (map + address text)  
3. Package attributes (size/weight/handling class)  
4. Contact details for pickup & recipient  
5. Time window / ASAP  
6. Restricted-goods declaration  
7. Optional: insurance declare-value (PR15 readiness)  
8. Submit → Pricing (PR04)  
9. Enterprise: approval gate if required  
10. Confirm → state `CONFIRMED` / `SCHEDULED`  

**Exceptions**
- Unserviceable zone → block with alternative guidance  
- Low geocode confidence → verification step before confirm  
- Restricted goods → block or special handling path  
- Quote expired → reprice  

**Business rules link:** Phase 1 §9.1.

---

## 6. PR04 — Pricing

**Intent:** Produce transparent, governed prices—not the cheapest guess.

| | |
|--|--|
| **Trigger** | Booking ready for quote; or contract rate card lookup |
| **Actors** | Platform pricing capability; Admin (config); Sales (propose exceptions via authority) |
| **Object** | Quote (+ components) |
| **Exit** | Shown quote with TTL; or contract price locked on confirm |

**Steps**
1. Resolve zone/distance/time components  
2. Apply package/handling/priority components  
3. Apply enterprise contract adjustments if any  
4. Apply taxes as configured  
5. Enforce floor / authority matrix  
6. Present itemised quote (customer-calm summary + detail available)  
7. Lock quote on confirm; store components for Finance  

**Exceptions**
- Below-floor request → reject or route to approver  
- Map/distance failure → manual estimate class (Ops) — rare, audited  
- Promo codes → acquisition-funded, not silent margin destruction  

**Non-goal:** Dynamic surge that feels predatory. Surge posture, if any, must be explained and Ops-governed (Phase 1 pricing philosophy).

---

## 7. PR05 — Dispatch & Assignment

**Intent:** Put the right eligible driver on the job in time—safety and promise over raw utilisation.

| | |
|--|--|
| **Trigger** | Job `CONFIRMED`/`SCHEDULED` and payment/auth rules satisfied |
| **Actors** | Dispatcher; platform dispatch engine; Driver; Fleet (visibility) |
| **Object** | Assignment  
| **Exit** | Job `ASSIGNED` (or waiting queue with honest customer status) |

**Steps**
1. Build eligible set (duty, vehicle class, compliance, geography, load limits)  
2. Rank candidates (ETA, fairness, SLA tier, skills)  
3. Auto-assign **or** dispatcher assign (city mode)  
4. Driver notified; accept/ack rules per mode  
5. On accept/ack → `ASSIGNED` → customer notified appropriately  
6. If no eligible driver → capacity exception (customer update + Ops throttle/surge playbook)  

**Exceptions**
- Driver reject/timeout → re-pool  
- Wrong vehicle class → block assign  
- Manual override → mandatory reason code  

**KPI link:** Dispatcher & Ops KPIs (Phase 3).

---

## 8. PR06 — Route Optimisation

**Intent:** Assist efficient sequencing **without** inventing impossible ETAs.

| | |
|--|--|
| **Trigger** | Assignment created; multi-stop or multi-job driver; traffic changes |
| **Actors** | Platform assist; Dispatcher (override); Driver (follow/navigate) |
| **Exit** | Ordered stop plan + ETA **confidence band** |

**Steps**
1. Collect active stops for driver  
2. Constraints: time windows, priority tier, vehicle, safety max stops  
3. Propose sequence  
4. Dispatcher may lock/reorder with reason  
5. Publish navigation intent to Driver App  
6. Recalculate on exception/breakdown/new assign  

**Board ruling**
- Wave 1: **good assignment + simple routing** beats multi-objective optimisation theatre.  
- Optimisation never overrides safety max-load or truthful status.

**Exceptions**
- Window infeasible → flag at-risk → Dispatcher + customer communication  
- AI suggestion → human confirm when policy requires (Phase 2 P-D3)

---

## 9. PR07 — Pickup

**Intent:** Lawful, evidenced transfer into driver care per SOP.

| | |
|--|--|
| **Trigger** | Driver `EN_ROUTE_PICKUP` → arrives  
| **Actors** | Driver; shipper contact; Dispatcher/Support if blocked |
| **States** | `EN_ROUTE_PICKUP` → `ARRIVED_PICKUP` → `PICKED_UP` (or fail/cancel classes) |

**Steps**
1. Navigate to pickup  
2. Mark arrived  
3. Contact shipper if needed (in-app)  
4. Run verification (PR08)  
5. Confirm package condition notes if required  
6. Mark picked up → start transit  

**Exceptions**
- Shipper unreachable → wait window → fail pickup attempt / reschedule policy  
- Wrong goods / unsafe goods → refuse with evidence + Support  
- Access issues → Dispatcher assist  

---

## 10. PR08 — Verification

**Intent:** Proof quality matched to service tier—enough trust, not bureaucracy for its own sake.

### Pickup verification (typical)
- Package count/class check  
- Photo if tier requires  
- Shipper acknowledgment (name/OTP/signature by tier)  
- Seal/ID for special handling  

### Dropoff verification / POD (typical)
- Recipient identity rule by tier  
- Signature / OTP / photo / ID check as configured  
- GPS + timestamp always for completed attempt  
- Failure evidence when not delivered  

**Rules**
- Insufficient proof → cannot quietly sit as `DELIVERED`  
- Evidence packs feed Claims (PR15) and Finance disputes  

---

## 11. PR09 — Delivery

**Intent:** Complete dropoff correctly or fail correctly—never fake success.

| | |
|--|--|
| **Trigger** | `IN_TRANSIT` after pickup  
| **Actors** | Driver; recipient; Dispatcher/Support on exception |
| **States** | `IN_TRANSIT` → `ARRIVED_DROPOFF` → `DELIVERED` or `FAILED_ATTEMPT` |

**Steps**
1. Navigate to dropoff  
2. Mark arrived  
3. Contact recipient per protocol  
4. Execute POD verification (PR08)  
5. On success → `DELIVERED` → notifications → settlement eligibility  
6. On failure → PR16  

**Exceptions**
- Refuse by recipient → evidence + return/hold policy  
- Partial delivery (multi-piece) → explicit state rules (avoid silent partial)  
- Safety threat → abort, PR19  

---

## 12. PR10 — Payment (Customer Charge)

**Intent:** Collect customer money in line with confirmed quote and contract—calm, explicit, auditable.

| | |
|--|--|
| **Trigger** | Confirm booking and/or enterprise invoice cycle  
| **Actors** | Customer/Enterprise; payment provider; Finance |
| **Exit** | Authorised/captured per rules; or invoice open for enterprise terms |

**Modes**
1. **Pay-on-confirm** (card/wallet) — Wave 1 default for SMB/consumer  
2. **Auth now / capture on deliver** — optional later  
3. **Invoice terms** — Enterprise  

**Steps (pay-on-confirm)**
1. Present amount  
2. Collect payment method  
3. Authorise/capture  
4. On success → dispatch eligible  
5. On failure → job not dispatchable; customer retry  

**COD:** Deferred per Phase 1 (D8). If later enabled, separate cash control process required.

**Exceptions**
- Chargeback → Finance + risk review  
- Price adjustment post-confirm → governed only (rare)  

---

## 13. PR11 — Settlement (Driver / Fleet Payout)

**Intent:** Pay supply fairly and on schedule from job truth—not chat screenshots.

| | |
|--|--|
| **Trigger** | Jobs reach billable completion states; payout schedule runs |
| **Actors** | Finance Officer; Driver; Fleet Manager |
| **Exit** | Payout batch paid/recorded; statements available |

**Steps**
1. Select eligible jobs in period  
2. Apply earnings rules (base, incentives, fees, adjustments)  
3. Hold jobs under dispute/incident freeze  
4. Generate statements  
5. Execute payout via provider  
6. Handle failures / retries  
7. Dispute window → evidence-based resolution  

**Exceptions**
- Fake POD suspected → freeze + investigation  
- Adjustment from Support credit → linked ledger entries  

---

## 14. PR12 — Ratings

**Intent:** Capture quality signal without turning into harassment or vanity.

| | |
|--|--|
| **Trigger** | Job `DELIVERED` (and optionally failed paths for process feedback) |
| **Actors** | Customer (primary); Driver (limited, optional) |
| **Exit** | Rating stored; low scores may open Support/Ops review |

**Steps**
1. Prompt customer after delivery (one calm ask)  
2. Optional tags (punctuality, condition, conduct)  
3. Free text optional  
4. Low score → optional Support follow-up  
5. Aggregate into driver/fleet quality views (ethics from Phase 3)  

**Rules**
- No rating extortion flows  
- Driver rating of customer (if any) limited and anti-abuse gated  

---

## 15. PR13 — Customer Support

**Intent:** Restore trust with job-linked truth.

| | |
|--|--|
| **Trigger** | In-app/help, phone, chat, email, enterprise escalation |
| **Actors** | Support Agent; customer/driver/enterprise; Dispatcher/Finance as needed |
| **Object** | Case |
| **Exit** | Resolved/closed with outcome code; or escalated |

**Steps**
1. Intake + authenticate  
2. Link job(s) / profile  
3. Read timeline + evidence  
4. Diagnose against playbooks  
5. Act within authority (info, reattempt request, ruled credit, claim open, escalate)  
6. Communicate next expectation  
7. Wrap-up codes → defect tags to Ops/Product  

**SLA class:** Response/resolve by channel & segment (Enterprise tighter).

---

## 16. PR14 — Refunds & Credits

**Intent:** Fair remedy without teaching the organisation to buy silence instead of fixing ops.

| | |
|--|--|
| **Trigger** | Support/Finance decision; failed payment cleanup; goodwill matrix |
| **Actors** | Support Agent; Finance Officer |
| **Exit** | Adjustment posted; customer notified; ledger consistent |

**Steps**
1. Determine eligibility (policy matrix: delay class, failure fault, tier)  
2. Calculate amount within authority  
3. If above threshold → Finance approve  
4. Execute refund/credit via payment rails or invoice credit note  
5. Link to Case + Job  
6. Report leakage KPIs  

**Rules**
- Credits are not a substitute for truthful status upstream  
- Repeat credit patterns → Ops root cause  

---

## 17. PR15 — Claims

**Intent:** Orchestrate loss/damage claims with evidence; partner insurer adjudicates coverage.

| | |
|--|--|
| **Trigger** | Suspected loss/damage/theft; customer or ops initiates |
| **Actors** | Support; Finance; Driver; Customer/Enterprise; insurance partner |
| **Exit** | Claim decision recorded; financial adjustments applied; incident linked if needed |

**Steps**
1. Open Claim linked to Job + Case  
2. Freeze related payouts if policy requires  
3. Assemble evidence pack (POD, photos, timeline, declarations)  
4. Confirm declared value / coverage attachment  
5. Submit to partner (or internal goodwill path if uninsured)  
6. Track adjudication  
7. Outcome → notify → adjust Finance → close  

**Rules**
- Marketing never promises coverage beyond partner terms  
- High-value may require declare-value at booking  

---

## 18. PR16 — Failed Deliveries

**Intent:** Fail honestly, then choose the next right action.

| | |
|--|--|
| **Trigger** | Legitimate attempt cannot complete dropoff (or pickup fail class) |
| **Actors** | Driver; Customer/Enterprise; Dispatcher; Support |
| **States** | `FAILED_ATTEMPT` → reattempt / redirect / return / hold |

**Steps**
1. Driver follows contact + wait protocol  
2. Capture evidence + reason code  
3. Mark `FAILED_ATTEMPT`  
4. Notify customer/enterprise  
5. Apply next-action policy (Phase 1 §11): reattempt, redirect, return, hold  
6. If reattempt → PR05/PR18 as needed  
7. If return → return flow to `RETURNED`  
8. Fee classes only if disclosed  

---

## 19. PR17 — Vehicle Breakdown

**Intent:** Protect people and goods; recover the promise with honesty.

| | |
|--|--|
| **Trigger** | Driver declares breakdown/accident/inability; or ops detects |
| **Actors** | Driver; Dispatcher; Ops; Support (customer comms); Finance (holds) |
| **Exit** | Jobs safely re-homed or paused; Incident opened (PR19) |

**Steps**
1. Declare incident in-app (type, location, safety status, goods status)  
2. Dispatcher freezes unsafe continuation  
3. Customer gets truthful delay class update  
4. If goods on board → chain-of-custody handoff plan  
5. Trigger backup allocation (PR18)  
6. Open/link Incident (PR19)  
7. Tow/safety external procedures as needed (local runbook)  

---

## 20. PR18 — Backup Driver Allocation

**Intent:** Replace capacity fast without losing custody truth.

| | |
|--|--|
| **Trigger** | Breakdown, no-show, safety pull, overload rebalance, S2 risk |
| **Actors** | Dispatcher; incoming Driver; outgoing Driver; Fleet optional |
| **Exit** | New assignment active; customer ETA expectation updated |

**Steps**
1. Prioritise jobs (safety → SLA tier → age)  
2. Select eligible backup candidates  
3. If goods already picked up → execute verified handoff (scan/photo/OTP as tier)  
4. Reassign → notify drivers  
5. Notify customer/enterprise of revised expectation  
6. Reason code + audit  
7. Original driver earnings rules for partial completion applied by Finance rules  

---

## 21. PR19 — Incident Management

**Intent:** Severity-based command for events that threaten safety, trust, or systemic reliability.

| | |
|--|--|
| **Trigger** | Theft, violence, major accident, data suspicion, cascade SLA failure, fraud, etc. |
| **Actors** | Ops Manager; Dispatcher; Support; Admin/Security; Executive on-call for S1 |
| **Object** | Incident |
| **Exit** | Contained; communications done; post-incident learning recorded |

**Severity (from Phase 1)**
- **S1** Exec + security/legal path  
- **S2** Ops + Support leads  
- **S3** Dispatch + Support  
- **S4** Log & coach  

**Steps**
1. Detect/declare → classify severity  
2. Page owners per roster  
3. Stabilize people & goods first  
4. Freeze relevant jobs/payouts/accounts if required  
5. Customer/enterprise/regulator communications as needed  
6. Evidence preservation  
7. Resolve operationally  
8. Post-incident review → update SOPs/Atlas within deadline  
9. Close with ownership of actions  

---

## 22. Process Ownership RACI (Summary)

| Process | Customer | Driver | Dispatch | Support | Finance | Ops | Admin | Fleet | Sales |
|---------|----------|--------|----------|---------|---------|-----|-------|-------|-------|
| PR01 Registration | R/A | | | C | | | C | | |
| PR02 Driver onboard | | R | | | | A | C | C/R | |
| PR03 Booking | R/A* | | | | | | | | C† |
| PR04 Pricing | C | | | | C | | A(config) | | C |
| PR05 Dispatch | I | C | R/A | C | | C | | I | |
| PR06 Routing | I | C | A | | | C | | | |
| PR07–09 Execute | C | R/A | C | C | | I | | I | |
| PR10 Payment | R | | | | A | | C | | |
| PR11 Settlement | | C | | C | R/A | I | | C | |
| PR12 Ratings | R | C | | C | | I | | | |
| PR13 Support | C | C | C | R/A | C | C | | | |
| PR14 Refunds | C | | | R | A | I | | | |
| PR15 Claims | C | C | | R | A | C | | | |
| PR16 Failed | C | R | A | C | | I | | | |
| PR17 Breakdown | I | R | A | C | C | A | | C | |
| PR18 Backup | I | C | R/A | I | | C | | C | |
| PR19 Incident | I | C | C | C | C | R/A | C | C | I |

\* Enterprise Approver may be A for approval step.  
† Sales consults on enterprise onboarding quality, not daily booking.

R=Responsible A=Accountable C=Consulted I=Informed

---

## 23. Decisions Log (Phase 4)

| ID | Decision |
|----|----------|
| PR-D1 | Nineteen named processes (PR01–PR19) cover the mandatory catalogue |
| PR-D2 | Master flow orbits Job spine; exceptions fork explicitly—never via WhatsApp-as-system |
| PR-D3 | Wave 1 routing = solid assignment + simple optimisation; not full OR theatre |
| PR-D4 | Verification intensity is tier-based; `DELIVERED` requires sufficient proof |
| PR-D5 | Pay-on-confirm default for SMB/consumer; enterprise invoice terms supported |
| PR-D6 | COD remains out of process scope until Phase 1 deferral lifted |
| PR-D7 | Settlement pays from job truth with dispute freezes |
| PR-D8 | Credits/claims are linked ledger processes, not chat favours |
| PR-D9 | Backup allocation includes custody handoff rules when goods already picked up |
| PR-D10 | Incident severity model drives paging & communications |

---

## 24. Risks

| Risk | Mitigation |
|------|------------|
| Processes exist on paper only | Phase 9 screens + training curriculum bind to PR-IDs |
| Over-automation before ops mastery | Encode happy path first; keep dispatcher override |
| Route optimisation over-promising ETAs | Confidence bands + at-risk flags |
| Support/Finance process collision | PR14 authority matrix |
| Fleet shadow processes | Eligibility always platform-side (PR02/PR05) |
| Incident under-classification | QA on severity tagging; blameless post-mortems |

---

## 25. Assumptions

| # | Assumption | If false |
|---|------------|----------|
| PR-A1 | Controlled dispatch primary (accept/ack), not open claiming | PR05/PR06 change |
| PR-A2 | Single-piece / simple multi-piece first; complex partials later | PR09 expands |
| PR-A3 | No hub depot network in Wave 1 (point-to-point) | Return/hold locations change |
| PR-A4 | Insurance partner available in beachhead city when declare-value offered | PR15 goodwill-only path |
| PR-A5 | Payouts are batched (e.g. weekly), not instant per job at launch | PR11 cadence changes |
| PR-A6 | Telephony/contact-centre tooling may be vendor-assisted; process still owned by PR13 | System Phase 5 choice |
| PR-A7 | English process docs at launch; local-language scripts later | Training scope |

---

## 26. Out of Scope for Phase 4

- Service/API/cloud design → **Phase 5**  
- Entity/table design → **Phase 6**  
- Detailed RBAC enforcement → **Phase 7**  
- Visual system / screens → **Phases 8–9**  
- Sprint modules → **Phase 10**  
- Minute-level fee amounts → Commercial calibration workbook (future)

---

## 27. Approval Checklist

- [ ] Process catalogue PR01–PR19 accepted  
- [ ] Master flow + exception forks accepted  
- [ ] RACI accepted as ownership baseline  
- [ ] Routing & payment rulings (PR-D3, PR-D5, PR-D6) accepted  
- [ ] Assumptions PR-A1–PR-A7 accepted or amended  
- [ ] Ready to open Phase 5 — System Architecture  

**Approval response options:**  
`APPROVE PHASE 4 WITH 4B AND 4C` · `APPROVE PHASE 4 FAMILY WITH AMENDMENTS: …` · `REVISE: …`  

Do **not** approve Phase 4 alone. Approve only with **4B** and **4C**.
