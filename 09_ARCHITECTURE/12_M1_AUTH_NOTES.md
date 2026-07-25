# M1 — Authentication & Identity (Implementation Notes)

**Status:** DELIVERED (local) — 2026-07-20  
**Depends on:** M0 complete  
**Code:** `platform/src/modules/identity/`

## Scope delivered in M1

| Capability | Approach |
|------------|----------|
| Customer / driver login | OTP to phone or email |
| Sessions | Opaque access + refresh tokens (hashed at rest); revocable |
| Roles | `role_bindings` table (Phase 3 role names) |
| Staff MFA | TOTP after OTP for privileged roles once enrolled |
| Dev OTP | Code logged + returned only when `NODE_ENV=development` |
| SMS/Email provider | Stub notifier (console); real CPaaS later |

## Done gate

- [x] Request + verify OTP  
- [x] Refresh + logout (revoke)  
- [x] `GET /v1/me`  
- [x] Role-guarded sample route (`/v1/admin/ping`)  
- [x] Audit events on auth actions  
- [x] Local smoke (`npm run smoke:m1`)  
- [ ] Production SMS/email provider (deferred)  
- [ ] Enterprise org membership (PR24 — with M7)

## Amendment

Auth channel providers and token lifetimes may change only via Atlas amendment + founder approval.
