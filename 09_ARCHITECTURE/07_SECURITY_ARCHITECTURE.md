# Phase 7 — Security Architecture

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED  
**Approved:** 2026-07-20  
**Depends on:** Phases 1–5 approved · Phase 6 (**APPROVED** 2026-07-20)  
**Phase gate:** Phase 7 locked as baseline. Amendments require explicit revision. Phase 8 unlocked.  
**Owner annex:** `07A_OWNER_THREAT_MAP.md` (solo-founder mode included).

---

## 0. Executive Position

SWIFT sells trust. Security is not a feature bolted on before launch—it is how the brand promise survives theft, fraud, insider misuse, and enterprise diligence.

### Board challenges

| Temptation | Verdict | Why |
|------------|---------|-----|
| “We’ll harden later” | **Reject** | Logistics PII + custody + payments = later is too late |
| Security that blocks Emergency flows | **Reject** | 4B: life safety outranks friction theatre |
| Shared staff logins / god-mode Admin | **Reject** | Destroys audit (PR25) and enterprise sales |
| Building a SOC before a job spine | **Reject** | Proportionate controls first |
| **Defence in depth, least privilege, auditable everything material, safety-aware UX** | **Adopt** | Premium logistics technology posture |

### Security thesis

> Authenticate strongly. Authorise narrowly. Encrypt by default.  
> Assume breach readiness. Prefer prevention, detect fast, recover with truth.  
> **People before parcels** still wins—security must enable WC-01/WC-02, not trap drivers in locked apps.

---

## 1. Security Objectives & Assets

### 1.1 Objectives (CIA + trust)

| Objective | SWIFT meaning |
|-----------|---------------|
| **Confidentiality** | PII, locations, documents, enterprise data stay scoped |
| **Integrity** | Job state, POD, money, audit log cannot be silently rewritten |
| **Availability** | Book/assign/track/support survive degraded modes honestly |
| **Accountability** | Every material action attributable (PR25) |
| **Safety** | Security controls never forbid emergency care / threat reporting |

### 1.2 Crown-jewel assets

1. Job timeline + proof artefacts (truth of delivery)  
2. Audit event spine  
3. Payment/settlement ledger references  
4. Identity & session store  
5. Driver/customer PII + document vault  
6. Live location streams  
7. Admin/config & break-glass powers  
8. Enterprise contracts & API credentials  

---

## 2. Threat Model (Summary)

| Actor | Goals | Example abuses |
|-------|-------|----------------|
| External attacker | Account takeover, data theft, ransomware | Phishing staff, API abuse, credential stuffing |
| Fraudulent shipper | Free transport, laundering, prohibited goods | Fake enterprises, undeclared danger, bust-out |
| Fraudulent driver | Steal goods, fake POD, earnings fraud | Abscond, GPS spoof, photo recycling |
| Malicious recipient/insider collusion | Theft with cover story | False claims, coerced redirects |
| Malicious / careless staff | Data snooping, credit abuse, cover-ups | Over-broad access, unlogged WhatsApp deals |
| Competitor / scraper | Price & supply intelligence | Bot quoting, driver enumeration |
| Nation-state (later scale) | Espionage | Targeted enterprise accounts |

Full STRIDE per module can deepen post-approval; Phase 7 locks control requirements.

---

## 3. Authentication Architecture

### 3.1 Principles

- Passwordless/OTP-first for customers & drivers where SMS/channel reliable  
- MFA mandatory for staff privileged roles (Admin, Finance, Dispatch leads, break-glass)  
- Short-lived access tokens + rotating refresh tokens  
- Device binding signals for Driver App (risk-based re-auth)  
- No shared accounts  

### 3.2 Subject methods (aligned Phase 5)

| Subject | AuthN | Notes |
|---------|-------|-------|
| Customer / Driver | OTP / secure session | Step-up for payout change, doc change |
| Enterprise user | Invite + session; SSO later | Org Admin can revoke |
| Staff | MFA | Role-gated apps |
| Enterprise machine | API key or OAuth client credentials | Hashed at rest; rotatable |
| Internal services | Workload identity / service tokens | No long-lived shared secrets in code |

### 3.3 Session security

- Secure cookie or native secure storage  
- Revocation list / session kill on password reset, theft report, offboarding  
- Idle timeout on staff consoles tighter than consumer  
- Concurrent session policy for Admin/Finance  

### 3.4 Emergency exception

Driver **Emergency** actions must work for an authenticated on-duty session even if secondary step-up would normally apply—**never** hide Emergency behind re-login friction mid-custody. Post-event re-auth may apply.

---

## 4. Authorisation & RBAC

### 4.1 Model

- **RBAC** using Phase 3 roles (U01–U10) + enterprise sub-roles  
- **Scopes:** self · organisation · fleet · zone/city · platform  
- **ABAC-lite** where needed: job.state, hold flags, ownership, assignment  

### 4.2 Enforcement points

| Layer | Duty |
|-------|------|
| API Gateway | Authenticate; coarse route allow |
| Domain modules | Fine-grained AuthZ on every command/query |
| Data layer | Org/fleet scoping in queries; no “fetch all jobs” for Support without role |
| Object storage | Signed short-TTL URLs; no public buckets for POD/KYC |

### 4.3 Separation of duties (non-negotiable)

| Action | Cannot be sole-approved by |
|--------|----------------------------|
| Below-floor pricing | Sales alone |
| Large credits | Support alone (Finance threshold) |
| Break-glass PII export | Unreviewed Admin habit |
| Role self-elevation | Anyone |
| Delete audit events | Anyone |

### 4.4 Role → permission intent (security view)

| Role | Sensitive powers |
|------|------------------|
| Customer | Own jobs/PII only |
| Enterprise | Org-scoped jobs/users per sub-role |
| Driver | Assigned job + own earnings; minimal customer PII |
| Fleet Manager | Own fleet only |
| Dispatcher | Zone-scoped assign/hold; reason codes required on override |
| Support | Case + linked job read; credits within matrix |
| Finance | Money movement; not live dispatch toys |
| Admin | Config + access; break-glass rare |
| Sales | Pipeline + limited portal; no production god-read |
| Ops Manager | Health + incident command; not silent ledger edits |

Detailed matrix tables can be expanded as an annex after approval; intent above is binding.

---

## 5. Encryption & Data Protection

| Control | Requirement |
|---------|-------------|
| In transit | TLS 1.2+ everywhere (apps, APIs, webhooks) |
| At rest | Cloud-managed encryption for DB, disks, object store |
| Secrets | Secrets manager; never in git or mobile binaries |
| Fields | Hash OTPs/passwords (modern KDF); tokenise payment refs |
| Documents | Private objects; encryption at rest; access logged |
| Key management | Provider KMS; rotation policy |
| Mobile | OS secure storage for tokens; certificate pinning recommended for Wave 1.5+ |

**PAN/CVV:** never stored (Phase 6 DB-D4 restated).

---

## 6. Audit Trails (Security Lens on PR25)

### 6.1 Mandatory audited actions

- AuthN failures/successes for staff & high-risk  
- All job state transitions & holds  
- Assignment overrides  
- Mutations (PR20)  
- Credits/refunds/claims decisions  
- Document views/downloads (KYC/POD) for staff  
- Config changes & feature flags  
- Break-glass & impersonation  
- API key create/rotate/revoke  
- Exports / audit pack downloads  

### 6.2 Integrity

- Append-only audit store  
- Admin cannot “edit history”  
- Clock skew monitored  
- Correlation IDs from gateway through workers  

### 6.3 Monitoring

- Alerts: spike in auth failures, mass job reads, unusual credit volume, break-glass use, teleport/spoof flags, S1 opens  

---

## 7. Device Security

### 7.1 Driver App

- Store tokens in secure enclave/keystore  
- Safety: Emergency available offline-ish (queue + OS dialer)  
- Root/jailbreak: detect & risk-score (warn/block high-risk actions—not medical emergency)  
- Remote session revoke if device reported stolen  
- Location: purpose-limited; integrity checks (PR23)  

### 7.2 Customer App

- Standard mobile hardening  
- Step-up for payment method changes  

### 7.3 Staff web

- MFA; hardened session  
- No POD bulk download without role + audit  
- Optional IP allowlists for Admin/Finance later  

---

## 8. Fraud Detection Architecture

### 8.1 Fraud domains

| Domain | Signals | Response classes |
|--------|---------|------------------|
| Account | Device velocity, OTP abuse | Challenge, lock, review |
| Booking | High value + new account, prohibited patterns | Manual review, declare-value force, ban |
| Driver | Fake POD, spoof GPS, cancel patterns | Freeze payouts, investigate, offboard |
| Claims | Repeat claims, evidence mismatch | Deny path, fraud case |
| Payments | Chargebacks, stolen instruments | PSP rules + SWIFT holds |
| Insider | Odd access patterns | Revoke, HR/legal path |

### 8.2 Placement

- Rules engine / risk scores consume events (Jobs, Tracking, Payments, Support)  
- Wave 1: deterministic rules + queues  
- Wave 4: AI assists ranking (suggest-only; Phase 5 S-D8)  
- Human accountable for punitive actions  

### 8.3 Customer fairness

Fraud controls must not silently punish honest emergency or connectivity degradation (tie to PR23 degraded states).

---

## 9. Enterprise Security

| Control | Requirement |
|---------|-------------|
| Tenant isolation | Org-scoped AuthZ + query filters (not separate DB per customer at Wave 1) |
| API credentials | Scoped, rotatable, rate-limited, IP allowlist optional |
| Webhooks | Signed payloads; replay protection |
| Diligence pack | PR25 enterprise pack: access model, incident stats, encryption, subprocessors |
| DPA / processing terms | Legal-owned; architecture supports deletion/export requests |
| Penetration testing | Before major enterprise scale; after Wave 1 hardening |
| SSO/SAML | Roadmap; not Wave 1 blocker if invite+MFA staff path solid |

---

## 10. Application & SDLC Security

1. Secure defaults in modules  
2. Dependency scanning in CI  
3. Secret scanning  
4. Threat model updates on new money/custody flows  
5. Least privilege cloud IAM (Phase 5)  
6. Separate prod credentials  
7. Change management for Admin config  
8. Responsible vulnerability intake path  

---

## 11. Infrastructure & Network Security

| Control | Requirement |
|---------|-------------|
| Edge | WAF/CDN, DDoS basics, TLS |
| Network | Private subnets for data stores; minimal public surface |
| Ingress | Gateway only for APIs |
| Egress | Controlled to PSP, SMS, maps, etc. |
| Backups | Encrypted; restore tested; access restricted |
| Environments | Hard separation dev/staging/prod data (no prod PII in dev) |

---

## 12. Incident Response (Security)

Align with PR19 severities; add cyber-specific:

| Class | Examples | Actions |
|-------|----------|---------|
| S1 cyber | Breach, ransomware, mass PII leak | Exec + contain + legal notify path + forensics |
| S2 cyber | Limited account compromise | Revoke sessions, reset, review audit |
| Abuse | Fraud rings | Freeze entities, Finance holds |

**Process:** Detect → Contain → Eradicate → Recover → Postmortem → Atlas update.  
Customer/enterprise notification per legal advice (beachhead jurisdiction).

---

## 13. Compliance Posture (Architecture)

| Domain | Security implication |
|--------|----------------------|
| Data protection | Minimise, purpose-limit, honour access/delete with legal hold |
| Payments | PCI via PSP; SWIFT SAQ posture as applicable |
| Employment/contractor | Driver data handling clarity |
| Transport/prohibited goods | Declaration + ban enforcement (PR21) |
| Retention | PR25 + counsel durations |

Compliance calendar owned with Legal; security implements technical measures.

---

## 14. Mapping Controls → Phase 5/6

| Asset / flow | Primary controls |
|--------------|------------------|
| API Gateway | AuthN, rate limit, WAF, correlation IDs |
| Identity module | Credentials, MFA, sessions, RBAC source |
| Jobs / Dispatch | AuthZ, reason codes, state machine integrity |
| Tracking | Access scope, integrity flags, retention |
| Object store | Private, signed URLs, audit downloads |
| Payments | PSP, idempotency, no PAN |
| AuditEvent | Append-only, monitored |
| Admin | MFA, change logs, break-glass |

---

## 15. Wave Sequencing for Security

| Wave | Security deliverables |
|------|------------------------|
| **Wave 0–1** | AuthN/Z, TLS, secrets, audit spine, private objects, Emergency-safe UX, basic fraud rules, staff MFA |
| **Wave 2** | Enterprise API signing, diligence pack automation, stronger fraud queues |
| **Wave 3+** | SSO, advanced SIEM, pen-test programme, AI anomaly assist |

---

## 16. Decisions Log (Phase 7)

| ID | Decision |
|----|----------|
| SEC-D1 | Defence in depth + least privilege + safety-aware Emergency UX |
| SEC-D2 | Gateway AuthN; domain AuthZ; object store never public for evidence/KYC |
| SEC-D3 | MFA for privileged staff; no shared logins |
| SEC-D4 | Append-only audit for all material & privileged actions |
| SEC-D5 | Fraud: rules-first; AI suggest-only later; humans for punishment |
| SEC-D6 | Enterprise isolation via AuthZ scoping at Wave 1 |
| SEC-D7 | PSP holds cards; SWIFT holds references + ledger |
| SEC-D8 | Security IR merges with PR19; cyber S1 has legal notify path |
| SEC-D9 | Prod PII never in dev |
| SEC-D10 | Separation of duties on price floors, credits, break-glass |

---

## 17. Risks

| Risk | Mitigation |
|------|------------|
| OTP SMS SIM-swap | Risk scoring, step-up, later app-based MFA for high value |
| Insider Support snooping | Scoped views + access audit alerts |
| Driver device theft mid-custody | Session revoke + Dispatch WC path |
| Over-blocking fraud false positives | Tie to PR23 degraded states; appeal path |
| Audit volume cost | Partition/archive; don’t disable |
| Enterprise questionnaire fail | Diligence pack from real controls, not slides |

---

## 18. Assumptions

| # | Assumption |
|---|------------|
| SEC-A1 | Beachhead has usable SMS/OTP or equivalent channel |
| SEC-A2 | PSP provides PCI scope reduction |
| SEC-A3 | Legal defines breach notification timelines per country |
| SEC-A4 | SSO can wait until pilot enterprises demand it |
| SEC-A5 | Formal pen-test before large enterprise expansion, not before first controlled pilot |

---

## 19. Out of Scope (Phase 7)

- Pixel UI for security screens → Phase 8/9  
- Vendor brand selection for SIEM/WAF → Tech Stack handbook  
- Employee HR security policy prose → Ops/People handbook  
- Production hardening implementation → build phases  

---

## 20. Approval Checklist

- [ ] AuthN/AuthZ model accepted  
- [ ] Encryption & PAN stance accepted  
- [ ] Audit + fraud + enterprise controls accepted  
- [ ] Emergency/safety exception accepted  
- [ ] Assumptions SEC-A1–SEC-A5 accepted or amended  
- [ ] Ready to open Phase 8 — Design Architecture  

**Approval response options:**  
`APPROVE PHASE 7` · `APPROVE PHASE 7 WITH AMENDMENTS: …` · `REVISE: …`
