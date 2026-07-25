# Phase 5 — System Architecture

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED  
**Approved:** 2026-07-20  
**Depends on:** Phases 1–3 approved · Phase 4 family (**APPROVED** 2026-07-20 with 4B + 4C)  
**Phase gate:** Phase 5 locked as baseline. Amendments require explicit revision. Phase 6 unlocked.

---

## 0. Executive Position

Phases 1–4 defined *why*, *what products*, *who*, and *how work flows*. Phase 5 defines the **software machine** that encodes those processes—without writing production code.

### Board challenges

| Temptation | Verdict | Why |
|------------|---------|-----|
| Microservices from day one | **Reject as default** | Small team + African launch realities → distributed complexity kills reliability |
| One spaghetti monolith | **Reject** | Cannot evolve Dispatch/Pricing/Tracking safely |
| Build AI Engine before Job spine | **Reject** | Violates Wave sequencing (Phase 2) |
| Customer-facing AI status oracle | **Reject** | Phase 2 P-D3 |
| **Modular platform (service-shaped modules) + managed cloud + explicit extraction criteria** | **Adopt** | Enterprise seams without Netflix cosplay |

### System architecture thesis

> The platform is a **control plane for trustworthy jobs**.  
> Every client is a lens; every module speaks through **APIs + events**.  
> **Reliability, auditability, and degraded-mode honesty** beat fashionable topology.

---

## 1. Architecture Style Decision

### 1.1 Target style: Modular platform

```text
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT EXPERIENCES                        │
│  Mobile (Customer · Driver)  ·  Web (Enterprise · Control)   │
├─────────────────────────────────────────────────────────────┤
│                     EDGE / ACCESS                             │
│           API Gateway  ·  AuthN/AuthZ  ·  WAF/CDN            │
├─────────────────────────────────────────────────────────────┤
│                 APPLICATION PLATFORM                          │
│   Domain modules (deployable as one unit initially)           │
│   + async workers  +  realtime gateway                        │
├─────────────────────────────────────────────────────────────┤
│                 DATA & MESSAGING                              │
│   Primary DB  ·  Cache  ·  Object store  ·  Event bus         │
├─────────────────────────────────────────────────────────────┤
│                 CLOUD FOUNDATION                              │
│   Compute  ·  Network  ·  Secrets  ·  Observability           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Modular monolith now → services later

**Wave 1–2:** Single primary deployable application composed of hard module boundaries (domains below), plus separately scalable **workers** and a **realtime/tracking ingest** path.

**Extract to independent services when** (any two true):
- Independent scale pain (e.g. GPS ingest vs booking)
- Independent failure domain required
- Separate team ownership with clear API contract
- Regulatory isolation needed

**Not a reason to extract:** “Uber has microservices.”

### 1.3 Domain modules (logical services)

| Module | Encodes processes | Notes |
|--------|-------------------|-------|
| **Identity & Access** | PR01, PR24 users, staff IAM | AuthN/Z source of truth |
| **Org & Enterprise** | PR24 | Orgs, contracts, sites |
| **Catalogue & Config** | Admin flags, zones, reason codes | PR25 config audit |
| **Quoting & Pricing** | PR04 | Pricing Engine |
| **Jobs / Booking** | PR03, PR20 mutations | Job spine |
| **Dispatch** | PR05, PR06, PR18 | Dispatch Engine |
| **Tracking** | PR23 | GPS Engine + integrity |
| **Execution / Proof** | PR07–PR09, PR08 | Pickup/delivery/POD |
| **Payments** | PR10 | Payment Service |
| **Settlements** | PR11, PR14 adjustments | Ledger-oriented |
| **Support / Cases** | PR13 | Support Centre backend |
| **Claims & Insurance** | PR15 | Partner orchestration |
| **Incidents** | PR17, PR19, PR21, PR22 | Safety command |
| **Notifications** | Cross-cutting | Notification Service |
| **Documents** | Onboarding, POD media | Object metadata |
| **Reporting / Audit** | PR25 | Event log + pack assembly |
| **Analytics projections** | BI reads | Warehouse feeder |
| **AI Assist** | P09 assist only | AI Engine (later wave) |

These are **logical microservices** (clear APIs). Physical deploy topology follows §1.2.

---

## 2. Frontend Architecture

### 2.1 Client portfolio

| Client | Type | Primary users | Online needs |
|--------|------|---------------|--------------|
| **Customer App** | iOS + Android (one codebase preferred) | U01, recipients | Booking, track, support entry |
| **Driver App** | iOS + Android | U03 | Duty, navigation, proof, **Emergency** |
| **Enterprise Portal** | Web responsive | U02, U10 (limited) | Org, book, monitor, billing views |
| **Dispatcher Console** | Web desktop-class | U05 | Realtime queues/map |
| **Operations Dashboard** | Web | U06 | Health KPIs |
| **Finance Dashboard** | Web | U08 | Ledger, payouts, invoices |
| **Fleet Dashboard** | Web | U04 | Roster, compliance |
| **Admin Portal** | Web | U09 | Config, access, audit search |
| **Support Centre** | Web | U07 | Cases + job truth |
| **AI Ops Centre** | Web (may embed first) | Ops/Dispatch leads | Assist governance |
| **BI** | Web (embedded or BI tool) | Exec/Ops | Curated boards |

### 2.2 Frontend principles

1. **BFF optional later** — start with one public API surface shaped by gateway + client needs; add BFFs if chatty pain appears.  
2. **Design system shared** (Phase 8) across web; mobile follows same tokens.  
3. **Optimistic UI only where reversible**; never optimistic `DELIVERED`.  
4. **Driver offline/degraded mode** is first-class (queue proofs, retry).  
5. **Emergency controls** always reachable on active custody jobs (4B WC-D8).  
6. **No business logic forks** that contradict server state machine.

### 2.3 Realtime on clients

- Customer/Enterprise/Dispatch: subscribe to job/event channels (WebSocket or equivalent) via gateway.  
- Driver: high-priority push + local foreground tracking service.  
- Fallback: polling when realtime unavailable — truthful degraded banner.

---

## 3. Backend Architecture

### 3.1 Application host

- **API application** — synchronous commands/queries  
- **Worker application(s)** — async: notifications, settlement batches, pack assembly, tracking integrity jobs, outbound webhooks  
- **Realtime gateway** — subscriptions + presence (may colocate initially)

### 3.2 Command / query / event pattern

Aligned with Phase 2 communication doctrine:

| Pattern | Use |
|---------|-----|
| **Commands** | CreateJob, AssignDriver, ConfirmDelivery, RequestMutation, OpenIncident |
| **Queries** | GetJob, ListQueue, EarningsStatement, OrgUsers |
| **Events** | `JobConfirmed`, `DriverAssigned`, `SignalLost`, `DestinationChanged`, `IncidentOpened` |

Clients never write directly to another client’s database. Modules publish domain events to the bus; consumers update projections.

### 3.3 Job state machine (system enforcement)

Server is sole authority for Phase 1 states + 4B/4C hold flags (`INCIDENT_HOLD`, `MUTATION_PENDING`, etc.).  
Illegal transitions rejected with typed errors. All transitions emit audit events (PR25).

---

## 4. API Gateway

### 4.1 Responsibilities

- TLS termination (with cloud edge)  
- Routing to API/realtime  
- Auth token validation (with Identity)  
- Rate limiting & abuse basics  
- Request correlation IDs  
- API versioning exterior (`/v1/...`)  
- WAF / bot controls at edge  

### 4.2 API families

| Family | Consumers |
|--------|-----------|
| `mobile` | Customer + Driver apps |
| `portal` | Enterprise + staff web apps |
| `enterprise` | Partner integrations (API keys / OAuth) |
| `internal` | Workers, admin automation (network restricted) |
| `webhooks` | Outbound signing to enterprise endpoints |

### 4.3 Standards (preview — handbook `API Standards` later)

- JSON over HTTPS  
- Idempotency keys on money & assignment commands  
- Cursor pagination  
- Stable error envelope  
- OpenAPI as contract source  

---

## 5. Authentication & Authorisation

### 5.1 AuthN

| Subject | Method (Wave 1 direction) |
|---------||---------------------------|
| Customers / drivers | OTP / passwordless-first + secure session/refresh tokens |
| Staff | SSO-ready email/password or SSO when available; MFA for privileged roles |
| Enterprise users | Org invite + same consumer-grade auth initially; SSO later (PR24 assumption) |
| Enterprise machines | API keys / OAuth client credentials |
| Services | Workload identity / mTLS or signed service tokens internal |

### 5.2 AuthZ

- **RBAC** from Phase 3 roles + enterprise sub-roles  
- **Scopes:** self · org · fleet · zone · platform  
- **Policy enforcement** in Identity module + resource checks in domain modules  
- Break-glass: time-bound, heavily audited (U09)

Detail matrices → Phase 7. Phase 5 locks **placement**: gateway authenticates; services authorise.

---

## 6. Core Engines & Services

### 6.1 Dispatch Engine

**Purpose:** Eligible set → rank → assign / reassign / backup (PR05, PR06, PR18).

**Inputs:** job requirements, driver duty/eligibility, location freshness, SLA tier, fairness constraints.  
**Outputs:** assignment commands + events.  
**Modes:** auto-assign and/or dispatcher-assisted (city config).  
**Rules:** manual override requires reason code; never assign ineligible/unsafe.  
**Wave 1:** deterministic rules + scoring; not full OR research platform.

### 6.2 Pricing Engine

**Purpose:** Quotes and contract price resolution (PR04).

**Inputs:** zones, distance/time proxies, package class, tier, org rate card, promos.  
**Outputs:** itemised quote + TTL + floors.  
**Governance:** below-floor blocked without authority workflow.  
**Must:** persist quote components for Finance/PR25.

### 6.3 GPS / Tracking Engine (PR23)

**Purpose:** Ingest, validate, store, project location & integrity states.

**Paths:**
- High-volume **ingest API** (separate scale path early if needed)  
- Integrity worker: freshness, teleport, spoof heuristics  
- Projection: last known, confidence, geofence events  

**Outputs:** tracking events to bus; Dispatch alerts on LOST/CONFLICTED; customer-safe projections.

### 6.4 Notification Service

**Channels:** push, SMS, email, in-app; later voice bridge.  
**Rules:** template registry; locale; quiet hours where appropriate; **no lying templates**.  
**Triggers:** domain events only (not random client pushes as source of truth).  
**Priority:** Emergency/S1 pages to staff via on-call integration.

### 6.5 Payment Service

**Purpose:** PR10 customer charges via PSP (Payment Service Provider).

**Capabilities:** method vaulting, auth/capture, refunds, webhook handling, idempotency.  
**Enterprise:** invoice mode may defer capture to billing module.  
**COD:** not in Wave 1.  
**Never:** store raw card PAN on SWIFT infra.

### 6.6 Settlement Service

**Purpose:** PR11 earnings calculation, batches, payouts via PSP/banking partner; PR14 adjustments linkage.  
**Freeze hooks:** incidents/theft/claims.

### 6.7 AI Engine (Wave 4 capability)

**Purpose:** Assist Dispatch/Ops (risk rank, suggested reassign, anomaly hints).  
**Placement:** reads events/features; writes **suggestions**, not silent job mutations (unless future approved autonomy amendment).  
**Hard rule:** no customer-facing invented status.

### 6.8 Reporting & Analytics

| Tier | Role |
|------|------|
| **OLTP audit/event store** | PR25 spine — system of record for “what happened” |
| **Pack assembler worker** | Job/incident/finance evidence packs |
| **Analytics pipeline** | ETL/ELT to warehouse |
| **BI consumption** | Curated dashboards (P11) |

Ops Dashboard near-realtime may use projections/cache; BI uses warehouse.

### 6.9 Monitoring & Observability (platform)

Not a business product—foundation:

- Structured logs with correlation IDs  
- Metrics (RED/USE + business SLIs: assign latency, tracking freshness)  
- Traces for critical command paths  
- Error tracking  
- Uptime synthetic checks on book/assign/track  
- On-call alerting tied to S1/S2 defs  

---

## 7. Cross-Cutting Runtime Flows (System View)

### 7.1 Book → assign → deliver

```text
Client → Gateway → Jobs.Create → Pricing.Quote → Jobs.Confirm
  → Payments.Authorise (if required) → event JobConfirmed
  → Dispatch.Assign → event DriverAssigned → Notify Driver/Customer
  → Tracking.SessionStart on pickup
  → Execution.POD → Jobs.Delivered → Settlements.Eligible → Notify → Rate
```

### 7.2 Lost signal mid-custody (PR23)

```text
Tracking integrity worker → SignalLost event
  → Dispatch task created → Notify on-call dispatcher
  → Customer projection: last known + honest degraded copy
  → If unresolved + risk → Incidents path (WC-05)
```

### 7.3 Medical emergency (PR22 / WC-01)

```text
Driver App Emergency → Incidents.Open(MEDICAL) + Jobs.Flag(INCIDENT_HOLD)
  → Notify Dispatch S2/S1 → Support/Customer truthful pause
  → Backup allocation module when safe → Tracking transfer
```

### 7.4 Destination change (PR20)

```text
Enterprise/Customer RequestMutation → Pricing.Requote
  → Dispatch feasibility → Driver accept command
  → Jobs.ApplyMutation + audit → Notify parties
```

---

## 8. Cloud Infrastructure Architecture

### 8.1 Principles

1. **One primary region** at Wave 1 (beachhead), with backup/DR strategy defined before multi-city criticality.  
2. **Managed services preferred** (DB, queue, secrets, observability).  
3. **Infrastructure as code** mandatory.  
4. **Separate environments:** dev · staging · production (Phase 1 handbook deployment stance).  
5. **Least privilege** cloud IAM.  
6. Design for **imperfect connectivity** on driver devices.

### 8.2 Logical cloud blueprint

```text
[ CDN / WAF / DNS ]
        │
[ API Gateway / Load Balancer ]
        │
[ App services: API · Workers · Realtime ]
        │
[ Primary DB ] [ Cache ] [ Object Storage ]
[ Event Bus / Queue ]
[ Secrets Manager ] [ Observability stack ]
[ PSP / SMS / Maps / Push — egress via controlled connectors ]
```

### 8.3 Environment & tenancy

- Single-tenant SWIFT control plane (not white-label multi-tenant chaos at start)  
- Enterprise data isolation via authorisation + row/org scoping (DB detail Phase 6)  
- Secrets never in app images  

### 8.4 DR / backup (directional)

- Automated DB backups + tested restore  
- Multi-AZ for production stateful stores  
- RPO/RTO targets set with Ops before launch (assumption: launch-class, not bank-grade active-active yet)

### 8.5 Third-party systems (connectors)

| Concern | External |
|---------|----------|
| Cards / payouts | PSP |
| SMS / WhatsApp business (if any) | CPaaS — WhatsApp never source of truth |
| Maps / routing | Maps platform |
| Push | APNs / FCM |
| Email | Transactional email |
| Insurance | Partner APIs |
| On-call | Pager tool |
| Contact centre (optional) | Telephony vendor ↔ Support Centre |

All connectors behind anti-corruption modules; outages degrade honestly.

---

## 9. Security Placement (Preview of Phase 7)

| Control | Where |
|---------|-------|
| AuthN | Gateway + Identity |
| AuthZ | Domain modules |
| Encryption in transit | TLS everywhere |
| Encryption at rest | Cloud managed + app-level for highly sensitive fields if needed |
| PII minimisation | Tracking projections, support views |
| Fraud hooks | Pricing/Jobs/Tracking/Payments events → risk review |
| Audit | PR25 event spine |

Full security architecture → Phase 7.

---

## 10. Scalability Strategy

| Layer | Wave 1 | Growth |
|-------|--------|--------|
| API | Vertical + horizontal replicas | Shard by domain extract |
| Tracking ingest | Separate path early if write-heavy | Partition by driver/job |
| Dispatch | In-module; city-scoped queues | Dedicated dispatch service |
| DB | Primary + replicas | Read replicas; later CQRS for hot reads |
| Notifications | Worker concurrency | Per-channel providers |
| Analytics | Batch ETL | Streaming where justified |

**Scale for promise KPIs**, not vanity QPS screenshots.

---

## 11. Degraded Mode Architecture (Mandatory)

| Failure | System behaviour |
|---------|------------------|
| Maps down | Cached geocodes; manual Dispatch assist; delay honesty |
| PSP down | Block new paid confirms; enterprise invoice path may continue if configured |
| Tracking ingest down | Last-known; Dispatch voice bridge; no auto-deliver |
| Notification provider down | Retry + alternate channel; in-app inbox durable |
| Primary DB failover | Maintenance honesty banner; no split-brain writes |

---

## 12. Mapping: Products → System

| Product (Phase 2) | Primary modules |
|-------------------|-----------------|
| Customer App | Identity, Jobs, Pricing, Payments, Tracking, Notifications, Support |
| Driver App | Identity, Dispatch, Tracking, Execution, Settlements(read), Incidents |
| Enterprise Portal | Org, Jobs, Pricing, Tracking, Finance(read), Support |
| Dispatcher Console | Dispatch, Tracking, Jobs, Incidents, AI(later) |
| Ops Dashboard | Analytics projections, Incidents |
| Finance Dashboard | Payments, Settlements, Claims |
| Fleet Dashboard | Identity/Fleet, Documents, Jobs(read), Settlements(read) |
| Admin Portal | Config, Identity, Audit search |
| Support Centre | Cases, Jobs(read), Adjustments, Claims |
| AI Ops | AI Engine + read models |
| BI | Warehouse + semantic metrics |

---

## 13. Explicit Non-Goals (Phase 5)

- Choosing final language/framework brands without team constraint workshop (recommend record in Tech Stack handbook after approval)  
- Physical ERD → Phase 6  
- Full RBAC matrix tables → Phase 7  
- UI kit → Phase 8  
- Screen inventory → Phase 9  
- Sprint breakdown → Phase 10  
- Production code, IaC repos, or cloud account setup in this phase  

---

## 14. Decisions Log (Phase 5)

| ID | Decision |
|----|----------|
| S-D1 | Modular platform (service-shaped modules), not microservices-first |
| S-D2 | Separate API, workers, realtime/tracking ingest paths as first scalability seams |
| S-D3 | Server-authoritative job state machine + audit events on all material transitions |
| S-D4 | Gateway AuthN; domain AuthZ; enterprise API family distinct |
| S-D5 | Engines: Dispatch, Pricing, Tracking, Notifications, Payments, Settlements, AI(later), Reporting/Audit |
| S-D6 | Managed cloud, IaC, one primary region at Wave 1 |
| S-D7 | Degraded-mode honesty is architectural, not UX polish |
| S-D8 | AI Engine suggest-only until autonomy explicitly approved |
| S-D9 | PSP holds card data; SWIFT holds payment references + ledger |
| S-D10 | WhatsApp/CPaaS never becomes system of record |

---

## 15. Risks

| Risk | Mitigation |
|------|------------|
| Premature microservice split | Extraction criteria §1.2 enforced in Phase 10 |
| Tracking volume melts API | Dedicated ingest path |
| God-module “Jobs” absorbs everything | Hard module boundaries + reviews |
| Multi-region too early | Single region until ops maturity |
| Vendor lock myths delaying launch | Prefer managed; abstract connectors |
| Staff tools realtime over-engineering | Start WebSocket where needed; poll fallback |

---

## 16. Assumptions

| # | Assumption | If false |
|---|------------|----------|
| S-A1 | Beachhead single-region cloud is acceptable at launch | DR topology changes |
| S-A2 | Native mobile via cross-platform codebase is preferred (team TBD) | Two native teams |
| S-A3 | OTP-friendly telephony/SMS available in beachhead | Auth redesign |
| S-A4 | Card PSP + payout rail available | Payments timeline slips |
| S-A5 | Team can operate one primary deployable + workers before many repos | Hiring/topology change |
| S-A6 | Exact cloud vendor chosen in Tech Stack follow-up, not blocking Phase 5 logic | Implementation detail |

---

## 17. Approval Checklist

- [ ] Modular platform (not microservices-first) accepted  
- [ ] Client portfolio & backend module map accepted  
- [ ] Gateway / AuthN / AuthZ placement accepted  
- [ ] Engines list & Wave placement of AI accepted  
- [ ] Cloud blueprint & degraded-mode doctrine accepted  
- [ ] Assumptions S-A1–S-A6 accepted or amended  
- [ ] Ready to open Phase 6 — Database Architecture  

**Approval response options:**  
`APPROVE PHASE 5` · `APPROVE PHASE 5 WITH AMENDMENTS: …` · `REVISE: …`
