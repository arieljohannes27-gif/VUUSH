# M7 — Enterprise Portal (B2B) · Design

**VUUSH · Project Atlas**  
**Status:** APPROVED TO BUILD  
**Opened:** 2026-07-26  
**Approved:** 2026-07-26  
**Module:** M7 Enterprise Portal (Phase 10 Phase C #15)  
**Depends on:** Wave-1 spine · M8 Harden (money truth) · Brand Foundation v1.0  
**Users:** Org Admin · Booker · Approver · Viewer · VUUSH Admin (lifecycle)  
**Screens (catalogue):** SC-EN-001…016 (Phase 9) — this design picks the **pilot slice**

### Founder locks (2026-07-26)

| Decision | Lock |
|----------|------|
| **Invoice mode** | **A** — weekly statement (PDF/CSV); pay outside (EFT). Per-org card (B) later via flag. |
| **Multi-stop / warehouse** | **M7a in same programme** (after E5 core, as E6) |
| **Surface** | **New** `enterprise-portal` Vite app |
| **Pilot city** | Cape Town (beachhead) |
| **Route copy** | Show “Your stop order” until M7b optimiser exists |

---

## 1. Plain English

Wave One proved: **one person books → one driver delivers → money settles**.

Wave Two proves: **a business** can ship with VUUSH.

A company gets an **organisation** account.  
Several people can log in (book, approve, watch).  
They create shipments from **saved sites** (warehouse, shop, customer).  
They see status without calling anyone.  
They get **invoices / statements** they can download.  
Later they can connect by **API**.

This is **not** VUUSH becoming a second dispatch room.  
Enterprise is **demand-side**: create and watch. Ops still live in Dispatch / Support / Admin.

---

## 2. Why now

| Already true | Still missing for B2B |
|--------------|------------------------|
| Job spine, pay, track, POD | Org accounts & multi-user |
| Customer app (single shipper) | Company booker + approver |
| Harden settlements | Invoices the business can see |
| Driver clearance | Warehouse / bulk patterns |

You said you need **financial depth + B2B + warehouse / bulk routing**.  
Atlas order: Harden (done as design+H0–H5) → **M7 Enterprise** → deeper finance / fleet later.

---

## 3. Founder decisions (locked)

| Decision | Lock | Why |
|----------|------|-----|
| **Beachhead product** | Thin **Enterprise Portal** — new `enterprise-portal` app | Matches SC-EN pilot |
| **First city org model** | One org · many users · many **sites** · Cape Town | Warehouse + shops without full WMS |
| **Approvals** | Optional: jobs above a rand threshold need Approver | Real B2B without workflow builder |
| **Invoices** | **A** — weekly statement view/download; Finance owns ledger | Harden deferred invoices here |
| **API** | Masked keys + webhook URL in portal (PR24 thin) | Integration path without boiling ocean |
| **Bulk / warehouse** | **M7a in programme (E6)** — not full route optimiser | Door open; optimiser = M7b |
| **Route mapping** | Ordered stops on map; dispatch assigns; copy = “Your stop order” | Honest maps; no fake optimisation |

---

## 4. What we build in M7 (pilot)

### 4.1 In scope

1. **Org lifecycle (Admin)** — create org, suspend, attach contract label / billing email.  
2. **Users & roles** — Org Admin, Booker, Approver, Viewer. Invite by email.  
3. **Sites** — named addresses (warehouse, store, consignee favourites).  
4. **Create shipment** — same booking rules as customer spine; org + site + cost centre (optional text).  
5. **Approval queue** — if policy on; else booker confirms = The Point.  
6. **Shipments list + detail** — status, track, POD link, exceptions (read + request support).  
7. **Billing** — list invoices/statements generated from delivered jobs (monthly or on-demand batch).  
8. **API settings** — create/rotate key (secret shown once), webhook endpoint, last delivery status.  
9. **Audit** — who booked, who approved, who downloaded invoice.

### 4.2 Out of scope (park)

| Park | Where it goes |
|------|----------------|
| Full Finance Dashboard (SC-FI-* reconciliation cockpit) | Later Wave-2 finance depth |
| Custom workflow builder / multi-step BPM | Later |
| Enterprise acting as dispatcher | Never — Dispatch stays ops |
| Full warehouse WMS / inventory | Outside VUUSH core |
| Auto multi-vehicle route optimisation | **M7b / W3** after thin multi-stop works |
| Marketing site polish | Parallel, not a gate |

---

## 5. Bulk warehouse & route mapping (honest split)

You asked for **route mapping for bulk warehouse courier**. We split so we do not lie:

### M7a — Thin bulk (with M7 pilot or immediately after)

| Capability | Meaning |
|------------|---------|
| **Multi-stop job** | One booking: Warehouse → Stop A → Stop B → … → done |
| **Stop order** | Booker sets order; map shows the chain |
| **Proof per stop** | POD / note at each stop (reuse M6a patterns) |
| **Pricing** | Quote by stops + distance band (simple rule; Admin-configurable later) |
| **Dispatch** | Still human/algorithm assign **one driver** to the whole run |

**Promise:** A warehouse can send a driver on a **clear run** without ten separate bookings.

### M7b — Later (do not pretend in M7)

- Optimise stop order automatically  
- Split one bulk order across many drivers  
- Live re-sequence mid-run  
- Fleet Dashboard density tools (Wave-3 M11)

**Rule:** If the map implies “optimised” and we only show booker order, copy must say **“Your stop order”** — never “smart route” until M7b exists.

---

## 6. Roles (plain)

| Role | Can |
|------|-----|
| **Org Admin** | Users, sites, API keys, billing contacts, approval policy |
| **Booker** | Create / cancel (pre-Point), see own + org shipments |
| **Approver** | Approve / reject pending shipments |
| **Viewer** | Read-only track & invoices |

VUUSH Admin can create/suspend orgs; cannot see other orgs’ data in the portal UI (tenant wall).

---

## 7. Money (from Harden → M7)

| Piece | Owner |
|-------|-------|
| Card / Paystack charge on confirm (consumer) | Existing M8 |
| **Org invoice / statement** | Finance generates; Enterprise **views** |
| Driver payouts | Harden Admin Money — unchanged |
| Credit terms (pay later) | **Optional later** — pilot default: pay-on-confirm or weekly invoice (pick at approval) |

### Invoice decision (lock at approval)

| Option | Meaning | Recommend |
|--------|---------|-----------|
| **A** | Weekly statement PDF/CSV of delivered jobs; pay outside (EFT) | Best for first SA B2B |
| **B** | Paystack charge per job (same as consumer) | Faster, less “enterprise” |
| **C** | Both: small jobs card; bulk on statement | Later |

**Locked:** **A** for pilot orgs; keep B available later as a per-org flag.

---

## 8. Screens (pilot map)

| ID | Screen | M7 pilot? |
|----|--------|-----------|
| SC-EN-001 | Login | Yes (password or OTP — match platform auth) |
| SC-EN-002 | Home overview | Yes (counts: live / today / needs approval) |
| SC-EN-003 | Create shipment | Yes (+ multi-stop in M7a) |
| SC-EN-004 | Approval queue | Yes if policy on |
| SC-EN-005 | Shipments list | Yes |
| SC-EN-006 | Shipment detail / track | Yes |
| SC-EN-007 | Mutation request | Thin: request destination change → existing mutation flow |
| SC-EN-008 | Sites & addresses | Yes |
| SC-EN-009 | Users & roles | Yes |
| SC-EN-010 | Billing & invoices | Yes (view/download) |
| SC-EN-011 | Invoice detail | Yes |
| SC-EN-012 | Contract / SLA | Read-only stub OK |
| SC-EN-013 | API settings | Yes (thin) |
| SC-EN-014 | Support | Link into Support case with org+job |
| SC-EN-015 | Pilot dashboard | Later |
| SC-EN-016 | Notification prefs | Later |

Admin: **SC-AD-010** Org accounts — create/suspend — in Admin Console (not a second product).

---

## 9. Data (minimum)

- `organisations` — id, name, status, billing_email, approval_threshold_cents, pay_mode  
- `org_memberships` — user_id, org_id, role  
- `org_sites` — label, address, lat/lng, kind (warehouse|store|other)  
- `jobs.org_id` — already sketched on jobs (`org_id` nullable)  
- `job_stops` — for M7a multi-stop (sequence, address, proof)  
- `invoices` / `invoice_lines` — period, org, totals, file ref  
- `org_api_keys` — hash, prefix, created_at, revoked_at  

Tenant rule: every enterprise query filters by `org_id`. Fail closed.

---

## 10. UX doctrine (your taste → product)

- **German-clean:** one job per screen; no decorative chrome.  
- Soft translucent hover on nav (Mac / your reference) — not blue text theatre.  
- Brand: white field, rare accent, honest status.  
- Copy: reduce friction; never promise optimisation we do not run.

---

## 11. Delivery slices (build order after approval)

| Slice | Outcome |
|-------|---------|
| **E0** | Schema + Admin create org + invite Org Admin |
| **E1** | Portal login · home · sites · users |
| **E2** | Book single-stop · list · detail/track |
| **E3** | Approval policy + queue |
| **E4** | Invoice statement generate (Admin/Finance) + portal download |
| **E5** | API key + webhook stub |
| **E6 / M7a** | Multi-stop book + map of stop order + per-stop proof |

Smoke: `smoke:m7` (to be added) — org book → deliver → invoice line exists.

---

## 12. Risks

| Risk | Mitigation |
|------|------------|
| Portal becomes dispatch | No assign controls in Enterprise |
| Fake “smart routing” | M7a copy locked; optimiser = M7b |
| Invoice ≠ ledger | Finance owns numbers; portal is a window |
| Scope crush vs beachhead go-live | Deploy remaining apps + RC can run **in parallel**; M7 design does not block city_live |

---

## 13. Approval checklist

- [x] Approve this design as **Wave-2 M7 pilot**  
- [x] Lock invoice option: **A** (weekly statement; B later via flag)  
- [x] Lock multi-stop: **M7a in same programme (E6)**  
- [x] Lock surface: **new `enterprise-portal` app**  
- [x] Confirm beachhead city: **Cape Town**  

---

## 14. Revision history

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-07-26 | Draft opened — B2B pilot + honest bulk/route split |
| 1.0 | 2026-07-26 | **APPROVED TO BUILD** — invoice A · M7a as E6 · new portal app · Cape Town |

---

**End of M7 Enterprise Design (APPROVED TO BUILD)**
