# M8b — Admin Portal (Implementation Notes)

**Status:** WAVE-1 DELIVERED  
**Depends on:** M0, M1, M3 catalogue · Design `23_M8B_ADMIN_DESIGN.md` (**APPROVED** 2026-07-23)  
**UI:** `platform/apps/admin-console/` → **http://localhost:5177**  
**Smoke:** `npm run smoke:m8b`  
**Run:** `npm run console:admin`  
**Migration:** `0008_m8b_admin.sql`

## Done gate (Wave-1)

- [x] Admin home (config health + recent audit)  
- [x] Staff & roles (grant/revoke; last-admin guard)  
- [x] Feature flags (seeded; audited toggles)  
- [x] Zones CRUD (codes — no polygons)  
- [x] Service types toggle/edit  
- [x] Reason codes catalogue  
- [x] Pricing params (thin read)  
- [x] Prohibited goods list  
- [x] Audit search  
- [x] Break-glass stub (≤30 min)  
- [x] Kill switches respected: `booking_enabled`, `dispatch_offers_enabled`, `support_refunds_enabled`

## Screen map

| Atlas | Wave-1 |
|-------|--------|
| SC-AD-001 | Home |
| SC-AD-002 | Staff & roles |
| SC-AD-003 | Feature flags |
| SC-AD-004 | Zones (codes) |
| SC-AD-005 | Service types |
| SC-AD-006 | Reason codes |
| SC-AD-007 | Pricing params (thin) |
| SC-AD-008 | Prohibited goods |
| SC-AD-011 | Audit search |
| SC-AD-013 | Break-glass stub |

Deferred: polygons, notification templates, org accounts, audit packs, API keys.

## Ports

| App | URL |
|-----|-----|
| Dispatch | :5173 |
| Driver | :5174 |
| Customer | :5175 |
| Support | :5176 |
| Admin | :5177 |

## Sign-in

`admin@swift.local` (or any email) — local login grants `administrator` via `/v1/dev/assign-role`. MFA required.
