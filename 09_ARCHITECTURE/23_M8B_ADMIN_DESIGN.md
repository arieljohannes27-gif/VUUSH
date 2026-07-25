# M8b — Admin Portal (Minimum) · Design

**SWIFT Technologies · Project Atlas · Official Architecture**  
**Status:** APPROVED  
**Approved:** 2026-07-23  
**Module:** M8b (Phase 10)  
**Depends on:** M0, M1 · catalogue seeds (M3) · audit events · DS v1 (`22_SWIFT_DESIGN_SYSTEM_V1.md`)  
**Users:** U09 Administrator (founder-as-admin in solo mode)  
**Phase gate:** Design locked. Implementation in `platform/` (Admin console :5177).

---

## 0. Executive position

Admin is the **configurator and access steward**, not a second Dispatch or Support desk.

> A city must be configurable without a code deploy for common toggles.  
> Every privileged change must be auditable.  
> Admin never silently rewrites job history.

Wave-1 Admin **min** closes the Phase 10 RC gap: *zones, flags, reason codes* (+ staff roles + audit search). Full enterprise Admin (orgs, API keys, audit packs) stays Wave-2.

### Board challenges

| Temptation | Verdict | Why |
|------------|---------|-----|
| God-mode “edit any job / wipe audit” | **Reject** | Kills PR25 and enterprise trust |
| Shared Admin login | **Reject** | Owner threat map #1 |
| Build full GIS polygon editor now | **Defer** | Codes + city + active unlock booking; polygons later |
| Admin as backup dispatcher | **Reject** | U-D6 — use Dispatch |
| Silent flag flips in production | **Reject** | Require reason note + audit |

---

## 1. Product promise (Wave-1)

| Promise | Meaning |
|---------|---------|
| Configure without deploy | Zones, service types, flags, reason codes editable in UI |
| Staff hygiene | Grant/revoke roles; see MFA status; no shared accounts |
| Audit findability | Search recent config + privileged actions |
| Safe defaults | Danger actions behind confirm + reason; break-glass time-bound stub |
| Honest density | Dense tables OK; DS v1 white/silver/blue — no large blue slabs |

**Done when (Atlas):** *City can be configured without code deploy for common toggles.*

---

## 2. Screen map (Atlas SC-AD-* → Wave-1)

| ID | Screen | Wave-1 | Notes |
|----|--------|--------|-------|
| SC-AD-001 | Admin home | **In** | Config health cards; shortcuts; “what’s live” |
| SC-AD-002 | Staff users & roles | **In** | List users with staff roles; assign/revoke `dispatcher`, `support_agent`, `administrator`, `operations_manager` |
| SC-AD-003 | Feature flags | **In** | Key/value booleans + optional string; city-scoped later |
| SC-AD-004 | Zones / serviceability | **In (codes)** | CRUD code, name, city, active — **no polygon map** in min |
| SC-AD-005 | Service types & tiers | **In** | Edit catalogue rows (fees, multiplier, active) |
| SC-AD-006 | Reason codes | **In** | Catalogue by domain (dispatch, support, cancel, hold, emergency) |
| SC-AD-007 | Pricing parameters | **Thin** | Floors / currency defaults as flags or `pricing_params` rows — not a full pricing studio |
| SC-AD-008 | Prohibited goods | **Thin** | Editable policy list (text items) used by booking declarations later |
| SC-AD-009 | Notification templates | **Defer W1.1** | Keep seeded copy until Support macros mature |
| SC-AD-010 | Org accounts | **W2** | Enterprise |
| SC-AD-011 | Audit search | **In** | Filter by action, actor, subject, time |
| SC-AD-012 | Audit pack | **W2** | Evidence packs |
| SC-AD-013 | Break-glass | **Stub** | UI + time-bound session intent; limited actions; heavy warn |
| SC-AD-014 | API keys | **W2** | Enterprise integrations |

---

## 3. Information architecture

```
Admin (:5177)
├── Home
├── Access
│   └── Staff & roles
├── Catalogue
│   ├── Zones
│   ├── Service types
│   └── Reason codes
├── Controls
│   ├── Feature flags
│   ├── Pricing parameters (thin)
│   └── Prohibited goods (thin)
├── Audit
│   └── Search
└── Safety
    └── Break-glass (stub)
```

**Layout:** TopBar (SWIFT · Admin) + left nav (~240–280px) + dense main. DS v1 Inter, radius 16px controls, tables with hairline rows.

**Port:** `http://localhost:5177` · `npm run console:admin`

---

## 4. Interaction principles

1. **One primary action per panel** — Save / Activate / Grant.  
2. **Every mutating save asks for a short reason** (stored on audit `reasonCode` / note).  
3. **Deactivate > delete** for zones, service types, reason codes (preserve history).  
4. **Cannot remove your own last `administrator` role** (lockout guard).  
5. **MFA:** Admin login follows staff MFA path (same as Dispatch/Support).  
6. **No job assignment, refunds, or case reply** in Admin — deep-link to Dispatch/Support if needed.  
7. **Read-only job peek** optional later; not Wave-1 min.

---

## 5. Data design (new / extended)

Existing: `zones`, `service_types`, `users`, `user_roles`, `audit_events`.

| Entity | Purpose |
|--------|---------|
| `feature_flags` | `key` unique, `enabled` bool, `value` text null, `description`, `updated_at`, `updated_by` |
| `reason_codes` | `code` unique, `domain`, `label`, `active`, `severity` (ops/safety) |
| `pricing_params` | `key` unique, `value_json`, `description` (floors, currency) |
| `prohibited_goods` | `id`, `label`, `active`, `sort_order` |
| *(optional)* `break_glass_sessions` | `user_id`, `reason`, `expires_at`, `ended_at` |

**Audit actions (examples):**  
`FLAG_UPDATED` · `ZONE_UPSERTED` · `SERVICE_TYPE_UPSERTED` · `REASON_CODE_UPSERTED` · `ROLE_GRANTED` · `ROLE_REVOKED` · `PRICING_PARAM_UPDATED` · `BREAK_GLASS_OPENED` · `BREAK_GLASS_CLOSED`

Config rows are not rewritten silently — prefer upsert + audit payload `{ before, after }`.

---

## 6. API surface (proposed)

All under `requireRoles("administrator")` (+ MFA session as for other staff).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/admin/home` | Counts: zones active, flags, open break-glass, recent audits |
| GET/PATCH | `/v1/admin/flags` · `/v1/admin/flags/:key` | List / update flag |
| GET/POST/PATCH | `/v1/admin/zones` · `/:id` | List / create / update (deactivate) |
| GET/POST/PATCH | `/v1/admin/service-types` · `/:id` | Catalogue |
| GET/POST/PATCH | `/v1/admin/reason-codes` · `/:id` | Catalogue |
| GET/PATCH | `/v1/admin/pricing-params` · `/:key` | Thin pricing |
| GET/POST/PATCH | `/v1/admin/prohibited-goods` | Policy list |
| GET | `/v1/admin/staff` | Users with staff roles + MFA flag |
| POST | `/v1/admin/staff/:userId/roles` | Grant role + reason |
| DELETE | `/v1/admin/staff/:userId/roles/:role` | Revoke + reason |
| GET | `/v1/admin/audit` | Search `audit_events` (q, action, from, to, limit) |
| POST | `/v1/admin/break-glass` | Open stub session |
| POST | `/v1/admin/break-glass/:id/close` | Close |

Dev helper (local only): seed admin role for `admin@swift.local` via existing `/v1/dev/assign-role`.

---

## 7. Feature flag starter set (Wave-1)

| Key | Default | Meaning |
|-----|---------|---------|
| `cod_enabled` | `false` | Cash on delivery — stay off (RM-A6) |
| `booking_enabled` | `true` | Kill switch for new bookings |
| `dispatch_offers_enabled` | `true` | Pause new offers |
| `support_refunds_enabled` | `true` | Gate Support refund button |
| `driver_emergency_enabled` | `true` | Emergency stub visibility |
| `city_live` | `false` | Public “live city” claim — Ops flip only when RC met |

Apps **read** flags where cheap (booking confirm, assign, refund). Missing flag = safe default above.

---

## 8. Reason code domains (Wave-1)

| Domain | Examples (seed) |
|--------|-----------------|
| `dispatch` | `ops_override`, `reassign_capacity`, `backup_custody` |
| `hold` | `DISPATCH_HOLD`, `INCIDENT_HOLD`, `PAYMENT_HOLD` |
| `cancel` | `customer_cancel`, `undeliverable`, `prohibited_goods` |
| `support` | `goodwill_credit`, `claim_opened`, `escalated_dispatch` |
| `emergency` | `emergency_medical`, `emergency_threat`, `emergency_accident` |
| `offer` | `driver_declined`, `offer_timeout` |

Dispatch/Support UIs may keep free-text reasons short-term but **prefer catalogue codes** once Admin ships.

---

## 9. Security & threat alignment

| Control | Wave-1 |
|---------|--------|
| Role | `administrator` only for Admin app APIs |
| MFA | Required for Admin (same staff path) |
| Audit | All CFG mutations |
| Break-glass | Stub: reason + expiry ≤ 30 min; no PII export yet |
| Self-lockout | Block revoking last active administrator |
| Impersonation | **Out** of Wave-1 |
| Shared passwords | Forbidden (process + unique logins) |

---

## 10. UX / Design System application

- **Density:** Admin = denser (tables, compact rows) per DS §9  
- **Colour:** 70/20/10 — blue only for primary Save / Grant  
- **Danger:** Deactivate / Break-glass / Revoke admin → danger button + modal  
- **Empty states:** “No flags yet — seed defaults” with one CTA  
- **Home:** 4–6 health tiles max — not a dashboard theatre  

Wireframe intent (Home):

```
[ SWIFT  Admin ]                    admin@…  [Refresh]
Zones 12 active · Flags OK · MFA staff 3/3 · Audit 24h

[ Access ]  [ Catalogue ]  [ Controls ]  [ Audit ]
```

---

## 11. Out of scope (explicit)

- Map polygon drawing / GIS  
- Full pricing studio / surge engine  
- Notification template WYSIWYG  
- Enterprise org lifecycle  
- Audit evidence pack PDF  
- Platform API keys  
- Job/dispatch mutation from Admin  
- AI config  
- Dark mode  

---

## 12. Implementation sketch (after approval)

1. Migration `0008_m8b_admin.sql` — flags, reason_codes, pricing_params, prohibited_goods (+ optional break_glass)  
2. Seed defaults + promote existing zones/service_types  
3. `platform/src/modules/admin/` routes + service  
4. `platform/apps/admin-console` Vite app :5177  
5. Wire booking/dispatch/support to read critical flags  
6. `npm run smoke:m8b` + notes → `24_M8B_ADMIN_NOTES.md` (implementation)

---

## 13. Decisions

| ID | Decision |
|----|----------|
| AD-D1 | Admin = configurator; no dispatch/support actions in-app |
| AD-D2 | Wave-1 zones = codes + metadata, not polygons |
| AD-D3 | Deactivate over hard delete for catalogue |
| AD-D4 | All CFG mutations require reason + audit |
| AD-D5 | Feature flags with safe defaults; `city_live` false until RC |
| AD-D6 | Break-glass is a warned stub, not full PII export |
| AD-D7 | Port 5177; role `administrator` |
| AD-D8 | DS v1 tokens; denser layout |

---

## 14. Risks

| Risk | Mitigation |
|------|------------|
| Founder uses Admin to “fix” production jobs | No job write APIs; training + UI copy |
| Bad flag kills city | Confirm modal; audit; quick revert |
| Role lockout | Last-admin guard |
| Scope creep to full Admin | W2 list locked above |
| Flags ignored by apps | Smoke asserts booking/assign/refund respect kill switches |

---

## 15. Assumptions

| # | Assumption |
|---|------------|
| AD-A1 | Solo founder holds `administrator` + MFA |
| AD-A2 | Beachhead = one city; multi-city flags later |
| AD-A3 | Existing seeded zones/service types remain source until first Admin edit |
| AD-A4 | Notification templates stay code-seeded through W1 min |

---

## 16. Approval gate

Reply with one of:

- `APPROVE M8B` — proceed to implement Wave-1 Admin console  
- `APPROVE M8B WITH AMENDMENTS: …` — adjust design then implement  
- `REVISE: …` — redesign before code  

---

**End of M8b Admin Portal (Minimum) Design**
