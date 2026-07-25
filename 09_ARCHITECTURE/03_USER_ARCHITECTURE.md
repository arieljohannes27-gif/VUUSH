# Phase 3 — User Architecture

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED  
**Approved:** 2026-07-20  
**Depends on:** Phase 1 (**APPROVED** 2026-07-16) · Phase 2 (**APPROVED** 2026-07-20)  
**Phase gate:** Phase 3 locked as baseline. Amendments require explicit revision. Phase 4 unlocked.

---

## 0. Executive Position

Phases 1–2 defined *what SWIFT is* and *which products exist*. Phase 3 defines **who acts**—responsibilities, permissions, workflows, pain points, goals, and KPIs—so every later process, screen, and security rule has a named human owner.

### Board challenges

| Temptation | Verdict | Why |
|------------|---------|-----|
| One “User” type with flags | **Reject** | Logistics trust fails when roles blur |
| Mirror Uber’s thin driver/customer dualism only | **Reject** | Controlled platform needs ops, finance, fleet, enterprise depth |
| Give Admin god-mode without audit | **Reject** | Premium enterprise sales die without accountability |
| Optimise every role for speed over calm | **Reject** | Overwhelmed drivers/agents break “Done Right” |
| **Explicit roles, least privilege, job-spine literacy** | **Adopt** | Clarity scales; confusion does not |

### User architecture thesis

> People do not share screens. They share **truth**.  
> Permissions follow **duty**, not curiosity.  
> KPIs must reinforce the brand promise—never punish honesty or safety.

### Role catalogue (canonical)

| ID | Role | Product home (Phase 2) |
|----|------|------------------------|
| U01 | Customer | Customer App |
| U02 | Enterprise Customer | Enterprise Portal |
| U03 | Driver | Driver App |
| U04 | Fleet Manager | Fleet Dashboard |
| U05 | Dispatcher | Dispatcher Console |
| U06 | Operations Manager | Operations Dashboard |
| U07 | Support Agent | Support Centre |
| U08 | Finance Officer | Finance Dashboard |
| U09 | Administrator | Admin Portal |
| U10 | Sales Representative | Enterprise Portal (limited) + sales tools |

**Also recognised (not separate permission personas at launch):** Recipient (Customer App mode), Executive (BI consumer). Detailed as variants where needed.

---

## 1. Permission Model (Cross-Cutting)

### 1.1 Principles

1. **Least privilege** — default deny; grant by role + scope.  
2. **Scope dimensions:** self · organisation · fleet · zone · platform.  
3. **Action classes:** read · create · update · transition (job states) · money · configure · break-glass.  
4. **Every privileged action is auditable** (who/when/why).  
5. **Separation of duties:** e.g. Sales cannot unilaterally set below-floor pricing; Support credits follow Finance rules.

### 1.2 Permission legend (used below)

| Code | Meaning |
|------|---------|
| R | Read |
| C | Create |
| U | Update profile/master data |
| T | Job state transition (allowed subset) |
| M | Money movement / adjustment (ruled) |
| X | Escalate / collaborate |
| CFG | Platform or org configuration |
| BG | Break-glass (time-bound, audited) |

Exact RBAC matrices → Phase 7. Phase 3 locks **intent**.

---

## 2. U01 — Customer

**Definition:** Individual or SMB user who ships via the Customer App (and may receive as recipient).

### Responsibilities
- Provide accurate pickup/dropoff, package class, and contactability  
- Confirm quotes and pay per rules  
- Respond to exception prompts (reattempt, access instructions)  
- Treat drivers and agents with respect  

### Permissions (intent)
| Object | Access |
|--------|--------|
| Own profile, addresses, payment methods | R/C/U |
| Own jobs | C, R, cancel (policy), limited T (e.g. confirm reattempt choice) |
| Other users’ jobs | — |
| Platform config / dispatch | — |
| Credits | Request only; M via Support/Finance rules |

### Daily workflow
1. Open app → create or repeat booking  
2. Review price → confirm  
3. Track status; respond if contacted  
4. Confirm receipt / view POD when needed  
5. Rate; contact support only if truth is unclear or outcome wrong  

### Pain points (industry today — SWIFT must remove)
- Opaque status and fake ETAs  
- Unclear pricing and surprise fees  
- No control when recipient unreachable  
- Support that doesn’t know the job  

### Goals
- Send/receive with zero training  
- Feel calm confidence, not chase anxiety  
- Trust “Done Right” enough to repeat  

### KPIs (customer health — measured on platform)
| KPI | Intent |
|-----|--------|
| Time-to-first successful delivery | Activation |
| Repeat job rate (30/90 day) | Habit / trust |
| First-attempt success (as recipient impact) | Reliability feel |
| Support contacts per completed job | Friction |
| CSAT / rating on completed jobs | Experience |
| Cancel rate post-quote | Pricing/UX clarity |

---

## 3. U02 — Enterprise Customer

**Definition:** User belonging to a contracted organisation—roles inside org may include Booker, Approver, Org Admin, Viewer (sub-roles).

### Responsibilities
- Book and/or approve within policy  
- Maintain org locations, users, cost centres (Org Admin)  
- Monitor SLA-relevant volume; escalate via official channels  
- Ensure internal staff do not bypass audit (e.g. side WhatsApp as system of record)  

### Permissions (intent)
| Object | Access |
|--------|--------|
| Org jobs | C/R (by sub-role); approve if Approver |
| Org users & roles | CFG for Org Admin only |
| Invoices / statements | R (finance-capable enterprise roles) |
| Other orgs | — |
| Dispatch assignment | — (may *request* via Support/ops protocols) |
| Contract rates | R; not arbitrary edit |

### Daily workflow
1. Intake orders (UI and/or integrated)  
2. Approve if required → jobs confirm  
3. Monitor live board for exceptions  
4. Coordinate with SWIFT Support/Dispatch on incidents  
5. Reconcile invoices periodically (finance-capable user)  

### Pain points
- Multi-user chaos without permissions  
- No audit trail for who shipped what  
- SLA theatre without operational truth  
- Billing that doesn’t match job outcomes  

### Goals
- Predictable logistics as a governed business process  
- Audit-ready proof and cost allocation  
- Expand volume only when reliability holds  

### KPIs
| KPI | Intent |
|-----|--------|
| Time-to-first-value (pilot) | Onboarding |
| SLA attainment % | Promise |
| Exception cycle time | Collaboration quality |
| Invoice dispute rate | Commercial clarity |
| Expansion sites / volume | Land-and-expand health |
| Stakeholder NPS (ops buyer) | Relationship |

---

## 4. U03 — Driver

**Definition:** Vetted executor of pickup and delivery under SWIFT standards (independent or fleet-employed).

### Responsibilities
- Maintain eligibility (documents, vehicle, safety)  
- Execute SOPs for pickup, transit, delivery, proof  
- Communicate truthfully via app states—not informal lies  
- Declare exceptions and incidents promptly  
- Protect goods, people, and brand conduct  

### Permissions (intent)
| Object | Access |
|--------|--------|
| Own profile, documents, duty status | R/U (document upload) |
| Assigned jobs | R, T (allowed execution transitions only) |
| Unassigned marketplace browse | Per assignment mode (may be limited/none in controlled dispatch) |
| Customer PII | Minimum needed for job; not exportable freely |
| Own earnings | R |
| Reassign others’ jobs | — |

### Daily workflow
1. Go on duty → review assignments  
2. Navigate to pickup → verify → mark picked up  
3. Transit → dropoff → POD / failure protocol  
4. Handle exceptions with in-app guidance  
5. Review earnings; contact driver support if blocked  

### Pain points
- Unclear instructions and unfair pay opacity  
- App overload and hostile UX under time pressure  
- Unreachable customers without a playbook  
- Support that treats drivers as disposable  

### Goals
- Complete jobs safely and correctly  
- Earn predictably and fairly  
- Feel respect and clarity—not anxiety  

### KPIs
| KPI | Intent |
|-----|--------|
| On-time completion % | Reliability |
| First-attempt success % | Execution quality |
| SOP / proof compliance rate | Trust artefacts |
| Safety incidents | Non-negotiable |
| Acceptance / completion integrity | Fairness + reliability |
| Driver retention / satisfaction | Supply health |

**KPI ethics:** Scores must not incentivise speeding, fake POD, or rejecting difficult dropoffs unfairly without ops review.

---

## 5. U04 — Fleet Manager

**Definition:** Operator of a partner fleet entity—roster, vehicles, compliance, fleet performance—under SWIFT platform rules.

### Responsibilities
- Keep drivers/vehicles compliant and eligible  
- Staff capacity for committed windows  
- Coach performance without bypassing SWIFT safety rules  
- Reconcile fleet earnings and disputes via official channels  

### Permissions (intent)
| Object | Access |
|--------|--------|
| Own fleet drivers & vehicles | R/C/U (within rules) |
| Fleet jobs (aggregate + detail) | R |
| Cross-fleet data | — |
| Platform eligibility rules | R (not override) |
| Fleet payouts | R; disputes via X to Finance/Support |
| Dispatch force-assign outside rules | — |

### Daily workflow
1. Check compliance dashboard (docs expiring, vehicle status)  
2. Confirm roster / on-duty coverage  
3. Monitor fleet job performance & exceptions  
4. Coach drivers; escalate systemic issues to SWIFT Ops  
5. Review statements / earnings  

### Pain points
- Opaque platform rules changing without notice  
- Drivers managed in WhatsApp while “system” is ignored  
- Payout disputes without evidence packs  
- Being blamed for SWIFT dispatch quality they don’t control  

### Goals
- Stable utilisation with compliant drivers  
- Predictable partnership economics  
- Preferred partner status via reliability  

### KPIs
| KPI | Intent |
|-----|--------|
| % eligible drivers on-duty vs plan | Capacity |
| Fleet on-time / completion % | Quality |
| Compliance completion % | Risk |
| Document expiry breaches | Control |
| Fleet churn / driver churn within fleet | Stability |
| Dispute rate on payouts | Trust |

---

## 6. U05 — Dispatcher

**Definition:** Real-time controller of assignment and recovery—human judgement plus console—guardian of same-day promise under load.

### Responsibilities
- Assign / reassign / trigger backup per rules  
- Watch queues, SLAs, and risk flags  
- Run exception playbooks with reason codes  
- Keep status truthful; coordinate with Support on customer impact  
- Log overrides with why  

### Permissions (intent)
| Object | Access |
|--------|--------|
| Live jobs in scope (zone/city) | R, T (assignment & ops transitions) |
| Driver duty & eligibility | R |
| Manual override | T + mandatory reason (audited) |
| Customer credits | — (request via Support/Finance) |
| Pricing floors / contracts | R limited; no arbitrary discount |
| Platform config | — |

### Daily workflow
1. Shift handover → queue health check  
2. Clear unassigned / at-risk jobs  
3. Manage exceptions (contact, breakdown, backup)  
4. Coordinate S2+ with Ops/Support  
5. End-of-shift notes & open risks  

### Pain points
- Firefighting without prioritisation  
- Tools that hide the next best action  
- Being measured only on utilisation, not recovery quality  
- Customers told one story while console shows another  

### Goals
- Maximise trustworthy completions in-window  
- Minimise chaos for drivers and customers  
- Leave the board cleaner than they found it  

### KPIs
| KPI | Intent |
|-----|--------|
| Time-to-assign | Speed with control |
| At-risk jobs recovered in SLA | Promise defence |
| Override rate + audit quality | Discipline |
| Backup allocation success time | Resilience |
| Customer-visible update latency on exceptions | Truth speed |
| Dispatcher decision quality reviews | Craft |

---

## 7. U06 — Operations Manager

**Definition:** Owner of network health and operating standards across shifts—patterns, capacity, quality—not every live click.

### Responsibilities
- Set and enforce SOP adherence  
- Balance demand vs qualified supply  
- Review incidents, trends, and city readiness  
- Approve operational escalations (L3)  
- Feed product/process improvements into Atlas  

### Permissions (intent)
| Object | Access |
|--------|--------|
| Ops dashboards & city/zone health | R |
| Incident records | R/U (ops fields), X escalate |
| Dispatcher performance views | R |
| Temporary policy switches (e.g. surge posture) | CFG limited + audit |
| Full Admin platform config | — (request Admin) |
| Ledger payouts | — (Finance) |

### Daily workflow
1. Review overnight promise KPIs & incidents  
2. Align with Dispatch leads on today’s risk  
3. Capacity actions (fleet outreach, throttle demand if required)  
4. Quality audits / coaching loops  
5. Weekly risk & improvement notes  

### Pain points
- Growth mandates without supply gates  
- Dashboards of vanity volume  
- Repeating the same incident class without root-cause closure  
- Enterprise promises sold beyond ops reality  

### Goals
- Reliable city machine that compounds trust  
- Predictable shift operations  
- Expansion only when playbook is green  

### KPIs
| KPI | Intent |
|-----|--------|
| On-time % / first-attempt success | Promise |
| Exception rate & repeat cause concentration | Learning |
| Supply coverage index | Capacity |
| S1/S2 incident counts | Risk |
| SOP audit pass rate | Standard |
| City launch checklist readiness | Expansion quality |

---

## 8. U07 — Support Agent

**Definition:** Trust-recovery professional—turns confusion and failure into clear next actions without inventing status.

### Responsibilities
- Authenticate and understand the user (customer, driver, enterprise)  
- Read job timeline as source of truth  
- Resolve within authority; escalate correctly  
- Document cases completely  
- Protect brand voice: calm, precise, human  

### Permissions (intent)
| Object | Access |
|--------|--------|
| Cases | C/R/U |
| Linked jobs / evidence | R |
| Ruled credits / goodwill | M within matrix |
| Claims intake | C → Finance/insurance workflow |
| Dispatch reassign | X request / limited playbook actions—not silent free assign if policy forbids |
| Other orgs’ unrelated data | — |
| Delete audit history | — |

### Daily workflow
1. Take next case (phone/chat/email/in-app)  
2. Verify identity → open job truth  
3. Diagnose → resolve or escalate  
4. Communicate expectation + next update time  
5. Wrap with codes; tag product/ops defects  

### Pain points
- No job context / contradictory systems  
- No authority to fix obvious issues  
- Being measured only on handle time, not resolution quality  
- Angry users because product lied upstream  

### Goals
- First-contact resolution where possible  
- Users feel respected and informed  
- Defects flow back to Ops/Product, not rot in macros  

### KPIs
| KPI | Intent |
|-----|--------|
| First contact resolution % | Effectiveness |
| Time-to-truthful-update | Brand |
| Reopen rate | Quality |
| Escalation rate + appropriateness | Judgement |
| QA score (voice/tone/process) | Craft |
| Credit leakage vs policy | Control |

---

## 9. U08 — Finance Officer

**Definition:** Guardian of money truth—charges, payouts, invoices, adjustments, reconciliation.

### Responsibilities
- Ensure job commercial outcomes match policy  
- Run customer invoicing & driver/fleet payouts  
- Process adjustments/claims outcomes with audit  
- Reconcile payment provider and bank movements  
- Flag fraud / anomaly to Ops/Security  

### Permissions (intent)
| Object | Access |
|--------|--------|
| Commercial ledger / invoices / payouts | R, M (finance actions) |
| Job financial artefacts | R |
| Support-initiated credit requests | Approve/reject per rules |
| Dispatch live controls | — |
| Pricing floor config | R; CFG only with Admin+authority |
| Delete financial history | — |

### Daily workflow
1. Review failed payments / exceptions queue  
2. Release or hold payout batches  
3. Issue/reconcile enterprise invoices  
4. Process claim/credit adjustments  
5. Close day with reconciliation checklist  

### Pain points
- Ops changing outcomes without finance events  
- Manual spreadsheets as ledger  
- Driver payout disputes without evidence  
- Sales promising commercial terms not in system  

### Goals
- Accurate, timely, dispute-light money movement  
- Audit readiness for enterprise  
- No silent margin leaks  

### KPIs
| KPI | Intent |
|-----|--------|
| Payout accuracy % | Trust with supply |
| Invoice dispute rate | Clarity |
| Time-to-payout / time-to-invoice | Reliability |
| Unreconciled items aging | Control |
| Credit/adjustment leakage | Margin integrity |
| Fraud flags actioned | Risk |

---

## 10. U09 — Administrator

**Definition:** Platform configurator and privileged steward—makes the system safe to operate, not a daily dispatch hero.

### Responsibilities
- Configure zones, services, flags, reason codes, role templates  
- Manage staff access (joiners/movers/leavers)  
- Maintain audit hygiene and break-glass process  
- Support city launch configuration with Ops/Legal checklists  
- Never casually bypass separation of duties  

### Permissions (intent)
| Object | Access |
|--------|--------|
| Platform configuration | CFG |
| Staff accounts & role assignment | CFG |
| Audit logs | R |
| Break-glass | BG (time-bound) |
| Production data export | Highly restricted + audited |
| Impersonate users | BG only, rare, logged |

### Daily workflow
1. Access requests & joiner/leaver tickets  
2. Config changes with change notes  
3. Monitor failed jobs from config errors (with Ops)  
4. Audit spot-checks  
5. Prepare config packs for launches  

### Pain points
- Being used as “fix anything”  
- Undocumented config changes by many people  
- No staging of flags → production surprises  
- Pressure to weaken controls for sales demos  

### Goals
- Stable, explainable platform behaviour  
- Secure access posture  
- Enable launches without chaos  

### KPIs
| KPI | Intent |
|-----|--------|
| Access joiner/leaver SLA | Hygiene |
| Config changes with documentation % | Discipline |
| Sev incidents caused by config | Quality |
| Orphaned privileged accounts | Security |
| Break-glass frequency & review completion | Control |
| Audit findings closure time | Compliance |

---

## 11. U10 — Sales Representative

**Definition:** Enterprise hunter/farmer who sells premium logistics technology honestly—never oversells reliability.

### Responsibilities
- Qualify ICP fit; disqualify bad-fit volume  
- Run discovery, pilots, proposals within commercial policy  
- Coordinate security/ops readiness before promising go-live  
- Hand off cleanly to onboarding / Customer Success–style ops  
- Protect brand: no “we’ll make it work” against Phase 1 disqualifiers  

### Permissions (intent)
| Object | Access |
|--------|--------|
| Lead/account CRM records | R/C/U (sales system) |
| Enterprise Portal demo/sandbox | R/C limited |
| Production org data | R limited post-sale as allowed |
| Contracted rates / discounts | Propose; approve via authority matrix |
| Dispatch / support tooling | — |
| KPI fabrication in BI | — |

### Daily workflow
1. Pipeline review → discovery calls  
2. Scope pilot success criteria with Ops  
3. Propose packaging/SLA within policy  
4. Negotiate with discount governance  
5. Close → structured handoff checklist  

### Pain points
- Pressure to win on price alone  
- Ops blind spots discovered after signature  
- Long security reviews without a pack  
- Unclear ICP → wasted cycles  

### Goals
- Win accounts SWIFT can serve excellently  
- Expand from proven pilots  
- Build reputation as truthful partner  

### KPIs
| KPI | Intent |
|-----|--------|
| Qualified pipeline quality (not raw logos) | Focus |
| Pilot → paid conversion | Honesty of fit |
| Discount vs list adherence | Premium discipline |
| Time-to-handoff completeness | Onboarding success |
| Early churn / SLA fail after sale | Oversell detector |
| Expansion revenue on accounts won | Land-and-expand |

---

## 12. Cross-Role Collaboration Map

```text
Sales ──handoff──► Enterprise Customer (+ Admin config + Ops readiness)
Customer / Enterprise ──jobs──► Dispatcher ──assign──► Driver (+ Fleet Manager)
Exceptions ──► Dispatcher + Support Agent ──credits/claims──► Finance Officer
Patterns / capacity ──► Operations Manager ──policy requests──► Administrator
AI assists (future) ──suggestions──► Dispatcher / Ops (human accountable)
```

### Escalation ownership (people)

| Severity | First owner | Accountable up |
|----------|-------------|----------------|
| Job-level exception | Dispatcher and/or Support | Operations Manager |
| S1 safety / theft / breach | Ops + Support + Admin/Security path | Executive on-call |
| Payout / invoice systemic | Finance Officer | Ops + Executive if trust risk |
| Bad-fit enterprise pressure | Sales + Ops jointly | CEO/commercial lead |

---

## 13. Recipient & Executive (Lightweight)

### Recipient (variant of Customer experience)
- **Responsibilities:** Be contactable; provide access; confirm where required  
- **Permissions:** R on inbound job; limited instructions; no arbitrary cancel of payer’s job  
- **KPIs:** Contact success, recipient CSAT, failed-attempt attributable to recipient access  

### Executive (BI consumer)
- **Responsibilities:** Decide from promise KPIs, not vanity volume  
- **Permissions:** R on curated BI; no silent operational writes  
- **KPIs:** Company-level on-time, margin quality, NPS/trust proxies, incident trend  

---

## 14. Decisions Log (Phase 3)

| ID | Decision |
|----|----------|
| U-D1 | Ten canonical roles (U01–U10); Recipient/Executive as variants |
| U-D2 | Least privilege + scoped access; money and config are restricted classes |
| U-D3 | KPIs must not incentivise unsafe or dishonest behaviour |
| U-D4 | Sales cannot unilaterally break pricing floors or ops disqualifiers |
| U-D5 | Support may request dispatch actions; free silent reassignment is not default |
| U-D6 | Admin is configurator/steward, not substitute dispatcher |
| U-D7 | Fleet Manager cannot override platform eligibility/safety rules |
| U-D8 | Enterprise sub-roles (Booker/Approver/Org Admin/Viewer) sit under U02 |

---

## 15. Risks

| Risk | Mitigation |
|------|------------|
| Role explosion before launch | Stick to U01–U10; sub-roles only where proven |
| KPI dashboards punishing honesty | Audit KPI ethics with Ops monthly |
| Sales–Ops conflict | Written disqualifiers + pilot gates from Phase 1 |
| Support over-crediting | Hard authority matrix + Finance approval thresholds |
| Dispatcher burnout | Queue UX + staffing model in Phase 4/9 |
| Admin as bottleneck/hero | Change management + runbooks + dual Admin |

---

## 16. Assumptions

| # | Assumption | If false |
|---|------------|----------|
| U-A1 | Driver assignment is primarily controlled dispatch (not open claiming) at Wave 1 | Driver permissions/workflow change |
| U-A2 | Enterprise sub-roles launch with Booker + Org Admin minimum; Approver optional | Portal complexity rises |
| U-A3 | Sales uses CRM outside core logistics spine initially | Integration earlier |
| U-A4 | One Support Agent role at launch (no L1/L2 split in software yet) | Support Centre IA grows |
| U-A5 | Fleet Manager is partner-facing; internal fleet lead can use same product | Packaging only |
| U-A6 | Customers may be individuals or thin SMB orgs without full Enterprise Portal | Segment routing rules needed |
| U-A7 | English-first for all staff UIs at launch | Hiring/localisation impact |

---

## 17. Out of Scope for Phase 3

- Step-by-step BPMN processes → **Phase 4**  
- System/API implementation of RBAC → **Phases 5 & 7**  
- Screen layouts → **Phase 9**  
- Hiring plans / org charts beyond role intent → People Ops (future handbook)  

---

## 18. Approval Checklist

- [ ] Role catalogue U01–U10 accepted  
- [ ] Permissions intent accepted as baseline for Phase 7  
- [ ] Workflows, pain points, goals, KPIs sufficient to drive Phase 4 processes  
- [ ] Assumptions U-A1–U-A7 accepted or amended  
- [ ] Ready to open Phase 4 — Process Architecture  

**Approval response options:**  
`APPROVE PHASE 3` · `APPROVE PHASE 3 WITH AMENDMENTS: …` · `REVISE: …`
