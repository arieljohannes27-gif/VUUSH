# M8 Harden — Implementation Notes

**Status:** APPROVED · DELIVERED (H0–H5 · 2026-07-25)  
**Design:** `30_M8_HARDEN_DESIGN.md` (APPROVED 2026-07-25)  
**Code:** `platform/src/modules/payments/` · Admin places (Home / City / Money / People / Activity)  
**Smoke:** `npm run smoke:m8` (stub path; optional `PAYSTACK_SMOKE=1` note)

---

## Money story (one order)

```
Customer pays (H1) → Driver earns → Hold if needed (H2/H4) → Payout (H2) → Ops sees it (H3) → Prove (H5)
```

| Step | What | Slice |
|------|------|-------|
| 1 | Take payment (Paystack / stub) | **H1** ✓ APPROVED |
| 2 | Pay drivers truthfully; respect freezes | **H2** ✓ APPROVED |
| 3 | Admin Money screens | **H3** ✓ APPROVED 2026-07-25 |
| 4 | Configurable driver share + incident auto-freeze | **H4** ✓ APPROVED 2026-07-25 |
| 5 | Smoke / RC notes | **H5** ✓ APPROVED 2026-07-25 |

Locks: Paystack SA · ZAR · local `dev_stub` · invoices → M7 · Finance UI = Admin.

---

## H1 — Take payment ✓

`PaystackProvider` beside `dev_stub`. Confirm with `AUTH_…` or transaction reference; initialize + webhook.

## H2 — Pay drivers ✓

`PayoutProvider` on execute. Failed ≠ paid. Frozen never paid. Recipient codes on driver profile.

## H3 — Ops can see & act ✓

Admin places: **Home · City · Money · People · Activity**.  
Money: Job money · Earnings · Payouts.  
APIs: `GET /v1/finance/earnings` · `…/payout-batches` · `…/jobs/:id/money`.

## H4 — Rules ✓

- Pricing param `driver_share` (default 75%; Admin → City → Pricing)
- `INCIDENT_HOLD` auto-freezes earnings (`incident_security` / `incident_medical` / `incident_hold`)
- Release last incident hold → clear auto freezes only

## H5 — Prove it ✓ APPROVED 2026-07-25

- `smoke:m8` asserts stub provider, finance reads, 75% share, incident freeze/unfreeze
- Optional Paystack path noted via `PAYSTACK_SMOKE=1` (manual sandbox)
- `27_WAVE1_RC_DRILL.md` §8 PSP gap updated: Harden shipped; RC stays on stub until live KYC

---

## Env (Paystack)

```
PSP_PROVIDER=dev_stub          # default for RC / laptop
# PSP_PROVIDER=paystack
# PAYSTACK_SECRET_KEY=sk_test_…
# PAYSTACK_PUBLIC_KEY=pk_test_…
# PAYSTACK_LIVE_ENABLED=false
# PAYSTACK_DEFAULT_TRANSFER_RECIPIENT=RCP_…
```

Webhook: `POST /v1/payments/webhooks/paystack`

---

**Not Harden (later):** Support “where’s my parcel” deep-dive · full invoice product (M7) · live Paystack KYC go-live.

---

## Driver clearance (2026-07-26)

Started from `34_DRIVER_CLEARANCE_DESIGN.md`: password signup + OTP email verify + Admin Approve/Reject. Migration `0012_driver_clearance.sql`.
