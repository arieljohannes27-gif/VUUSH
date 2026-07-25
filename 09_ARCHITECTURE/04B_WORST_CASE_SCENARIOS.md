# Phase 4B — Worst-Case Scenario Architecture

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED (with Phase 4 + 4C)  
**Approved:** 2026-07-20  
**Parent:** `04_PROCESS_ARCHITECTURE.md`  
**Siblings:** `04C_PROCESS_COMPLETENESS.md`  
**Phase gate:** Locked as baseline with Phase 4 family.

---

## 0. Why This Exists

Phase 4A defined named processes (PR01–PR19). That is necessary and **insufficient**.

Logistics fails in the tails:

- People get sick, threatened, or dishonest mid-custody  
- Goods are not what was declared  
- Paying customers change their minds after the van is moving  
- Systems lie, roads close, police intervene  

If SWIFT cannot answer **“what do we do in the next 90 seconds?”** for these cases, the brand promise is fiction and later system architecture will encode the wrong defaults.

### Board doctrine for worst cases

1. **People before parcels.** Always.  
2. **Truth before ETA.** Never invent status to soothe.  
3. **Custody is sacred.** Who has the goods, with what evidence, at what time.  
4. **Lawful refusal is a feature.** Drivers and SWIFT may refuse unsafe/illegal continuance.  
5. **One command channel.** Dispatcher/Support own coordination; WhatsApp is not the system of record.  
6. **Freeze > freestyle.** When unsure and risk is high, freeze movement and escalate.  
7. **Every nightmare gets a reason code, an owner, and a customer sentence.**

---

## 1. Stress-Test Verdict on Phase 4A (Gaps Found)

| Gap | Severity | Fix in this document |
|-----|----------|----------------------|
| No dedicated **driver medical / incapacity mid-custody** playbook | Critical | WC-01 |
| No dedicated **dangerous / explosive / WMD suspicion** playbook | Critical | WC-02 |
| **Mid-job destination / instruction change** underspecified | Critical | WC-03 + PR20 |
| Custody during hospital diversion unclear | Critical | WC-01 |
| Shipper vs recipient conflicting instructions | High | WC-04 |
| Driver goes offline with goods | High | WC-05 |
| Suspected bomb vs “odd package” triage | Critical | WC-02 |
| Cancel after pickup | High | WC-06 |
| Police stop / seizure | High | WC-07 |
| Customer pressure to “just leave it anywhere” | Medium | WC-08 |
| Multi-job contamination (one crisis affects other parcels) | High | WC-01, WC-09 |
| Undeclared high-value / fraud booking | High | WC-10 |

**New processes added to Phase 4 catalogue:**

| ID | Process | Owner |
|----|---------|-------|
| **PR20** | Mid-job mutation (address/recipient/cancel-after-pickup) | Dispatcher + Support + paying customer |
| **PR21** | Dangerous goods / security threat response | Driver + Dispatcher + Ops + emergency services |
| **PR22** | Driver incapacity / medical emergency mid-job | Driver (+ bystander path) + Dispatcher + Ops |

---

## 2. Universal Decision Triage (First 60 Seconds)

Whatever the nightmare, the platform and humans follow this order:

```text
1. Is anyone in immediate danger?
      YES → Protect life → call emergency services → declare S1 → pause parcel goals
      NO  ↓
2. Is the package a plausible public-safety threat (explosive/chem/bio)?
      YES → Do NOT move it further than safety requires → WC-02
      NO  ↓
3. Who has custody right now? (driver / shipper / recipient / unknown)
      → Lock custody state on job timeline
4. Can the current plan still be executed safely & legally?
      NO → Freeze job(s) → Dispatcher command → customer truth update
5. What is the next lawful action? (backup / return / hold / mutate / abandon-to-authority)
```

**Customer sentence template (always):**  
“Here’s what happened. Here’s what we’re doing. Here’s what we need from you. Here’s when you’ll hear next.”

---

## 3. Your Three Scenarios — Full Playbooks

### WC-01 — Driver becomes medically distressed mid-trip and diverts to hospital

**Example:** Driver feels critically unwell after pickup, believes they need emergency care, drives toward hospital (or pulls over and calls emergency services).

#### Priorities (ordered)
1. Driver’s life  
2. Public road safety  
3. Secure custody of goods (without delaying emergency care)  
4. Truthful customer communication  
5. Recovery of the delivery promise via backup  

#### Detection paths
- Driver taps **Emergency / I need help** in Driver App (must be one-thumb, always reachable on active job)  
- Driver calls ops/dispatch emergency line  
- Watchdog: job mid-custody + sudden route diversion to hospital POI + speed/stop anomaly → Dispatcher alert (“possible medical/diversion”)  
- Third party / hospital / police notifies SWIFT  

#### Immediate actions (T+0 to T+5 min)

| Step | Who | Action |
|------|-----|--------|
| 1 | Driver (if able) | Activate Emergency → choose **Medical** → optional note; app auto-shares live location + active job IDs to Dispatch |
| 2 | Platform | Job(s) → `INCIDENT_HOLD` (new holding state class under exceptions); stop encouraging navigation to dropoff; page Dispatcher S2/S1 |
| 3 | Dispatcher | Open PR22 + PR19; voice/SMS attempt to driver; **do not pressure delivery continuation** |
| 4 | Dispatcher / Support | Customer/Enterprise: honest update — “Your driver has a medical emergency. Delivery is paused. We are securing the parcel and arranging recovery. Next update in X minutes.” |
| 5 | Ops | If driver incapacitated: guide toward **leave vehicle secured** if safe; or accept hospital diversion; involve emergency services if needed |

#### Custody rules (critical)

| Situation | Rule |
|-----------|------|
| Driver still conscious, vehicle mobile | **Medical care first.** Diverting to hospital is **authorised**. Not a performance crime. |
| Parcel in vehicle at hospital | Vehicle locked; location pinned; **do not** ask driver to deliver before triage |
| Handoff possible in parking area | Backup driver + verified chain-of-custody handoff (PR18) **only if** it does not delay care |
| Driver admitted / unreachable | Treat as **secured vehicle recovery**: Ops + possibly security/fleet; never shame the driver |
| Multi-job on board | All jobs on that vehicle enter hold; prioritise recovery order by safety/SLA/value **after** medical stabilisation |

#### What we do **not** do
- Penalise the driver for choosing emergency care  
- Tell the customer “still on the way”  
- Ask hospital staff to “just drop the parcel at reception” without chain-of-custody  
- Leave goods indefinitely without Incident owner  

#### Exit paths
1. **Backup handoff** → resume delivery (PR18)  
2. **Return to sender** if windows blown / goods type requires  
3. **Hold at secure SWIFT/partner location** (if/when exists) pending instruction  
4. **Claim/incident** if goods compromised during event  

#### Money / fairness
- Driver earnings: **medical incapacity protection class** (pay for work done + non-punitive)  
- Customer: re-promise or goodwill per matrix; enterprise SLA relief under force majeure class  

#### Product requirements implied (for later phases — capture now)
- Persistent **Emergency** control in Driver App  
- `INCIDENT_HOLD` state visible calmly to customer  
- Auto-page Dispatch with location + job list  
- “Hospital diversion” reason code distinct from “driver cancelled”  

---

### WC-02 — Parcel suspected to contain an explosive (or other mass-harm agent)

**Example:** Driver, shipper, recipient, or scanning anomaly suggests explosive / bomb / chemical / biological threat.

#### Priorities (ordered)
1. Public life safety (driver, bystanders, recipient site)  
2. Law enforcement / bomb squad authority  
3. Preserve evidence without handling more than instructed  
4. Freeze network actions that could move the threat  
5. Controlled customer/enterprise communication (no panic theatre, no tips to a bad actor)

#### Absolute rules
- **SWIFT is not a bomb squad.**  
- **Do not** open, shake, puncture, microwave, submerge, or “test” the parcel.  
- **Do not** continue delivery to a busy site to “get rid of it.”  
- **Do not** return it casually through normal return flow if suspicion is credible.  
- **Do not** discuss speculative bomb details in public customer push notifications.

#### Triage: unease vs credible threat

| Signal | Posture |
|--------|---------|
| Vague “feels weird,” no threat indicators | Heightened caution; photo of exterior; Dispatcher consult; may continue with refusal rights |
| Leak, wires, unusual odour, powder, ticking, threat message, declared as weapon, credible tip | **Credible threat path** → emergency services |
| Explicit shipper threat / coercion | S1 + police; freeze account |

#### Immediate actions (credible threat)

| Step | Who | Action |
|------|-----|--------|
| 1 | Driver | Move to safe distance if already holding it / stop approaching if not yet picked up; call **local emergency number**; then tap **Emergency → Dangerous goods / Threat** |
| 2 | Platform | Job → hard freeze; suppress further assignment movement; page S1 (Ops + Exec on-call); notify Security/Admin path |
| 3 | Dispatcher/Ops | Confirm driver safety; ensure emergency services contacted; **follow authority instructions only** |
| 4 | Ops | Quarantine related jobs from same shipper if pattern risk; optionally freeze shipper account pending investigation |
| 5 | Comms | Customer/Enterprise: limited truth — “We paused this delivery due to a safety investigation and are working with authorities. We will update you.” No speculative detail. |
| 6 | Legal/Exec | Authority liaison; evidence pack (booking declarations, IDs, timeline) |

#### If suspicion arises **before pickup**
- Abort pickup  
- Do not take custody  
- If device already placed in vehicle against will → treat as threat path  
- Shipper may be blocked from further booking pending review  

#### If suspicion arises **at recipient door**
- Retreat to safe distance  
- Do not force handoff  
- Emergency services + S1  

#### If it was a false alarm
- Document thoroughly (anti-abuse: repeated false alarms by driver or customer reviewed fairly)  
- Restart lawful process only when Ops clears  
- No humiliation of driver who erred on side of safety  

#### Booking prevention (upstream — mandatory architecture)
- Restricted goods declaration at PR03 with clear **prohibited list** (explosives, illegal weapons, etc.)  
- Shipper attestation with legal consequence language  
- High-risk categories blocked or require enterprise-controlled lanes  
- Repeat undeclared-danger offenders → permanent ban path  

#### Exit paths
1. Authority takes control → job `CLOSED` under security outcome; claim/legal follows  
2. Cleared false alarm → resume or return with Ops clearance  
3. Criminal referral → account termination  

---

### WC-03 — Business that booked wants to change destination mid-journey

**Example:** Enterprise/SMB shipper booked A→B. After pickup (or after assignment), they want A→C instead.

This is not a minor UX toggle. It is a **mid-job mutation** of a contracted, priced, possibly insured, possibly SLA’d job with a driver already executing.

#### Principles
1. **Only the paying authority** (or contracted org role with permission) may request mutation — not a random recipient, not a driver’s cousin.  
2. **Pre-pickup vs post-pickup** are different risk universes.  
3. **Repricing is mandatory** when distance/zone/time changes materially.  
4. **Driver consent/feasibility** matters post-assignment (safety, hours, vehicle, other jobs).  
5. **Recipient expectations** may already have been notified — mutations can create conflict (see WC-04).  
6. Silent WhatsApp “just take it to C” is **invalid** until captured in system.

#### Decision matrix

| Job stage | Change destination allowed? | Conditions |
|-----------|----------------------------|------------|
| `DRAFT` / `QUOTED` | Yes | Edit freely → reprice |
| `CONFIRMED` / `SCHEDULED`, not assigned | Yes | Reprice; update schedule |
| `ASSIGNED` / `EN_ROUTE_PICKUP`, not picked up | Usually yes | Reprice; notify driver; driver may decline → reassign |
| `PICKED_UP` / `IN_TRANSIT` | **Conditional** | PR20: feasibility + reprice + driver accept + Ops/Dispatch approve if risk flags |
| `ARRIVED_DROPOFF` | Rare | Usually fail attempt / new job; don’t improvisationally redirect without PR20 |
| After `DELIVERED` | No | New job |

#### PR20 — Mid-job mutation process (destination change)

**Happy controlled path (post-pickup)**
1. Authorised enterprise user requests **Change dropoff** in Portal/App  
2. System computes: new zone serviceability, delta price, new ETA confidence, insurance implications, driver feasibility  
3. Show customer: new price, new window, driver confirmation pending  
4. Dispatcher sees mutation request queue (auto-approve only if rules green)  
5. Driver receives **Accept new destination?** with earnings delta — can decline for safety/hours  
6. If accepted → update job destination + timeline event `DestinationChanged` + notify old/new recipient per policy  
7. If declined → options: backup driver (PR18), return to sender, cancel-after-pickup policy, or keep original B  

**Must block when**
- New location unserviceable  
- Dangerous goods / hold / incident freeze active  
- Driver in WC-01/WC-02 path  
- Mutation would break chain-of-custody rules (e.g. leave with stranger mid-route)  
- Requestor lacks authority  

#### Commercial rules (classes)
- Price increase: collect/auth before commit when possible  
- Price decrease: rare; governed  
- Driver earnings: recalculated fairly; never “free favour”  
- SLA clock: restart or pause rules disclosed in enterprise contract  

#### Customer communication
- Old recipient: if already notified, send “delivery redirected by sender” (privacy-safe)  
- New recipient: standard inbound notifications  

#### Abuse controls
- Repeated mid-route changes → fee class + possible tier restriction  
- Pattern used to probe routes / fraud → risk review  

---

## 4. Extended Worst-Case Catalogue

Each row: **what happens** → **process** → **non-negotiable rule**.

### 4.1 People & custody

| ID | Scenario | Primary process | Non-negotiable |
|----|----------|-----------------|----------------|
| WC-01 | Driver medical emergency / hospital divert | PR22, PR18, PR19 | Life first; no punishment; hold jobs |
| WC-05 | Driver phone dies / app offline with goods | PR17/PR19, Dispatch outbound | Watchdog timers; call tree; last-known location |
| WC-11 | Driver assaulted / hijack attempt | PR19 S1 | Abandon goods if needed to survive; police |
| WC-12 | Driver absconds / suspected theft | PR19 S1, Finance freeze | Freeze payouts/account; police; customer truth |
| WC-13 | Driver refuses area for safety | PR05 reassign | Refusal right; not automatic ban |
| WC-14 | Driver admits too tired / unfit mid-shift | PR22-like | Stop assignment; no forced continue |

### 4.2 Goods & legality

| ID | Scenario | Primary process | Non-negotiable |
|----|----------|-----------------|----------------|
| WC-02 | Explosive / mass-harm suspicion | PR21, PR19 S1 | Emergency services; do not normal-return |
| WC-15 | Chemical leak / fumes | PR21 | Evacuate; emergency services |
| WC-16 | Undeclared illegal goods discovered | PR21/PR19 | Refuse/stop; authority as required; ban path |
| WC-17 | Parcel damaged in transit | PR15, PR13 | Evidence; claim; honest status |
| WC-18 | Dead animal / biohazard smell | PR21 | Safety stop; specialised handling / authority |
| WC-10 | Bust-out fraud / fake enterprise volume | Risk + Admin | Velocity limits; manual review |

### 4.3 Instruction conflicts & mutations

| ID | Scenario | Primary process | Non-negotiable |
|----|----------|-----------------|----------------|
| WC-03 | Shipper changes destination mid-trip | PR20 | Authority + reprice + driver feasibility |
| WC-04 | Recipient demands different address than shipper | PR20 / PR16 | **Payer/org policy wins** unless legal compulsion |
| WC-06 | Cancel after pickup | PR20 cancel class | Return/hold; fees; driver pay class |
| WC-19 | Shipper asks to leave with neighbour (not in job) | PR08/PR16 | Only if tier allows alternate + evidence |
| WC-08 | “Leave at gate / dump it” pressure | PR08 | Tier rules; photo; never unsafe abandon |
| WC-20 | Two enterprise users issue conflicting commands | PR20 | Org role hierarchy; Dispatch freezes until clarity |

### 4.4 External force

| ID | Scenario | Primary process | Non-negotiable |
|----|----------|-----------------|----------------|
| WC-07 | Police stop / search / seizure | PR19 | Comply with law; document; notify customer of delay class carefully |
| WC-21 | Protest / riot / fire closes route | PR05/PR06/PR16 | Reroute or hold; truthful delay |
| WC-22 | Natural disaster mid-day | PR19 city mode | Suspend zone; protect people; mass customer notice |
| WC-23 | Accident involving SWIFT vehicle | PR19, PR17 | Emergency first; incident; backup |

### 4.5 Money & trust

| ID | Scenario | Primary process | Non-negotiable |
|----|----------|-----------------|----------------|
| WC-24 | Payment reverses / chargeback in transit | PR10/PR11 | Risk hold; may complete or return per policy |
| WC-25 | Enterprise disputes “we didn’t book that” | PR13 + audit | Timeline evidence; org admin review |
| WC-26 | Driver demands cash side-payment | Conduct + Support | Forbid; report; protect customer |

### 4.6 System & scale

| ID | Scenario | Primary process | Non-negotiable |
|----|----------|-----------------|----------------|
| WC-27 | App/backend down with thousands in transit | Degraded mode | Last-known truth; voice dispatch bridge; no fake auto-delivered |
| WC-28 | GPS spoofing / fake POD ring | Fraud + PR08 | Proof tier escalation; investigate cohort |
| WC-09 | One crisis contaminates driver’s other jobs | Hold-all-on-vehicle | Explicit multi-job freeze policy |

---

## 5. New Holding Semantics (State Addendum)

Phase 1 states remain canonical. Worst cases require **holding semantics** without lying:

| Hold class | Meaning | Customer-visible framing |
|------------|---------|--------------------------|
| `INCIDENT_HOLD` | Safety/medical/security pause | “Paused for a safety/emergency reason” |
| `MUTATION_PENDING` | Waiting on reprice/driver accept for change | “Updating delivery details” |
| `AUTHORITY_HOLD` | Police/legal control | “Delayed due to an official investigation/stop” (legal-reviewed copy) |
| `CUSTODY_RECOVERY` | Goods need secure recovery/handoff | “We’re transferring your delivery to another driver” |

These may be implemented as state **flags + reason codes** on existing states rather than exploding the state machine—**Phase 5/6 decide storage**. Process truth requires them now.

---

## 6. Reason Code Starter Set (Worst-Case)

Must exist in Admin catalogue before software coding:

**Driver:** `MEDICAL_EMERGENCY`, `UNFIT_TO_CONTINUE`, `ASSAULT`, `VEHICLE_UNSAFE`, `REFUSE_UNSAFE_AREA`, `OFFLINE_WITH_CUSTODY`  
**Goods:** `SUSPECTED_EXPLOSIVE`, `HAZMAT_LEAK`, `PROHIBITED_GOODS`, `UNDECLARED_DANGER`  
**Customer mutation:** `DESTINATION_CHANGE`, `RECIPIENT_CHANGE`, `CANCEL_AFTER_PICKUP`, `CONFLICTING_INSTRUCTIONS`  
**External:** `POLICE_STOP`, `SEIZURE`, `FORCE_MAJEURE_ZONE`  
**Fraud/trust:** `SUSPECTED_THEFT`, `FAKE_POD_SUSPECTED`, `SIDE_PAYMENT_REQUEST`

---

## 7. Product Implications (Capture Now — Build Later)

| Surface | Must support |
|---------|--------------|
| Driver App | One-tap Emergency (Medical / Threat / Accident / Assault); offline dead-man’s watchdog guidance; accept/decline mutation |
| Dispatcher Console | S1/S2 incident board; multi-job vehicle hold; mutation approval queue; hospital diversion alert |
| Customer App / Enterprise | Calm pause messaging; destination change request with price delta; no free-text “secret” redirects |
| Support Centre | Playbooks WC-01… linked; authority matrix; legal-safe scripts for security events |
| Finance | Freeze payouts on S1 theft/security; medical non-punitive pay class |
| Admin | Reason codes; prohibited goods list; freeze accounts |

---

## 8. Training & Authority Implications

- Dispatchers rehearse WC-01 and WC-02 like fire drills  
- Drivers trained: **emergency care is always allowed**; **never open suspected explosives**  
- Support scripts legal-reviewed for authority holds  
- Sales forbidden from promising “we’ll deliver anything anywhere”  

---

## 9. Decisions Log (Phase 4B)

| ID | Decision |
|----|----------|
| WC-D1 | Phase 4 approval requires this worst-case companion |
| WC-D2 | People before parcels; medical diversion is authorised and non-punitive |
| WC-D3 | Credible explosive/mass-harm → emergency services; no normal return loop |
| WC-D4 | Mid-job destination change is PR20: authority + reprice + feasibility + audit |
| WC-D5 | Recipient cannot override paying shipper destination without policy/legal basis |
| WC-D6 | Add PR20, PR21, PR22 to process catalogue |
| WC-D7 | Holding classes required for truthful pause states |
| WC-D8 | One-tap Driver Emergency is a Wave 1 product requirement (not a “nice to have”) |

---

## 10. Risks If We Ignore This

| If ignored | Outcome |
|------------|---------|
| No medical playbook | Drivers hide illness, crash, or dump goods; brand cruelty |
| No explosive playbook | Staff improvises; mass-casualty liability |
| Free destination edits in chat | Custody chaos, fraud, unpaid kilometres, SLA fiction |
| Punitive culture on emergencies | Silence; worse disasters |

---

## 11. Assumptions

| # | Assumption |
|---|------------|
| WC-A1 | Beachhead city has reachable emergency services numbers drivers know |
| WC-A2 | Legal counsel will refine “authority hold” customer language per country |
| WC-A3 | Secure depot hold may not exist at Wave 1 → backup handoff / return / locked-vehicle recovery dominate |
| WC-A4 | Prohibited goods list is published at booking before first live job |
| WC-A5 | Enterprise contracts will reference mutation and force-majeure classes |

---

## 12. Approval Checklist (Phase 4 + 4B together)

- [ ] WC-01 medical / hospital diversion playbook accepted  
- [ ] WC-02 explosive / mass-harm playbook accepted  
- [ ] WC-03 / PR20 mid-job destination change rules accepted  
- [ ] Extended catalogue WC-04–WC-28 accepted as baseline stress set  
- [ ] PR20/PR21/PR22 added to Phase 4 catalogue  
- [ ] Wave 1 Driver Emergency control accepted as mandatory  
- [ ] Ready to approve Phase 4 **as amended** before Phase 5  

**Approval response options:**  
`APPROVE PHASE 4 WITH 4B AND 4C` · `APPROVE PHASE 4 FAMILY WITH AMENDMENTS: …` · `REVISE 4B: …`
