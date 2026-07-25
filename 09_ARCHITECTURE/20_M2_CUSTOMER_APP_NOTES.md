# M2 — Customer App (Implementation Notes)

**Status:** WAVE-1 DELIVERED  
**Depends on:** M1, M3, M5 (projection), M8 (pay-on-confirm)  
**UI:** `platform/apps/customer-app/` → **http://localhost:5175**  
**Smoke:** `npm run smoke:m2`  
**Run:** `npm run console:customer` (API on `:3000`)

## Done gate (Wave-1)

- [x] OTP sign-in  
- [x] Home CTA + active jobs  
- [x] Book route → package → quote → pay/confirm (dev_stub)  
- [x] Track with honest projection (no fake motion copy)  
- [x] Destination change request (`MUTATION_PENDING` hold)  
- [x] Support case entry (audit-backed until M8a)  
- [x] Activity list + profile shell  

## Screen map (Atlas SC-CU-*)

| Atlas | Wave-1 coverage |
|-------|-----------------|
| SC-CU-001–003 | Splash / sign-in / OTP |
| SC-CU-004 | Home |
| SC-CU-005–010 | Book + quote + confirm |
| SC-CU-011–012 | Track + degraded messaging |
| SC-CU-015–016 | Mutation request (pending hold) |
| SC-CU-017 | Cancel (early states) |
| SC-CU-018–019 | Activity / detail via track |
| SC-CU-021 | Support hub entry |
| SC-CU-023 | Profile shell |

Deferred: saved addresses, recipient inbound view, rating, commercial mutation delta UX.  
Support thread: upgraded with M8a (`21_M8A_SUPPORT_NOTES.md`).

## APIs added

| Method | Path |
|--------|------|
| POST | `/v1/jobs/:id/mutations` |
| POST | `/v1/support/cases` |

## Ports

| App | URL |
|-----|-----|
| Dispatch | http://localhost:5173 |
| Driver | http://localhost:5174 |
| Customer | http://localhost:5175 |
