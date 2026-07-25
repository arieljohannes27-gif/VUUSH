# Phase 6 — Database Architecture

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED  
**Approved:** 2026-07-20  
**Depends on:** Phases 1–4 family approved · Phase 5 (**APPROVED** 2026-07-20)  
**Phase gate:** Phase 6 locked as baseline. Amendments require explicit revision. Phase 7 unlocked.

---

## 0. Executive Position

Phase 5 defined the modular platform. Phase 6 defines the **data truth**: entities, relationships, integrity rules, indexing strategy, and storage placement—so Jobs, money, custody, and audit never disagree.

### Board challenges

| Temptation | Verdict | Why |
|------------|---------|-----|
| One mega-table “orders” for everything | **Reject** | Destroys audit and settlements |
| Micro-databases per module on day one | **Reject** | Distributed transactions before team maturity |
| Store card PANs / raw KYC dumps casually | **Reject** | Security and compliance failure |
| Soft-delete as the only history | **Reject** | PR25 needs immutable event spine |
| **Primary relational store + event/audit log + object store + analytics warehouse** | **Adopt** | Fits modular monolith and process spine |

### Data architecture thesis

> The **Job** is the commercial/operational spine.  
> The **Audit/Event log** is the proof spine.  
> Money, people, and documents orbit those spines with hard foreign integrity.  
> What customers see is a **projection**; what courts/enterprises need is the **log**.

---

## 1. Storage Topology

| Store | Role | Holds |
|-------|------|-------|
| **Primary OLTP DB** (relational) | System of record for entities & current state | Users, orgs, jobs, assignments, ledgers refs, cases |
| **Event / audit log** | Append-only facts (PR25) | State transitions, overrides, access-sensitive actions |
| **Cache** | Hot read projections | Session, queues, last-known tracking summary |
| **Object storage** | Blobs | POD photos, documents, evidence packs exports |
| **Tracking time-series / append store** | High-volume breadcrumbs | Raw/near-raw GPS points (retention-limited) |
| **Search (optional Wave 2)** | Support/Admin findability | Cases, jobs by attributes |
| **Analytics warehouse** | BI / reporting | Transformed facts & dimensions |

**Wave 1 physical choice:** one primary relational database (schemas/modules as namespaces), plus object store, plus either (a) `audit_events` table in OLTP or (b) dedicated log store—**board prefers OLTP `audit_events` initially** with archival jobs, extract later if volume demands.

---

## 2. Domain Data Map

```text
Identity ──┬── Organisation (Enterprise)
           ├── Fleet
           ├── Driver ── Vehicle
           └── Customer profiles

Job ── Quote/Price snapshot
   ├── Assignment ── Driver/Vehicle
   ├── Tracking session ── Signals
   ├── Proof artefacts (POD)
   ├── Mutations / holds
   └── Links → Payment · Settlement lines · Case · Claim · Incident

Finance: Payment · Invoice · Payout batch · Adjustment
Trust: Rating · Notification · Document · Insurance attachment
Config: Zone · Service type · Reason code · Feature flag
```

---

## 3. Entity Catalogue

Naming is logical (Phase 5 modules). Physical table names/implementations follow this model; no SQL DDL shipped in this phase.

### 3.1 Identity & people

| Entity | Purpose | Key attributes (logical) |
|--------|---------|--------------------------|
| **User** | Login identity | id, contact channels, status, auth refs |
| **UserProfile** | Display/persona fields | name, locale, avatar ref |
| **RoleBinding** | Platform/staff RBAC | user_id, role, scope (zone/platform) |
| **Session / RefreshToken** | Auth sessions | hashes only, expiry, device meta |
| **Device** | App installs | user_id, platform, push tokens, last_seen |

### 3.2 Organisations & enterprise (PR24)

| Entity | Purpose |
|--------|---------|
| **Organisation** | Legal/commercial account |
| **OrgMembership** | User ↔ org + enterprise sub-role |
| **OrgContract** | Versioned MSA/SLA/commercial attachment |
| **RateCard** | Contract pricing rules ref |
| **BillingProfile** | Invoice terms, tax ids, billing contacts |
| **Site / LocationBook** | Org addresses & contacts |
| **IntegrationProfile** | API mode, webhook endpoints, key refs |
| **OrgLifecycleStatus** | prospect→offboarded (PR24 stages) |

### 3.3 Drivers, fleets, vehicles (PR02)

| Entity | Purpose |
|--------|---------|
| **Driver** | Executable supply profile linked to User |
| **DriverEligibility** | Compliance state, city, onboarding status |
| **DriverDocument** | Licence/ID docs → object refs + expiry |
| **Vehicle** | Plate, class, photos, insurance refs |
| **Fleet** | Partner fleet org |
| **FleetMembership** | Driver ↔ fleet |
| **DutyStatus** | on/off duty, timestamps |

### 3.4 Customers

| Entity | Purpose |
|--------|---------|
| **CustomerAccount** | Shipper profile (individual/SMB) linked to User |
| **SavedAddress** | Address book |
| **PaymentMethodRef** | PSP token references only |

*Recipients* may be lightweight contacts on a Job, not full users, until they claim an account.

### 3.5 Catalogue & config

| Entity | Purpose |
|--------|---------|
| **ServiceType / ServiceTier** | Standard, Priority, etc. |
| **Zone** | Serviceability polygons/refs |
| **ReasonCode** | Failures, overrides, incidents (4B set) |
| **FeatureFlag** | COD off, city launch toggles |
| **ProhibitedGoodsPolicy** | Declaration catalogue |
| **NotificationTemplate** | Channel templates versioned |

### 3.6 Pricing & booking (PR03–PR04)

| Entity | Purpose |
|--------|---------|
| **Quote** | Priced offer + TTL + component breakdown |
| **Job** | Spine entity — current state, parties, locations, package class |
| **JobParty** | Shipper, pickup contact, recipient contacts |
| **JobLocation** | Pickup/dropoff structured + geocode confidence |
| **JobStateHistory** | Convenience projection (events remain authoritative) |
| **JobHold** | INCIDENT_HOLD, MUTATION_PENDING, AUTHORITY_HOLD, … |
| **JobMutationRequest** | PR20 requests + approvals + price deltas |

### 3.7 Dispatch & execution (PR05–PR09, PR18)

| Entity | Purpose |
|--------|---------|
| **Assignment** | Job ↔ driver/vehicle, mode, timestamps |
| **AssignmentAttempt** | Offers, rejects, timeouts |
| **RoutePlan** | Ordered stops + confidence (Wave 1 simple) |
| **ProofArtefact** | POD/pickup verification items → object refs + type |
| **ExecutionEvent** | Arrived pickup, picked up, etc. (may be audit subtypes) |

### 3.8 Tracking (PR23)

| Entity | Purpose |
|--------|---------|
| **TrackingSession** | Per job (or vehicle-custody) session state |
| **TrackingSignal** | Breadcrumb points (high volume store) |
| **TrackingIntegrityFlag** | stale/lost/conflicted markers |

### 3.9 Payments & settlements (PR10–PR11, PR14)

| Entity | Purpose |
|--------|---------|
| **PaymentIntent / Payment** | Customer charge attempts, PSP ids, status |
| **Invoice** | Enterprise invoices |
| **InvoiceLine** | Job-linked lines |
| **LedgerEntry** | Double-entry or append commercial ledger lines |
| **EarningLine** | Driver/fleet earning for job |
| **PayoutBatch** | Settlement run |
| **PayoutItem** | Per driver/fleet in batch |
| **Adjustment** | Credits/refunds/goodwill with reason + authorities |

### 3.10 Support, claims, incidents

| Entity | Purpose |
|--------|---------|
| **Case** | Support case |
| **CaseMessage / CaseEvent** | Thread & actions |
| **Claim** | Loss/damage claim |
| **InsuranceAttachment** | Declared value + partner policy refs on job |
| **Incident** | S1–S4 incidents |
| **IncidentJobLink** | Multi-job contamination |
| **Rating** | Post-job scores/tags |

### 3.11 Documents, notifications, audit

| Entity | Purpose |
|--------|---------|
| **Document** | Metadata + object key + owner + expiry |
| **Notification** | Outbound notification records |
| **AuditEvent** | Append-only PR25 spine |
| **AuditPackRequest** | Pack generation jobs |
| **ReportSubscription** | Scheduled report defs |
| **MetricDefinition** | Governed KPI definitions (PR25) |

### 3.12 AI (later)

| Entity | Purpose |
|--------|---------|
| **AiSuggestion** | Suggestion payloads + accept/reject |  
| **AiModelRun** | Evaluation metadata (Wave 4+) |

---

## 4. Core Relationships

```text
User 1──* OrgMembership *──1 Organisation
User 1──0..1 Driver
Driver *──* Vehicle (via active vehicle binding)
Fleet 1──* Driver (FleetMembership)
Organisation 1──* Job (enterprise jobs)
CustomerAccount 1──* Job
Job 1──* Quote (usually 1 active)
Job 1──0..* Assignment (latest active)
Assignment *──1 Driver
Job 1──0..1 TrackingSession
TrackingSession 1──* TrackingSignal
Job 1──* ProofArtefact
Job 1──* Payment / InvoiceLine
Job 1──* EarningLine
Job 1──* Case / Claim / Incident (via links)
Job 1──* JobMutationRequest
Job 1──* JobHold
AuditEvent *── polymorphic subject (job_id, org_id, …)
Document *── owner (driver/org/job/case)
```

### Cardinality rules (critical)

1. A Job has **at most one active Assignment** at a time.  
2. `DELIVERED` requires sufficient ProofArtefacts per tier.  
3. Financial Adjustments must reference Job and/or Case and actor.  
4. OrgLifecycleStatus gates whether OrgMemberships can create Jobs.  
5. Driver duty/eligibility gates Assignment creation (DB + app enforce).

---

## 5. Job Record — Canonical Fields (Logical)

| Group | Fields |
|-------|--------|
| Identity | job_id, public_code, created_at, channel (app/portal/api) |
| Parties | shipper_ref, org_id nullable, recipient contacts |
| Geometry | pickup, dropoff, geocode confidence |
| Commercial | service_tier, quote_id, currency, amount snapshot |
| State | state, hold_flags[], last_transition_at |
| Supply | active_assignment_id |
| Risk | prohibited_declaration, insurance_attachment_id |
| Audit | created_by, correlation_id |

State values align Phase 1 §8; holds align Phase 4B §5.

---

## 6. Audit Event Schema (Logical)

| Field | Purpose |
|-------|---------|
| event_id | Unique |
| occurred_at | UTC |
| actor_type / actor_id | user/system |
| action | e.g. JOB_STATE_CHANGED, BREAK_GLASS |
| subject_type / subject_id | job, org, … |
| payload | structured summary (no secrets) |
| reason_code | overrides/failures |
| correlation_id | request chain |
| ip/device fingerprint | when relevant |

**Immutability:** no updates/deletes except legal retention purge process (PR25).

---

## 7. Indexing Strategy (Directional)

Indexes are design intent, not vendor DDL.

| Area | Index intent |
|------|--------------|
| Job | `(state, city/zone, updated_at)`, `(org_id, created_at)`, `(public_code)` unique, `(active_assignment_id)` |
| Assignment | `(driver_id, status)`, `(job_id, status)` |
| Driver | `(eligibility_status, city)`, `(user_id)` |
| TrackingSignal | `(session_id, recorded_at)` — time-ordered; partition/TTL |
| Case | `(status, assignee_id)`, `(job_id)` |
| Payment | `(psp_ref)` unique, `(job_id)` |
| PayoutItem | `(batch_id)`, `(driver_id, period)` |
| AuditEvent | `(subject_type, subject_id, occurred_at)`, `(actor_id, occurred_at)` |
| OrgMembership | `(org_id, user_id)` unique |
| Documents | `(owner_type, owner_id)`, `(expires_at)` |

Hot paths: Dispatch queues, driver active job, customer track-by-code, audit pack assembly by job_id.

---

## 8. Integrity, Consistency & Idempotency

| Concern | Approach |
|---------|----------|
| Job transitions | Transactional update + AuditEvent in same unit of work |
| Payments webhooks | Idempotent upsert on psp_event_id |
| Assignment race | DB constraints / row locks: one active assignment |
| Quote confirm | Quote must be unexpired and bound on confirm |
| Ledger | Append-only entries; corrections via reversing entries |
| Tracking | Signals append-only; session state may update |
| Mutations | MutationRequest state machine; apply once |

**Cross-module note:** Within modular monolith, prefer **single DB transactions** across modules for job+audit+payment refs. After service extraction, use outbox pattern (decision for later).

---

## 9. Retention & Archival

| Data class | Directional policy |
|------------|--------------------|
| Tracking breadcrumbs | Short operational window → aggregate/delete |
| POD / evidence objects | Long (claims/legal) |
| Audit events | Long / compliance-class |
| Job current row | Long; cold archive after years |
| PII of deleted users | PR25 + legal hold process |
| Cache | Ephemeral |

Exact durations await counsel (Phase 4C assumption restated).

---

## 10. PII & Sensitive Data Placement

| Data | Placement |
|------|-----------|
| Card PAN | **Never** — PSP only |
| OTP secrets | Hashed/short-lived |
| National IDs / licence images | Object store + Document meta; encrypted at rest; access audited |
| Precise GPS history | Tracking store; limited staff access |
| Customer phone/email | OLTP with field-level access discipline |
| Break-glass views | Audited |

Security controls detail → Phase 7.

---

## 11. Analytics Model (Logical)

Warehouse facts (later ETL):

- `fact_job` · `fact_assignment` · `fact_payment` · `fact_support_case` · `fact_incident`  
- Dimensions: date, zone, tier, org, driver, fleet, reason_code  

Ops near-realtime dashboards may read OLTP projections/cache; **BI must not hammer OLTP**.

---

## 12. Mapping: Process → Data

| Process | Primary entities |
|---------|------------------|
| PR01 Registration | User, CustomerAccount, Device |
| PR02 Onboarding | Driver, DriverDocument, Vehicle, Eligibility |
| PR03–04 Book/Price | Job, Quote, Locations |
| PR05–06–18 Dispatch | Assignment, RoutePlan |
| PR07–09 Execution | ProofArtefact, Execution/Audit events |
| PR23 Tracking | TrackingSession, TrackingSignal, IntegrityFlag |
| PR10–11–14 Money | Payment, Invoice, EarningLine, PayoutBatch, Adjustment |
| PR13–15 Support/Claims | Case, Claim, InsuranceAttachment |
| PR17–19–21–22 Incidents | Incident, JobHold, links |
| PR20 Mutation | JobMutationRequest, Quote delta, AuditEvent |
| PR24 Enterprise | Organisation + contract/membership/site/integration |
| PR25 Audit/Report | AuditEvent, AuditPackRequest, MetricDefinition |

---

## 13. Example: Worst-Case Data Effects

| Scenario | Data actions |
|----------|--------------|
| Medical emergency | Incident row; JobHold INCIDENT_HOLD; AuditEvents; Assignment may end; new Assignment after backup; TrackingSession transfer/end |
| Explosive suspicion | Incident S1; JobHold AUTHORITY/INCIDENT; freeze flags on Org/Driver as applicable; evidence Documents; no normal return Assignment |
| Destination change | JobMutationRequest; new Quote; JobLocation update on apply; AuditEvent DestinationChanged; Notifications recorded |

---

## 14. Non-Goals (Phase 6)

- Vendor-specific SQL DDL / migrations  
- Exact Postgres vs MySQL vs etc. bake-off (Tech Stack handbook)  
- Full warehouse star-schema DDL  
- ORM models / code  
- Phase 7 control catalogues  

---

## 15. Decisions Log (Phase 6)

| ID | Decision |
|----|----------|
| DB-D1 | Primary relational OLTP + append-only audit events + object store + tracking append store + warehouse |
| DB-D2 | Job is operational spine; AuditEvent is proof spine |
| DB-D3 | One active assignment per job enforced |
| DB-D4 | PSP token refs only; no PAN storage |
| DB-D5 | Tracking breadcrumbs retention-limited; evidence objects long-lived |
| DB-D6 | Financial corrections via adjustments/reversals, not silent overwrites |
| DB-D7 | Wave 1: modular schemas in one DB; outbox when services extract |
| DB-D8 | Hold flags model mid-job pauses without lying about state |

---

## 16. Risks

| Risk | Mitigation |
|------|------------|
| Audit table growth | Partition + archive; don’t skip events |
| Tracking volume | Separate store/TTL early |
| PII sprawl in payloads | Payload standards; tokenise secrets |
| Org/job orphan data | Strict FKs + lifecycle gates |
| Dual truth JobStateHistory vs events | Events authoritative; history is projection |

---

## 17. Assumptions

| # | Assumption |
|---|------------|
| DB-A1 | Relational primary DB is acceptable for Wave 1 scale |
| DB-A2 | Beachhead counsel sets retention numbers before launch |
| DB-A3 | Recipients need not be full User rows initially |
| DB-A4 | Multi-currency may appear later; Wave 1 single currency per city |
| DB-A5 | Search engine optional until Support volume hurts |

---

## 18. Approval Checklist

- [ ] Storage topology accepted  
- [ ] Entity catalogue covers Phase 4/4B/4C processes  
- [ ] Job + Audit dual-spine accepted  
- [ ] Indexing & integrity approach accepted  
- [ ] PII/PAN placement accepted  
- [ ] Assumptions DB-A1–DB-A5 accepted or amended  
- [ ] Ready to open Phase 7 — Security Architecture  

**Approval response options:**  
`APPROVE PHASE 6` · `APPROVE PHASE 6 WITH AMENDMENTS: …` · `REVISE: …`
