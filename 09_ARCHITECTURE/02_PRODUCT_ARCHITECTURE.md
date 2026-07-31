# Phase 2 — Product Architecture

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED  
**Approved:** 2026-07-20  
**Depends on:** Phase 1 Business Architecture (**APPROVED** 2026-07-16)  
**Phase gate:** Phase 2 locked as baseline. Amendments require explicit revision. Phase 3 unlocked.

---

## 0. Executive Position

Phase 1 locked SWIFT as a **controlled logistics technology platform**. Phase 2 defines the **product surfaces** that make that model real—and how they share one operational truth.

### Board challenges to naive product sprawl

| Temptation | Verdict | Why |
|------------|---------|-----|
| Build all 11 products at once | **Reject** | Dilutes craft; breaks “Done Right” |
| Separate “apps” with separate truths | **Reject** | Status lies emerge; trust dies |
| One mega-admin for every role | **Reject** | Overwhelms operators; violates calm UX |
| AI as a customer-facing status oracle | **Reject (early)** | Invented ETAs destroy brand |
| **One platform, role-shaped products, shared job spine** | **Adopt** | Premium coherence + staged delivery |

### Product architecture thesis

> Every product is a **lens** on the same delivery lifecycle.  
> No product owns a private version of reality.  
> The **Job (delivery)** is the atomic spine. Everything else orbits it.

---

## 1. Product Ecosystem Map

### 1.1 Suite inventory

| ID | Product | Primary users | Class |
|----|---------|---------------|-------|
| P01 | **Customer App** | SMB shippers, consumer senders, recipients (lightweight) | Demand / Experience |
| P02 | **Driver App** | Independent & fleet drivers | Supply / Execution |
| P03 | **Enterprise Portal** | Enterprise shippers, coordinators, approvers | Demand / Governance |
| P04 | **Dispatcher Console** | Dispatchers | Control / Real-time |
| P05 | **Operations Dashboard** | Ops managers | Control / Performance |
| P06 | **Finance Dashboard** | Finance officers | Money / Settlement |
| P07 | **Fleet Dashboard** | Fleet managers / partners | Supply / Capacity |
| P08 | **Admin Portal** | Administrators | Platform configuration |
| P09 | **AI Operations Centre** | Ops leads, dispatch leads (assistive) | Intelligence / Assist |
| P10 | **Support Centre** | Support agents | Trust recovery |
| P11 | **Business Intelligence** | Leadership, ops, commercial | Insight / Strategy |

### 1.2 Layered product model

```text
┌──────────────────────────────────────────────────────────────────────┐
│ INSIGHT          Business Intelligence · AI Operations Centre        │
├──────────────────────────────────────────────────────────────────────┤
│ CONTROL          Dispatcher · Operations · Support · Admin · Finance │
├──────────────────────────────────────────────────────────────────────┤
│ DEMAND           Customer App · Enterprise Portal                    │
├──────────────────────────────────────────────────────────────────────┤
│ SUPPLY           Driver App · Fleet Dashboard                        │
├──────────────────────────────────────────────────────────────────────┤
│ SHARED SPINE     Identity · Jobs · Pricing · Tracking · Payments ·   │
│                  Notifications · Documents · Audit                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.3 Design principles for every product

1. **One job spine** — canonical states from Phase 1 §8.  
2. **Fewest decisions** — each screen earns its keep (detail in Phase 9).  
3. **Role purity** — a driver never sees enterprise billing chrome.  
4. **Calm under failure** — exception UX is first-class, not an afterthought.  
5. **Premium coherence** — same brand language across all surfaces (Phase 8).  
6. **Assist, don’t obscure** — AI suggests; humans (and rules) remain accountable.

---

## 2. Shared Platform Capabilities (Product View)

These are **not** separate customer products; they are shared capabilities every product consumes. System decomposition is Phase 5; here we define **product contracts**.

| Capability | Product contract |
|------------|------------------|
| **Identity & access** | Who can act; org membership; roles |
| **Job / delivery service** | Lifecycle, state transitions, reason codes |
| **Pricing & quotes** | Quote, confirm, contract rates |
| **Dispatch & assignment** | Eligibility, assign, reassign, backup |
| **Tracking & events** | Location, milestones, audit trail |
| **Proof & verification** | POD, pickup checks, evidence packs |
| **Payments & settlement** | Customer charges, driver pay, invoices |
| **Notifications** | Push, SMS, email, in-app — truthful triggers |
| **Support / cases** | Tickets linked to jobs & people |
| **Documents** | IDs, contracts, PODs, claim packs |
| **Configuration** | Zones, service types, rules, feature flags |
| **AI assistance** | Recommendations with explanation + override |

---

## 3. Product Definitions

### 3.1 P01 — Customer App

**Purpose:** The calm demand surface for SMB and consumer shippers—and a lightweight recipient experience—to book, track, and resolve without training.

**Primary jobs**
- Create and confirm a delivery  
- Pay / store payment method (per rules)  
- Track status with truthful ETAs / confidence  
- Manage addresses & saved preferences  
- Receive exception updates and choose next actions  
- Rate completed jobs  
- Contact support with job context attached  

**Recipient mode (same app or deep link)**
- View inbound delivery  
- Coordinate access / alternate instructions (bounded)  
- Confirm receipt when required by tier  

**Must never**
- Expose dispatch internals  
- Invent “on the way” without state truth  
- Require a manual to complete a standard send  

**MVP boundary (product, not build plan)**  
Book → pay/confirm → track → POD visibility → support entry → rate.  
Multi-stop, complex approvals, heavy analytics → later / Enterprise.

**Key dependencies:** Job spine, pricing, payments, tracking, notifications, support.

---

### 3.2 P02 — Driver App

**Purpose:** Execution cockpit that reduces stress—clear next action, fair economics visibility, safe exception paths.

**Primary jobs**
- Go on/off duty  
- Receive / accept / view assigned jobs (per assignment mode)  
- Navigate to pickup / dropoff  
- Execute verification & POD flows  
- Declare exceptions & incidents  
- See earnings & job history  
- Access driver support  

**Must never**
- Overwhelm with enterprise dashboards  
- Hide how pay was calculated for a job  
- Incentivise unsafe multi-job overload  

**MVP boundary**  
Duty → assigned job → pickup verify → navigate → deliver/POD → earnings for that job → exception declare.  
Advanced bidding markets, social features → out of scope.

**Key dependencies:** Dispatch, tracking, proof, navigation/maps, notifications, settlement (earnings), support.

---

### 3.3 P03 — Enterprise Portal

**Purpose:** Governed demand surface for organisations—multi-user control, visibility, billing artefacts, SLA confidence.

**Primary jobs**
- Org structure, users, roles, approval policies  
- Create jobs (UI) and monitor fleets of jobs  
- Upload / integrate order intake (API contract owned in Phase 5; portal shows status)  
- Live ops visibility for their volume  
- Exception collaboration with SWIFT  
- Invoices, statements, cost centres  
- Pilot / SLA dashboards (read)  
- Admin of locations, contacts, preferences  

**Must never**
- Allow shadow processes that bypass audit  
- Show other enterprises’ data  
- Promise SLA tiles that ops cannot back  

**MVP boundary**  
Users/roles → book/monitor jobs → tracking → basic reporting → invoices → support escalation path.  
Deep BI, custom workflow builders → later.

**Key dependencies:** Identity/orgs, jobs, pricing contracts, tracking, finance, support, notifications, Admin-configured entitlements.

---

### 3.4 P04 — Dispatcher Console

**Purpose:** Real-time control room to assign, watch, and recover jobs so the brand promise holds under load.

**Primary jobs**
- Live map / queue of jobs & drivers  
- Assign, reassign, backup allocation  
- Monitor SLA / risk flags  
- Act on exceptions with reason codes  
- Coordinate with support on customer impact  
- Manual overrides with mandatory notes  

**Must never**
- Become a spreadsheet graveyard with no prioritisation  
- Allow silent state changes without audit  
- Optimise utilisation over safety  

**MVP boundary**  
Queues → assign/reassign → exception actions → job detail → driver contact path.  
Full optimisation theatre → AI Ops assisted later.

**Key dependencies:** Dispatch, tracking, jobs, driver duty state, notifications, AI assist (optional), Support (handoffs).

---

### 3.5 P05 — Operations Dashboard

**Purpose:** Management view of network health—not the real-time firehose of dispatch, but patterns, quality, and capacity.

**Primary jobs**
- Service health by zone / tier / hour  
- Promise KPIs (on-time, first-attempt, failures)  
- Supply coverage vs demand  
- Incident & exception trend review  
- Launch readiness / city health (later)  

**Must never**
- Duplicate every dispatcher click-path  
- Reward vanity volume over promise KPIs  

**MVP boundary**  
KPI boards + exception trends + capacity snapshot.  
Full scenario planning → BI / later.

**Key dependencies:** Jobs/events analytics feeds, incidents, fleet capacity summaries, BI overlap (clarify ownership §6).

---

### 3.6 P06 — Finance Dashboard

**Purpose:** Money truth—customer charges, driver/fleet settlements, invoices, disputes, reconciliation.

**Primary jobs**
- Job-level commercial outcomes  
- Customer invoices & collections status  
- Driver/fleet payout batches  
- Adjustments, credits, claim-related finance  
- Margin / take-rate operational views (appropriate level)  
- Export for accounting  

**Must never**
- Pay drivers on chat screenshots  
- Let support credits bypass finance rules without audit  

**MVP boundary**  
Job commercial ledger → payout runs → invoices → adjustments with reason codes.  
Full ERP replacement → never; integrate later.

**Key dependencies:** Pricing, payments, jobs states, claims outcomes, enterprise contracts, Admin tax/config.

---

### 3.7 P07 — Fleet Dashboard

**Purpose:** Partner/fleet lens on their drivers, vehicles, compliance, performance, and earnings.

**Primary jobs**
- Manage fleet drivers & vehicles (within SWIFT rules)  
- Compliance document status  
- Visibility of assigned/completed work  
- Fleet-level performance  
- Earnings / statements for the fleet entity  

**Must never**
- Override SWIFT safety / eligibility rules  
- See cross-fleet competitive private data  

**MVP boundary**  
Roster + vehicle compliance + job visibility + earnings.  
Shift optimisation suites → later.

**Key dependencies:** Identity (fleet org), driver/vehicle records, jobs, settlement, Admin rules, Driver App execution.

---

### 3.8 P08 — Admin Portal

**Purpose:** Platform configuration and privileged control—service catalogue, zones, rules, users, feature flags, policy switches.

**Primary jobs**
- Service types & packaging toggles  
- Zones / geofences / serviceability  
- Pricing rule parameters (governed)  
- Role templates & staff access  
- Policy flags (e.g., COD enabled?)  
- Catalogue of reason codes  
- Audit log search  
- City launch configuration  

**Must never**
- Be the daily dispatch tool  
- Allow ungoverned price-floor destruction without authority trail  

**MVP boundary**  
Users/roles · zones/serviceability · reason codes · feature flags · audit search.  
Complex rules engines UX → iterate carefully.

**Key dependencies:** All capabilities (configures them); strongest coupling to Identity, Pricing, Dispatch rules.

---

### 3.9 P09 — AI Operations Centre

**Purpose:** Assistive intelligence for ops—prediction, triage suggestions, anomaly highlights—with explanation and human override.

**Primary jobs**
- Risk job / ETA confidence assists  
- Suggested reassignments / backup triggers  
- Exception triage ranking  
- Fraud / anomaly highlights  
- Post-hoc pattern narratives for ops leads  

**Must never**
- Autonomously lie to customers  
- Apply opaque driver punishment  
- Ship as a toy chatbot on the brand surface first  

**MVP boundary**  
Read-only recommendations inside Dispatcher / Ops.  
Closed-loop autonomous dispatch → explicit later amendment.

**Key dependencies:** Event streams, jobs, dispatch, Support signals; Governance from Phase 1 AI ethics stance.

---

### 3.10 P10 — Support Centre

**Purpose:** Trust-recovery workplace—cases linked to real job truth, empowered resolution, escalation to dispatch/ops.

**Primary jobs**
- Case intake (phone/chat/email/in-app)  
- Customer / driver / enterprise context  
- Job timeline & evidence  
- Resolutions: reattempt, credit (ruled), claim open, escalate  
- Knowledge alignment with brand voice  
- Quality / wrap-up codes  

**Must never**
- Invent status contradictory to job spine  
- Become the permanent patch for broken product truth  

**MVP boundary**  
Case ↔ job linkage · timeline · contact tools · credit/claim/escalation actions · macros.  
Full contact-centre telephony stack detail → vendor decision in Phase 5.

**Key dependencies:** Jobs, identity, notifications, finance adjustments, dispatch escalation, documents/evidence.

---

### 3.11 P11 — Business Intelligence

**Purpose:** Decision-grade analytics for leadership and functional heads—trends, cohorts, corridor performance, commercial health.

**Primary jobs**
- Executive promise & growth boards  
- Cohort retention / repeat behaviour  
- Corridor & city performance  
- Enterprise account health  
- Funnel & acquisition quality (when marketing data exists)  

**Must never**
- Replace real-time dispatch  
- Present unaudited vanity metrics as truth  

**MVP boundary**  
Curated executive + ops boards from warehouse.  
Self-serve infinite exploration → controlled rollout.

**Key dependencies:** Analytics pipeline (Phase 5/6); reads from job/finance/support facts; no write-back to lifecycle except via formal ops actions.

---

## 4. Role → Product Matrix

| Role | Primary product | Secondary |
|------|-----------------|-----------|
| Customer (SMB / consumer) | Customer App | Support (via app) |
| Recipient | Customer App (recipient mode) | Notifications |
| Enterprise coordinator / admin | Enterprise Portal | Support Centre (named), BI (limited) |
| Driver | Driver App | Support (driver) |
| Fleet manager | Fleet Dashboard | Driver App (visibility only via fleet) |
| Dispatcher | Dispatcher Console | Ops Dashboard, AI Ops |
| Operations manager | Operations Dashboard | Dispatcher, AI Ops, BI |
| Support agent | Support Centre | Job read-only lenses |
| Finance officer | Finance Dashboard | Admin (read config), Enterprise billing views |
| Administrator | Admin Portal | All (break-glass, audited) |
| Sales representative | Enterprise Portal (limited) + external deck | BI account views (later) |
| Executive | BI | Ops Dashboard |

Detailed permissions → **Phase 3**.

---

## 5. How Products Communicate

### 5.1 Communication doctrine

Products do **not** peer-wire ad hoc. They communicate through the **shared spine** via:

1. **Commands** — user intents that request state change (create job, assign, deliver).  
2. **Queries** — read models shaped per product.  
3. **Events** — immutable facts (`JobConfirmed`, `DriverAssigned`, `DeliveryFailedAttempt`, …).  
4. **Notifications** — human-facing projections of events.  
5. **Cases / incidents** — cross-team collaboration objects linked to jobs.

> If two products disagree, the **event-sourced job timeline** wins—not the loudest UI.

### 5.2 Canonical interaction map

```text
Customer App ──create/confirm/cancel──► Job Spine
Enterprise Portal ──create/bulk/monitor──► Job Spine
Job Spine ──quote/price──► Pricing Capability
Job Spine ──needs assignment──► Dispatch Capability
Dispatcher Console ──assign/reassign/backup──► Dispatch Capability
Dispatch ──assignment events──► Driver App
Driver App ──pickup/POD/exception──► Job Spine
Job Spine ──tracking events──► Customer App · Enterprise · Dispatcher · Support
Job Spine ──billable outcomes──► Finance Dashboard
Finance ──payouts/invoices──► Driver App · Fleet · Enterprise Portal
Exceptions/S1 ──open──► Support Centre · Incidents
Support ──credits/claims/escalations──► Finance · Dispatch · Job Spine
Fleet Dashboard ◄──roster/compliance/perf──► Driver/Vehicle records ↔ Dispatch eligibility
Admin Portal ──configures──► Pricing · Dispatch rules · Zones · Flags · Roles
AI Ops Centre ──reads events / suggests──► Dispatcher · Operations (human confirms)
Operations Dashboard · BI ──read aggregates──► Analytics projections (no silent lifecycle writes)
Notification Service ──fans out──► all human products
```

### 5.3 Pairwise communication matrix

Legend: **C** command · **E** event subscription · **Q** query/read · **N** notify · **X** collaborate object · **—** no direct need

| From ↓ / To → | Cust | Drv | Ent | Disp | Ops | Fin | Fleet | Admin | AI | Supp | BI |
|---------------|------|-----|-----|------|-----|-----|-------|-------|----|------|-----|
| **Customer** | — | — | — | — | — | — | — | — | — | C/X | — |
| **Driver** | — | — | — | E/X | — | Q | Q | — | — | C/X | — |
| **Enterprise** | — | — | — | — | Q | Q | — | — | — | C/X | Q |
| **Dispatcher** | N* | C/N | N* | — | E | — | Q | Q | Q | X | — |
| **Operations** | — | — | — | Q | — | Q | Q | Q | Q | Q | Q |
| **Finance** | N | N | N/Q | — | Q | — | N/Q | Q | — | X | Q |
| **Fleet** | — | Q/N | — | E | Q | Q | — | Q | — | X | Q |
| **Admin** | — | — | — | — | — | — | — | — | — | — | — |
| **AI Ops** | — | — | — | Q/C† | Q | — | — | — | — | Q | Q |
| **Support** | N/X | N/X | N/X | X | X | C/X | — | Q | Q | — | — |
| **BI** | — | — | Q | — | Q | Q | Q | — | Q | Q | — |

\* Via notifications / shared job truth, not private chat as system of record.  
† Suggestions only until autonomy is explicitly approved in a later amendment.

Admin configures capabilities consumed by all; it rarely “talks to” products pairwise—it **shapes** them.

### 5.4 Example end-to-end: failed first attempt

1. Driver App → event `FailedAttempt` + reason + evidence.  
2. Job Spine updates state; Notification → Customer App + Enterprise watchers.  
3. Dispatcher Console queue surfaces risk; AI Ops may rank severity.  
4. Customer chooses reattempt window (or Support assists).  
5. Dispatch assigns (same or backup driver).  
6. If claim: Support opens case → Finance adjustment rules → BI later counts claim rate.

---

## 6. Boundary Clarifications (Avoid Duplicate Products)

| Ambiguity | Ruling |
|-----------|--------|
| Ops Dashboard vs BI | **Ops** = near-real-time operational health; **BI** = analytical, historical, strategic |
| Ops Dashboard vs Dispatcher | **Dispatcher** = action now; **Ops** = manage patterns & capacity |
| AI Ops vs Dispatcher | **AI** embeds into Dispatcher/Ops; AI Centre is the governance/monitoring surface for assists |
| Support vs Customer App chat | Customer starts in app; agents work in **Support Centre** on the same case |
| Fleet vs Admin | Fleet manages *their* assets; Admin sets *platform* rules |
| Enterprise vs Customer App | Same job spine; Enterprise adds org governance, billing, multi-user |
| Finance vs Enterprise invoices UI | Enterprise **views** artefacts; Finance **owns** ledger truth & payouts |

---

## 7. Build Sequencing (Product Priority — Not Dev Tasks)

Aligned with Phase 1 (SMB beachhead, controlled platform):

| Wave | Products | Intent |
|------|----------|--------|
| **Wave 0** | Shared spine contracts (product definition) | One truth |
| **Wave 1** | Customer App · Driver App · Dispatcher Console · Admin (min) · Support (min) | Prove promise in one metro |
| **Wave 2** | Finance Dashboard · Enterprise Portal (pilot-grade) | Money + B2B |
| **Wave 3** | Fleet Dashboard · Operations Dashboard | Supply partners + ops maturity |
| **Wave E** | E-hailing (people mobility) — **parked** | Design only **after** Wave 2 Finance complete; see `39_WAVE_EHAILING_PARKED.md` |
| **Wave 4** | AI Operations Centre · Business Intelligence | Intelligence after data exists |
| **Wave 5** | Harden all for multi-city | Expansion readiness |

**Wave E** does not change the parcel job spine until a separate design is approved. Module-level engineering roadmap → **Phase 10**. This is product capability sequencing only.

---

## 8. Non-Goals for Phase 2

- Screen-by-screen UI → Phase 9  
- Persona permissions & KPIs detail → Phase 3  
- BPMN process maps → Phase 4  
- Microservices / API / cloud → Phase 5  
- Data models → Phase 6  
- Security controls detail → Phase 7  
- Visual design system → Phase 8  
- Application code → never in these phases  

---

## 9. Decisions Log (Phase 2)

| ID | Decision |
|----|----------|
| P-D1 | 11 products as lenses on one job spine; no private realities |
| P-D2 | Shared capabilities listed as product contracts; systems come in Phase 5 |
| P-D3 | AI Ops is assistive and ops-facing first; not a customer status oracle |
| P-D4 | Support Centre is the agent workplace; Customer App is intake + self-serve |
| P-D5 | Ops Dashboard ≠ BI ≠ Dispatcher — three distinct jobs |
| P-D6 | Wave sequencing: Demand+Supply+Dispatch+min Admin/Support before enterprise depth and AI/BI |
| P-D7 | Recipient experience lives in Customer App (mode/deep link), not a 12th consumer product |
| P-D8 | Products communicate via commands, queries, events, notifications, cases—not ad hoc peer hacks |

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| Building Wave 4 toys before Wave 1 trust | Enforce wave gates in Phase 10 |
| Enterprise Portal becoming a second dispatch | Keep enterprise actions demand-side; ops actions stay in Dispatcher/Support |
| AI recommendations without override UX | Mandatory explain + human confirm in P-D3 |
| Finance and Support both issuing credits | Single adjustment capability with dual entry + audit |
| Fleet Dashboard fighting Admin rules | Eligibility always evaluated by platform rules, not fleet preference |
| Notification spam destroying calm brand | Notification taxonomy owned with job events (Phase 4/5) |

---

## 11. Assumptions

| # | Assumption | If false |
|---|------------|----------|
| P-A1 | Mobile-first for Customer & Driver; web-first for control products | Device strategy shifts |
| P-A2 | One Customer App serves shipper + recipient modes | Separate recipient app increases scope |
| P-A3 | Dispatcher Console is web (desktop-class), not phone-first | Staffing model / hardware changes |
| P-A4 | Enterprise API is part of Enterprise capability but not a separate “product logo” in the suite | May market API as product later |
| P-A5 | AI Centre may ship initially as views inside Dispatcher/Ops before standalone shell | Packaging change only |
| P-A6 | English-first UI copy across products at launch | Localisation wave needed earlier |
| P-A7 | Phase 1 COD deferral still holds — payment UX omits COD in Wave 1 | Customer/Finance/Driver scope grows |

---

## 12. Approval Checklist

- [ ] Suite of 11 products is complete and correctly bounded  
- [ ] Shared spine thesis accepted  
- [ ] Communication matrix / doctrine accepted  
- [ ] Wave sequencing accepted  
- [ ] Assumptions P-A1–P-A7 accepted or amended  
- [ ] Ready to open Phase 3 — User Architecture  

**Approval response options:**  
`APPROVE PHASE 2` · `APPROVE PHASE 2 WITH AMENDMENTS: …` · `REVISE: …`
