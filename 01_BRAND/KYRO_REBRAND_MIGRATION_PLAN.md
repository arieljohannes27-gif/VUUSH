# KYRO Rebrand — Migration Plan

**Status:** CANCELLED — keep **VUUSH**  
**Decision:** Do **not** rename to KYRO (name conflict with existing kyro.ai construction product)  
**Principle:** Public brand remains VUUSH. This plan is retained only as history.

---

## 1. Guiding rules

1. Change what people **see and read** first.  
2. Do **not** rename technical or infrastructure identifiers unless required for the brand to work.  
3. If a rename adds risk without customer value, **leave it** and document it.  
4. Design language stays: calm, premium, precise, minimal, enterprise-grade.  
5. Existing SWIFT token/package layer stays (already deferred once during VUUSH surface brand).

---

## 2. Inventory summary

| Layer | What we found |
|-------|----------------|
| **Cosmetic** | Wordmarks, browser titles, marketing site, empty/onboarding copy in all apps |
| **Product** | OTP email subject/body, TOTP issuer `VUUSH`, Paystack payout reasons, catalogue seed names, temp password prefix |
| **Technical** | `vuush.*` localStorage keys, `@vuush.local` email aliases, `vuush_` API key prefix, health `vuush-platform` |
| **Infrastructure** | GitHub `VUUSH`, Vercel `vuush-*` projects/URLs, Railway hostname docs, CORS examples |
| **Deep legacy** | `@swift/*` packages, `--swift-*` CSS tokens, DB `swift_platform` — **out of scope for this rebrand** |

Logo mark remains a CSS square (no separate favicon/logo asset pack).

---

## 3. Category A — Cosmetic branding (CHANGE)

Customer- and staff-facing identity.

| Item | Where (examples) | Action |
|------|------------------|--------|
| Wordmark “VUUSH” | Each app `BrandLockup` / lockup in `App.tsx` | → **KYRO** |
| Browser titles | All `platform/apps/*/index.html` | → KYRO / KYRO Dispatch / etc. |
| Marketing hero, nav, footer, CTAs | `marketing-site` | → KYRO |
| Empty / join / clearance copy | Driver, Admin, Dispatch MFA hints | → KYRO |
| Meta description | Marketing `index.html` | → KYRO |
| Careers email display | Marketing (`hello@vuush.app`) | → KYRO domain when owned; else placeholder env |

**Out of this slice:** new logo illustration system (optional later). Keep The Point square mark; only the word changes unless new assets are supplied.

---

## 4. Category B — Product branding (CHANGE)

Messages users receive outside the chrome.

| Item | Where | Action |
|------|--------|--------|
| OTP subject/body | `identity/otp-delivery.ts` | → KYRO |
| OTP from display name | Railway `OTP_EMAIL_FROM` | → `KYRO <…>` / `onboarding@resend.dev` with KYRO name |
| TOTP issuer | `identity/service.ts` `otpauth://…issuer=VUUSH` | → **KYRO** for new enrollments |
| MFA UI copy | Dispatch (and staff apps) | → KYRO |
| Paystack payout reason strings | `payments/*` | → KYRO |
| New catalogue seed names | `booking/service.ts` (empty DB only) | → KYRO Standard / Priority |
| Temp password prefix | `enterprise/service.ts` `Vuush-…` | → `Kyro-…` for **new** temps |
| API root display name | `app.ts` `"VUUSH Platform"` | → `"KYRO Platform"` |

**Note:** Existing authenticator enrollments under issuer VUUSH keep working until users re-enroll. Document that.

---

## 5. Category C — Technical identifiers (MOSTLY LEAVE)

| Item | Recommendation | Why |
|------|----------------|-----|
| `@swift/*` packages & Vite aliases | **Leave** | Breaks imports/locks |
| `--swift-*` CSS / design tokens | **Leave** | Huge blast radius; semantic `--color-*` already used |
| `SwiftMap` / `[swift-nav]` | **Leave** | Internal |
| DB `swift_platform`, Docker user `swift` | **Leave** | Breaks local + Railway `DATABASE_URL` |
| Env **names** (`CORS_ORIGINS`, `OTP_EMAIL_FROM`, …) | **Leave** | No brand need |
| `vuush.*` localStorage keys | **Dual-read then migrate** | Write `kyro.*`, fall back to `vuush.*` one release |
| `@vuush.local` email alias | **Add `@kyro.local`**, keep vuush + swift aliases | Avoid breaking dogfood accounts |
| New org API keys `vuush_` prefix | **New keys → `kyro_`**; old keys untouched | Compatibility |
| Health `service: "vuush-platform"` | **Optional later** | Only if monitors depend on it — document if left |

---

## 6. Category D — Infrastructure identifiers (LEAVE UNLESS CUTOVER PLANNED)

| Item | Recommendation |
|------|----------------|
| GitHub repo `VUUSH` | **Leave** for this phase (rename is a separate ops project) |
| Vercel project slugs `vuush`, `vuush-dispatch`, … | **Leave** URLs; update **visible** marketing links via env where possible |
| Railway hostname `vuush-production.up.railway.app` | **Leave** until custom domain |
| CORS origin list values | Update only when URLs actually change |
| Supabase | **N/A** — stack is Postgres on Railway, not Supabase Auth |

Custom domain `kyro.app` (or similar) is a **later** DNS + Vercel + CORS + Resend domain project — not part of the code surface pass.

---

## 7. Handbook & brand docs

| Priority | Action |
|----------|--------|
| High | Add this plan + short “Public brand is KYRO” lock note under `01_BRAND/` |
| Medium | Update root `README.md` and go-live checklists after apps ship |
| Low / later | Full rewrite of `00_FOUNDATION` and all SWIFT-era architecture markdown |

Do **not** rewrite ~900 markdown files in the first implementation pass.

---

## 8. Implementation phases (after approval)

### Phase 0 — Approval gate
- Approve this plan.  
- Confirm TOTP issuer change for new enrollments is accepted.  
- Confirm no Vercel/GitHub rename in this pass.

### Phase 1 — API product strings
- OTP copy, TOTP issuer, Paystack reasons, API display name, seed names, temp password prefix.  
- Email aliases: `@kyro.local` + keep `@vuush.local` + `@swift.local`.  
- Deploy API first.

### Phase 2 — App cosmetics (order)
1. Marketing  
2. Dispatch  
3. Driver  
4. Customer  
5. Admin  
6. Enterprise  
7. Support  

Per app: wordmark, title, user-facing copy, localStorage dual-read.

### Phase 3 — Ops config
- Railway `OTP_EMAIL_FROM` display name → KYRO.  
- Resend templates if any.  
- Marketing env URLs (no forced project rename).

### Phase 4 — QA audit
- No visible VUUSH in UI of shipped apps.  
- Builds / typecheck green.  
- Auth, maps, queue, portals still work.  
- Document intentional leftovers (list below).

### Phase 5 — Later (separate programme)
- Custom domain  
- Vercel project renames  
- GitHub rename  
- Optional SWIFT token/package rename  

---

## 9. Explicit “do not rename” list (this programme)

- `@swift/platform`, `@swift/*-app`, `@swift/design-system`, `@swift/maps`  
- `--swift-*` design tokens and Tailwind `swift` palette keys  
- Database name `swift_platform` / Docker postgres role  
- Environment variable **names**  
- GitHub repository name `VUUSH`  
- Existing Vercel project slugs and Railway hostname  
- Already-issued `vuush_…` API keys  
- Historical DB rows (service type names already seeded)

---

## 10. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Staff logged out after storage key change | Dual-read `vuush.*` → write `kyro.*` |
| Authenticator still shows VUUSH | Expected for old enrollments; new issuer = KYRO |
| Marketing links break | Prefer env vars; don’t rename Vercel projects yet |
| Global replace breaks SWIFT layer | Forbidden — scoped PRs only |
| Catalogue still says VUUSH in prod DB | Update seed for new envs; optional Admin rename later |

---

## 11. Success criteria

- Product feels “always KYRO” in UI, email, and new MFA enrollments.  
- No functional regression on auth, apps, maps, queue, APIs, DB.  
- Leftover VUUSH/SWIFT technical names are **documented**, not accidental.  
- Design language unchanged.

---

## 12. Approval / cancellation

Plan was briefly approved, then **cancelled** after discovering KYRO is already used by an AI construction product.  
**Public brand: VUUSH.** Do not implement this plan.
