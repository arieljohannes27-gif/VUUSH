# Phase 4C — Process Completeness Addendum

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED (with Phase 4 + 4B)  
**Approved:** 2026-07-20  
**Parents:** `04_PROCESS_ARCHITECTURE.md` · `04B_WORST_CASE_SCENARIOS.md`  
**Phase gate:** Locked as baseline with Phase 4 family. Phase 5 unlocked.

---

## 0. Why 4C Exists

A founder audit asked whether registration → audit were “all in order.”  
Board answer: **most were covered; three were not.**

| Soft spot | Risk if ignored | Fix |
|-----------|-----------------|-----|
| In-transit tracking | Fake ETAs, silent GPS loss, spoofed progress | **PR23** |
| Enterprise account workflows | Portal without governed org lifecycle | **PR24** |
| Reporting & auditing | “We have logs somewhere” ≠ enterprise trust | **PR25** |

4C closes those gaps at **process level** (not systems, screens, or SQL — those remain Phases 5–9).

---

## 1. Updated Process Catalogue (Additive)

| ID | Process | Primary owner | Object |
|----|---------|---------------|--------|
| **PR23** | In-transit tracking & signal integrity | Dispatcher (+ platform tracking) | Job tracking session / signals |
| **PR24** | Enterprise account lifecycle | Sales + Admin + Ops + Finance (stage-owners) | Organisation account |
| **PR25** | Reporting & audit operations | Admin + Finance + Ops (+ Compliance) | Reports / audit packs / exports |

Full Phase 4 catalogue is now **PR01–PR25** (+ worst-case playbooks in 4B).

---

## 2. PR23 — In-Transit Tracking & Signal Integrity

### 2.1 Intent

Make movement **observable, truthful, and failure-aware** from pickup to delivery attempt—without inventing progress when signals are weak or hostile.

### 2.2 Scope

| In scope | Out of scope (later phases) |
|----------|-----------------------------|
| Tracking session lifecycle | Map vendor selection |
| Signal classes & freshness rules | Exact GPS SDK / proto design |
| Lost-signal / spoof / teleport playbooks | ML model weights |
| Customer/dispatcher visibility rules | Screen wireframes |
| Multi-job tracking contamination | |

### 2.3 Trigger / entry / exit

| | |
|--|--|
| **Trigger** | Job reaches `PICKED_UP` (or `EN_ROUTE_PICKUP` for light pre-pickup tracking if enabled) |
| **Actors** | Driver App (producer); Tracking capability; Dispatcher; Customer/Enterprise (consumers); Support (read) |
| **Entry** | Active assignment + device permission / degraded mode declared |
| **Exit** | Terminal attempt state (`DELIVERED`, `FAILED_ATTEMPT`, return/hold/incident path) + tracking session closed |

### 2.4 Tracking session lifecycle

```text
SESSION_START (on relevant state)
  → STREAMING (fresh signals)
  → DEGRADED (stale / low confidence)
  → LOST (no acceptable signal beyond threshold)
  → RECOVERED | MANUAL_LOCATE | INCIDENT_ESCALATE
  → SESSION_END
```

### 2.5 Signal classes

| Class | Meaning | Customer visibility |
|-------|---------|---------------------|
| **Fresh** | Recent legitimate fix within freshness SLA | Normal map/progress |
| **Stale** | Older than freshness SLA but not lost | Calm “connection weak” / last known |
| **Degraded** | Coarse location / delayed batching (network) | Honest degraded UX |
| **Conflicted** | Teleport, impossible speed, spoof heuristics | Hidden from customer as “live lie”; Dispatch alert |
| **Absent** | No signal beyond lost threshold | Last known + human process |

**Non-negotiable:** Never animate a fake smooth route when signal is Absent/Conflicted.

### 2.6 Process steps (happy path)

1. On custody start → open tracking session linked to Job (+ vehicle/driver).  
2. Ingest location/event pings with timestamps & integrity metadata.  
3. Derive progress milestones (left pickup zone, approaching dropoff geofence).  
4. Project **ETA confidence band** (not false precision).  
5. Fan-out to Customer App, Enterprise Portal, Dispatcher Console per privacy rules.  
6. On terminal attempt → close session; retain trail per PR25 retention.

### 2.7 Exception playbooks (tracking-specific)

| Condition | Detection | Action |
|-----------|-----------|--------|
| **Stale signal** | Freshness timeout | Mark DEGRADED; notify Dispatcher watchlist; customer sees last known + honesty |
| **Lost signal** | Extended absence mid-custody | Auto-create Dispatch task; call/SMS driver tree; if custody risk → align WC-05 |
| **Teleport / spoof suspect** | Impossible distance/time | Conflicted flag; suppress misleading customer live path; fraud/ops review |
| **Driver denies location permission** | App health | Block on-duty / block assignment (policy); cannot execute mid-custody without declared degraded mode approval |
| **Background kill / phone off** | Heartbeat loss | Same as lost signal; do not auto-`DELIVERED` |
| **Multi-job on vehicle** | Session shared carrier | All active custody jobs inherit hold if vehicle-level incident (4B WC-09) |
| **Customer refresh spam** | N/A | Cache projections; still one truth |

### 2.8 Ownership RACI (PR23)

| Activity | Driver | Dispatch | Support | Ops | Admin |
|----------|--------|----------|---------|-----|-------|
| Produce signals | R | I | | I | |
| Monitor integrity | C | R/A | C | C | |
| Customer truth wording | | A (ops events) | R (cases) | C | |
| Spoof policy thresholds | | C | | A | C (config) |

### 2.9 KPIs

- % custody time in Fresh vs Degraded/Lost  
- Median time-to-Dispatch-ack on Lost mid-custody  
- Spoof/conflict flags per 1,000 jobs  
- Customer contacts with root cause “where is my driver?”  
- Zero tolerance: auto-complete without proof because tracking died  

### 2.10 Decisions

| ID | Decision |
|----|----------|
| PR23-D1 | Tracking is a first-class process, not a map widget |
| PR23-D2 | Degraded/lost must be visible internally; customers get honest last-known—not synthetic motion |
| PR23-D3 | Conflicted signals never drive customer-facing “on the way” theatre |
| PR23-D4 | Lost mid-custody joins Dispatch + WC-05 discipline |

---

## 3. PR24 — Enterprise Account Lifecycle

### 3.1 Intent

Govern an enterprise from **first qualified opportunity → operating account → expansion/renewal/exit** so Portal access, jobs, SLAs, and invoices share one organisational truth.

### 3.2 Why this is not “just booking”

Without PR24, Enterprise Portal becomes a login bolted onto consumer jobs—no seats, no approvals, no contract state, no offboarding. That fails Phase 1 enterprise strategy.

### 3.3 Lifecycle stages

```text
PROSPECT → QUALIFIED → PILOT_SETUP → PILOT_LIVE
  → CONTRACTED → OPERATING → EXPANDING
  → RENEWAL_REVIEW → SUSPENDED / OFFBOARDED
```

### 3.4 Sub-processes

#### PR24.1 — Account creation & legal entity

| | |
|--|--|
| **Trigger** | Sales wins pilot/contract intent OR inbound enterprise signup (controlled) |
| **Actors** | Sales (U10); Admin; Ops (readiness); Legal consult |
| **Steps** | Capture legal name, billing entity, country, contacts → create Org record → link opportunity → KYC/KYB depth by risk → status `PILOT_SETUP` or `CONTRACTED` pending docs |
| **Exit** | Org exists with unique ID; not yet freely booking unless gates green |

#### PR24.2 — Contract, SLA & commercial attachment

| | |
|--|--|
| **Steps** | Attach MSA/schedule/SLA classes → rate card / pricing contract → invoice terms → success criteria for pilot → discount authority logged |
| **Rules** | Cannot mark `OPERATING` at volume without Ops readiness sign-off (Phase 1 disqualifiers) |
| **Exit** | Commercial terms versioned on Org |

#### PR24.3 — Users, roles & approvals

| | |
|--|--|
| **Steps** | Invite Org Admin → Org Admin invites Bookers/Approvers/Viewers → configure approval thresholds (optional) → SSO later (Phase 5+) |
| **Rules** | Least privilege (Phase 3 U02); joiner/leaver within SLA |
| **Exit** | At least one Org Admin active; booking roles clear |

#### PR24.4 — Locations, cost centres & preferences

| | |
|--|--|
| **Steps** | Register sites/addresses → contacts → default service tiers → notification distribution lists → cost centre codes |
| **Exit** | Bookable locations validated for serviceability |

#### PR24.5 — Technical integration readiness (process, not API design)

| | |
|--|--|
| **Steps** | Decide UI-only vs API → sandbox access → test job checklist → go-live checklist → production credentials ownership |
| **Exit** | Integration mode recorded; support runbook tagged |

#### PR24.6 — Pilot → operating gate

| Gate | Owner | Must be true |
|------|-------|--------------|
| Supply coverage for promised windows | Ops | Green |
| Support/Dispatch staffing aware | Ops | Green |
| Billing test invoice OK | Finance | Green |
| Security questionnaire / basics | Admin/Security | Green |
| Success metrics defined | Sales + Ops | Green |

Fail any gate → stay in pilot/limited mode; Sales may not silently override.

#### PR24.7 — Steady-state operating rhythms

- Daily/weekly: exception collaboration (jobs via normal PR05/PR13)  
- Monthly: QBR-style account health (Ops + Sales)  
- Continuous: user access reviews; volume vs SLA  

#### PR24.8 — Expansion

New city/site/service line → mini readiness gate (not automatic because HQ works).

#### PR24.9 — Suspension

| Triggers | Actions |
|----------|---------|
| Non-payment | Finance hold on new bookings; in-flight jobs policy |
| Fraud/security | Admin freeze; S1 if needed |
| Repeated unsafe goods violations | Ban path |
| Mutual commercial pause | Documented suspension state |

In-flight custody jobs still follow PR23/PR16/PR19—freeze is not abandonment.

#### PR24.10 — Offboarding

1. Stop new bookings  
2. Complete or lawfully return in-flight jobs  
3. Final invoice + payout impacts none (enterprise is demand-side)  
4. Revoke users/API keys  
5. Retain audit/commercial records per PR25  
6. Status `OFFBOARDED`

### 3.5 Enterprise objects (process view)

| Object | Purpose |
|--------|---------|
| Organisation | Legal/commercial umbrella |
| OrgUser membership | Role bindings |
| Contract/SLA version | What was promised |
| Rate card attachment | How priced |
| Site/location | Where work happens |
| Billing profile | How invoiced |
| Integration profile | How orders enter |

### 3.6 RACI (summary)

| Stage | Sales | Org Admin | Admin | Ops | Finance | Support |
|-------|-------|-----------|-------|-----|---------|---------|
| Prospect/qualify | R/A | | C | C | | |
| Contract attach | R | C | C | C | A(terms ops) | |
| User/roles | C | R/A | C | | | |
| Readiness gate | C | C | C | A | C | C |
| Operating exceptions | I | C | | A | | R |
| Suspension/offboard | C | C | R | C | A/C | C |

### 3.7 KPIs

- Time-to-pilot-live  
- Pilot → contracted conversion  
- % launches with all gates green  
- Access joiner/leaver SLA  
- Invoice dispute rate  
- Early churn within 90 days (oversell detector)  

### 3.8 Decisions

| ID | Decision |
|----|----------|
| PR24-D1 | Enterprise is an account lifecycle, not only a login |
| PR24-D2 | Ops readiness gate can block Sales go-live |
| PR24-D3 | Offboarding must drain in-flight jobs lawfully before credential death |
| PR24-D4 | Expansion re-opens readiness, not copy-paste trust |

---

## 4. PR25 — Reporting & Audit Operations

### 4.1 Intent

Ensure SWIFT can **prove what happened**, **to whom**, **when**, and **under which rules**—for operations learning, enterprise trust, finance integrity, and compliance—without turning Atlas into an uncontrolled data swamp.

### 4.2 Two different disciplines (do not conflate)

| Discipline | Question it answers | Cadence |
|------------|---------------------|---------|
| **Reporting** | How are we performing? What should we decide? | Scheduled / on-demand analytic |
| **Auditing** | What exactly occurred, who did it, can we evidence it? | Continuous immutable trail + pack generation |

BI (P11) consumes reporting. Audit packs are legal/ops artefacts.

### 4.3 Audit spine (process requirements)

Every material action in PR01–PR24 must be able to produce an audit event with:

- actor (user/system)  
- timestamp (UTC + city local display rules later)  
- object IDs (job, org, case, payout, …)  
- action / transition  
- before/after or payload summary  
- reason code where human override  
- correlation ID across products  

**WhatsApp is not an audit trail** unless transcribed into an official note event (Phase 1 rule restated).

### 4.4 Audit pack types

| Pack | When | Contents (min) | Owner |
|------|------|----------------|-------|
| **Job evidence pack** | Claim, dispute, enterprise request | Timeline, POD, tracking summary, contacts attempts, mutations | Support/Finance |
| **Incident pack** | S1/S2 close | Severity, actions, comms log, freezes, postmortem link | Ops |
| **Enterprise diligence pack** | Security review / renewal | Access model, incident stats, uptime/SLA report, data handling summary | Admin + Ops |
| **Finance reconciliation pack** | Period close / dispute | Jobs ↔ charges ↔ payouts ↔ adjustments | Finance |
| **Access audit pack** | Periodic / investigation | Privileged actions, break-glass, joiner/leaver | Admin |

### 4.5 Reporting catalogue (process-owned, not chart design)

| Report class | Audience | Examples | Primary owner |
|--------------|----------|----------|---------------|
| Promise | Ops / Exec | On-time, first-attempt, fail reasons | Ops |
| Supply | Ops / Fleet | Eligibility, coverage, retention | Ops |
| Demand | Sales / Exec | Volume, repeat, enterprise health | Sales/Ops |
| Exception | Dispatch / Support | Lost-signal, mutations, incidents | Ops |
| Money | Finance | Take rate, credits leakage, unreconciled aging | Finance |
| Quality | Support / Ops | CSAT, reopen, QA | Support |
| Risk | Admin / Exec | S1 counts, freezes, fraud flags | Admin/Ops |

Cadence: daily ops flash · weekly leadership · monthly enterprise QBR extracts · quarterly risk.

### 4.6 Process steps — generating an audit pack

1. Trigger (claim, legal, enterprise, internal investigation).  
2. Authorised role requests pack type + object scope + time range.  
3. System assembles from spine (Phase 5 implements; process requires completeness checklist).  
4. Human verifies pack integrity (Support/Finance/Admin as applicable).  
5. Deliver via secure channel; watermark/access log who downloaded.  
6. Retention clock per class; legal hold overrides deletion.

### 4.7 Process steps — scheduled reporting

1. Define report subscription (who/what/cadence).  
2. Generate from approved metric definitions (no shadow spreadsheets as source of truth).  
3. Distribute to role-appropriate audiences.  
4. Anomalies open Ops review tasks (not silent).  
5. Metric definition changes versioned (Admin/Ops governance).

### 4.8 Retention & legal hold (process policy)

| Class | Directional retention stance |
|-------|------------------------------|
| Job timeline + POD | Years-class (jurisdiction calibrated) |
| Tracking breadcrumbs | Shorter operational window + aggregated truths retained |
| Support recordings/chats | Policy + consent constrained |
| Access/break-glass logs | Long / compliance-class |
| Finance artefacts | Statutory accounting minimums |
| Legal hold | Suspend purge until released |

Exact durations → Legal Phase / counsel (flagged assumption).

### 4.9 Access rules

- Least privilege on packs and reports  
- Enterprise sees **their** jobs/reports only  
- Staff broad access audited  
- Break-glass for investigation only (Phase 3 Admin)  

### 4.10 RACI (summary)

| Activity | Ops | Finance | Support | Admin | Exec | Enterprise |
|----------|-----|---------|---------|-------|------|------------|
| Metric definitions | A | C | C | C | I | I |
| Job evidence pack | C | A/C | R | C | | request |
| Incident pack | R/A | C | C | C | I | limited |
| Access audit | C | | | R/A | I | |
| Period finance pack | C | R/A | C | C | I | statements |

### 4.11 KPIs

- % claims with complete evidence pack on first assembly  
- Pack generation latency  
- Privileged action review completion %  
- Report anomaly → task open rate  
- Audit findings closure time  

### 4.12 Decisions

| ID | Decision |
|----|----------|
| PR25-D1 | Auditing ≠ reporting; both are mandatory processes |
| PR25-D2 | Material overrides require reason codes to be auditable |
| PR25-D3 | Evidence packs are productised outputs, not manual archaeology |
| PR25-D4 | Metric definitions are governed; shadow KPIs cannot drive exec truth |
| PR25-D5 | Retention/legal hold is counsel-calibrated per beachhead jurisdiction |

---

## 5. How 4C Connects to Prior Phases

```text
PR23 Tracking  ←→  PR05 Dispatch, PR09 Delivery, WC-05 offline, PR19 incidents
PR24 Enterprise ←→  PR03 Booking, PR04 Pricing, PR10 Invoicing, PR13 Support, Phase 3 U02/U10
PR25 Audit/Report ←→ every PR (event spine), P11 BI, Admin, Finance, 4B incident packs
```

---

## 6. Founder Checklist — “Are these in order now?”

| Item | After 4C |
|------|----------|
| Customer registration | Covered (PR01) |
| Driver onboarding & verification | Covered (PR02) |
| Quote generation | Covered (PR04) |
| Booking lifecycle | Covered (PR03) |
| Dispatch & assignment | Covered (PR05) |
| Pickup verification | Covered (PR07/08) |
| **In-transit tracking** | **Covered (PR23)** |
| Delivery confirmation | Covered (PR09/08) |
| Payments & settlements | Covered (PR10/11) |
| Refunds | Covered (PR14) |
| Claims & insurance | Covered (PR15) |
| Customer support | Covered (PR13) |
| Incident management | Covered (PR19 + 4B) |
| Vehicle breakdowns | Covered (PR17) |
| Backup driver allocation | Covered (PR18) |
| **Enterprise account workflows** | **Covered (PR24)** |
| **Reporting and auditing** | **Covered (PR25)** |

**Meaning of Covered:** process architecture complete enough to drive Phase 5.  
**Still not done:** systems, data model, security detail, UI, implementation.

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Tracking process ignored in build | Wave 1 dependency: PR23 + Driver Emergency |
| Enterprise lifecycle skipped for “fast logos” | Hard readiness gates PR24.6 |
| Audit packs left as SQL heroics | PR25 productises packs before enterprise scale |
| Retention guessed wrong | Counsel calibration before launch |

---

## 8. Assumptions

| # | Assumption |
|---|------------|
| PR-C-A1 | Pre-pickup tracking may be limited; custody-start tracking is mandatory |
| PR-C-A2 | KYB depth for enterprises scales with risk/volume |
| PR-C-A3 | Exact retention days await beachhead legal advice |
| PR-C-A4 | SSO/SAML is later; invite/password OTP acceptable for pilot |
| PR-C-A5 | Metric warehouse may lag Wave 1; audit spine must not lag Wave 1 |

---

## 9. Joint Approval Gate (Phase 4 family)

Approve only if you accept:

- [ ] PR23 tracking & signal integrity  
- [ ] PR24 enterprise account lifecycle  
- [ ] PR25 reporting & audit operations  
- [ ] Prior PR01–PR22 + 4B worst cases still stand  
- [ ] Soft spots from founder audit are closed at process level  

**Approval response options:**  
`APPROVE PHASE 4 WITH 4B AND 4C` · `APPROVE PHASE 4 FAMILY WITH AMENDMENTS: …` · `REVISE 4C: …`

Phase 5 (System Architecture) remains locked until this joint approval.
