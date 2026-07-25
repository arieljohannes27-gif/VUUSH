# Phase 1 — Business Architecture

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED  
**Approved:** 2026-07-16  
**Phase gate:** Phase 1 locked as baseline. Amendments require explicit revision. Phase 2 unlocked.

---

## 0. Executive Position

SWIFT is a **premium logistics technology company**, not a courier brand with an app.

We design and operate an **intelligent logistics control platform** that connects:

- businesses, retailers, and enterprise shippers (demand)
- vetted drivers and fleet partners (supply)
- recipients / consumers (experience endpoint)
- internal operators (dispatch, support, finance, admin)

**Brand promise this architecture must make true:**  
*Every Delivery. Every Time. Done Right.*

### Board recommendation (model choice)

| Option | Verdict | Why |
|--------|---------|-----|
| Pure open marketplace | **Reject** | Undermines reliability and premium trust in African logistics conditions |
| Full asset-heavy courier | **Reject as primary** | Capex-heavy, confuses category, slows software moat |
| **Controlled platform (recommended)** | **Adopt** | Software + standards + ops control; hybrid supply; SLA-grade reliability without pretending we are “just an app” |

**Controlled platform meaning:** SWIFT owns the customer relationship, pricing integrity, dispatch rules, exception recovery, data, and brand promise. Supply is a mix of independent drivers and fleet partners operating under SWIFT standards. Optional SWIFT-controlled capacity may be used later as SLA insurance—not as the default identity.

---

## 1. Business Model

### 1.1 Model statement

SWIFT creates value by **removing friction and uncertainty from moving goods**, and captures value through **fulfilled logistics transactions**, **enterprise software access**, and **premium operational guarantees**.

We sell **trustworthy completion**, not the cheapest kilometre.

### 1.2 Value creation layers

```text
┌─────────────────────────────────────────────────────────────┐
│  EXPERIENCE LAYER                                           │
│  Customer App · Enterprise Portal · Recipient experience    │
├─────────────────────────────────────────────────────────────┤
│  CONTROL LAYER (SWIFT core advantage)                       │
│  Pricing · Dispatch · Tracking · Exceptions · Support · SLA │
├─────────────────────────────────────────────────────────────┤
│  SUPPLY LAYER                                               │
│  Drivers · Fleet partners · (future) controlled capacity    │
├─────────────────────────────────────────────────────────────┤
│  TRUST LAYER                                                │
│  Identity · Verification · Insurance facilitation · Audit   │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 What SWIFT owns vs enables

| Owns (non-negotiable) | Enables / partners | Explicitly does not own (Phase 1 stance) |
|-----------------------|--------------------|------------------------------------------|
| Brand promise & CX standards | Insurance underwriting (partner) | Being “the cheapest courier” |
| Pricing integrity | Payments rails | Unvetted open gig chaos |
| Dispatch rules & exception ownership | Maps / telco / identity vendors | Unlimited geographic sprawl |
| Platform data & audit truth | Vehicle ownership (mostly partners) | Taking legal custody of all goods as default |
| Support escalation path | Local compliance advisors | |

### 1.4 Units of value

1. **Completed delivery job** (primary transactional unit)  
2. **Enterprise organisation subscription / seats / API usage**  
3. **Service-level tier** (standard vs priority vs white-glove)  
4. **Value-added service** (insurance facilitation, COD handling where offered, scheduled windows, proof packs)

---

## 2. Customer Segments

### 2.1 Demand-side segments

| Segment | Who | Jobs to be done | Priority |
|---------|-----|-----------------|----------|
| **SMB / Retail shippers** | Local shops, boutiques, pharmacies, small e-commerce | Reliable same-day / next-day, simple booking, clear status | **Beachhead** |
| **Enterprise shippers** | Retail chains, banks, healthcare, 3PLs using SWIFT tech, marketplaces | SLA, multi-user, API, billing, audit, volume governance | **Strategic core** |
| **Consumer senders** | Individuals sending parcels | Simple, calm, trustworthy send | Secondary (brand + fill) |
| **Recipients** | Anyone receiving | Clear ETA, proof, low-stress receive / redirect | Always-on CX (not always paying) |

### 2.2 Supply-side ecosystem

| Actor | Role | SWIFT obligation |
|-------|------|------------------|
| **Independent driver** | Executes jobs under SWIFT standards | Fair pay transparency, clear UX, safety, support |
| **Fleet manager / partner** | Provides multi-vehicle capacity | Performance contracts, branding/compliance standards |
| **Backup / surge pool** | Covers breakdowns & peaks | Fast reassignment rules |

### 2.3 Internal operating segments (economic actors inside the firm)

Dispatchers, support agents, operations managers, finance officers, administrators, sales — detailed in Phase 3 (User Architecture). Phase 1 treats them as **cost and quality levers** of the control layer.

### 2.4 Segment strategy (Board decision)

1. **Win SMB density in one metro** → prove promise publicly.  
2. **Land enterprise with pilot SLAs** → prove margin & process maturity.  
3. **Grow consumer send** only when supply reliability is stable.  
4. **Never grow demand faster than qualified supply + support capacity.**

---

## 3. Enterprise Customers

### 3.1 Enterprise definition

An organisation that requires **multi-user access**, **commercial contracts**, **SLA language**, **billing artefacts**, and typically **integration** (portal and/or API).

### 3.2 Enterprise value proposition

- Predictable pricing and invoicing  
- Role-based control of who can book / approve  
- Live and historical visibility  
- Exception collaboration with SWIFT ops  
- Audit-ready proof of delivery and event history  
- Premium support path  

### 3.3 Enterprise commercial shape

| Element | Standard approach |
|---------|-------------------|
| Contract | MSA + service schedule + SLA annex |
| Commercial | Hybrid: platform fee and/or volume tiers + per-job charges |
| Pilot | Time-boxed, success criteria defined before discounting |
| Expansion | Site / city / service-line expansion after reliability proof |

### 3.4 Enterprise disqualifiers (protect the brand)

- Demands that require silent failure hiding  
- Price-only RFPs with no reliability weighting  
- Volume commitments SWIFT cannot staff safely  
- Requirements that break driver fairness or safety rules  

---

## 4. Driver Ecosystem

### 4.1 Design intent

Drivers are **operators of the brand promise**, not disposable gig inventory.

### 4.2 Ecosystem principles

1. **Vetted access** — identity, documents, vehicle standards before first job.  
2. **Transparent economics** — earnings visible before accept (or clearly rule-based if auto-assign).  
3. **Decision minimalism** — app never overwhelms.  
4. **Fairness** — assignment and scoring policies are explainable.  
5. **Safety over utilisation** — no incentive that rewards unsafe behaviour.  
6. **Support parity** — drivers get a real support path, not only customers.

### 4.3 Supply mix (phased)

| Phase | Mix | Intent |
|-------|-----|--------|
| Launch | High share independent + select fleets | Speed with control |
| Scale | Fleets grow for predictable B2B windows | SLA stability |
| Maturity | Optional SWIFT buffer capacity | Enterprise SLA insurance |

### 4.4 Driver lifecycle (business view)

Recruit → Screen → Onboard → Activate → Execute → Coach → Reward / remediate → Offboard

Detailed process maps belong in Phase 4; Phase 1 locks the **business rules** below.

---

## 5. Revenue Streams

### 5.1 Stream map

| Stream | Description | Margin character | Stage |
|--------|-------------|------------------|-------|
| **Delivery transaction fee** | Charge to shipper for fulfilled (or contractually billable) jobs | Ops-linked | Launch |
| **Priority / window premiums** | Paid urgency or time windows | High | Launch |
| **Enterprise platform subscription** | Portal seats, admin, reporting | Software-like | Early |
| **API / integration fees** | Usage or tiered access | Software-like | Early–scale |
| **SLA premium** | Higher assurance, dedicated support | Mixed | When ops ready |
| **Insurance facilitation margin** | Partner product attachment | Variable | Launch (careful) |
| **Value-added services** | White-glove, multi-stop, special handling | Mixed | Selective |
| **Fleet software / partner tools** | Charging fleets for management tooling | Software-like | Scale |
| **Future: AI ops / BI packs** | Premium intelligence for enterprises | Software-like | Later — ethics gated |

### 5.2 What we will not monetise

- Hiding delays behind paid “priority support” as a substitute for fixing ops  
- Selling raw personal/driver behavioural data  
- Penalty designs that feel like predation rather than cost recovery  

### 5.3 Revenue mix intent (directional, not a forecast)

Early: **transaction-heavy**.  
Maturity: **rising share of software + SLA + API** without abandoning fulfilment excellence.

---

## 6. Pricing Philosophy

### 6.1 Principles

1. **Premium, not predatory** — price signals quality; it does not invent it.  
2. **Transparent** — customers understand components; drivers understand earnings logic.  
3. **Predictable for enterprise** — quotes, rate cards, and invoice reconciliation must be calm.  
4. **Fair to supply** — sustainable driver earnings are a reliability input, not a residual.  
5. **No race to the bottom** — refuse volume that only works by destroying trust.  
6. **Discount governance** — discounts are strategic tools, not sales panic.

### 6.2 Price architecture (logical components)

```text
Customer price ≈
  Base service fee
+ Distance / zone component
+ Weight / size / handling component
+ Time window / priority component
+ Value-added (insurance, COD, white-glove)
+ Taxes (as applicable)
± Contracted enterprise adjustments
```

Driver earnings are derived from a **separate but linked** ruleset (guarantee fairness and margin). Exact formulae are calibrated later; Phase 1 locks the **structure and governance**.

### 6.3 Packaging

| Package | Audience | Promise |
|---------|----------|---------|
| **SWIFT Standard** | SMB / consumer | Reliable completion, clear tracking |
| **SWIFT Priority** | Time-sensitive | Faster assignment + tighter windows |
| **SWIFT Enterprise** | Contracted orgs | Portal/API + SLA + billing + governance |
| **SWIFT Care / White-glove** | High-value items | Enhanced verification & handling (selective) |

### 6.4 Discount & exception pricing rules

- Below-floor pricing requires named approver.  
- Pilots have end dates and success metrics.  
- Free delivery marketing must be funded as acquisition cost, not silent margin destruction.  

---

## 7. Operational Workflow (Business Control Loop)

End-to-end operating loop at business level:

```text
Demand capture → Price & rules check → Confirm job →
Dispatch / assign → Pickup execution → In-transit control →
Delivery / proof → Settlement → Quality signal → Learn & improve
         ↑                                        |
         └──────── exceptions / escalation ───────┘
```

### 7.1 Control accountabilities

| Stage | Primary owner | Success look |
|-------|---------------|--------------|
| Demand & pricing | Product + Commercial | Clear quote, correct service fit |
| Confirm | Customer / Enterprise user | Intent locked, payable terms clear |
| Dispatch | Dispatch ops (+ engine later) | Right driver, right time |
| Execution | Driver / fleet | SOP compliance |
| Exception | Dispatch + Support | Truthful recovery, timed updates |
| Settlement | Finance | Accurate, timely, dispute-light |
| Learn | Ops + Product | Fewer repeats of same failure |

---

## 8. Delivery Lifecycle

### 8.1 Canonical job states

| State | Meaning | Customer-visible? |
|-------|---------|-------------------|
| `DRAFT` | Incomplete booking | Soft / internal |
| `QUOTED` | Price presented | Yes |
| `CONFIRMED` | Accepted by customer; payable per rules | Yes |
| `SCHEDULED` | Time window locked | Yes |
| `ASSIGNED` | Driver/vehicle assigned | Yes (careful detail level) |
| `EN_ROUTE_PICKUP` | Moving to pickup | Yes |
| `ARRIVED_PICKUP` | At pickup | Yes |
| `PICKED_UP` | Custody transfer to driver (operational) | Yes |
| `IN_TRANSIT` | Moving to dropoff | Yes |
| `ARRIVED_DROPOFF` | At dropoff | Yes |
| `DELIVERED` | Successful completion + proof rules met | Yes |
| `FAILED_ATTEMPT` | Attempt ended without completion | Yes |
| `CANCELLED` | Stopped under cancellation policy | Yes |
| `RETURN_IN_PROGRESS` | Returning to origin / depot rule | Yes |
| `RETURNED` | Return completed | Yes |
| `CLOSED` | Finance/support terminal state | Internal + statements |

### 8.2 Happy-path lifecycle

1. Customer creates booking (service, pickup, dropoff, package attributes).  
2. System prices using rules; customer confirms.  
3. Dispatch assigns eligible driver/vehicle.  
4. Driver completes pickup verification.  
5. Driver completes dropoff verification / POD.  
6. Job → `DELIVERED` → settlement & ratings prompts.  
7. Job → `CLOSED` after payment/settlement conditions met.

### 8.3 Non-negotiable lifecycle rules

- **Status must never lie.** Prefer “delayed with reason class” over fake ETAs.  
- **Every state change is auditable** (who/what/when/why).  
- **Money movement follows state rules**, not chat messages.  
- **Enterprise visibility** can be richer than consumer, never contradictory.

---

## 9. Business Rules (Core)

### 9.1 Booking rules

- Required: valid parties, locations serviceable, service type, package class, contactability.  
- Restricted goods classes blocked or specially handled.  
- Quotes expire after defined TTL.  
- Address / geocode confidence below threshold → verification step before confirm.

### 9.2 Assignment rules

- Only eligible, on-duty, compliant drivers.  
- Respect vehicle class vs package class.  
- Respect max active jobs / safety limits.  
- Enterprise SLA jobs may use priority queues.  
- Manual override allowed for dispatchers with reason codes.

### 9.3 Cancellation rules

| Actor | Window | Consequence (policy classes) |
|-------|--------|------------------------------|
| Customer | Pre-assignment | Low / no fee |
| Customer | Post-assignment | Fee class + driver compensation class |
| Driver | After accept | Performance + possible supply penalty path |
| SWIFT | Safety / fraud / force majeure | Defined goodwill / rebook path |

Exact fee amounts are commercial calibration; Phase 1 locks **classes and fairness**.

### 9.4 Proof rules

POD may include: timestamp, GPS, recipient name, signature / OTP / photo / ID check — **by service tier**.  
Insufficient proof → job cannot quietly sit as `DELIVERED`.

### 9.5 Data & truth rules

- Platform event log is source of operational truth.  
- Side agreements in WhatsApp are not system truth unless captured as an official note/event.

---

## 10. Exception Handling

### 10.1 Exception classes

| Class | Examples | Default posture |
|-------|----------|-----------------|
| **A — Customer contact** | Recipient unreachable, wrong number | Retry protocol + timed customer updates |
| **B — Location** | Can't find address, access control | Driver assist + geocode escalation |
| **C — Capacity** | No driver, late assignment | Dispatch surge / re-promise |
| **D — Asset** | Breakdown, accident | Backup allocation (see §12 linkage) |
| **E — Goods** | Damage suspected, refused package | Photo evidence + claims path |
| **F — Safety / security** | Threat, theft, fraud signals | Freeze, escalate, protect people first |
| **G — System** | App/GPS/payment outage | Degraded mode + honest comms |

### 10.2 Exception principles

1. Detect early.  
2. Tell the truth quickly.  
3. Offer a next action.  
4. Record evidence.  
5. Close the loop with the paying customer / enterprise.  
6. Feed learning into ops & product.

### 10.3 Customer communication standard

Every material exception requires:

- What happened (plain language)  
- What SWIFT is doing  
- What we need from the customer (if anything)  
- New expectation (time or decision)

---

## 11. Failed Delivery Procedures

### 11.1 Definition

A **failed delivery attempt** is a legitimate attempt that does not complete dropoff under policy (not a cancellation before attempt).

### 11.2 Standard attempt protocol

1. Driver follows contact script / in-app contact tools.  
2. Wait window rule (service-specific).  
3. Evidence capture (location, attempts, photos if required).  
4. State → `FAILED_ATTEMPT` with reason code.  
5. Auto notify customer / enterprise contacts.  
6. Apply **next-action policy**:

| Policy option | When used |
|---------------|-----------|
| Reattempt same day | Recipient requests / SLA allows |
| Reattempt next window | Default for many B2C |
| Redirect to safe alternative | Approved alternate address / pickup point (if offered) |
| Return to sender | Attempts exhausted / high-value rules |
| Hold for instruction | Enterprise special accounts |

### 11.3 Attempt limits

Default business stance: **defined maximum attempts per service tier**, then return or hold. Enterprise contracts may override within safety and cost bounds.

### 11.4 Cost & fee classes

Failed attempts may trigger:

- reattempt fees  
- return fees  
- wait-time fees  

…only when disclosed at booking / contract. Surprise fees are brand damage.

---

## 12. Incident, Breakdown & Backup Allocation (Business Rules)

> Detailed process maps → Phase 4. Phase 1 locks outcomes.

### 12.1 Vehicle breakdown / driver inability mid-job

1. Driver declares incident in-app (or ops detects).  
2. Dispatch freezes unsafe continuation.  
3. Customer receives honest delay class update.  
4. **Backup driver allocation** triggered by priority:  
   - safety of goods & people  
   - SLA / service tier  
   - proximity / ETA recovery  
5. Chain-of-custody handoff rules if goods already picked up (verification + evidence).  
6. Incident record opened; linked to job(s).

### 12.2 Incident severity (business)

| Severity | Examples | Escalation |
|----------|----------|------------|
| S1 | Theft, violence, major accident, data breach | Exec + security + legal path |
| S2 | Damage, repeated SLA breach risk, fraud suspicion | Ops lead + support lead |
| S3 | Single job failure with recovery | Dispatch + support |
| S4 | Minor process deviation | Log & coach |

---

## 13. Insurance Workflows

### 13.1 Board decision

**SWIFT is not the insurer at Phase 1.**  
SWIFT **facilitates** declared-value protection via regulated insurance partners where available, and maintains claims orchestration UX + evidence packs.

### 13.2 Workflow (business)

```text
Declare value (optional/required by tier)
→ Show coverage summary & exclusions (plain language)
→ Attach partner policy reference to job
→ If incident: evidence pack auto-assembled
→ Claim intake (customer/enterprise)
→ Partner adjudication support
→ Outcome recorded on job + finance adjustments if any
```

### 13.3 Rules

- No coverage claims in marketing that outrun partner contracts.  
- High-value goods may **require** declared protection or be declined.  
- Claims without required evidence follow a slower / weaker path — communicated upfront.

---

## 14. Escalation Procedures

### 14.1 Escalation ladder

```text
Driver / Customer self-serve
    → Support Agent (L1)
        → Senior Support / Dispatch Lead (L2)
            → Operations Manager (L3)
                → Executive on-call (S1 / brand threats)
```

### 14.2 Mandatory escalation triggers

- Safety / security events  
- Suspected theft or major damage  
- Enterprise SLA breach likelihood above threshold  
- Media / reputational risk  
- Payment / settlement systemic errors  
- Data privacy incidents  
- Discrimination / harassment reports  

### 14.3 Escalation artefacts

Every L2+ escalation requires: job IDs, timeline, customer impact, actions taken, decision needed, owner, next update time.

---

## 15. Compliance

### 15.1 Compliance domains (business architecture view)

| Domain | Why it matters | Phase 1 stance |
|--------|----------------|----------------|
| **Company & commercial law** | Contracts, invoicing | Template-ready; counsel for jurisdiction |
| **Transport / logistics regulations** | Operating legality by city/country | Local launch checklist mandatory |
| **Data protection & privacy** | Trust + enterprise sales | Privacy by design; minimise PII |
| **Consumer protection** | Fair terms, advertising truth | Transparent fees & status |
| **Employment / contractor classification** | Driver model risk | Explicit model per country; no pretend employment |
| **Payments & financial rules** | Collections, COD, settlements | Licensed partners; clear money movement |
| **Insurance regulations** | Facilitation vs underwriting | Partner model |
| **Tax** | Invoicing, VAT/GST where applicable | Finance-owned calendar |

### 15.2 Compliance operating rule

**No city launch without a signed Launch Compliance Checklist** (legal, ops, insurance, data, tax, transport). Expansion theatre without compliance is not premium—it is negligence.

---

## 16. Risk Management (Business)

### 16.1 Top risks to the brand promise

| Risk | Impact | Control direction |
|------|--------|-------------------|
| Demand outruns quality supply | Failed promise | Growth throttles; supply gates |
| Status dishonesty / ETA fiction | Trust collapse | Truthful state model; ETA confidence bands |
| Driver unfairness / churn | Capacity & quality shock | Transparent pay; support; coaching |
| Enterprise over-selling | SLA cascade failure | Disqualifiers; pilot gates |
| Fraud (fake POD, false claims, account takeover) | Margin + trust | Verification tiers; anomaly review |
| Cash handling (if COD) | Loss / safety | Delay COD until controls mature (**recommended**) |
| Data breach | Enterprise death event | Security Phase 7; minimise data now |
| Geographic sprawl | Diluted standards | City-depth strategy |
| Race-to-bottom competitors | Margin temptation | Pricing philosophy enforcement |
| Regulatory misclassification | Fines / shutdown | Counsel + explicit driver model |

### 16.2 Risk appetite

- **Low appetite** for safety, fraud blindness, status lying, privacy negligence.  
- **Measured appetite** for market expansion and product bets.  
- **No appetite** for growth that knowingly breaks “Done Right.”

### 16.3 Business risk cadence

Weekly ops risk review · Monthly enterprise risk · Quarterly board-level risk register refresh.

---

## 17. Future Expansion

### 17.1 Expansion doctrine

**Depth before width.**  
One metro proving trust > five metros apologising.

### 17.2 Expansion sequence (business)

1. **Home metro dominance** — reliability, brand recognition, density.  
2. **Corridor expansion** — connected economic routes.  
3. **Second metro in same country** — replicate playbook.  
4. **New country** — entity, compliance, payments, insurance, supply model rebuild.  

### 17.3 What expands with geography

- Localised pricing & zones  
- Driver compliance packs  
- Support hours / language  
- Enterprise contracts variants  
- Insurance partner availability  

### 17.4 What must remain global

- Brand promise  
- Lifecycle truthfulness  
- Design calm & premium bar  
- Security & privacy principles  
- Escalation seriousness for S1  

### 17.5 Future business lines (backlog only — not Phase 1 scope)

- Cross-border  
- Warehousing / micro-fulfil  
- Deeper 3PL OS for others  
- Advanced AI ops products  

Each requires a new business-architecture amendment—not silent feature creep.

---

## 18. Operating Metrics (Business KPIs)

These are the health instruments of the architecture:

| Domain | Example KPIs |
|--------|--------------|
| Promise | On-time % by tier, successful delivery %, first-attempt success |
| Trust | Complaint rate, claim rate, status accuracy audits |
| Supply | Active eligible drivers, acceptance quality, retention |
| Demand | Completed jobs, enterprise logo retention, SMB repeat rate |
| Economics | Take rate, contribution margin/job, cost-to-serve exceptions |
| Support | Time-to-truthful-update, FCR, escalation rate |
| Risk | S1/S2 incident counts, fraud flags, compliance checklist completion |

Vanity volume without promise KPIs is rejected as a management practice.

---

## 19. Phase 1 Decisions Log (Summary)

| ID | Decision |
|----|----------|
| D1 | SWIFT = controlled logistics technology platform, not pure marketplace, not primarily asset-heavy courier |
| D2 | Beachhead = SMB density in one metro; enterprise is strategic parallel track with pilot gates |
| D3 | Multi-stream revenue; transaction + enterprise software + premiums; no bottom-feeder pricing |
| D4 | Transparent price architecture; discount governance mandatory |
| D5 | Canonical delivery lifecycle & truthful states are constitutional |
| D6 | Exception classes + failed-attempt protocols + escalation ladder are mandatory ops design inputs |
| D7 | Insurance = facilitation via partners in Phase 1 (not SWIFT underwriting) |
| D8 | COD / heavy cash handling delayed until controls mature (recommended default) |
| D9 | Expansion = depth before width; compliance checklist gates every launch |
| D10 | Drivers are brand operators; fairness and safety are reliability inputs |

---

## 20. Risks to This Phase (Meta)

| Risk | Mitigation |
|------|------------|
| Founders later want pure marketplace speed | Revisit D1 explicitly; do not silently dilute |
| Home market / city not yet chosen | Block launch planning until beachhead geography approved |
| Enterprise sales ahead of ops maturity | Enforce pilot success criteria |
| Handbook chapters still outline-only | After approval, sync Foundation commercial chapters to this phase |
| Over-precision on fees before costing | Keep fee *classes* now; calibrate amounts in commercial modelling |

---

## 21. Assumptions (Require Confirmation)

| # | Assumption | If false, impact |
|---|------------|------------------|
| A1 | Initial model is primarily **point-to-point / scheduled local delivery**, not hub-and-spoke network | Network design & pricing change |
| A2 | **Beachhead geography** will be a single primary metro (country TBD by founders) | All compliance/pricing localise differently |
| A3 | Drivers are predominantly **independent contractors / fleet-employed**, not SWIFT W2-style employees at launch | Cost, UX, legal model change |
| A4 | SWIFT **does not underwrite insurance** at launch | Claims & margin model change |
| A5 | **COD is deferred** or tightly limited at launch | Payment & safety controls accelerate if COD is mandatory |
| A6 | Recipients may be non-paying users with first-class UX obligations | Support & notification load |
| A7 | English-first product language at launch, local language later | Support hiring & UX scope |
| A8 | Premium positioning is non-negotiable even under competitor discount pressure | Growth rate vs margin tradeoff |

---

## 22. Out of Scope for Phase 1

- Product surface IA and app maps → **Phase 2**  
- Persona permissions & KPIs detail → **Phase 3**  
- Step-by-step BPMN-style process maps → **Phase 4**  
- Services, APIs, cloud, data models, UI kit, screens, build modules → **Phases 5–10**  
- Production code, databases, React, APIs → **Never in architecture phases**

---

## 23. Approval Checklist

Approve this phase if you agree that:

- [ ] Controlled platform model (D1) is correct  
- [ ] Segment strategy (SMB beachhead + enterprise pilots) is correct  
- [ ] Revenue & pricing philosophy match premium brand  
- [ ] Lifecycle, exceptions, failed delivery, escalation, insurance stance are acceptable  
- [ ] Assumptions A1–A8 are accepted, amended, or replaced  
- [ ] COD deferral recommendation is accepted or overridden  
- [ ] Beachhead country/metro will be named as a follow-up decision  

**Approval response options:**  
`APPROVE PHASE 1` · `APPROVE PHASE 1 WITH AMENDMENTS: …` · `REVISE: …`

Only after approval will the Architecture Board open **Phase 2 — Product Architecture**.
