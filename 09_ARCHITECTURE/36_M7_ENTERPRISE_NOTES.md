# M7 Enterprise — Implementation Notes

**Status:** E0–E1 DELIVERED (2026-07-26)  
**Design:** `35_M7_ENTERPRISE_DESIGN.md` (APPROVED TO BUILD)

| Slice | Outcome | Status |
|-------|---------|--------|
| **E0** | Schema + Admin create org + invite Org Admin + portal shell | **Done** |
| **E1** | Portal login · home · sites · users | **Done** |
| **E2** | Book single-stop · list · detail | |
| **E3** | Approval queue | |
| **E4** | Weekly statement invoices | |
| **E5** | API keys thin | |
| **E6 / M7a** | Multi-stop warehouse runs | |

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
