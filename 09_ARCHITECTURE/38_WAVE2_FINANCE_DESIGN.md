# Wave 2 — Finance Dashboard & Trust Depth · Design

**VUUSH · Project Atlas**  
**Status:** APPROVED TO BUILD  
**Opened:** 2026-07-30  
**Approved:** 2026-07-30  
**Module:** Wave-2 Finance (Phase 10 Phase C remaining) + PR25 audit packs  
**Depends on:** Wave-1 spine · M8 Harden · M7 Enterprise E0–E6 · Brand = **VUUSH**  
**Users:** Finance Officer (U08) · Administrator · Support (propose only) · Org Admin (billing view)  
**Screens:** SC-FI-001…008, 010–011 (pilot) · SC-AD-012 · SC-FI-009 parked  

**Successor gate:** E-hailing (**Wave E**) stays parked until this programme’s implementation DoD is met. See `39_WAVE_EHAILING_PARKED.md`.

---

## 0. Founder locks (APPROVED)

| # | Lock |
|---|------|
| **D1** | Surface = **Admin → Money** (rename nav group to **Finance**). No new Vite app. |
| **D2** | Depth = **pilot** (attention, ledger, payments, payouts, adjustments, statements, manual reconcile, export). Claims cockpit later. |
| **D3** | Invoices = **org statements list + credit note stub** (reuse M7; no PDF builder). |
| **D4** | Reconciliation = **manual match** only. |
| **D5** | Audit pack = **CSV + JSON zip** for a date range. |
| **D6** | M7b smart stops = **parked** (Wave 3+). |
| **D7** | **ZAR · Cape Town** only. |

---

## 1. Plain English

Wave One: one person books → driver delivers → money settles.  
M7: a business can ship.  

Wave Two Finance: staff can run a calm money week.

> See every rand.  
> Pay drivers honestly.  
> Match Paystack to our books by hand.  
> Export for the accountant.  
> Hand diligence a pack.

Not an ERP. Not a second Dispatch.  
Enterprise **views** statements. Finance **owns** the ledger.

---

## 2. Baseline (do not rebuild)

| Piece | Status |
|-------|--------|
| Charge / refund / webhooks | M8 + Harden |
| Earnings + freeze + payout execute | Harden H2–H4 |
| Admin Money: Earnings · Payouts · Job money | Harden H3 |
| Org weekly statement CSV | M7 E4 |
| Enterprise portal | M7 E0–E6 |

**Build on Harden Money** — deepen, do not fork.

---

## 3. Information architecture (Admin)

Rename top group **Money → Finance**. Sub-nav:

| Nav id | Label | Screen | Slice |
|--------|-------|--------|-------|
| `finance_home` | Home | SC-FI-001 | F0–F1 |
| `payments` | Payments | SC-FI-003 | F1 |
| `job_money` | Job ledger | SC-FI-002 | F2 |
| `earnings` | Earnings | (existing polish) | F2 |
| `payouts` | Payouts | SC-FI-006/007 | F3 |
| `adjustments` | Adjustments | SC-FI-008 | F4 |
| `statements` | Statements | SC-FI-004/005 | F5 |
| `reconcile` | Reconcile | SC-FI-010 | F6 |
| `exports` | Exports | SC-FI-011 | F7 |

**Activity** (existing): keep audit search.  
**New under Activity or City:** **Audit pack** (SC-AD-012) — F8.

Role gate: `administrator` **or** new role `finance_officer` for all Finance nav.  
Dispatchers / support **cannot** open Finance pages (Support may deep-link “request adjustment” only via Support console).

---

## 4. Screen contracts (pilot)

### SC-FI-001 Finance home

**One job:** show what needs a human today.

Cards / counts (tap → filtered list):

1. Failed / unpaid consumer payments (last 7 days)  
2. Frozen earnings (count + sum ZAR)  
3. Payout batches in `failed` / `partial`  
4. Open reconcile items older than 48h  
5. Adjustments waiting approval  

Copy: **“Needs you”** — not “anomalies.”  
Empty state: “Finance is quiet. Nothing needs you.”

### SC-FI-002 Job commercial ledger

**One job:** answer charged? earned? frozen? paid out?

Reuse / deepen existing Job money:

- Job public code, state, org (if any)  
- Payment rows: status, amount, PSP ref, refunds  
- Earning rows: amount, frozen, status, payout batch link  
- Actions: freeze / unfreeze (existing); link to payout item if any  

No assign-driver theatre on this screen beyond existing Harden control.

### SC-FI-003 Payments list

Filterable table: status, created, amount, job code, provider.  
Default sort: newest. Filter chips: failed · pending · captured · refunded.

### SC-FI-004 / 005 Statements + credit stub

- List all `org_invoices` (Finance sees every org).  
- Open detail: lines + CSV download (same as portal).  
- **Regenerate** week for an org (same rules as portal generate; audit who ran it).  
- **Credit note:** amount, reason code, optional job / statement link → row in `credit_notes` + audit. Does **not** auto-refund Paystack (Support/Finance refund path stays separate). Statement totals may show credits as memo lines in export.

### SC-FI-006 / 007 Payouts

Polish Harden:

- Batch list with status honest (`pending` / `executing` / `paid` / `failed` / `partial`)  
- Detail: each item success/fail code; frozen lines never included  
- Execute button confirms: “Moves real money when Paystack live.”  

### SC-FI-008 Adjustments queue

- Config: `finance_credit_approve_above_cents` (default e.g. 50000 = R500)  
- Support refund/credit **above** threshold creates `adjustment_request` = `pending_finance`  
- Finance **Approve** → existing refund/credit executes  
- Finance **Reject** → closed with reason; Support notified via case note if linked  

Below threshold: Support path unchanged (still audited).

### SC-FI-010 Reconcile (manual)

- Rows from: failed webhook orphans, amount mismatches staff flag, or “create item” from payment  
- Status: `open` · `matched` · `waived`  
- Actions: Match to job id · Waive with note · both audited  

No auto-match engine.

### SC-FI-011 Exports

Form: from date · to date · datasets (checkboxes):

- payments · earnings · payout_batches · org_statements · credit_notes · reconcile_items  

Download one CSV per dataset (or zip of CSVs). Sync generate OK for beachhead volumes.

### SC-AD-012 Audit pack

Admin/Finance:

- from · to · optional org_id  
- Async or sync zip:  
  - `jobs.json` (ids, states, money fields)  
  - `payments.csv` · `earnings.csv` · `payouts.csv`  
  - `incidents.json` (if any in window)  
  - `audit_events.jsonl` (filtered)  
  - `manifest.json` (who, when, range, hashes)  
- Store file ref or stream download; list past packs  

---

## 5. API sketch (build contract)

All under `/v1/finance/*` unless noted; auth: finance_officer | administrator.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/finance/home` | Queue counts for SC-FI-001 |
| GET | `/v1/finance/payments` | List + filters |
| GET | `/v1/finance/jobs/:id/money` | Existing — keep |
| GET | `/v1/finance/earnings` | Existing — keep |
| POST | `/v1/finance/earnings/:jobId/freeze` | Existing |
| GET/POST | `/v1/finance/payout-batches` | Existing + richer detail errors |
| GET | `/v1/finance/statements` | All orgs’ statements |
| POST | `/v1/finance/statements/generate` | Org + period (mirror enterprise rules) |
| POST | `/v1/finance/credit-notes` | Create stub |
| GET | `/v1/finance/adjustments` | Pending queue |
| POST | `/v1/finance/adjustments/:id/approve\|reject` | Threshold flow |
| GET/POST | `/v1/finance/reconcile` | List / create |
| POST | `/v1/finance/reconcile/:id/match\|waive` | Manual close |
| POST | `/v1/finance/exports` | Returns zip or multi-CSV |
| POST | `/v1/admin/audit-packs` | Request pack |
| GET | `/v1/admin/audit-packs/:id` | Download / status |

Support integration: refund path checks threshold → may return `needs_finance_approval` + adjustment id.

---

## 6. Data (minimum)

| Table / field | Role |
|---------------|------|
| `finance_reconcile_items` | Manual reconcile board |
| `credit_notes` | Memo credits against org/job/statement |
| `adjustment_requests` | Pending large Support money moves |
| `audit_packs` | Pack metadata + storage key |
| pricing/config `finance_credit_approve_above_cents` | Threshold |

Reuse: `payments`, `earning_lines`, `payout_batches`, `payout_items`, `org_invoices`, `org_invoice_lines`, `audit_events`.

---

## 7. Roles

| Role | Finance |
|------|---------|
| `finance_officer` | All Finance screens + exports; audit packs |
| `administrator` | Same + threshold config + staff roles |
| `support` | Propose refund/credit; blocked above threshold until approve |
| `org_admin` | Own statements in Enterprise only |
| `dispatcher` | No Finance |

Every approve / execute / match / credit / pack → `audit_events`.

---

## 8. Delivery slices

| Slice | Outcome | Done when |
|-------|---------|-----------|
| **F0** | Nav = Finance; role gate | finance_officer can open; dispatcher cannot |
| **F1** | Home queues + Payments list | Counts match filtered lists |
| **F2** | Job ledger polish | One job answers charge/earn/freeze/payout |
| **F3** | Payout detail failures | Failed item shows code; not marked paid |
| **F4** | Adjustments threshold | Above-threshold Support blocked until approve |
| **F5** | Statements + credit note | Finance lists all orgs; credit audited |
| **F6** | Reconcile board | Match/waive closes open item |
| **F7** | Exports | Date-range CSVs download |
| **F8** | Audit pack | Zip download for range |
| **F9** | `smoke:finance` + notes | Script green on stub |

Optional (not gate): statement PDF, portal Support deep-link.

---

## 9. UX doctrine

- One purpose per screen.  
- Numbers first; no chart theatre.  
- Failed money is loud and honest.  
- VUUSH wordmark; calm field; rare accent.  
- German-clean Admin patterns already in use.

---

## 10. Out of scope (park)

| Park | Where |
|------|--------|
| SC-FI-009 claims finance deep | Later |
| Auto reconcile / Xero | Later |
| Invoice PDF builder | Later |
| M7b optimiser | Wave 3+ |
| New finance-console app | Rejected (D1) |
| E-hailing | Wave E after Finance DoD |

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| ERP scope crush | Pilot boundary D2; park claims |
| Finance = Support | Threshold queue only |
| Fake auto-reconcile | Manual only |
| Spine thrash for rides | Wave E gated |

---

## 12. Programme DoD (Finance complete)

All of:

- [ ] F0–F9 delivered  
- [ ] `smoke:finance` green  
- [ ] Live/sandbox: home queues usable  
- [ ] Audit pack produced once without eng help  
- [ ] No regression Customer / Driver / Dispatch / Enterprise  

Then founder may say **open Wave E design**.

---

## 13. Approval

- [x] Design approved to build (2026-07-30)  
- [x] Locks D1–D7 as §0  
- [x] Brand VUUSH  

**Implementation** starts only when founder says **build Finance** (or equivalent). This document is the build authority.

---

## 14. Revision history

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-07-30 | Draft |
| 1.0 | 2026-07-30 | **APPROVED TO BUILD** — locks D1–D7; screen/API/slice contracts |

---

**End of Wave 2 Finance Design (APPROVED TO BUILD)**
