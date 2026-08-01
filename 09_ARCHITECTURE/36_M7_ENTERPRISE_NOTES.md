# M7 Enterprise — Implementation Notes

**Status:** E0–E6 DELIVERED (2026-07-27)  
**Design:** `35_M7_ENTERPRISE_DESIGN.md` (APPROVED TO BUILD)

| Slice | Outcome | Status |
|-------|---------|--------|
| **E0** | Schema + Admin create org + invite Org Admin + portal shell | **Done** |
| **E1** | Portal login · home · sites · users | **Done** |
| **E2** | Book single-stop · list · detail | **Done** |
| **E3** | Approval queue | **Done** |
| **E4** | Weekly statement invoices | **Done** |
| **E5** | API keys thin | **Done** |
| **E6 / M7a** | Multi-stop warehouse runs | **Done** |

## E0 delivered

- Migration `0016_m7_organisations` — `organisations`, `org_memberships`, `org_sites`
- API: `GET/POST /v1/admin/orgs`, `GET/PATCH /v1/admin/orgs/:id`, `POST .../invite`
- Admin → People → **Organisations**
- App shell: `platform/apps/enterprise-portal`

## E1 delivered

- Portal OTP login → `/v1/enterprise/session`
- Home stats · Sites CRUD (admin/booker) · People list + invite (org_admin)
- Header `x-org-id` for tenant scope
- App: `npm run console:enterprise` (port 5182)

## E2 delivered

- `jobs.org_id` set on enterprise create
- Statement orgs confirm without card (`paymentStatus: invoiced`)
- Portal **Ship**: list + draft → quote → confirm
- APIs: `/v1/enterprise/jobs`, `.../quote`, `.../confirm`, `/v1/enterprise/catalog`

## E3 delivered

- Job state `PENDING_APPROVAL` when quote ≥ `organisations.approval_threshold_cents`
- Confirm returns `needsApproval: true` until approver finishes
- APIs: `GET /v1/enterprise/approvals`, `POST .../jobs/:id/approve|reject`, `PATCH /v1/enterprise/settings`
- Portal **Approvals**: queue + threshold (rands → cents) for Org Admin

## E4 delivered

- Migration `0017_m7_e3_e6` — `org_invoices`, `org_invoice_lines`
- `POST /v1/enterprise/statements/generate` (weekly) · list · detail with CSV body
- Portal **Billing**: generate + download CSV

## E5 delivered

- Table `org_api_keys` — create (secret once) · list · revoke
- APIs: `/v1/enterprise/api-keys`
- Portal **Keys**

## E6 delivered

- Table `job_stops` · `POST /v1/enterprise/jobs/multi-stop` · `GET .../stops`
- Copy: **your stop order** (no smart reordering)
- Portal Ship multi-stop: addresses one per line → quote → confirm
- **Stop order map**: Ship → View stop order map (Leaflet / OSM). Pins follow booker order; zone centroids for Cape Town pilot zones — not address geocoding, not optimiser

## Local verify

1. API on `:3000` (migrate + `node dist/server.js`)
2. Portal: http://localhost:5182 — login as invited org email (e.g. `ops@vuush.local`)
3. Set approval threshold on Approvals, ship over it → Sent for approval → Approve
4. Billing → Generate statement (statement pay-mode org with invoiced jobs)
5. Keys → Create / Revoke
6. Ship → Multi-stop with ≥2 addresses

## Production

- Portal: https://vuush-enterprise.vercel.app (`VITE_API_BASE_URL` → Railway)
- API: https://vuush-production.up.railway.app (migrate on deploy via Dockerfile)
- Marketing Enterprise CTA → `vuush-enterprise.vercel.app`

## How companies get in (B2B)

1. Company **Applies** on Enterprise (details + password + one email verify)
2. Org stays `pending_review` — no portal access yet
3. Admin → Organisations → **Approve** (email sent) or **Reject**
4. User signs in with work email + password — **no MFA**
5. Admin can still **Create organisation** + invite after a contract

Public legacy `/v1/enterprise/signup` stays closed.  
Password policy: 12+ with upper/lower/number/symbol (see `37_AUTH_ARCHITECTURE.md`).  
**Passwords cannot be viewed** (hashed). Admin → Reset password issues a temporary password once.
