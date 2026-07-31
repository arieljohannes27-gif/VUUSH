# Wave 2 Finance — Implementation Notes

**Status:** F0–F9 DELIVERED (2026-07-30)  
**Design:** `38_WAVE2_FINANCE_DESIGN.md` (APPROVED TO BUILD)  
**Code:** `platform/src/modules/finance/` · Admin → **Finance** · migration `0019_wave2_finance`  
**Smoke:** `npm run smoke:finance`

| Slice | Outcome | Status |
|-------|---------|--------|
| **F0** | Finance nav + `finance_officer` / admin gate | **Done** |
| **F1** | Home queues + payments list | **Done** |
| **F2** | Job ledger (org id shown) | **Done** |
| **F3** | Payout detail (Harden polish kept) | **Done** |
| **F4** | Adjustments threshold queue | **Done** |
| **F5** | Statements + credit notes | **Done** |
| **F6** | Manual reconcile | **Done** |
| **F7** | Exports zip | **Done** |
| **F8** | Audit packs zip | **Done** |
| **F9** | `smoke:finance` | **Done** |

## APIs

- `GET /v1/finance/home`
- `GET /v1/finance/payments`
- `GET|POST /v1/finance/statements` · `POST .../generate`
- `GET|POST /v1/finance/credit-notes`
- `GET /v1/finance/adjustments` · `POST .../approve|reject`
- `GET|POST /v1/finance/reconcile` · `POST .../match|waive`
- `POST /v1/finance/exports` (zip)
- `GET|POST /v1/admin/audit-packs` · `GET .../:id/download`

Support / job refunds above `finance_credit_approve_above_cents` (default R500) return `needs_finance_approval`.

## Local verify

1. Migrate + API on `:3000`
2. Admin → Finance → Home
3. `npm run smoke:finance`

## Gate unlocked next

Wave E e-hailing design may open only after founder accepts Finance DoD in production/sandbox. See `39_WAVE_EHAILING_PARKED.md`.
