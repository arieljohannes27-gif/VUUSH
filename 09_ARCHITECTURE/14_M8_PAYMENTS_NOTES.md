# M8 — Payments & Settlements (Implementation Notes)

**Status:** DELIVERED (+ Harden H1–H5 — see `31_M8_HARDEN_NOTES.md`)  
**Depends on:** M0, M1, M3  
**Code:** `platform/src/modules/payments/`  
**Smoke:** `npm run smoke:m8`

## Decisions

| Decision | Choice |
|----------|--------|
| Card PANs | **Never stored** — PSP method refs only (`tok_*`) |
| Wave 1 provider | `dev_stub` default; Harden H1 adds `paystack` (see `31_M8_HARDEN_NOTES.md`) |
| Pay timing | **Pay-on-confirm** (charge succeeds → job CONFIRMED) |
| Webhooks | Idempotent on `(provider, provider_event_id)` |
| Driver share | 75% of quote total into pending earning line (placeholder) |
| COD / Bitcoin | Still out of scope |

## Done gate

- [x] Pay-on-confirm via provider abstraction  
- [x] Idempotent webhook handler  
- [x] Refund/credit with audit + authority roles  
- [x] Earning lines + payout batch with freeze flag  
- [x] No PAN fields anywhere  

## API surface

| Method | Path | Notes |
|--------|------|-------|
| POST | `/v1/jobs/:id/confirm` | Optional `{ methodRef }`; charges then confirms |
| GET | `/v1/jobs/:id/payments` | List payment rows |
| POST | `/v1/payments/webhooks/dev_stub` | Idempotent webhook |
| POST | `/v1/jobs/:id/refunds` | Finance/admin/support |
| POST | `/v1/finance/earnings/:jobId/assign-driver` | Bind driver before payout |
| POST | `/v1/finance/earnings/:jobId/freeze` | Hold from payout |
| POST | `/v1/finance/payout-batches` | Bundle pending earnings |
| POST | `/v1/finance/payout-batches/:id/execute` | Mark paid |

## Switching to Paystack (Harden H1)

Set `PSP_PROVIDER=paystack` plus `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` (sandbox `sk_test_…`).  
Confirm with `AUTH_…` or a verified transaction reference; or `POST /v1/jobs/:id/payments/initialize` then webhook/confirm.  
Live keys require `PAYSTACK_LIVE_ENABLED=true`.
