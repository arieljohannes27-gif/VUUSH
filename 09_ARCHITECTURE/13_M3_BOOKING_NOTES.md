# M3 — Booking Engine (Implementation Notes)

**Status:** DELIVERED (local) — 2026-07-20  
**Depends on:** M0, M1  
**Code:** `platform/src/modules/booking/`

## Scope

| Capability | Approach |
|------------|----------|
| Job spine | States: DRAFT → QUOTED → CONFIRMED/SCHEDULED / CANCELLED (later states in M4+) |
| Quotes | Persisted components + 15m TTL |
| Pricing | Rule engine: base + distance + package + tier |
| Serviceability | Zone codes (minimal config until M8b Admin) |
| Declarations | Prohibited-goods attestation required |
| Auth | Customer (or admin) owns jobs |
| Payments | Confirm charges via M8 (`paymentStatus=captured` on success) |

## Done gate

- [x] Create draft job  
- [x] Generate quote with components  
- [x] Confirm creates CONFIRMED/SCHEDULED + audit  
- [x] Illegal transitions rejected  
- [x] List/get own jobs  
- [x] Seed catalogue (placeholder Cape Town zones — beachhead still founder-locked)

## Note

Full Admin zone editor is M8b. M3 ships **seed zones/service types** so booking is testable now.  
Seed city is a **placeholder** until you formally lock beachhead geography.
