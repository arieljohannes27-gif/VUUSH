# M8 Harden — Payments, Settlements & Thin Finance Ops · Design

**VUUSH · Project Atlas · Official Architecture**  
**Status:** APPROVED  
**Approved:** 2026-07-25  
**Opened:** 2026-07-25  
**Module:** M8 Harden (Phase 10 Phase C #14)  
**Depends on:** M8 delivered · M8c incidents · Admin flags · Brand Foundation v1.0  
**Users:** U01 Customer (pay) · U04 Driver (earnings/paid) · U07 Support (refund) · Finance/Admin ops  
**Phase gate:** Harden H0–H5 **APPROVED · DELIVERED** 2026-07-25. See `31_M8_HARDEN_NOTES.md`.

### Founder locks (2026-07-25)

| Decision | Lock |
|----------|------|
| **PSP** | **Paystack** (South Africa) |
| **Currency** | **ZAR** |
| **Invoices** | **A — defer** to M7 (no invoice product in Harden) |
| **Finance UI** | **Admin section** (thin Finance ops — not a standalone desk) |
| **Support job deep-dive** | Separate from Harden — schedule after H1 or parallel later |

---

## 0. Executive position

Wave-1 M8 already charges on confirm, refunds, creates earning lines, and “executes” payout batches — but the **PSP is `dev_stub`** and payout execute only **marks paid**. That is enough to dogfood trust flows; it is **not** enough to put real money in motion.

**M8 Harden** makes money **trustworthy for soft-live beachhead**:

> Real charge path (sandbox → live).  
> Real (or partner-real) driver payouts with freeze respect.  
> A thin finance ops surface to run settlements.  
> Clear driver “pending vs paid.”  
> Incident holds freeze earnings without heroics.

**Not** the full Finance Dashboard (SC-FI-*), not Enterprise invoicing (M7), not multi-currency ERP.

### Board challenges

| Temptation | Verdict | Why |
|------------|---------|-----|
| Build full P06 Finance product now | **Reject** | W2 screen catalogue; beachhead first |
| Enterprise invoice portal inside Harden | **Defer to M7** | Finance owns ledger; Enterprise views — Harden stays settlements |
| Drop `dev_stub` entirely | **Reject** | Local smoke + RC must stay green offline |
| Auto-payout every night with no freeze check | **Reject** | Frozen earnings must never leave |
| Support live map as part of Harden | **Separate** | Job deep-dive is M8a polish, not money |

---

## 1. Baseline (what exists)

| Piece | Status |
|-------|--------|
| Pay-on-confirm + provider abstraction | Delivered (`dev_stub`) |
| Webhooks idempotent | Delivered (stub) |
| Refunds + audit | Delivered |
| Earning lines + freeze flag | Delivered |
| Payout batch create + execute | Delivered — execute is **mark-paid only** |
| Driver earnings UI | Delivered (pending clarity) |
| Finance ops UI | **Missing** |
| Real PSP adapter | **Missing** |
| Invoice entities | **Missing** (DB arch target only) |
| Configurable driver share | Hard-coded 75% |

Authority notes: `14_M8_PAYMENTS_NOTES.md` · schema `0003_m8_payments.sql`.

---

## 2. Harden promise (beachhead)

| Promise | Meaning |
|---------|---------|
| **Honest charge** | Sandbox PSP can take a real test card; live mode gated by Admin flag |
| **Honest payout** | Execute moves money (or partner transfer API) or fails honestly — never silent “paid” |
| **Freeze wins** | Frozen / incident-held earnings cannot enter or leave a batch |
| **Ops can settle** | Staff can see pending → batch → execute without curl |
| **Driver clarity** | Pending vs paid is obvious in Driver Pay |
| **Local still works** | `dev_stub` remains default for `npm run smoke:m8` / RC |

---

## 3. In scope

### 3.1 Real PSP adapter — Paystack (SA)

- **Vendor lock:** Paystack South Africa · **ZAR only** for beachhead.  
- Implement `PaymentProvider` beside `DevStubProvider` (stub remains default for local smoke).  
- Env: `PSP_PROVIDER=dev_stub|paystack` (+ Paystack secret/public keys; webhook secret).  
- Webhook route for Paystack; keep idempotency on `(provider, provider_event_id)`.  
- Customer confirm continues to pass a **method ref** (Paystack authorization / reference) — never PAN storage.  
- Sandbox first; live mode gated (Admin flag / env) after KYC.  
- Stripe is **out of Harden** unless Paystack is blocked — revisit only with Atlas amendment.

### 3.2 Payout rail

- `executePayoutBatch` must call a **PayoutProvider** (may share PSP or be a thin bank/transfer stub with real failure modes).  
- Persist provider transfer ids; statuses: `pending → processing → paid | failed`.  
- Retries documented; failed items do not mark earning paid.  
- **Never** include `frozen=true` earnings.

### 3.3 Thin Finance ops UI

Minimum surface (Admin section **or** small Finance desk — pick one in approval):

| View | Purpose |
|------|---------|
| Pending earnings | Filter by driver / frozen |
| Create batch | Select driver + eligible lines |
| Batch detail | Execute / see results |
| Job money read | Payments + earnings for a job (support/finance) |

Maps loosely to SC-FI-006/007 beachhead — not full SC-FI catalogue.

### 3.4 Earnings rule

- Driver share from **Admin config / feature flag or pricing param** (replace hard-coded `0.75`).  
- Default remains 75% until changed.

### 3.5 Incident ↔ freeze

- Document + implement: when job enters security-relevant `INCIDENT_HOLD` (theft/threat playbooks), **auto-freeze** related earning lines.  
- Medical non-punitive holds: freeze policy explicit (default: freeze payout until release — people-safe, not punitive copy).

### 3.6 Smoke / RC

- Extend `smoke:m8` for provider factory with stub.  
- Optional sandbox smoke behind env.  
- Update `27_WAVE1_RC_DRILL.md` §8 PSP gap when sandbox proven.

---

## 4. Out of scope (park)

| Item | Where it goes |
|------|----------------|
| Full Finance Dashboard (reconciliation, exports, claims queues) | Wave-2 / later |
| Enterprise org invoices & credit terms | **M7** |
| Multi-driver mega-batch UX polish | Later |
| COD / Bitcoin / auth-capture-later | Still out |
| Support live map + driver card (“where is my parcel”) | **Separate slice** — see §7 |
| Deep rename `@swift/*` / DB | Brand migration programme |

### Invoice decision (lock at approval)

Phase 10 says “settlements/payouts/**invoices**.” For Harden beachhead:

| Option | Meaning |
|--------|---------|
| **A — Defer invoices** | Harden = PSP + payouts + thin finance UI only; invoice tables in M7 |
| **B — Thin artefact** | Add minimal `invoices` + lines for **driver/customer receipt PDF-less record** after paid job — no Enterprise portal |

**Locked:** **A — defer invoices to M7.**

### 4.1 South Africa operating model (plain)

1. VUUSH registers a Paystack business (SA KYC) and links a **ZAR business bank account**.  
2. Customers pay in **Rands** (card / channels Paystack enables for SA).  
3. Funds settle to VUUSH’s Paystack balance → business bank (Paystack schedule; typically ~2 working days).  
4. Driver payouts use Paystack **Transfers** (or equivalent) to SA bank accounts for eligible, non-frozen earnings.  
5. Local/dev continues on `dev_stub` so RC and laptops do not require live keys.

---

## 5. Non-goals

- Replacing Wave-1 pay-on-confirm timing  
- Storing card PANs  
- Punitive driver language when earnings freeze  
- Blocking RC dogfood on `dev_stub`

---

## 6. Suggested build slices (after approval)

| Slice | Outcome |
|-------|---------|
| **H0** | Design approved ✓ — Paystack + ZAR · invoices deferred · Admin Finance |
| **H1** | Paystack adapter + webhook + confirm path in sandbox ✓ **APPROVED** 2026-07-25 |
| **H2** | Payout provider + execute truthfulness + freeze guards ✓ **APPROVED** 2026-07-25 |
| **H3** | Thin Finance ops UI ✓ **APPROVED** 2026-07-25 |
| **H4** | Configurable share + incident auto-freeze ✓ **APPROVED** 2026-07-25 |
| **H5** | Smoke/RC updates + notes ✓ **APPROVED** 2026-07-25 (`31_M8_HARDEN_NOTES.md`) |

---

## 7. Adjacent work (not Harden)

**Support job deep-dive** (from founder ask 2026-07-24):

- From Support case → job: live projection / last-known, driver professional card  
- Reuses M5b + driver-profile APIs  
- Can ship **in parallel** as M8a polish without blocking H1–H5  

**RC drills B–E** remain human dogfood gates — not blocked by Harden design, but **live PSP** waits for H1+.

---

## 8. Brand / Atlas alignment

- Customer & driver money copy follows **Voice & Tone** (calm, exact; no urgency theatre).  
- Surfaces show **VUUSH** (surface rebrand done).  
- Product principles: Clear Commitment at pay; Faithful Completion at payout.

---

## 9. Approval checklist

- [x] Approve this design  
- [x] Lock PSP: **Paystack** · **ZAR**  
- [x] Lock invoice option: **A** (defer to M7)  
- [x] Lock Finance UI: **Admin section**  
- [x] Support job deep-dive: **separate** (after H1 / later)  

---

## 10. Revision history

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-07-25 | Draft opened — M8 Harden beachhead scope |
| 1.0 | 2026-07-25 | **APPROVED** — Paystack SA + ZAR; invoices deferred; Admin Finance UI |

---

**End of M8 Harden Design (approved)**
