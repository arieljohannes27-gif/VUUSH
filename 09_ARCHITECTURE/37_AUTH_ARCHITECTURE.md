# VUUSH Authentication Architecture

**Status:** In progress (2026-08-01)  
**Scope:** Admin · Dispatch · Enterprise · Driver · Customer

## What was wrong

| Problem | Why it mattered |
|---------|-----------------|
| Different login modes per app (OTP vs password vs MFA) | Unpredictable production behaviour |
| Staff password login skipped MFA | Security hole |
| Customer OTP-only; Enterprise invite-only vs apply | Policy drift |
| Min 8 passwords, no complexity | Too weak for commercial use |
| No self-serve password reset for Driver/Customer | Ops burden; blocked drivers |
| Tokens only in localStorage; logout not server-side | Sessions live after “sign out” |
| Raw `snake_case` API errors in UI | Looks broken |
| Duplicated login clients in every app | Inconsistent fixes |

## Target policy (locked)

| App | Sign-in | MFA | Registration |
|-----|---------|-----|--------------|
| **Admin** | Email + password | **Required** (authenticator) | Staff provisioned only |
| **Dispatch** | Email + password | **Required** (authenticator) | Staff provisioned only |
| **Enterprise** | Work email (or username) + password | **None** | Apply → Admin approve/reject → email → login |
| **Driver** | Phone or email + password | **None** | Docs + verify once → Admin approve → password login; self-serve reset |
| **Customer** | Email or phone + password | **None** | Register + verify once → password login; self-serve reset |

OTP/email codes are for **verification and recovery only**, not every login (except staff MFA recover).

## Password policy (all apps)

- Minimum **12** characters  
- Uppercase, lowercase, number, special character  
- Strength meter in UI  
- Never email passwords; never expose hashes  
- Legacy short passwords: allowed to **log in** until next reset/change, then must meet policy

## Account status

`pending` · `approved`/`active` · `rejected` · `suspended` · `disabled` · `blocked`

Login must refuse non-active accounts with a clear message.

## Shared service

One identity module (`platform/src/modules/identity/`) owns:

- password verify / set / reset  
- MFA tickets (staff only)  
- OTP (verify / recover)  
- sessions (create, refresh, revoke, revoke-all)  
- friendly error codes + messages  
- audit events  

Frontends share `@vuush/auth` helpers (messages, password strength, session helpers).

## Phases

| Phase | Status |
|-------|--------|
| 0 Safety (MFA bypass fix, friendly errors) | **Done** |
| 1 Policy + password reset API + status map | **Done** |
| 2 Staff email+password+MFA (Admin) | **In progress** (password primary; OTP fallback; Dispatch still OTP-primary) |
| 3 Enterprise apply → Admin → login | **Done** (UI + API + approval email) |
| 4 Driver phone/email + recovery | **Partial** (API login accepts phone; reset API ready; UI recovery pending) |
| 5 Customer password migration | **Done** (register/login/reset UI + API) |
| 6 Cookies / logout-everywhere / trusted devices | **Partial** (`/v1/auth/logout-all` exists; cookies not yet) |

### Still open for production cutover

- Dispatch console password+MFA UI (mirror Admin)
- Driver Forgot password UI + phone login field
- Migrate OTP-only customers via “set password” prompt
- Staff without `passwordHash` must use email-code fallback once, then set password
- HttpOnly secure cookies (replace localStorage tokens)
- Redeploy API (Railway) + all frontends (Vercel)
