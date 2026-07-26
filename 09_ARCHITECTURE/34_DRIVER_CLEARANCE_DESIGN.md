# Driver Clearance & Account Approval · Design

**VUUSH · Project Atlas**  
**Status:** APPROVED TO BUILD — password at sign-up + Admin approve + marketing landing (2026-07-26)  
**Date:** 2026-07-26  
**Why:** Drivers must not work until licence, insurance, and required permits are reviewed and cleared.

---

## 1. Plain English

A new driver **applies**.  
They upload **documents**.  
**You review** (screen check + clearance).  
Only then you **Approve**.  
Until Approved, they **cannot** go on duty or take jobs.

This is **not** the full Fleet Dashboard (Wave-3).  
This is a beachhead **Driver Clearance** desk inside Admin + Driver app apply flow.

---

## 2. Problem today

| Today | Gap |
|-------|-----|
| Email + OTP login | Anyone can sign in |
| No application queue | No review step |
| Doc statuses shown, uploads deferred | Cannot prove licence / insurance |
| No Approve / Reject | Ops cannot gate supply |

---

## 3. Locked goals (propose)

1. Driver creates an account and submits required docs.  
2. Account stays **Pending** until Admin approves.  
3. Admin can see docs, run a simple clearance checklist, **Approve** or **Reject**.  
4. Only **Approved** + non-expired critical docs → duty / offers.  
5. Every decision is audited (who approved, when, reason).

---

## 4. Driver statuses

| Status | Meaning | Can go on duty? |
|--------|---------|-----------------|
| `draft` | Started apply, not submitted | No |
| `pending_review` | Submitted — waiting on Ops | No |
| `needs_more_info` | Ops asked for fixes / new scans | No |
| `approved` | Cleared to work | Yes (if docs still valid) |
| `rejected` | Not accepted | No |
| `suspended` | Was approved; pulled offline | No |

---

## 5. Documents (beachhead minimum)

| Doc | Required for beachhead? | Notes |
|-----|-------------------------|--------|
| Driver licence (photo / PDF) | **Yes** | Front (+ back if SA dual-side) |
| Vehicle / public liability insurance | **Yes** | Policy doc or certificate |
| Vehicle registration / permit | **If city requires** | Flag per city config |
| Profile photo | Recommended | Public driver card |
| **Vehicle photo (live camera)** | **Yes** | Must be taken in-app at signup — no gallery / old uploads |
| ID / police clearance | **Optional Wave-1** → can be Wave-1.1 | Add when legal ops ready |

Each doc has: file, expiry date (if any), status `missing | uploaded | approved | rejected | expired`.

---

## 6. Screens

### Driver app
| Screen | Purpose |
|--------|---------|
| Apply / Sign up | Name, phone, email, password (or OTP — lock below) |
| Upload docs | Licence, insurance, permit |
| Application status | Pending / Needs info / Approved / Rejected |
| Login gate | Pending users see “We’re reviewing you” — no duty |

### Admin (People → Drivers)
| Screen | Purpose |
|--------|---------|
| Applications queue | Pending first |
| Driver detail | Profile + docs viewer + checklist |
| Decision | Approve / Reject / Request more info + reason |

---

## 7. Clearance checklist (Ops)

Before Approve, Admin ticks (stored on decision):

- [ ] Licence valid and matches name  
- [ ] Insurance valid for vehicle / work type  
- [ ] Permit OK for city (or N/A)  
- [ ] Vehicle details match  
- [ ] Screen check / call done (manual note)  
- [ ] No obvious fraud / mismatch  

No automatic government API in beachhead — **human clearance**.

---

## 8. Login — LOCKED (2026-07-26)

**Locked: email + password at sign-up + Admin approval.**  
OTP only to **verify email** at sign-up, and for **forgot password**.

| Step | What happens |
|------|----------------|
| 1 | Driver enters email + creates **password** |
| 2 | OTP to email → confirm email is real |
| 3 | Upload licence / insurance / permit |
| 4 | Status `pending_review` — **no duty / no jobs** |
| 5 | Admin clearance → **Approve** / **Reject** / needs info |
| 6 | Day-to-day login: **email + password** |
| 7 | Forgot password: OTP → set new password |

**Still gated:** Approved + valid docs before duty.  
Staff (Admin / Dispatch / Support) keep MFA.

---

## 9. Out of scope (later)

- Full Fleet Dashboard (W3)  
- Play Store native shell (separate)  
- Automatic police/traffic API verification  
- Multi-fleet partner orgs  
- Invoices / Enterprise  

---

## 10. Build slices (after approval)

| Slice | Deliverable |
|-------|-------------|
| **D0** | Design approved + locks |
| **D1** | Driver status + Admin queue (Approve / Reject) |
| **D2** | Doc upload storage + viewer |
| **D3** | Duty/offers blocked unless `approved` + docs OK |
| **D4** | Expiry warnings + auto-suspend on expired critical docs |

---

## 11. Approval locks

| Lock | Decision |
|------|----------|
| Login | **Email + password at sign-up** ✓ locked 2026-07-26 |
| Email proof | OTP at sign-up + forgot-password ✓ |
| Approval gate | **Required** before duty/jobs ✓ |
| Docs | Licence + insurance + permit-if-needed ✓ |
| Build when | **Now** ✓ 2026-07-26 |
| First screen | Marketing landing → CTA “Become a driver” → Sign up ✓ |

### First-open UX (locked)

1. Open Driver portal → **landing** (slogan + “Become a driver” / “Sign in”)  
2. Sign up → email + password → OTP verify email  
3. Upload docs (licence, insurance, permit-if-needed)  
4. Pending until Admin approves  
5. Approved → normal driver home / duty  

---

**End of Driver Clearance design (DRAFT)**
